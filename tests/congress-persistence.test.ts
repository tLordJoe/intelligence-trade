import assert from "node:assert/strict";
import test from "node:test";
import { assessRecord, assessRun, isIsoDate } from "../src/lib/congress-gates.ts";
import { mergeRecords } from "../src/lib/congress-merge.ts";
import { assignRowIds, type IdentityInput } from "../src/lib/congress-identity.ts";
import {
  emptyCounts,
  type DisclosureRecord,
  type ImportCounts,
} from "../src/lib/congress-schema.ts";
import { buildSecurityMaster } from "../src/lib/security-master.ts";

/**
 * Second-review regressions:
 *
 *  - ticker resolution must reach the archive, not just the warning list
 *  - a routine window must not fail against a full-index baseline
 *  - a parser correction must revise through the real identity path
 *  - impossible calendar dates must be rejected
 */

const master = buildSecurityMaster(
  {
    "0": { ticker: "NVDA", cik_str: 1045810, title: "NVIDIA CORP" },
    "1": { ticker: "BRK-B", cik_str: 1067983, title: "BERKSHIRE HATHAWAY INC" },
    "2": { ticker: "CARR", cik_str: 1783180, title: "CARRIER GLOBAL Corp" },
  },
  "2026-08-21T00:00:00.000Z"
);

/** Build a record the way the importer does, through assignRowIds. */
function buildRecords(docId: string, rows: IdentityInput[]): DisclosureRecord[] {
  const identities = assignRowIds(docId, rows);
  return rows.map((row, i) => {
    const identity = identities[i];
    const record: DisclosureRecord = {
      id: identity.id,
      idStrategy: "content-row",
      politician: "Jane Doe",
      party: "D",
      chamber: "House",
      state: "CA",
      district: "CA11",
      ticker: row.tickerText,
      companyName: row.issuerName,
      type: "Buy",
      amount: row.amountText,
      amountLow: 1001,
      amountHigh: 15000,
      transactionDate: "2026-07-01",
      filedDate: "2026-08-05",
      isOptions: false,
      source: `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/${docId}.pdf`,
      raw: {
        issuerName: row.issuerName,
        tickerText: row.tickerText,
        amountText: row.amountText,
        typeText: row.typeText,
        ownerText: row.ownerText,
        transactionDateText: row.transactionDateText,
        filedDateText: "08/05/2026",
      },
      provenance: {
        sourceChamber: "House",
        filingUrl: `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/${docId}.pdf`,
        docId,
        rowIndex: i,
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
      tickerResolution: "unknown",
    };

    // Exactly what the importer does with the assessment.
    const assessment = assessRecord(record, master);
    record.status = assessment.status;
    record.warnings = assessment.warnings;
    record.tickerResolution = assessment.tickerResolution;
    if (assessment.resolvedTicker) record.ticker = assessment.resolvedTicker;
    if (assessment.cik) record.cik = assessment.cik;

    return record;
  });
}

function row(over: Partial<IdentityInput> = {}): IdentityInput {
  return {
    issuerName: "NVIDIA Corporation",
    tickerText: "NVDA",
    typeText: "P",
    amountText: "$1,001 - $15,000",
    transactionDateText: "07/01/2026",
    ownerText: "SP",
    ...over,
  };
}

// --- 1. resolution reaches the archive --------------------------------------

test("regression: a verified ticker is persisted with its CIK", () => {
  const [record] = buildRecords("DOC1", [row()]);
  assert.equal(record.tickerResolution, "verified");
  assert.equal(record.cik, "0001045810");
  assert.equal(record.ticker, "NVDA");
});

test("regression: an aliased ticker is normalized and persisted", () => {
  // Filings write BRK.B; the SEC master uses BRK-B.
  const [record] = buildRecords("DOC1", [
    row({ tickerText: "BRK.B", issuerName: "Berkshire Hathaway Inc." }),
  ]);
  assert.equal(record.tickerResolution, "aliased");
  assert.equal(record.ticker, "BRK-B", "stored ticker is the canonical symbol");
  assert.equal(record.cik, "0001067983");
  assert.equal(record.raw.tickerText, "BRK.B", "raw keeps what the filing said");
});

test("regression: an unresolved ticker is recorded as unknown with no CIK", () => {
  const [record] = buildRecords("DOC1", [
    row({ tickerText: "ZZZZQ", issuerName: "Unlisted Co" }),
  ]);
  assert.equal(record.tickerResolution, "unknown");
  assert.equal(record.cik, undefined);
  assert.ok(record.warnings.includes("unknown_ticker"));
});

test("an archive built this way is not uniformly unknown", () => {
  const records = buildRecords("DOC1", [
    row(),
    row({ tickerText: "BRK.B", issuerName: "Berkshire Hathaway Inc.", amountText: "$15,001 - $50,000" }),
    row({ tickerText: "ZZZZQ", issuerName: "Unlisted Co", amountText: "$50,001 - $100,000" }),
  ]);
  const resolutions = records.map((r) => r.tickerResolution).sort();
  assert.deepEqual(resolutions, ["aliased", "unknown", "verified"]);
  assert.equal(records.filter((r) => r.cik).length, 2);
});

// --- 2. routine window vs full-index baseline -------------------------------

function counts(over: Partial<ImportCounts> = {}): ImportCounts {
  return {
    ...emptyCounts(),
    sourceFilings: 359,
    selectedFilings: 359,
    downloadedFilings: 359,
    parsedFilings: 359,
    parsedRecords: 945,
    accepted: 945,
    archiveBefore: 900,
    archiveAfter: 945,
    ...over,
  };
}

test("regression: a 150-filing routine run passes against a 359-filing backfill baseline", () => {
  // The real shape. Backfill: 945 accepted from 359 filings (2.63 per filing).
  // Routine run: 150 filings at the same yield produces ~395 records, which is
  // far below 85% of 945 and would fail permanently under an absolute
  // comparison.
  const backfillYield = 945 / 359;
  const routine = counts({
    selectedFilings: 150,
    downloadedFilings: 150,
    parsedFilings: 150,
    parsedRecords: 395,
    accepted: 395,
    archiveBefore: 945,
    archiveAfter: 960,
  });

  const result = assessRun({ counts: routine, previousYieldPerFiling: backfillYield });
  assert.equal(
    result.passed,
    true,
    `routine run must not fail on window size: ${result.failures.join(", ")}`
  );
});

test("a genuine yield collapse still fails, whatever the window size", () => {
  const backfillYield = 945 / 359;
  const broken = counts({
    selectedFilings: 150,
    downloadedFilings: 150,
    parsedFilings: 150,
    parsedRecords: 100, // 0.67 per filing against 2.63
    accepted: 100,
    archiveBefore: 945,
    archiveAfter: 950,
  });
  const result = assessRun({ counts: broken, previousYieldPerFiling: backfillYield });
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.startsWith("yield_far_below_previous_run")));
});

