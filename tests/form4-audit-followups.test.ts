import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseForm4 } from "../src/lib/form4/parse.ts";
import {
  classifyPriceQuality, classifyRow, isExecutionPrice, isOrdinaryShareTrade,
} from "../src/lib/form4/classify.ts";
import type { Form4Filing, PriceQuality } from "../src/lib/form4/types.ts";

/**
 * Findings from Perplexity's independent hand-read audit of the fixture corpus.
 *
 * The audit confirmed all 35 documents against SEC source bytes and every
 * field-level assertion, and supported leaving amendments unresolved. It also
 * found two manifest issuer errors and three risks the parser had not covered.
 * Nothing below adjusts an expected value to suit the parser; where the parser
 * disagreed with the audit, the parser was wrong.
 */

const FIXTURE_DIR = join(import.meta.dirname, "fixtures", "form4");
const DOCUMENTS = join(FIXTURE_DIR, "documents");

interface ManifestEntry {
  file: string; accession: string; documentType: string; issuerSymbol: string;
  issuerName: string; issuerCik: string; documentName: string;
  documentUrl: string | null; indexUrl: string | null; sha256: string;
  bytes: number; coverage: string; synthetic: boolean;
  amendmentPairRole?: string; amendmentPairPartner?: string;
  observed: { codes: string[] };
}

const manifest: { count: number; authenticCount: number; syntheticCount: number; filings: ManifestEntry[] } =
  JSON.parse(readFileSync(join(FIXTURE_DIR, "manifest.json"), "utf8"));

const xmlFor = (e: ManifestEntry) => readFileSync(join(DOCUMENTS, e.file), "utf8");

function parse(entry: ManifestEntry): Form4Filing {
  const result = parseForm4({
    xml: xmlFor(entry), accessionNumber: entry.accession,
    documentUrl: entry.documentUrl ?? "https://www.sec.gov/Archives/x.xml",
    indexUrl: entry.indexUrl ?? "https://www.sec.gov/Archives/x.htm",
    documentName: entry.documentName, importRunId: "audit_test",
    firstObservedAt: "2026-09-05T00:00:00.000Z",
  });
  assert.equal(result.ok, true, `${entry.accession} should parse`);
  return (result as { ok: true; filing: Form4Filing }).filing;
}

const byAccession = (a: string) => {
  const e = manifest.filings.find((f) => f.accession === a);
  assert.ok(e, `fixture ${a} must exist`);
  return e;
};

// --- 1. issuer identity comes from the filing, never from a reporting owner ---

test("regression: every manifest issuer matches the document's own issuer section", () => {
  // The audit found two wrong labels. Both came from recording the CIK used to
  // *discover* a filing rather than the issuer the filing names — Intel and
  // Oracle appeared on those documents as reporting owners, not issuers.
  for (const entry of manifest.filings) {
    const xml = xmlFor(entry);
    const issuerBlock = xml.match(/<issuer>([\s\S]*?)<\/issuer>/);
    assert.ok(issuerBlock, `${entry.accession} has an issuer section`);

    const symbol = (issuerBlock[1].match(/<issuerTradingSymbol>([^<]*)</) ?? [, ""])[1].trim();
    const name = (issuerBlock[1].match(/<issuerName>([^<]*)</) ?? [, ""])[1].trim();
    const cik = (issuerBlock[1].match(/<issuerCik>([^<]*)</) ?? [, ""])[1].trim().padStart(10, "0");

    assert.equal(entry.issuerSymbol, symbol, `${entry.accession} issuerSymbol`);
    assert.equal(entry.issuerName, name, `${entry.accession} issuerName`);
    assert.equal(entry.issuerCik, cik, `${entry.accession} issuerCik`);
  }
});

