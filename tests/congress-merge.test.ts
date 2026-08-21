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
      rowIndex,
      contentHash: "testhash00000000",
      occurrence: 0,
      reconciliationKey: `${docId}::core::${rowIndex}`,
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

// --- a recovered amount is a revision, not a duplicate ----------------------

test("regression: recovering a missing amount revises rather than duplicates", () => {
  // The reconciliation key includes the amount, so a record whose amount was
  // previously unreadable necessarily changes key once the parser can read it.
  // Without a fallback it arrives as a new record and the amountless original
  // lingers beside it, double-counting the transaction.
  const stored = makeRecord("20034999", 0, {
    amount: "",
    amountLow: null,
    amountHigh: null,
    amountStatus: "parse_failed",
    ticker: "ICHR",
    type: "Sell",
    transactionDate: "2026-06-17",
  });
  stored.provenance = {
    ...stored.provenance,
    docId: "20034999",
    occurrence: 0,
    reconciliationKey: "20034999::oldcore::0",
  };

  const reparsed = makeRecord("20034999", 0, {
    amount: "$2,722.50",
    amountLow: 2722.5,
    amountHigh: 2722.5,
    amountStatus: "disclosed_exact",
    ticker: "ICHR",
    type: "Sell",
    transactionDate: "2026-06-17",
  });
  reparsed.provenance = {
    ...reparsed.provenance,
    docId: "20034999",
    occurrence: 0,
    reconciliationKey: "20034999::newcore::0",
  };

  const result = mergeRecords([stored], [reparsed], "2026-08-21T09:00:00.000Z", "run_1");

  assert.equal(result.added, 0, "no duplicate is created");
  assert.equal(result.revised, 1, "the correction is a revision");
  assert.equal(result.records.length, 1, "one transaction, one record");
  assert.equal(result.records[0].id, stored.id, "identity does not move");
  assert.equal(result.records[0].amountLow, 2722.5, "the amount is corrected");
  assert.equal(result.records[0].amountStatus, "disclosed_exact");

  const changes = result.records[0].revisions?.at(-1)?.changes ?? [];
  assert.ok(
    changes.some((c) => c.field === "amountLow"),
    "the amount change is logged"
  );
});

test("the fallback never fuses two rows that both have amounts", () => {
  // Two genuine transactions in one filing differing only by amount must stay
  // two records. The fallback index is populated only from amountless records,
  // so it can never reach either of these.
  const first = makeRecord("DOC", 0, {
    amount: "$1,001 - $15,000",
    amountLow: 1001,
    amountHigh: 15000,
    ticker: "BRK-B",
    type: "Sell",
    transactionDate: "2026-02-10",
  });
  first.provenance = { ...first.provenance, docId: "DOC", occurrence: 0, reconciliationKey: "DOC::c1::0" };

  const second = makeRecord("DOC", 1, {
    amount: "$15,001 - $50,000",
    amountLow: 15001,
    amountHigh: 50000,
    ticker: "BRK-B",
    type: "Sell",
    transactionDate: "2026-02-10",
  });
  second.provenance = { ...second.provenance, docId: "DOC", occurrence: 0, reconciliationKey: "DOC::c2::0" };

  const result = mergeRecords([first], [second], "2026-08-21T09:00:00.000Z", "run_1");

  assert.equal(result.added, 1, "the second transaction is its own record");
  assert.equal(result.records.length, 2);
});

