import assert from "node:assert/strict";
import test from "node:test";
import {
  assessRecord,
  assessRun,
  isIsoDate,
  looksTruncated,
} from "../src/lib/congress-gates.ts";
import { emptyCounts, type DisclosureRecord } from "../src/lib/congress-schema.ts";
import {
  buildSecurityMaster,
  cleanTickerText,
  issuerNameMatchesTicker,
  resolveTicker,
  tickerAliases,
} from "../src/lib/security-master.ts";

/**
 * Fixtures reproduce the defects found in the August 2026 audit of the House
 * importer. Each one is a regression guard: the pipeline must not be able to
 * reintroduce these without a test going red.
 */

const master = buildSecurityMaster(
  {
    "0": { ticker: "NVDA", cik_str: 1045810, title: "NVIDIA CORP" },
    "1": { ticker: "GOOGL", cik_str: 1652044, title: "Alphabet Inc." },
    "2": { ticker: "GOOGM", cik_str: 1652044, title: "Alphabet Inc." },
    "3": { ticker: "GOOGN", cik_str: 1652044, title: "Alphabet Inc." },
    "4": { ticker: "BRK-B", cik_str: 1067983, title: "BERKSHIRE HATHAWAY INC" },
    "5": { ticker: "CARR", cik_str: 1783180, title: "CARRIER GLOBAL Corp" },
    "6": { ticker: "ABR-PD", cik_str: 1253986, title: "ARBOR REALTY TRUST INC" },
    "7": { ticker: "ACHR-WT", cik_str: 1824502, title: "Archer Aviation Inc." },
    "8": { ticker: "XOM", cik_str: 34088, title: "ExxonMobil Holdings Corp" },
    "9": { ticker: "MCD", cik_str: 63908, title: "MCDONALDS CORP" },
    "10": { ticker: "SIRI", cik_str: 908937, title: "SIRIUS XM HOLDINGS INC." },
    "11": { ticker: "GE", cik_str: 40545, title: "GENERAL ELECTRIC CO" },
  },
  "2026-08-21T00:00:00.000Z"
);

function makeRecord(overrides: Partial<DisclosureRecord> = {}): DisclosureRecord {
  const base: DisclosureRecord = {
    id: "20035136#0",
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
    source:
      "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035136.pdf",
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
      filingUrl:
        "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035136.pdf",
      docId: "20035136",
      rowIndex: 0,
      firstSeen: "2026-08-21T00:00:00.000Z",
      lastSeen: "2026-08-21T00:00:00.000Z",
      importRunId: "run_test",
      schemaVersion: 1,
    },
    status: "valid",
    warnings: [],
    tickerResolution: "verified",
  };
  return { ...base, ...overrides };
}

// --- ticker validation ------------------------------------------------------

test("regression: GOOGM and GOOGN are real Alphabet securities, not parser artifacts", () => {
  // The original audit wrongly called these fabricated. The SEC master lists
  // both under Alphabet's CIK, so the pipeline must publish them.
  for (const symbol of ["GOOGM", "GOOGN"]) {
    const lookup = resolveTicker(symbol, master);
    assert.equal(lookup.resolution, "verified", `${symbol} should resolve`);
    assert.equal(lookup.cik, "0001652044");
  }
  const record = makeRecord({
    ticker: "GOOGM",
    raw: { ...makeRecord().raw, tickerText: "GOOGM", issuerName: "Alphabet Inc." },
  });
  assert.notEqual(assessRecord(record, master).status, "quarantined");
});

test("regression: a bare ticker regex would reject valid share classes and warrants", () => {
  // /^[A-Z]{1,5}$/ rejects all of these. The master accepts them.
  for (const symbol of ["BRK-B", "ABR-PD", "ACHR-WT"]) {
    assert.notEqual(resolveTicker(symbol, master).resolution, "unknown", symbol);
  }
});

test("BRK.B as filed aliases to the SEC's BRK-B", () => {
  const lookup = resolveTicker("BRK.B", master);
  assert.equal(lookup.resolution, "aliased");
  assert.equal(lookup.ticker, "BRK-B");
});

test("ticker text is cleaned without destroying meaningful punctuation", () => {
  assert.equal(cleanTickerText(" brk.b "), "BRK.B");
  assert.equal(cleanTickerText("nvda*"), "NVDA");
  assert.deepEqual(tickerAliases("BRK.B").includes("BRK-B"), true);
});

test("regression: an unresolvable ticker is flagged, not withheld", () => {
  // The SEC master omits listed issuers (BK, EXAS, HOLX, CTRA, GTLS) and most
  // foreign ADRs, so absence proves nothing about the symbol. Withholding on it
  // would under-report real filings.
  const record = makeRecord({
    ticker: "ZZZZQ",
    raw: { ...makeRecord().raw, tickerText: "ZZZZQ", issuerName: "Unknown Co" },
  });
  const result = assessRecord(record, master);
  assert.equal(result.status, "warning");
  assert.ok(result.warnings.includes("unknown_ticker"));
});

test("regression: issuer names that differ only by word breaks still match", () => {
  // Real false positives from the first full backfill.
  const cases: Array<[string, string]> = [
    ["XOM", "Exxon Mobil Corporation Common Stock"],
    ["MCD", "McDonald's Corporation Common Stock"],
    ["SIRI", "SiriusXM Holdings Inc. - Common Stock"],
  ];
  for (const [symbol, filedName] of cases) {
    const record = makeRecord({
      ticker: symbol,
      raw: { ...makeRecord().raw, tickerText: symbol, issuerName: filedName },
    });
    assert.notEqual(
      assessRecord(record, master).status,
      "quarantined",
      `${symbol} (${filedName}) must not be quarantined`
    );
  }
});

