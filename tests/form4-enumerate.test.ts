import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  dailyIndexUrl, datesInRange, federalHolidays, filterByIssuerCik,
  isExpectedFilingDay, isFederalHoliday, isWeekend, parseFormIndex,
  quarterlyIndexUrl, quarterOf, summarizeEnumeration, unavailableIndex,
} from "../src/lib/form4/enumerate.ts";
import { mergeCandidate, readCandidate, EMPTY_CANDIDATE } from "../src/lib/form4/merge.ts";
import type { CandidateArchive } from "../src/lib/form4/merge.ts";
import type { Form4Filing } from "../src/lib/form4/types.ts";

/**
 * Enumeration from official SEC indexes, and append-only candidate merging.
 *
 * The index fixture is a trimmed copy of the real
 * `daily-index/2026/QTR3/form.20260903.idx`, keeping its header, a mix of other
 * form types, thirteen Form 4s, six 4/As, and one accession repeated under a
 * second CIK exactly as EDGAR emits it.
 */

const INDEX = readFileSync(
  join(import.meta.dirname, "fixtures", "form4", "indexes", "form.20260903.sample.idx"),
  "utf8"
);

const parsed = () => parseFormIndex(INDEX, dailyIndexUrl("2026-09-03"), "2026-09-03");

// --- index URLs and ranges ----------------------------------------------------

test("index URLs follow the published EDGAR layout", () => {
  assert.equal(
    dailyIndexUrl("2026-09-03"),
    "https://www.sec.gov/Archives/edgar/daily-index/2026/QTR3/form.20260903.idx"
  );
  assert.equal(
    quarterlyIndexUrl(2026, 1),
    "https://www.sec.gov/Archives/edgar/full-index/2026/QTR1/form.idx"
  );
  assert.deepEqual(
    ["2026-01-15", "2026-04-01", "2026-07-31", "2026-12-31"].map(quarterOf),
    [1, 2, 3, 4]
  );
});

test("a date range is inclusive and rejects an inverted window", () => {
  assert.deepEqual(datesInRange("2026-09-01", "2026-09-03"), [
    "2026-09-01", "2026-09-02", "2026-09-03",
  ]);
  assert.equal(datesInRange("2026-09-03", "2026-09-03").length, 1);
  assert.throws(() => datesInRange("2026-09-05", "2026-09-01"), /after end/);
  assert.throws(() => datesInRange("not-a-date", "2026-09-01"), /invalid date range/);
});

// --- parsing an index ---------------------------------------------------------

test("only exact form types 4 and 4/A are enumerated", () => {
  const result = parsed();
  assert.equal(result.availability, "available");
  assert.ok(result.entries.length > 0);
  for (const entry of result.entries) {
    assert.ok(["4", "4/A"].includes(entry.formType), `unexpected ${entry.formType}`);
  }
  // The fixture deliberately contains 1-A, 8-K, 3 and 5 lines.
  assert.ok(/^1-A/m.test(INDEX), "fixture must contain other form types");
  assert.ok(!result.entries.some((e) => (e.formType as string) === "3"));
  assert.ok(!result.entries.some((e) => (e.formType as string) === "5"));
});

test("regression: one filing listed under two CIKs is enumerated once", () => {
  const result = parsed();
  const accessions = result.entries.map((e) => e.accessionNumber);
  assert.equal(new Set(accessions).size, accessions.length, "accession is the dedup key");
  assert.ok(
    result.matchedLines > result.entries.length,
    "the fixture contains a repeated accession, so matched lines exceed unique filings"
  );
});

test("company names containing spaces survive column splitting", () => {
  const result = parsed();
  const multiWord = result.entries.filter((e) => e.companyName.includes(" "));
  assert.ok(multiWord.length > 0, "names are split on runs of spaces, not single ones");
  for (const entry of result.entries) {
    assert.ok(entry.companyName.trim().length > 0);
    assert.doesNotMatch(entry.companyName, /^\d+$/, "the CIK column must not land in the name");
  }
});