test("regression: the two issuers the audit corrected are right", () => {
  // Recorded explicitly so a regression names the same filings the audit did.
  const borqs = byAccession("0000899243-19-015532");
  assert.equal(borqs.issuerSymbol, "BRQS", "was mislabelled INTC");
  assert.equal(borqs.issuerName, "Borqs Technologies, Inc.");
  assert.notEqual(borqs.issuerCik, "0000050863", "Intel's CIK is the reporting owner here");

  const netsuite = byAccession("0000899243-16-033520");
  assert.equal(netsuite.issuerSymbol, "N", "was mislabelled ORCL");
  assert.equal(netsuite.issuerName, "NETSUITE INC");
  assert.notEqual(netsuite.issuerCik, "0001341439", "Oracle's CIK is the reporting owner here");
});

test("no manifest issuer CIK coincides with one of that filing's reporting owners", () => {
  // The shape of the original mistake: an owner CIK standing in for the issuer.
  for (const entry of manifest.filings) {
    const filing = parse(entry);
    const ownerCiks = new Set(filing.reportingOwners.map((o) => o.cik));
    if (ownerCiks.has(entry.issuerCik)) {
      // Legitimate when a company reports on its own securities; assert it is
      // genuinely what the issuer section says rather than an import artifact.
      assert.equal(filing.issuer.cik, entry.issuerCik, `${entry.accession}`);
    }
    assert.equal(filing.issuer.cik, entry.issuerCik);
  }
});

test("the parser reads the issuer from the issuer section", () => {
  const filing = parse(byAccession("0000899243-16-033520"));
  assert.equal(filing.issuer.name, "NETSUITE INC");
  assert.equal(filing.issuer.tradingSymbol, "N");
  assert.ok(
    filing.reportingOwners.some((o) => o.cik === "0001341439"),
    "Oracle is present, as a reporting owner"
  );
});

// --- 2. an authentic original and its amendment ------------------------------

test("the corpus contains an authentic original and its amendment", () => {
  const original = byAccession("0001045810-23-000006");
  const amendment = byAccession("0001045810-23-000050");

  assert.equal(original.documentType, "4");
  assert.equal(amendment.documentType, "4/A");
  assert.equal(original.synthetic, false);
  assert.equal(amendment.synthetic, false);
  assert.equal(original.amendmentPairPartner, amendment.accession);
  assert.equal(amendment.amendmentPairPartner, original.accession);

  // Both were retrieved from EDGAR and still hash to their recorded bytes.
  for (const entry of [original, amendment]) {
    assert.ok(entry.documentUrl?.startsWith("https://www.sec.gov/Archives/"));
    assert.equal(Buffer.byteLength(xmlFor(entry), "utf8"), entry.bytes);
  }
});

test("the pair really is an original and its amendment", () => {
  const original = parse(byAccession("0001045810-23-000006"));
  const amendment = parse(byAccession("0001045810-23-000050"));

  assert.equal(original.issuer.cik, amendment.issuer.cik, "same issuer");
  assert.equal(original.periodOfReport.value, amendment.periodOfReport.value, "same period");
  assert.deepEqual(
    original.reportingOwners.map((o) => o.cik),
    amendment.reportingOwners.map((o) => o.cik),
    "same reporting owner"
  );
  assert.equal(amendment.dateOfOriginalSubmission.value, "2023-01-27");
  assert.equal(original.dateOfOriginalSubmission.value, null, "an original has no original");
});