test("a mild yield dip warns rather than blocks", () => {
  const result = assessRun({
    counts: counts({ parsedRecords: 880, accepted: 880 }),
    previousYieldPerFiling: 945 / 359,
  });
  assert.equal(result.passed, true);
  assert.ok(result.warnings.some((w) => w.startsWith("yield_below_previous_run")));
});

// --- 3. correction revises through the real identity path -------------------

test("regression: a parser correction produces one revised record, not two", () => {
  // The path the importer actually takes: ids assigned by assignRowIds on both
  // runs, with no manual id reuse.
  const before = buildRecords("DOC1", [
    row({
      tickerText: "CARR",
      issuerName: "Berkshire Hathaway Inc. New Common Stock (BRK.B) [ST] P 07/2",
    }),
  ]);

  // A later parser reads the same row correctly.
  const after = buildRecords("DOC1", [
    row({ tickerText: "BRK.B", issuerName: "Berkshire Hathaway Inc. New Common Stock" }),
  ]);

  assert.notEqual(
    before[0].id,
    after[0].id,
    "the content hash legitimately moves when interpretation changes"
  );

  const result = mergeRecords(before, after, "2026-08-21T00:00:00.000Z", "run_new");

  assert.equal(result.records.length, 1, "one record, not two");
  assert.equal(result.revised, 1);
  assert.equal(result.added, 0);

  const merged = result.records[0];
  assert.equal(merged.id, before[0].id, "identity is retained across the correction");
  assert.equal(merged.ticker, "BRK-B", "the correction reaches readers");
  assert.equal(
    merged.raw.tickerText,
    "CARR",
    "raw still records what the original parse read"
  );
  assert.equal(merged.provenance.firstSeen, "2026-08-01T00:00:00.000Z");
  assert.ok(merged.revisions?.[0].changes.some((c) => c.field === "ticker"));
});

