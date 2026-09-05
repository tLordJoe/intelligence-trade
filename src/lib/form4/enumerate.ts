/**
 * Enumeration from official SEC indexes.
 *
 * Replaces per-issuer Atom-feed enumeration. The feed answered "what did this
 * company file", which is a different question from "what was filed", and it
 * could not distinguish an empty result from a feed that failed to return one.
 * The daily and quarterly form indexes are the authoritative list, and their
 * availability is observable.
 *
 * Two distinctions the previous approach could not make, and this one must:
 *
 *   An index that could not be retrieved is **incomplete**, not empty. A run
 *   over a window containing an unavailable index has not seen that day, and
 *   must say so rather than reporting zero filings.
 *
 *   The same filing appears in the index once per associated CIK. Accession is
 *   the deduplication key; a filing listed under an issuer and an owner is one
 *   filing.
 */

/** `edgar/data/1770787/0001610717-26-000396.txt` */
const FILE_NAME_RE = /edgar\/data\/(\d+)\/(\d{10}-\d{2}-\d{6})\.txt/;

/** Exactly the forms this pipeline supports. Prefix matching would catch 4-01 and friends. */
const SUPPORTED_FORM_TYPES = new Set(["4", "4/A"]);

export interface IndexEntry {
  formType: "4" | "4/A";
  companyName: string;
  cik: string;
  filedDate: string;
  accessionNumber: string;
  /** Directory holding the filing's documents. */
  archiveDir: string;
  indexHeaderUrl: string;
}

/**
 * What we found when we looked for a date's index.
 *
 * `expected_non_filing` is the state that keeps a routine window from blocking:
 * EDGAR publishes no daily index on weekends or federal holidays, so their
 * absence is the calendar working, not a gap in what we saw. A *business day*
 * with no index is `unavailable` and does block — that is a day we should have
 * seen and did not.
 */
export type IndexAvailability =
  | "available"
  | "expected_non_filing"
  | "unavailable"
  | "malformed";

export interface IndexResult {
  url: string;
  date: string;
  availability: IndexAvailability;
  /** Why an index is not `available`. Null when it is. */
  detail: string | null;
  entries: IndexEntry[];
  /** Total lines matching a supported form, before accession de-duplication. */
  matchedLines: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** The `n`th `weekday` of a month, 1-indexed. Weekday 0 is Sunday. */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return iso(year, month, 1 + offset + (n - 1) * 7);
}

/** The last `weekday` of a month. */
function lastWeekdayOfMonth(year: number, month: number, weekday: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return iso(year, month, last.getUTCDate() - offset);
}

/**
 * A fixed-date holiday, shifted to the day it is observed.
 *
 * A Saturday holiday is observed the preceding Friday and a Sunday holiday the
 * following Monday, and it is the *observed* day on which markets and EDGAR are
 * closed. Independence Day 2026 falls on a Saturday, so 3 July is the closure.
 */
function observed(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  if (weekday === 6) date.setUTCDate(date.getUTCDate() - 1);
  if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * US federal holidays, which are the days EDGAR does not publish an index.
 *
 * Computed rather than tabulated so the calendar does not expire. Good Friday
 * is deliberately absent: markets close but EDGAR does publish, so treating it
 * as a non-filing day would hide a genuinely missing index.
 */
export function federalHolidays(year: number): string[] {
  return [
    observed(year, 1, 1),                        // New Year's Day
    nthWeekdayOfMonth(year, 1, 1, 3),            // Martin Luther King Jr. Day
    nthWeekdayOfMonth(year, 2, 1, 3),            // Washington's Birthday
    lastWeekdayOfMonth(year, 5, 1),              // Memorial Day
    observed(year, 6, 19),                       // Juneteenth
    observed(year, 7, 4),                        // Independence Day
    nthWeekdayOfMonth(year, 9, 1, 1),            // Labor Day
    nthWeekdayOfMonth(year, 10, 1, 2),           // Columbus Day
    observed(year, 11, 11),                      // Veterans Day
    nthWeekdayOfMonth(year, 11, 4, 4),           // Thanksgiving
    observed(year, 12, 25),                      // Christmas Day
  ].sort();
}

export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function isFederalHoliday(date: string): boolean {
  return federalHolidays(Number(date.slice(0, 4))).includes(date);
}

/**
 * Whether an index should exist for this date.
 *
 * The whole point of the distinction: a run over Friday–Monday covers two days
 * with no index and must still pass, while a Tuesday with no index must not.
 */
export function isExpectedFilingDay(date: string): boolean {
  return !isWeekend(date) && !isFederalHoliday(date);
}

export function quarterOf(date: string): number {
  const month = Number(date.slice(5, 7));
  return Math.floor((month - 1) / 3) + 1;
}

/** `https://www.sec.gov/Archives/edgar/daily-index/2026/QTR3/form.20260903.idx` */
export function dailyIndexUrl(date: string): string {
  const compact = date.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/daily-index/${date.slice(0, 4)}/QTR${quarterOf(date)}/form.${compact}.idx`;
}

/** `https://www.sec.gov/Archives/edgar/full-index/2026/QTR3/form.idx` */
export function quarterlyIndexUrl(year: number, quarter: number): string {
  return `https://www.sec.gov/Archives/edgar/full-index/${year}/QTR${quarter}/form.idx`;
}

/** Inclusive list of calendar dates. Weekends are included and simply have no index. */
export function datesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`invalid date range ${from}..${to}`);
  }
  if (start > end) throw new Error(`range start ${from} is after end ${to}`);
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    dates.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  return dates;
}