test("regression: the parser preserves both and invents no relationship", () => {
  // Everything that would tempt an automatic link is present — same issuer,
  // same owner, same period, and an original-submission date. None of it may
  // produce one.
  const original = parse(byAccession("0001045810-23-000006"));
  const amendment = parse(byAccession("0001045810-23-000050"));

  assert.notEqual(original.id, amendment.id, "two documents, two identities");
  assert.notEqual(original.accessionNumber, amendment.accessionNumber);
  assert.notEqual(original.documentSha256, amendment.documentSha256);

  assert.equal(original.amendment, null, "an original carries no amendment record");
  assert.equal(amendment.amendment?.status, "unresolved");
  assert.equal(amendment.amendment?.originalAccession, null, "no link is asserted");
  assert.deepEqual(amendment.amendment?.candidateAccessions, []);
  assert.equal(amendment.amendment?.method, null);

  // Neither document's rows are merged into or replaced by the other's.
  const originalRowIds = new Set(original.rows.map((r) => r.id));
  for (const row of amendment.rows) {
    assert.ok(!originalRowIds.has(row.id), "amendment rows are their own rows");
    assert.equal(row.accessionNumber, amendment.accessionNumber);
  }
  assert.ok(original.rows.length > 0 && amendment.rows.length > 0, "both retain their rows");
});

// --- 3. price quality ---------------------------------------------------------

test("regression: a weighted-average price is never presented as exact", () => {
  // The audit's point: many reported prices are aggregates of a day's fills,
  // disclosed in a footnote. Reading them as execution prices is wrong.
  const footnotes = {
    F1: "This transaction was executed in multiple trades at prices ranging from $497.69 to $498.67. The price reported above reflects the weighted average purchase price.",
  };
  const quality = classifyPriceQuality("498.10", ["F1"], footnotes);
  assert.equal(quality, "weighted_average");
  assert.equal(isExecutionPrice(quality), false);
});

test("price quality covers each case, and guesses at none", () => {
  const wavg = { F1: "reflects the weighted average purchase price" };
  const ranging = { F1: "executed in multiple trades at prices ranging from $10 to $11" };
  const opaque = { F1: "Shares held in a family trust." };

  assert.equal(classifyPriceQuality("12.34", [], {}), "exact", "a bare number is exact");
  assert.equal(classifyPriceQuality("12.34", ["F1"], wavg), "weighted_average");
  assert.equal(classifyPriceQuality("12.34", ["F1"], ranging), "weighted_average");
  assert.equal(classifyPriceQuality(null, ["F1"], opaque), "footnote_only");
  assert.equal(classifyPriceQuality(null, [], {}), "unspecified");

  // A price qualified by a footnote we do not recognise. It may be exact; we
  // cannot establish that, so we do not claim it.
  assert.equal(
    classifyPriceQuality("12.34", ["F1"], opaque),
    "unspecified",
    "an unrecognised qualification is not evidence of exactness"
  );
  // An unresolvable footnote id is equally not evidence.
  assert.equal(classifyPriceQuality("12.34", ["F9"], {}), "unspecified");
});

test("only an exact price may be read as an execution price", () => {
  const qualities: PriceQuality[] = ["exact", "weighted_average", "footnote_only", "unspecified"];
  assert.deepEqual(qualities.filter(isExecutionPrice), ["exact"]);
});

test("the corpus is mostly not exact prices, and the parser says so", () => {
  const counts: Record<string, number> = {};
  for (const entry of manifest.filings) {
    for (const row of parse(entry).rows) {
      counts[row.priceQuality] = (counts[row.priceQuality] ?? 0) + 1;
    }
  }
  // The measured shape of the corpus: weighted averages outnumber exact prices.
  assert.ok(counts.weighted_average > 0, "the corpus contains aggregate prices");
  assert.ok(
    counts.weighted_average > counts.exact,
    `weighted averages (${counts.weighted_average}) should outnumber exact (${counts.exact})`
  );
  assert.ok(counts.footnote_only > 0);
  assert.ok(counts.unspecified > 0);
});

test("an aggregate price is flagged on the row, not only in its quality field", () => {
  const filing = parse(byAccession("0000789019-26-000161"));
  const aggregate = filing.rows.filter((r) => r.priceQuality === "weighted_average");
  assert.ok(aggregate.length > 0, "this filing reports weighted averages");
  for (const row of aggregate) {
    assert.ok(row.warnings.includes("price_is_weighted_average"));
    assert.ok(row.pricePerShare.value !== null, "the reported value is preserved");
    assert.ok(row.pricePerShare.footnoteIds.length > 0, "and so are its footnotes");
  }
});

