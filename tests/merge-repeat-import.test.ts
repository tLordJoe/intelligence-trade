import assert from "node:assert/strict";
import test from "node:test";
import { assignRowIds } from "../src/lib/congress-identity.ts";
import { mergeRecords } from "../src/lib/congress-merge.ts";
import type {
  AmountStatus,
  DisclosureRecord,
} from "../src/lib/congress-schema.ts";

/**
 * Repeat-import stability for corrected records.
 *
 * A correction that moves a record's *reconciliation* identity has to remain
 * matchable on every later import, not just the one that applied it. Otherwise
 * a run appears to fix the record and the very next routine run re-adds it as a
 * duplicate — a failure that is invisible until the archive has grown by one
 * phantom transaction per import.
 *
 * These tests drive the real identity path (`assignRowIds`) rather than
 * hand-written hashes, so the keys under test are the ones production computes.
 */

const DOC = "20034999";
const RUN_TS = "2026-09-03T00:00:00.000Z";

interface RowInput {
  issuerName: string;
  tickerText: string;
  typeText: string;
  amountText: string;
  transactionDateText: string;
  ownerText: string;
}

/**
 * Build a record exactly as `scripts/import-house.ts` does: identity derived
 * from the row's own raw text by `assignRowIds`, everything else normalized
 * around it.
 */
function buildRecord(
  row: RowInput,
  amount: { low: number | null; high: number | null; status: AmountStatus },
  runId: string,
  now: string
): DisclosureRecord {
  const [identity] = assignRowIds(DOC, [row]);
  const filingUrl = `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/${DOC}.pdf`;

  return {
    id: identity.id,
    idStrategy: "content-row",
    politician: "Debbie Wasserman Schultz",
    party: "D",
    chamber: "House",
    state: "FL",
    district: "FL25",
    ticker: row.tickerText,
    companyName: row.issuerName,
    type: "Sell",
    amount: row.amountText,
    amountLow: amount.low,
    amountHigh: amount.high,
    amountStatus: amount.status,
    transactionDate: "2026-06-17",
    filedDate: "2026-07-14",
    isOptions: false,
    source: filingUrl,
    raw: {
      issuerName: row.issuerName,
      tickerText: row.tickerText,
      amountText: row.amountText,
      typeText: row.typeText,
      ownerText: row.ownerText,
      transactionDateText: row.transactionDateText,
      filedDateText: "7/14/2026",
    },
    provenance: {
      sourceChamber: "House",
      filingUrl,
      docId: DOC,
      rowIndex: 0,
      contentHash: identity.contentHash,
      occurrence: identity.occurrence,
      reconciliationKey: identity.reconciliationKey,
      firstSeen: now,
      lastSeen: now,
      importRunId: runId,
      schemaVersion: 2,
    },
    status: "valid",
    warnings: [],
    tickerResolution: "verified",
  };
}

const AMOUNTLESS_ROW: RowInput = {
  issuerName: "Ichor Holdings - Ordinary Shares",
  tickerText: "ICHR",
  typeText: "S 06/17/2026",
  amountText: "",
  transactionDateText: "06/17/2026",
  ownerText: "",
};

/** Same transaction, with the exact figure the fixed parser now reads. */
const CORRECTED_ROW: RowInput = { ...AMOUNTLESS_ROW, amountText: "$2,722.50" };

const NO_AMOUNT = { low: null, high: null, status: "parse_failed" as AmountStatus };
const EXACT = { low: 2722.5, high: 2722.5, status: "disclosed_exact" as AmountStatus };

