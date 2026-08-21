import assert from "node:assert/strict";
import test from "node:test";
import { mergeRecords, tallyCounts } from "../src/lib/congress-merge.ts";
import {
  emptyCounts,
  filingRowId,
  type DisclosureRecord,
} from "../src/lib/congress-schema.ts";

function makeRecord(
  docId: string,
  rowIndex: number,
  overrides: Partial<DisclosureRecord> = {}
): DisclosureRecord {
  const id = filingRowId(docId, rowIndex);
  return {
    id,
    idStrategy: "filing-row",
    politician: "Jane Doe",
    party: "D",
    chamber: "House",
    state: "CA",
    district: "CA11",
    ticker: "NVDA",
    companyName: "NVIDIA CORP",
    type: "Buy",
    amount: "$1,001 - $15,000",
    amountLow: 1001,
    amountHigh: 15000,
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
      rowIndex,
      contentHash: "testhash00000000",
      occurrence: 0,
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

test("regression: a short source window cannot delete archived history", () => {
  // The August incident in miniature. The archive holds three filings; the new
  // run's window only covers one. All three must survive.
  const archive = [
    makeRecord("A", 0),
    makeRecord("B", 0),
    makeRecord("C", 0),
  ];
  const incoming = [makeRecord("C", 0)];

  const result = mergeRecords(archive, incoming, "2026-08-21T00:00:00.000Z");

  assert.equal(result.records.length, 3, "no record may be lost");
  assert.equal(result.added, 0);
  assert.equal(result.refreshed, 1);
  assert.deepEqual(result.unseenIds.sort(), ["A#0", "B#0"]);
});

test("new filings are appended", () => {
  const archive = [makeRecord("A", 0)];
  const incoming = [makeRecord("A", 0), makeRecord("B", 0)];
  const result = mergeRecords(archive, incoming, "2026-08-21T00:00:00.000Z");
  assert.equal(result.records.length, 2);
  assert.equal(result.added, 1);
  assert.equal(result.refreshed, 1);
});

test("regression: two identical-looking transactions in one filing stay distinct", () => {
  // A composite key of (politician, ticker, type, date, amount) would collapse
  // these into one. Filing-row identity keeps both.
  const first = makeRecord("A", 0);
  const second = makeRecord("A", 1);
  assert.notEqual(first.id, second.id);

  const result = mergeRecords([], [first, second], "2026-08-21T00:00:00.000Z");
  assert.equal(result.records.length, 2);
  assert.equal(result.duplicates, 0);
});

test("a repeated id inside one run counts as a duplicate and keeps the first", () => {
  const original = makeRecord("A", 0, { ticker: "NVDA" });
  const collision = makeRecord("A", 0, { ticker: "AMD" });
  const result = mergeRecords([], [original, collision], "2026-08-21T00:00:00.000Z");
  assert.equal(result.records.length, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(result.records[0].ticker, "NVDA");
});

test("re-parsing a filing preserves firstSeen and the original raw values", () => {
  const archived = makeRecord("A", 0, {
    raw: { ...makeRecord("A", 0).raw, issuerName: "NVIDIA Corporation" },
  });
  const reparsed = makeRecord("A", 0, {
    raw: { ...makeRecord("A", 0).raw, issuerName: "MANGLED BY A NEW PARSER" },
    provenance: {
      ...makeRecord("A", 0).provenance,
      firstSeen: "2026-08-21T00:00:00.000Z",
    },
  });

  const result = mergeRecords([archived], [reparsed], "2026-08-21T12:00:00.000Z");
  const merged = result.records[0];

  assert.equal(merged.provenance.firstSeen, "2026-08-01T00:00:00.000Z");
  assert.equal(merged.provenance.lastSeen, "2026-08-21T12:00:00.000Z");
  assert.equal(merged.raw.issuerName, "NVIDIA Corporation");
});

test("records sort newest transaction first with a stable tiebreaker", () => {
  const older = makeRecord("A", 0, { transactionDate: "2026-06-01" });
  const newer = makeRecord("B", 0, { transactionDate: "2026-07-15" });
  const result = mergeRecords([], [older, newer], "2026-08-21T00:00:00.000Z");
  assert.equal(result.records[0].transactionDate, "2026-07-15");
});

test("tallyCounts reports missing fields without altering records", () => {
  const records = [
    makeRecord("A", 0),
    makeRecord("B", 0, { party: null }),
    makeRecord("C", 0, { party: null, source: "" }),
  ];
  const counts = tallyCounts(records, emptyCounts());
  assert.equal(counts.missingParty, 2);
  assert.equal(counts.missingFilingUrl, 1);
  assert.equal(counts.missingTicker, 0);
});