// --- 4. chronology is preserved, flagged, and never trusted -------------------

test("regression: impossible original-submission chronology is flagged", () => {
  // Two real fixtures report an original filed before the period it covers.
  const mu = parse(byAccession("0000723125-12-000062"));
  assert.equal(mu.dateOfOriginalSubmission.value, "2011-12-31", "preserved as reported");
  assert.ok(
    mu.chronologyWarnings.some((w) => w.startsWith("original_submission_before_period")),
    `expected a chronology flag, got ${JSON.stringify(mu.chronologyWarnings)}`
  );

  const netsuite = parse(byAccession("0000899243-16-033520"));
  assert.ok(netsuite.chronologyWarnings.some((w) => w.startsWith("original_submission_before_period")));
});

test("a suspicious date is preserved rather than discarded or corrected", () => {
  const mu = parse(byAccession("0000723125-12-000062"));
  assert.equal(mu.dateOfOriginalSubmission.raw, "2011-12-31");
  assert.equal(mu.dateOfOriginalSubmission.reason, null, "it parsed; it is simply implausible");
});

test("a sound chronology raises no flag", () => {
  const amendment = parse(byAccession("0001045810-23-000050"));
  assert.equal(amendment.dateOfOriginalSubmission.value, "2023-01-27");
  assert.deepEqual(amendment.chronologyWarnings, []);
});

test("regression: the original-submission date never becomes a link", () => {
  // Even where it is present, plausible, and matches a real original that is
  // sitting in the same corpus.
  const amendment = parse(byAccession("0001045810-23-000050"));
  assert.equal(amendment.dateOfOriginalSubmission.value, "2023-01-27");
  assert.equal(amendment.amendment?.status, "unresolved");
  assert.equal(amendment.amendment?.originalAccession, null);

  for (const entry of manifest.filings.filter((f) => f.documentType === "4/A")) {
    const filing = parse(entry);
    assert.equal(filing.amendment?.status, "unresolved", `${entry.accession} must not self-resolve`);
    assert.equal(filing.amendment?.originalAccession, null);
  }
});

// --- 5. rare and blank transaction codes ------------------------------------

test("the corpus carries authentic rare transaction codes", () => {
  const codes = new Set(manifest.filings.flatMap((f) => f.observed.codes));
  assert.ok(codes.has("L"), "code L appears in an authentic filing");
  assert.ok(codes.has("J"), "code J appears in an authentic filing");

  const rareFixtures = manifest.filings.filter(
    (f) => !f.synthetic && f.observed.codes.some((c) => ["L", "J", "C", "D"].includes(c))
  );
  assert.ok(rareFixtures.length >= 3, "several authentic rare-code filings are committed");
});

test("rare codes classify as other-reported, never as buys or sells", () => {
  for (const code of ["L", "I", "J", "U"]) {
    const { classification } = classifyRow("transaction", code);
    assert.equal(classification, "other_reported", `code ${code}`);
    assert.notEqual(classification, "reported_purchase");
    assert.notEqual(classification, "reported_sale");
  }
  for (const [code, expected] of [["W", "inheritance"], ["Z", "voting_trust"], ["E", "expiration_or_cancellation"], ["H", "expiration_or_cancellation"], ["X", "exercise_or_conversion"]] as const) {
    assert.equal(classifyRow("transaction", code).classification, expected);
  }
});