/**
 * Parse a form index.
 *
 * Columns are whitespace-aligned rather than delimited, so fields are split on
 * runs of two or more spaces: a company name contains single spaces, and
 * splitting on any whitespace would shred it.
 */
export function parseFormIndex(body: string, url: string, date: string): IndexResult {
  const lines = body.split(/\r?\n/);

  // A real index carries this header. Its absence means we fetched something
  // else — an error page, a redirect — and must not read zero filings from it.
  const looksLikeIndex = lines
    .slice(0, 12)
    .some((l) => /Form Type/i.test(l) || /EDGAR/i.test(l));
  if (!looksLikeIndex) {
    return {
      url, date, availability: "malformed",
      detail: "response does not look like an EDGAR form index",
      entries: [], matchedLines: 0,
    };
  }

  const entries: IndexEntry[] = [];
  const seenAccessions = new Set<string>();
  let matchedLines = 0;

  for (const line of lines) {
    if (!line.trim() || line.startsWith("-")) continue;
    const fields = line.trim().split(/\s{2,}/);
    if (fields.length < 5) continue;

    const [formType, companyName, cik, filedDate, fileName] = fields;
    if (!SUPPORTED_FORM_TYPES.has(formType)) continue;
    matchedLines += 1;

    const match = fileName.match(FILE_NAME_RE);
    if (!match) continue;
    const [, fileCik, accessionNumber] = match;

    // One filing, listed once per associated CIK.
    if (seenAccessions.has(accessionNumber)) continue;
    seenAccessions.add(accessionNumber);

    const noDashes = accessionNumber.replace(/-/g, "");
    entries.push({
      formType: formType as "4" | "4/A",
      companyName,
      cik: cik.padStart(10, "0"),
      filedDate: `${filedDate.slice(0, 4)}-${filedDate.slice(4, 6)}-${filedDate.slice(6, 8)}`,
      accessionNumber,
      archiveDir: `https://www.sec.gov/Archives/edgar/data/${fileCik}/${noDashes}`,
      indexHeaderUrl: `https://www.sec.gov/Archives/edgar/data/${fileCik}/${noDashes}/${accessionNumber}-index.htm`,
    });
  }

  return { url, date, availability: "available", detail: null, entries, matchedLines };
}

/**
 * An index we could not retrieve.
 *
 * Classified by the calendar rather than by the error: EDGAR returns the same
 * 403 for a Saturday and for a Tuesday whose index has not been published yet,
 * so the response cannot tell them apart and the date has to.
 */
export function unavailableIndex(url: string, date: string, detail: string): IndexResult {
  const expected = isExpectedFilingDay(date);
  return {
    url,
    date,
    availability: expected ? "unavailable" : "expected_non_filing",
    detail: expected
      ? detail
      : `${isWeekend(date) ? "weekend" : "federal holiday"} — no index expected (${detail})`,
    entries: [],
    matchedLines: 0,
  };
}

export interface EnumerationSummary {
  requestedDates: string[];
  availableDates: string[];
  /** Weekends and federal holidays. Absent by design, not a gap. */
  expectedNonFilingDates: string[];
  /** Business days whose index we should have seen and did not. */
  unavailableDates: string[];
  malformedDates: string[];
  /** True only when every requested date was retrieved. */
  complete: boolean;
  totalMatchedLines: number;
  uniqueAccessions: number;
}

/**
 * Fold per-index results into one selection.
 *
 * `complete` is the field that matters downstream: a window containing an
 * unavailable index has not been fully seen, and nothing may describe its
 * output as the filings for that period.
 */
export function summarizeEnumeration(results: IndexResult[]): {
  entries: IndexEntry[];
  summary: EnumerationSummary;
} {
  const entries: IndexEntry[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    for (const entry of result.entries) {
      if (seen.has(entry.accessionNumber)) continue;
      seen.add(entry.accessionNumber);
      entries.push(entry);
    }
  }

  const by = (state: IndexAvailability) =>
    results.filter((r) => r.availability === state).map((r) => r.date);

  const unavailableDates = by("unavailable");
  const malformedDates = by("malformed");
  const expectedNonFilingDates = by("expected_non_filing");

  return {
    entries,
    summary: {
      requestedDates: results.map((r) => r.date),
      availableDates: by("available"),
      expectedNonFilingDates,
      unavailableDates,
      malformedDates,
      complete: unavailableDates.length === 0 && malformedDates.length === 0,
      totalMatchedLines: results.reduce((n, r) => n + r.matchedLines, 0),
      uniqueAccessions: entries.length,
    },
  };
}

/**
 * Optional issuer narrowing, applied *after* enumeration.
 *
 * Filtering during enumeration would make an issuer-shaped hole look like an
 * empty market. Enumerate everything, record what was seen, then narrow.
 */
export function filterByIssuerCik(entries: IndexEntry[], ciks: string[]): IndexEntry[] {
  if (ciks.length === 0) return entries;
  const wanted = new Set(ciks.map((c) => c.replace(/\D/g, "").padStart(10, "0")));
  return entries.filter((e) => wanted.has(e.cik));
}
