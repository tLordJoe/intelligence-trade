import assert from "node:assert/strict";
import test from "node:test";
import { assessRun } from "../src/lib/congress-gates.ts";
import { mergeRecords, diffRecords } from "../src/lib/congress-merge.ts";
import {
  emptyCounts,
  type DisclosureRecord,
  type ImportCounts,
} from "../src/lib/congress-schema.ts";
import { assignRowIds } from "../src/lib/congress-identity.ts";
import {
  filterByParty,
  normalizeParty,
  partyBreakdown,
  unknownPartyDisclosure,
} from "../src/lib/party-stats.ts";

/**
 * End-to-end behaviour of the pipeline under partial failure, plus the
 * consumer-facing guarantees around party attribution.
 *
 * The organizing principle: an unsafe run must exit non-zero and leave the
 * production archive untouched. "Nothing was written" is a correct outcome;
 * "wrote a smaller archive and reported success" is the failure this rebuild
 * exists to prevent.
 */

function makeRecord(
  docId: string,
  overrides: Partial<DisclosureRecord> = {}
): DisclosureRecord {
  const identity = assignRowIds(docId, [
    {
      issuerName: String(overrides.companyName ?? "NVIDIA Corporation"),
      tickerText: String(overrides.ticker ?? "NVDA"),
      typeText: "P",
      amountText: "$1,001 - $15,000",
      transactionDateText: "07/01/2026",
      ownerText: "SP",
    },
  ])[0];

  return {
    id: identity.id,
    idStrategy: "content-row",
    politician: "Jane Doe",
    party: "D",
    chamber: "House",
    state: "CA",
    district: "CA11",
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    type: "Buy",
    amount: "$1,001 - $15,000",
    amountLow: 1001,
    amountHigh: 15000,
    amountStatus: "disclosed_range",
    transactionDate: "2026-07-01",
    filedDate: "2026-08-05",
    isOptions: false,
    source: `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/${docId}.pdf`,
    raw: {
      issuerName: "NVIDIA Corporation",
      tickerText: "NVDA",
      amountText: "$1,001 - $15,000",
      typeText: "P",
      ownerText: "SP",
      transactionDateText: "07/01/2026",
      filedDateText: "08/05/2026",
    },
    provenance: {
      sourceChamber: "House",
      filingUrl: `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/${docId}.pdf`,
      docId,
      rowIndex: 0,
      contentHash: identity.contentHash,
      occurrence: identity.occurrence,
      reconciliationKey: identity.reconciliationKey,
      firstSeen: "2026-08-01T00:00:00.000Z",
      lastSeen: "2026-08-01T00:00:00.000Z",
      importRunId: "run_old",
      schemaVersion: 1,
    },
    status: "valid",
    warnings: [],
    tickerResolution: "verified",
    ...overrides,
  };
}

function healthyCounts(over: Partial<ImportCounts> = {}): ImportCounts {
  return {
    ...emptyCounts(),
    sourceFilings: 150,
    selectedFilings: 150,
    downloadedFilings: 150,
    parsedFilings: 150,
    parsedRecords: 400,
    accepted: 400,
    archiveBefore: 900,
    archiveAfter: 1000,
    ...over,
  };
}

// --- partial source failure -------------------------------------------------

test("e2e: only 1 of 150 filings downloads — run fails, archive untouched", () => {
  const counts = healthyCounts({
    selectedFilings: 150,
    downloadedFilings: 1,
    parsedFilings: 1,
    parsedRecords: 3,
    accepted: 3,
    archiveBefore: 900,
    archiveAfter: 903,
  });
  const result = assessRun({ counts, previousYieldPerFiling: 400 / 150 });
  assert.equal(result.passed, false, "must not publish a near-empty harvest");
  assert.ok(
    result.failures.some((f) => f.startsWith("download_completion_too_low")),
    `expected download completion failure, got ${result.failures.join(",")}`
  );
});

test("e2e: PDFs download but every one yields zero rows — run fails", () => {
  const counts = healthyCounts({
    downloadedFilings: 150,
    parsedFilings: 150,
    zeroRowFilings: 150,
    parsedRecords: 0,
    accepted: 0,
    archiveBefore: 900,
    archiveAfter: 900,
  });
  const result = assessRun({ counts, previousYieldPerFiling: 400 / 150 });
  assert.equal(result.passed, false);
  assert.ok(result.failures.includes("no_records_parsed"));
});