test("each entry carries the identifiers needed to fetch it", () => {
  for (const entry of parsed().entries) {
    assert.match(entry.accessionNumber, /^\d{10}-\d{2}-\d{6}$/);
    assert.match(entry.cik, /^\d{10}$/);
    assert.match(entry.filedDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(entry.archiveDir.startsWith("https://www.sec.gov/Archives/edgar/data/"));
    assert.ok(entry.indexHeaderUrl.endsWith("-index.htm"));
  }
});

// --- unavailable is not empty --------------------------------------------------

test("regression: a missing business-day index is not a zero-filing day", () => {
  // Thursday 2026-09-10 — a business day whose index we should have seen.
  const missing = unavailableIndex(dailyIndexUrl("2026-09-10"), "2026-09-10", "403 Forbidden");
  assert.equal(missing.availability, "unavailable");
  assert.deepEqual(missing.entries, []);
  assert.match(missing.detail ?? "", /403/);

  const { summary } = summarizeEnumeration([parsed(), missing]);
  assert.equal(summary.complete, false, "a window with a missing index is not complete");
  assert.deepEqual(summary.unavailableDates, ["2026-09-10"]);
  assert.deepEqual(summary.availableDates, ["2026-09-03"]);
});

test("a legitimately empty index is complete, and distinguishable from a missing one", () => {
  // A real index header with no Form 4 lines: the day happened, nothing was filed.
  const emptyDay = parseFormIndex(
    INDEX.split("\n").slice(0, 11).join("\n"),
    dailyIndexUrl("2026-09-06"),
    "2026-09-06"
  );
  assert.equal(emptyDay.availability, "available");
  assert.deepEqual(emptyDay.entries, []);

  const { summary } = summarizeEnumeration([emptyDay]);
  assert.equal(summary.complete, true, "seeing an empty day is completeness, not a gap");
  assert.equal(summary.uniqueAccessions, 0);
  assert.deepEqual(summary.unavailableDates, []);
});

test("a response that is not an index is malformed, never read as empty", () => {
  for (const body of ["<html><body>Access Denied</body></html>", "", "  "]) {
    const result = parseFormIndex(body, "https://www.sec.gov/Archives/x.idx", "2026-09-03");
    assert.equal(result.availability, "malformed", `${body.slice(0, 20)} must not read as empty`);
    assert.deepEqual(result.entries, []);
  }
  const { summary } = summarizeEnumeration([
    parseFormIndex("<html>nope</html>", "u", "2026-09-04"),
  ]);
  assert.equal(summary.complete, false);
  assert.deepEqual(summary.malformedDates, ["2026-09-04"]);
});

// --- issuer filtering happens after enumeration -------------------------------

test("issuer filtering narrows the enumerated set rather than the enumeration", () => {
  const all = parsed().entries;
  const target = all[0];

  const narrowed = filterByIssuerCik(all, [target.cik]);
  assert.ok(narrowed.length >= 1);
  assert.ok(narrowed.every((e) => e.cik === target.cik));

  assert.equal(filterByIssuerCik(all, []).length, all.length, "no filter means no narrowing");
  assert.equal(filterByIssuerCik(all, ["0000000001"]).length, 0, "an absent issuer yields nothing");
  // Unpadded input still matches.
  assert.equal(
    filterByIssuerCik(all, [String(Number(target.cik))]).length,
    narrowed.length,
    "CIKs are compared zero-padded"
  );
});

// --- append-only candidate merging ---------------------------------------------

function filing(accession: string, hash: string, over: Partial<Form4Filing> = {}): Form4Filing {
  return {
    id: `${accession}::${hash}`, source: "sec-form4", accessionNumber: accession,
    documentType: "4", sourceSchemaVersion: "X0609",
    indexUrl: "https://www.sec.gov/Archives/i.htm",
    documentUrl: "https://www.sec.gov/Archives/d.xml",
    documentName: "d.xml", documentSha256: hash, rawArtifactPath: null,
    issuer: { cik: "0000123456", name: "Test", tradingSymbol: "TST", resolvedTicker: null, tickerResolution: "unresolved", tickerResolutionSource: null },
    reportingOwners: [], periodOfReport: { value: null, raw: null, reason: null, footnoteIds: [] },
    dateOfOriginalSubmission: { value: null, raw: null, reason: null, footnoteIds: [] },
    timestamps: {
      filedDate: { value: null, raw: null, reason: null, footnoteIds: [] },
      acceptedAt: { value: null, raw: null, reason: null, footnoteIds: [] },
      acceptedAtSource: null,
      publiclyAvailableAt: { value: null, raw: null, reason: null, footnoteIds: [] },
      firstObservedAt: "2026-09-01T00:00:00.000Z", lastObservedAt: "2026-09-01T00:00:00.000Z",
      observationMode: "backfill",
    },
    aff10b5OneRaw: null, aff10b5One: null, notSubjectToSection16: null,
    footnotes: {}, remarks: null, rows: [], amendment: null,
    parserVersion: 1, schemaVersion: 1, importRunId: "run_a",
    warnings: [], validation: "valid",
    ...over,
  } as Form4Filing;
}

const archiveOf = (...f: Form4Filing[]): CandidateArchive => ({
  schemaVersion: 1, updatedAt: "2026-09-01T00:00:00.000Z", runIds: ["run_a"], filings: f,
});

test("regression: a bounded run does not replace a wider archive with its own window", () => {
  // The defect: promotion used to write the run's selection over the file, so a
  // one-issuer week would erase everything collected before it.
  const prior = archiveOf(
    filing("0000000001-26-000001", "h1"),
    filing("0000000002-26-000002", "h2"),
    filing("0000000003-26-000003", "h3")
  );
  const thisRun = [filing("0000000004-26-000004", "h4")];

  const result = mergeCandidate(prior, thisRun, "run_b", "2026-09-04T00:00:00.000Z");

  assert.equal(result.archive.filings.length, 4, "prior filings are carried forward");
  assert.equal(result.addedFilings, 1);
  assert.deepEqual(result.lostAccessions, [], "nothing may be lost");
  assert.equal(result.untouchedAccessions.length, 3, "and untouched history is counted");
  for (const accession of ["0000000001-26-000001", "0000000002-26-000002", "0000000003-26-000003"]) {
    assert.ok(result.archive.filings.some((f) => f.accessionNumber === accession), accession);
  }
});

test("re-running the identical window adds nothing and preserves first sighting", () => {
  const first = filing("0000000001-26-000001", "h1");
  const prior = archiveOf(first);

  const result = mergeCandidate(prior, [
    filing("0000000001-26-000001", "h1", {
      timestamps: { ...first.timestamps, firstObservedAt: "2027-01-01T00:00:00.000Z" },
    }),
  ], "run_b", "2026-09-04T00:00:00.000Z");

  assert.equal(result.archive.filings.length, 1, "no duplicate");
  assert.equal(result.addedFilings, 0);
  assert.equal(result.refreshedFilings, 1);
  assert.equal(
    result.archive.filings[0].timestamps.firstObservedAt,
    "2026-09-01T00:00:00.000Z",
    "first sighting is never rewritten by a later run"
  );
  assert.equal(result.archive.filings[0].timestamps.lastObservedAt, "2026-09-04T00:00:00.000Z");
});

test("revised source bytes are archived alongside, never over, the version we hold", () => {
  const prior = archiveOf(filing("0000000001-26-000001", "hashOLD"));
  const result = mergeCandidate(prior, [filing("0000000001-26-000001", "hashNEW")], "run_b", "now");

  assert.equal(result.archive.filings.length, 2, "both document versions are retained");
  assert.equal(result.addedDocumentVersions, 1);
  assert.equal(result.addedFilings, 0, "it is not a new filing, it is a new version");
  assert.deepEqual(result.sourceRevisedAccessions, ["0000000001-26-000001"]);
  assert.deepEqual(result.lostAccessions, []);
  const hashes = result.archive.filings.map((f) => f.documentSha256).sort();
  assert.deepEqual(hashes, ["hashNEW", "hashOLD"]);
});

test("merging into an empty archive is an ordinary first run", () => {
  const result = mergeCandidate({ ...EMPTY_CANDIDATE }, [filing("0000000001-26-000001", "h1")], "run_a", "now");
  assert.equal(result.archive.filings.length, 1);
  assert.equal(result.addedFilings, 1);
  assert.deepEqual(result.lostAccessions, []);
  assert.deepEqual(result.archive.runIds, ["run_a"]);
});

test("run ids accumulate so the archive records who contributed", () => {
  let archive = mergeCandidate({ ...EMPTY_CANDIDATE }, [filing("a-26-000001", "h1")], "run_a", "t1").archive;
  archive = mergeCandidate(archive, [filing("b-26-000002", "h2")], "run_b", "t2").archive;
  assert.deepEqual(archive.runIds, ["run_a", "run_b"]);
});

test("a corrupt candidate file is refused rather than silently restarted from empty", () => {
  // Starting from empty would turn one bad file into a total archive loss on the
  // next promotion.
  assert.throws(() => readCandidate("{ not json"), /Unexpected|JSON/);
  assert.throws(() => readCandidate('{"filings":"nope"}'), /refusing to overwrite/);
  assert.throws(() => readCandidate("null"), /refusing to overwrite/);
  assert.deepEqual(readCandidate(null).filings, [], "an absent file is simply empty");
});

test("output ordering is deterministic, so the file does not churn between runs", () => {
  const a = mergeCandidate({ ...EMPTY_CANDIDATE }, [
    filing("0000000002-26-000002", "h2"), filing("0000000001-26-000001", "h1"),
  ], "r", "t").archive;
  const b = mergeCandidate({ ...EMPTY_CANDIDATE }, [
    filing("0000000001-26-000001", "h1"), filing("0000000002-26-000002", "h2"),
  ], "r", "t").archive;
  assert.deepEqual(a.filings.map((f) => f.id), b.filings.map((f) => f.id));
});

// --- weekends and federal holidays ---------------------------------------------

/**
 * Expected non-filing days must not block a run; a business day we should have
 * seen and did not still must.
 *
 * This is a real defect being pinned, not a hypothetical: the first version
 * blocked a live run on 2026-09-05 — a Saturday — and reported it as a missing
 * index. EDGAR returns the same 403 for a weekend and for a business day whose
 * index has not published, so the response cannot tell them apart. The calendar
 * has to.
 */

test("federal holidays are computed, including observance shifts", () => {
  const y2026 = federalHolidays(2026);

  assert.ok(y2026.includes("2026-01-01"), "New Year's Day");
  assert.ok(y2026.includes("2026-01-19"), "MLK Day, third Monday");
  assert.ok(y2026.includes("2026-02-16"), "Washington's Birthday, third Monday");
  assert.ok(y2026.includes("2026-05-25"), "Memorial Day, last Monday");
  assert.ok(y2026.includes("2026-09-07"), "Labor Day, first Monday");
  assert.ok(y2026.includes("2026-11-26"), "Thanksgiving, fourth Thursday");
  assert.equal(y2026.length, 11, "eleven federal holidays");

  // Independence Day 2026 falls on a Saturday, so the observed closure is the
  // preceding Friday. Treating the 4th itself as the holiday would leave the
  // 3rd looking like a missing business day.
  assert.ok(y2026.includes("2026-07-03"), "Independence Day observed on Friday 3 July");
  assert.ok(!y2026.includes("2026-07-04"));

  // A Sunday holiday shifts forward instead.
  assert.ok(federalHolidays(2027).includes("2027-12-24"), "Christmas 2027 observed Friday");
  assert.ok(federalHolidays(2022).includes("2022-06-20"), "Juneteenth 2022 observed Monday");
});

test("weekends and holidays are not expected filing days; business days are", () => {
  assert.equal(isWeekend("2026-09-05"), true, "Saturday");
  assert.equal(isWeekend("2026-09-06"), true, "Sunday");
  assert.equal(isWeekend("2026-09-04"), false, "Friday");

  assert.equal(isFederalHoliday("2026-09-07"), true, "Labor Day");
  assert.equal(isFederalHoliday("2026-09-08"), false, "the Tuesday after");

  assert.equal(isExpectedFilingDay("2026-09-04"), true, "Friday");
  assert.equal(isExpectedFilingDay("2026-09-05"), false, "Saturday");
  assert.equal(isExpectedFilingDay("2026-09-07"), false, "Labor Day");
  assert.equal(isExpectedFilingDay("2026-09-08"), true, "Tuesday");
});

test("regression: a weekend with no index does not block the run", () => {
  const saturday = unavailableIndex(dailyIndexUrl("2026-09-05"), "2026-09-05", "403 Forbidden");
  const sunday = unavailableIndex(dailyIndexUrl("2026-09-06"), "2026-09-06", "403 Forbidden");

  assert.equal(saturday.availability, "expected_non_filing");
  assert.equal(sunday.availability, "expected_non_filing");
  assert.match(saturday.detail ?? "", /weekend/);

  const { summary } = summarizeEnumeration([parsed(), saturday, sunday]);
  assert.equal(summary.complete, true, "a weekend is the calendar, not a gap");
  assert.deepEqual(summary.unavailableDates, []);
  assert.deepEqual(summary.expectedNonFilingDates, ["2026-09-05", "2026-09-06"]);
});

test("regression: a federal holiday with no index does not block the run", () => {
  const laborDay = unavailableIndex(dailyIndexUrl("2026-09-07"), "2026-09-07", "403 Forbidden");
  assert.equal(laborDay.availability, "expected_non_filing");
  assert.match(laborDay.detail ?? "", /holiday/);

  const { summary } = summarizeEnumeration([parsed(), laborDay]);
  assert.equal(summary.complete, true);
  assert.deepEqual(summary.expectedNonFilingDates, ["2026-09-07"]);
});

test("a missing business-day index still blocks, in the same window as a weekend", () => {
  // The case that matters: the run must not become permissive just because it
  // learned to tolerate weekends.
  const tuesday = unavailableIndex(dailyIndexUrl("2026-09-08"), "2026-09-08", "403 Forbidden");
  const saturday = unavailableIndex(dailyIndexUrl("2026-09-05"), "2026-09-05", "403 Forbidden");

  const { summary } = summarizeEnumeration([parsed(), saturday, tuesday]);
  assert.equal(summary.complete, false, "one missing business day is enough to block");
  assert.deepEqual(summary.unavailableDates, ["2026-09-08"]);
  assert.deepEqual(summary.expectedNonFilingDates, ["2026-09-05"]);
});

test("a Friday-to-Monday window spanning a holiday weekend is complete", () => {
  // 2026-09-04 Friday · 05 Sat · 06 Sun · 07 Labor Day · 08 Tuesday.
  // Two business days present, three expected closures — this must pass.
  const dates = datesInRange("2026-09-04", "2026-09-08");
  assert.deepEqual(dates, [
    "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08",
  ]);

  const results = dates.map((date) =>
    isExpectedFilingDay(date)
      ? parseFormIndex(INDEX, dailyIndexUrl(date), date)
      : unavailableIndex(dailyIndexUrl(date), date, "403 Forbidden")
  );

  const { summary } = summarizeEnumeration(results);
  assert.equal(summary.complete, true, "a long weekend must not fail a routine run");
  assert.deepEqual(summary.availableDates, ["2026-09-04", "2026-09-08"]);
  assert.equal(summary.expectedNonFilingDates.length, 3);
  assert.deepEqual(summary.unavailableDates, []);
});

test("a business day that returns a malformed body still blocks", () => {
  // Tolerating closures must not extend to tolerating garbage on an open day.
  const results = [
    parseFormIndex("<html>Access Denied</html>", dailyIndexUrl("2026-09-08"), "2026-09-08"),
    unavailableIndex(dailyIndexUrl("2026-09-05"), "2026-09-05", "403"),
  ];
  const { summary } = summarizeEnumeration(results);
  assert.equal(summary.complete, false);
  assert.deepEqual(summary.malformedDates, ["2026-09-08"]);
});

test("a whole-week window over a normal week expects five indexes", () => {
  const dates = datesInRange("2026-09-14", "2026-09-20");
  const business = dates.filter(isExpectedFilingDay);
  assert.equal(business.length, 5, "Monday to Friday, no holiday that week");
  assert.deepEqual(dates.filter((d) => !isExpectedFilingDay(d)), ["2026-09-19", "2026-09-20"]);
});
