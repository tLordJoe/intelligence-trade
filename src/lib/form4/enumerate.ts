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

export type IndexAvailability = "available" | "unavailable" | "malformed";

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

/** An index we could not retrieve. Distinct from one that legitimately held nothing. */
export function unavailableIndex(url: string, date: string, detail: string): IndexResult {
  return { url, date, availability: "unavailable", detail, entries: [], matchedLines: 0 };
}

export interface EnumerationSummary {
  requestedDates: string[];
  availableDates: string[];
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

  return {
    entries,
    summary: {
      requestedDates: results.map((r) => r.date),
      availableDates: by("available"),
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