test("e2e: previously productive filings suddenly yield nothing — run fails", () => {
  const counts = healthyCounts({ parsedRecords: 380, accepted: 380 });
  const result = assessRun({
    counts,
    previousYieldPerFiling: 400 / 150,
    previouslyProductiveDocIds: new Set(["DOC1", "DOC2", "DOC3"]),
    zeroRowDocIds: ["DOC2", "DOC3"],
  });
  assert.equal(result.passed, false);
  assert.ok(
    result.failures.some((f) =>
      f.startsWith("previously_productive_filings_now_empty")
    ),
    `expected regression failure, got ${result.failures.join(",")}`
  );
});

test("e2e: a 20% decline in accepted records blocks the run", () => {
  // Append-only storage protects what is already held; it cannot notice that a
  // run failed to collect disclosures it should have collected.
  const counts = healthyCounts({
    parsedRecords: 320,
    accepted: 320,
    archiveBefore: 900,
    archiveAfter: 920,
  });
  const result = assessRun({ counts, previousYieldPerFiling: 400 / 150 });
  assert.equal(result.passed, false, "a 20% yield drop must block, not warn");
  assert.ok(
    result.failures.some((f) => f.startsWith("yield_far_below_previous_run"))
  );
});

test("a modest 12% dip warns rather than blocks", () => {
  const counts = healthyCounts({ parsedRecords: 352, accepted: 352 });
  const result = assessRun({ counts, previousYieldPerFiling: 400 / 150 });
  assert.equal(result.passed, true);
  assert.ok(result.warnings.some((w) => w.startsWith("yield_below_previous_run")));
});

test("a reviewed override converts a blocking drop into a recorded warning", () => {
  const counts = healthyCounts({ parsedRecords: 320, accepted: 320 });
  const result = assessRun({
    counts,
    previousYieldPerFiling: 400 / 150,
    allowCompletenessDrop: true,
  });
  assert.equal(result.passed, true);
  assert.ok(
    result.warnings.some((w) => w.includes("override_accepted")),
    "the override must be visible in the report, never silent"
  );
});

test("a healthy run passes cleanly", () => {
  const result = assessRun({ counts: healthyCounts(), previousYieldPerFiling: 400 / 150 });
  assert.equal(result.passed, true);
  assert.deepEqual(result.failures, []);
});

// --- revisions --------------------------------------------------------------

test("e2e: a parser improvement corrects a stored record and logs the change", () => {
  const stored = makeRecord("DOC1", {
    companyName: "Alphabet Inc. - Depositary Shares representing a 1/20th Inte",
    warnings: ["truncated_issuer_name"],
    status: "warning",
  });
  const reparsed: DisclosureRecord = {
    ...stored,
    companyName: "Alphabet Inc. - Depositary Shares representing a 1/20th Interest",
    warnings: [],
    status: "valid",
  };

  const result = mergeRecords([stored], [reparsed], "2026-08-21T00:00:00.000Z", "run_new");
  const merged = result.records[0];

  assert.equal(result.revised, 1);
  assert.equal(result.refreshed, 0);
  assert.equal(
    merged.companyName,
    "Alphabet Inc. - Depositary Shares representing a 1/20th Interest",
    "the correction must reach readers"
  );
  assert.equal(merged.status, "valid");
  assert.equal(merged.revisions?.length, 1);
  assert.ok(
    merged.revisions?.[0].changes.some((c) => c.field === "companyName"),
    "the change must be logged"
  );
});

test("a correction never rewrites raw values or firstSeen", () => {
  const stored = makeRecord("DOC1", { ticker: "CARR" });
  const reparsed: DisclosureRecord = { ...stored, ticker: "BRK-B" };

  const merged = mergeRecords(
    [stored],
    [reparsed],
    "2026-08-21T00:00:00.000Z",
    "run_new"
  ).records[0];

  assert.equal(merged.ticker, "BRK-B", "normalized value is corrected");
  assert.equal(merged.raw.tickerText, stored.raw.tickerText, "raw is immutable");
  assert.equal(
    merged.provenance.firstSeen,
    "2026-08-01T00:00:00.000Z",
    "firstSeen is immutable"
  );
  assert.equal(merged.provenance.lastSeen, "2026-08-21T00:00:00.000Z");
});