test("regression: a blank transaction code stays unclassified", () => {
  // Synthetic by necessity: no blank code occurred in 420 real documents
  // sampled across four filing days. The behaviour still has to be pinned.
  const entry = byAccession("SYNTHETIC-0000000000-00-000000");
  assert.equal(entry.synthetic, true, "and is labelled synthetic in the manifest");

  const filing = parse(entry);
  assert.equal(filing.rows.length, 2);

  const [blank, missing] = filing.rows;
  assert.equal(blank.transactionCodeRaw, null, "an empty element reads as no code");
  assert.equal(blank.classification, "unknown_code");
  assert.ok(blank.warnings.includes("transaction_code_missing"));

  assert.equal(missing.classification, "unknown_code", "an absent element likewise");
  assert.ok(missing.warnings.includes("transaction_code_missing"));

  // The acquired/disposed flags are A and D respectively — the exact trap.
  assert.equal(blank.acquiredDisposedRaw, "A");
  assert.equal(missing.acquiredDisposedRaw, "D");
  assert.notEqual(blank.classification, "reported_purchase", "A must not become a buy");
  assert.notEqual(missing.classification, "reported_sale", "D must not become a sell");
});

test("no unclassified row is eligible for a buy or sell screen", () => {
  for (const entry of manifest.filings) {
    for (const row of parse(entry).rows) {
      if (row.classification !== "unknown_code") continue;
      assert.equal(
        isOrdinaryShareTrade(row.table, row.classification),
        false,
        `${entry.accession} row ${row.sourceOrdinal}`
      );
    }
  }
});

// --- 7. the buy/sell screen ---------------------------------------------------

test("regression: the ordinary buy/sell screen admits only non-derivative P and S", () => {
  const eligible: string[] = [];
  for (const entry of manifest.filings) {
    for (const row of parse(entry).rows) {
      if (!isOrdinaryShareTrade(row.table, row.classification)) continue;
      eligible.push(`${row.table}:${row.transactionCodeRaw}`);
    }
  }
  assert.ok(eligible.length > 0, "the corpus contains eligible trades");
  for (const entry of eligible) {
    assert.match(entry, /^nonDerivative:(P|S)$/, `${entry} must not reach a buy/sell screen`);
  }
});

test("no other code is admitted, including on the derivative table", () => {
  for (const code of ["A", "M", "F", "G", "D", "C", "J", "L", "W", "Z", "E", "H", "X", "K", "V"]) {
    const { classification } = classifyRow("transaction", code);
    assert.equal(
      isOrdinaryShareTrade("nonDerivative", classification), false,
      `code ${code} must not be a discretionary buy or sell`
    );
  }
  for (const code of ["P", "S"]) {
    const { classification } = classifyRow("transaction", code);
    assert.equal(isOrdinaryShareTrade("nonDerivative", classification), true);
    assert.equal(
      isOrdinaryShareTrade("derivative", classification), false,
      `a derivative ${code} buys an instrument, not shares`
    );
  }
  assert.equal(isOrdinaryShareTrade("nonDerivative", "holding"), false);
});

// --- corpus integrity ---------------------------------------------------------

test("every authentic fixture still matches its recorded bytes and has a source URL", () => {
  const authentic = manifest.filings.filter((f) => !f.synthetic);
  assert.equal(authentic.length, manifest.authenticCount);
  assert.ok(authentic.length >= 39, `expected at least 39 authentic fixtures, have ${authentic.length}`);

  for (const entry of authentic) {
    assert.equal(Buffer.byteLength(xmlFor(entry), "utf8"), entry.bytes, entry.accession);
    assert.ok(entry.documentUrl?.startsWith("https://www.sec.gov/Archives/"), entry.accession);
    assert.match(entry.accession, /^\d{10}-\d{2}-\d{6}$/);
  }
});

test("the single synthetic fixture is labelled and explains itself", () => {
  const synthetic = manifest.filings.filter((f) => f.synthetic);
  assert.equal(synthetic.length, 1, "only the blank-code case is synthetic");
  assert.equal(synthetic[0].documentUrl, null, "it has no SEC source, and claims none");
  assert.match(xmlFor(synthetic[0]), /SYNTHETIC FIXTURE/, "and says so in the document itself");
});