test("a corrected issuer name revises rather than duplicating", () => {
  const before = buildRecords("DOC1", [
    row({ issuerName: "Alphabet Inc. - Depositary Shares representing a 1/20th Inte" }),
  ]);
  const after = buildRecords("DOC1", [
    row({ issuerName: "Alphabet Inc. - Depositary Shares representing a 1/20th Interest" }),
  ]);

  const result = mergeRecords(before, after, "2026-08-21T00:00:00.000Z", "run_new");
  assert.equal(result.records.length, 1);
  assert.equal(result.revised, 1);
  assert.ok(
    result.records[0].companyName.endsWith("Interest"),
    "the fuller name is published"
  );
});

test("genuine duplicate transactions survive the reconciliation path", () => {
  // Two identical rows in one filing must remain two records, and a correction
  // to one of them must not collapse them.
  const before = buildRecords("DOC1", [row(), row()]);
  assert.equal(before.length, 2);
  assert.notEqual(
    before[0].provenance.reconciliationKey,
    before[1].provenance.reconciliationKey,
    "identical rows get distinct reconciliation keys by occurrence"
  );

  const result = mergeRecords(before, buildRecords("DOC1", [row(), row()]), "2026-08-21T00:00:00.000Z", "run_new");
  assert.equal(result.records.length, 2, "duplicates are preserved");
  assert.equal(result.added, 0);
});

test("two different securities on the same day stay separate records", () => {
  const records = buildRecords("DOC1", [
    row({ tickerText: "NVDA", issuerName: "NVIDIA Corporation" }),
    row({ tickerText: "CARR", issuerName: "Carrier Global Corporation" }),
  ]);
  // Same date, amount, owner and direction — only the security differs, so the
  // occurrence counter must keep their reconciliation keys apart.
  assert.notEqual(
    records[0].provenance.reconciliationKey,
    records[1].provenance.reconciliationKey
  );
  const result = mergeRecords([], records, "2026-08-21T00:00:00.000Z", "run_new");
  assert.equal(result.records.length, 2);
});

// --- 4. impossible calendar dates -------------------------------------------

test("regression: impossible calendar dates are rejected", () => {
  // JavaScript rolls these forward instead of failing.
  assert.equal(isIsoDate("2026-02-31"), false, "31 February does not exist");
  assert.equal(isIsoDate("2026-04-31"), false, "31 April does not exist");
  assert.equal(isIsoDate("2026-06-31"), false);
  assert.equal(isIsoDate("2026-09-31"), false);
  assert.equal(isIsoDate("2026-11-31"), false);
  assert.equal(isIsoDate("2026-00-10"), false);
  assert.equal(isIsoDate("2026-13-01"), false);
  assert.equal(isIsoDate("2026-01-00"), false);
  assert.equal(isIsoDate("2026-01-32"), false);
});

test("regression: leap years are handled exactly", () => {
  assert.equal(isIsoDate("2024-02-29"), true, "2024 is a leap year");
  assert.equal(isIsoDate("2025-02-29"), false, "2025 is not");
  assert.equal(isIsoDate("2000-02-29"), true, "2000 is a leap year");
  assert.equal(isIsoDate("1900-02-29"), false, "1900 is not, despite dividing by 4");
  assert.equal(isIsoDate("2026-02-28"), true);
});

test("well-formed real dates still pass", () => {
  for (const d of ["2026-07-01", "2026-12-31", "2026-01-01"]) {
    assert.equal(isIsoDate(d), true, d);
  }
});

test("malformed strings are rejected", () => {
  for (const d of ["07/01/2026", "2026-7-1", "", "not a date", "20260701"]) {
    assert.equal(isIsoDate(d), false, JSON.stringify(d));
  }
});