test("regression: a corrected record survives a second identical import", () => {
  // --- Stage 1: the archive holds the amountless record ---------------------
  const stored = buildRecord(AMOUNTLESS_ROW, NO_AMOUNT, "run_1", "2026-08-01T00:00:00.000Z");
  let archive = [stored];
  assert.equal(archive.length, 1);

  // --- Stage 2: the fixed parser reads the amount ---------------------------
  const corrected = buildRecord(CORRECTED_ROW, EXACT, "run_2", RUN_TS);

  // The correction genuinely moves both identities; that is the premise.
  assert.notEqual(corrected.id, stored.id, "content hash moves with the amount");
  assert.notEqual(
    corrected.provenance.reconciliationKey,
    stored.provenance.reconciliationKey,
    "the reconciliation key moves too, because the core includes the amount"
  );

  const second = mergeRecords(archive, [corrected], RUN_TS, "run_2");
  assert.equal(second.added, 0, "stage 2: the correction must not add a record");
  assert.equal(second.revised, 1, "stage 2: it is a revision");
  assert.equal(second.records.length, 1, "stage 2: still one transaction");
  assert.equal(second.records[0].id, stored.id, "public identity is stable");
  assert.equal(second.records[0].amountLow, 2722.5, "the amount is corrected");
  assert.deepEqual(
    second.records[0].raw,
    stored.raw,
    "raw source history is immutable"
  );
  assert.equal(
    second.records[0].provenance.firstSeen,
    stored.provenance.firstSeen,
    "firstSeen is never rewritten"
  );

  archive = second.records;

  // --- Stage 3: the next routine import sees the same corrected row ---------
  // Nothing about the filing changed, so this must be an ordinary refresh.
  const again = buildRecord(CORRECTED_ROW, EXACT, "run_3", "2026-09-04T00:00:00.000Z");

  const third = mergeRecords(archive, [again], "2026-09-04T00:00:00.000Z", "run_3");

  assert.equal(third.added, 0, "stage 3: the transaction must not be added again");
  assert.equal(third.records.length, 1, "stage 3: still exactly one record");
  assert.equal(third.revised, 0, "stage 3: nothing changed, so nothing to revise");
  assert.equal(third.refreshed, 1, "stage 3: an ordinary refresh");
  assert.equal(third.records[0].id, stored.id, "public identity is still stable");
  assert.deepEqual(third.records[0].raw, stored.raw, "raw history still immutable");
});

test("regression: a corrected record stays stable across many later imports", () => {
  // Guards against a fix that merely defers the duplicate by one run.
  let archive = [buildRecord(AMOUNTLESS_ROW, NO_AMOUNT, "run_1", "2026-08-01T00:00:00.000Z")];
  archive = mergeRecords(
    archive,
    [buildRecord(CORRECTED_ROW, EXACT, "run_2", RUN_TS)],
    RUN_TS,
    "run_2"
  ).records;

  for (let i = 3; i <= 8; i += 1) {
    const ts = `2026-09-${String(i).padStart(2, "0")}T00:00:00.000Z`;
    const result = mergeRecords(
      archive,
      [buildRecord(CORRECTED_ROW, EXACT, `run_${i}`, ts)],
      ts,
      `run_${i}`
    );
    assert.equal(result.added, 0, `import ${i} must add nothing`);
    assert.equal(result.records.length, 1, `import ${i} must hold one record`);
    archive = result.records;
  }
});

// --- the same question for every other reconciliation-key field -------------

/**
 * The reconciliation core is type, amount, transaction date and owner. A
 * correction to any of them moves the key, so each has to be checked for the
 * same repeat-import behaviour.
 */
const CORE_FIELD_CASES: Array<{ field: string; row: RowInput }> = [
  { field: "typeText", row: { ...AMOUNTLESS_ROW, typeText: "S (partial) 06/17/2026" } },
  { field: "transactionDateText", row: { ...AMOUNTLESS_ROW, transactionDateText: "06/18/2026" } },
  { field: "ownerText", row: { ...AMOUNTLESS_ROW, ownerText: "SP" } },
];

for (const { field, row } of CORE_FIELD_CASES) {
  test(`a correction to ${field} behaves identically on the first and second import`, () => {
    const stored = buildRecord(AMOUNTLESS_ROW, NO_AMOUNT, "run_1", "2026-08-01T00:00:00.000Z");
    const changed = buildRecord(row, NO_AMOUNT, "run_2", RUN_TS);

    const first = mergeRecords([stored], [changed], RUN_TS, "run_2");
    const archive = first.records;

    // Whatever the first import decided, the second must not change the count.
    const second = mergeRecords(
      archive,
      [buildRecord(row, NO_AMOUNT, "run_3", "2026-09-04T00:00:00.000Z")],
      "2026-09-04T00:00:00.000Z",
      "run_3"
    );

    assert.equal(
      second.added,
      0,
      `${field}: a repeat import must never add another copy`
    );
    assert.equal(
      second.records.length,
      archive.length,
      `${field}: archive size must be stable across repeat imports`
    );
  });
}