test("the fallback does not reach across filings", () => {
  const stored = makeRecord("DOC1", 0, {
    amount: "",
    amountLow: null,
    amountHigh: null,
    amountStatus: "parse_failed",
    ticker: "ICHR",
    type: "Sell",
    transactionDate: "2026-06-17",
  });
  stored.provenance = { ...stored.provenance, docId: "DOC1", occurrence: 0, reconciliationKey: "DOC1::x::0" };

  const other = makeRecord("DOC2", 0, {
    amount: "$2,722.50",
    amountLow: 2722.5,
    amountHigh: 2722.5,
    amountStatus: "disclosed_exact",
    ticker: "ICHR",
    type: "Sell",
    transactionDate: "2026-06-17",
  });
  other.provenance = { ...other.provenance, docId: "DOC2", occurrence: 0, reconciliationKey: "DOC2::y::0" };

  const result = mergeRecords([stored], [other], "2026-08-21T09:00:00.000Z", "run_1");
  assert.equal(result.added, 1, "a different filing is a different transaction");
  assert.equal(result.records.length, 2);
});

test("regression: inserting a recovered row must not re-point another record's key", () => {
  // The reconciliation key ends in an occurrence counted across rows sharing an
  // economic core, and the core excludes the ticker. Filing 20033737 had five
  // securities sharing one core — same type, amount, date and owner. Recovering
  // a previously dropped row shifted every later occurrence by one, so under a
  // single-pass merge the recovered row claimed the *next* record's key: IDEXX's
  // values were written onto PTC's record and the genuine PTC row was dropped as
  // a duplicate. Exact-id matches must therefore be resolved before any
  // positional fallback.
  const sharedCore = "coreHASH";

  const storedCdw = makeRecord("D", 0, { ticker: "CDW" });
  storedCdw.provenance = { ...storedCdw.provenance, reconciliationKey: `D::${sharedCore}::0` };
  const storedPtc = makeRecord("D", 1, { ticker: "PTC" });
  storedPtc.provenance = { ...storedPtc.provenance, reconciliationKey: `D::${sharedCore}::1` };
  const storedPwr = makeRecord("D", 2, { ticker: "PWR" });
  storedPwr.provenance = { ...storedPwr.provenance, reconciliationKey: `D::${sharedCore}::2` };

  // This run recovers an IDXX row that sorts between CDW and PTC, shifting the
  // occurrence of everything after it.
  const incomingCdw = makeRecord("D", 0, { ticker: "CDW" });
  incomingCdw.provenance = { ...incomingCdw.provenance, reconciliationKey: `D::${sharedCore}::0` };
  const incomingIdxx = makeRecord("D", 9, { ticker: "IDXX" });
  incomingIdxx.provenance = { ...incomingIdxx.provenance, reconciliationKey: `D::${sharedCore}::1` };
  const incomingPtc = makeRecord("D", 1, { ticker: "PTC" });
  incomingPtc.provenance = { ...incomingPtc.provenance, reconciliationKey: `D::${sharedCore}::2` };
  const incomingPwr = makeRecord("D", 2, { ticker: "PWR" });
  incomingPwr.provenance = { ...incomingPwr.provenance, reconciliationKey: `D::${sharedCore}::3` };

  const result = mergeRecords(
    [storedCdw, storedPtc, storedPwr],
    [incomingCdw, incomingIdxx, incomingPtc, incomingPwr],
    "2026-08-21T09:00:00.000Z",
    "run_1"
  );

  const byTicker = new Map(result.records.map((r) => [r.ticker, r]));

  assert.equal(result.duplicates, 0, "no genuine row is discarded as a duplicate");
  assert.equal(result.added, 1, "only the recovered row is new");
  assert.equal(result.records.length, 4, "three existing plus one recovered");

  assert.ok(byTicker.has("PTC"), "PTC survives");
  assert.ok(byTicker.has("PWR"), "PWR survives");
  assert.ok(byTicker.has("CDW"), "CDW survives");
  assert.ok(byTicker.has("IDXX"), "IDXX is added");

  // The corruption this pins: PTC's stored record must still be PTC's.
  assert.equal(byTicker.get("PTC")!.id, storedPtc.id, "PTC keeps its own record");
  assert.equal(byTicker.get("PWR")!.id, storedPwr.id, "PWR keeps its own record");
  assert.notEqual(
    byTicker.get("IDXX")!.id,
    storedPtc.id,
    "the recovered row never lands on another security's record"
  );
});