test("an unchanged re-parse refreshes without creating a revision", () => {
  const stored = makeRecord("DOC1");
  const result = mergeRecords(
    [stored],
    [{ ...stored }],
    "2026-08-21T00:00:00.000Z",
    "run_new"
  );
  assert.equal(result.refreshed, 1);
  assert.equal(result.revised, 0);
  assert.equal(result.records[0].revisions, undefined);
});

test("successive corrections accumulate in the revision log", () => {
  const v1 = makeRecord("DOC1", { companyName: "NVIDIA Corp" });
  const v2: DisclosureRecord = { ...v1, companyName: "NVIDIA Corporation" };
  const first = mergeRecords([v1], [v2], "2026-08-21T00:00:00.000Z", "run_a").records[0];
  const v3: DisclosureRecord = { ...first, companyName: "NVIDIA Corporation - Common Stock" };
  const second = mergeRecords([first], [v3], "2026-08-22T00:00:00.000Z", "run_b").records[0];

  assert.equal(second.revisions?.length, 2);
  assert.equal(second.revisions?.[0].importRunId, "run_a");
  assert.equal(second.revisions?.[1].importRunId, "run_b");
});

test("diffRecords ignores field ordering in warnings", () => {
  const a = makeRecord("DOC1", { warnings: ["unknown_party", "ticker_aliased"] });
  const b = makeRecord("DOC1", { warnings: ["ticker_aliased", "unknown_party"] });
  assert.deepEqual(diffRecords(a, b), []);
});

// --- party attribution ------------------------------------------------------

test("regression: unknown party is never counted as Democratic or Republican", () => {
  const records = [
    { party: "D" },
    { party: "D" },
    { party: "R" },
    { party: null },
    { party: "?" }, // the API's legacy substitution
    { party: undefined },
    { party: "" },
  ];
  const b = partyBreakdown(records);

  assert.equal(b.democrat, 2);
  assert.equal(b.republican, 1);
  assert.equal(b.unknown, 4);
  assert.equal(b.total, 7);
  assert.equal(
    b.democrat + b.republican + b.unknown,
    records.length,
    "every record must land in exactly one bucket"
  );
});

test("normalizeParty resolves every non-party value to unknown", () => {
  for (const value of [null, undefined, "?", "", "I", "Independent", "d"]) {
    assert.equal(normalizeParty(value as string), "unknown", String(value));
  }
  assert.equal(normalizeParty("D"), "D");
  assert.equal(normalizeParty("R"), "R");
});

test("filtering by party excludes unattributed records and unknown is reachable", () => {
  const records = [
    { id: 1, party: "D" },
    { id: 2, party: "R" },
    { id: 3, party: null },
    { id: 4, party: "?" },
  ];
  assert.deepEqual(filterByParty(records, "D").map((r) => r.id), [1]);
  assert.deepEqual(filterByParty(records, "R").map((r) => r.id), [2]);
  assert.deepEqual(
    filterByParty(records, "unknown").map((r) => r.id),
    [3, 4],
    "unattributed filings must remain visible somewhere"
  );
  assert.equal(filterByParty(records, "all").length, 4);
});

test("a summary containing unknown records discloses how many it excluded", () => {
  const withUnknown = partyBreakdown([{ party: "D" }, { party: null }]);
  const note = unknownPartyDisclosure(withUnknown);
  assert.ok(note && note.includes("1 of 2"));
  assert.ok(note && /not assigned to one/.test(note));

  const allKnown = partyBreakdown([{ party: "D" }, { party: "R" }]);
  assert.equal(unknownPartyDisclosure(allKnown), null, "no note when nothing is excluded");
});

test("archive-scale attribution matches the real archive shape", () => {
  // 148 of 945 records currently lack a party.
  const records = [
    ...Array.from({ length: 630 }, () => ({ party: "D" })),
    ...Array.from({ length: 167 }, () => ({ party: "R" })),
    ...Array.from({ length: 148 }, () => ({ party: null })),
  ];
  const b = partyBreakdown(records);
  assert.equal(b.total, 945);
  assert.equal(b.unknown, 148);
  assert.equal(b.democrat + b.republican, 797);
  assert.ok(b.attributedShare > 0.84 && b.attributedShare < 0.85);
});