test("regression: a renamed issuer warns but is not withheld", () => {
  // GE files as "GE Aerospace"; the SEC master still reads GENERAL ELECTRIC CO.
  const record = makeRecord({
    ticker: "GE",
    raw: { ...makeRecord().raw, tickerText: "GE", issuerName: "GE Aerospace Common Stock" },
  });
  const result = assessRecord(record, master);
  assert.notEqual(result.status, "quarantined");
  assert.ok(result.warnings.includes("issuer_ticker_mismatch"));
});

// --- issuer / ticker cross-check -------------------------------------------

test("regression: Berkshire Hathaway labelled CARR is quarantined", () => {
  const record = makeRecord({
    ticker: "CARR",
    companyName: "CARRIER GLOBAL Corp",
    raw: {
      ...makeRecord().raw,
      tickerText: "CARR",
      issuerName: "Berkshire Hathaway Inc. New Common Stock (BRK.B) [ST] P 07/2",
    },
  });
  const result = assessRecord(record, master);
  assert.equal(result.status, "quarantined");
  assert.ok(
    result.warnings.some((w) => w.startsWith("issuer_ticker_conflict")),
    `expected conflict warning, got ${result.warnings.join(",")}`
  );
});

test("a genuine Carrier Global record still passes", () => {
  const record = makeRecord({
    ticker: "CARR",
    companyName: "CARRIER GLOBAL Corp",
    raw: {
      ...makeRecord().raw,
      tickerText: "CARR",
      issuerName: "Carrier Global Corporation",
    },
  });
  assert.notEqual(assessRecord(record, master).status, "quarantined");
});

test("issuer name matching tolerates abbreviation", () => {
  const lookup = resolveTicker("NVDA", master);
  assert.equal(
    issuerNameMatchesTicker("NVIDIA Corporation - Common Stock", lookup, master)
      .matches,
    true
  );
});

// --- truncation -------------------------------------------------------------

test("regression: names sliced at 60 characters are flagged as truncated", () => {
  assert.equal(
    looksTruncated(
      "Alphabet Inc. - Depositary Shares representing a 1/20th Inte"
    ),
    true
  );
  assert.equal(
    looksTruncated("NICE Ltd - American Depositary Shares each representing one "),
    false, // ends on whitespace, so it is a boundary, not a mid-word cut
    "trailing-space names end on a boundary"
  );
  assert.equal(looksTruncated("NVIDIA Corporation"), false);
});

test("a truncated name warns but still publishes", () => {
  const record = makeRecord({
    raw: {
      ...makeRecord().raw,
      issuerName:
        "Alphabet Inc. - Depositary Shares representing a 1/20th Inte",
      tickerText: "GOOGM",
    },
    ticker: "GOOGM",
  });
  const result = assessRecord(record, master);
  assert.equal(result.status, "warning");
  assert.ok(result.warnings.includes("truncated_issuer_name"));
});

// --- required fields --------------------------------------------------------

test("regression: an unresolved party warns and is never guessed", () => {
  const record = makeRecord({ party: null });
  const result = assessRecord(record, master);
  assert.ok(result.warnings.includes("unknown_party"));
  assert.notEqual(result.status, "quarantined");
});

test("a missing or unofficial filing URL is quarantined", () => {
  assert.equal(assessRecord(makeRecord({ source: "" }), master).status, "quarantined");
  assert.equal(
    assessRecord(makeRecord({ source: "https://example.com/fake.pdf" }), master)
      .status,
    "quarantined"
  );
});

test("unusable dates are quarantined", () => {
  assert.equal(isIsoDate("2026-07-01"), true);
  assert.equal(isIsoDate("07/01/2026"), false);
  assert.equal(
    assessRecord(makeRecord({ transactionDate: "07/01/2026" }), master).status,
    "quarantined"
  );
});

// --- run-level gates --------------------------------------------------------

test("regression: an archive that shrinks fails the run", () => {
  // This is the gate that would have stopped the August incident on day one.
  const counts = {
    ...emptyCounts(),
    sourceFilings: 40,
    parsedFilings: 40,
    parsedRecords: 182,
    accepted: 182,
    archiveBefore: 225,
    archiveAfter: 182,
  };
  const result = assessRun({ counts });
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.startsWith("archive_shrank")));
});

test("a growing archive passes", () => {
  const counts = {
    ...emptyCounts(),
    sourceFilings: 40,
    parsedFilings: 40,
    parsedRecords: 210,
    accepted: 210,
    archiveBefore: 203,
    archiveAfter: 228,
  };
  assert.equal(assessRun({ counts }).passed, true);
});

test("an empty or unparseable source fails the run", () => {
  assert.equal(assessRun({ counts: { ...emptyCounts() } }).passed, false);
  assert.equal(
    assessRun({
      counts: { ...emptyCounts(), sourceFilings: 40, parsedFilings: 0 },
    }).passed,
    false
  );
});

test("wholesale rejection fails rather than publishing an empty set", () => {
  const counts = {
    ...emptyCounts(),
    sourceFilings: 40,
    parsedFilings: 40,
    parsedRecords: 100,
    accepted: 0,
    quarantined: 100,
    archiveBefore: 203,
    archiveAfter: 203,
  };
  const result = assessRun({ counts });
  assert.equal(result.passed, false);
  assert.ok(result.failures.includes("all_records_rejected"));
});

test("a sharp drop against the previous run warns without blocking", () => {
  const counts = {
    ...emptyCounts(),
    sourceFilings: 40,
    parsedFilings: 40,
    parsedRecords: 120,
    accepted: 120,
    archiveBefore: 203,
    archiveAfter: 210,
  };
  const result = assessRun({ counts, previousAccepted: 200 });
  assert.equal(result.passed, true);
  assert.ok(result.warnings.some((w) => w.startsWith("accepted_below_previous_run")));
});
