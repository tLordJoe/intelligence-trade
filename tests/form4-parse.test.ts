import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseForm4, sha256 } from "../src/lib/form4/parse.ts";
import { classifyRow, isOrdinaryShareTrade } from "../src/lib/form4/classify.ts";
import type { Form4Filing } from "../src/lib/form4/types.ts";

/**
 * Form 4 parsing, against real filings retrieved from EDGAR.
 *
 * Everything here runs offline from `tests/fixtures/form4/`. The manifest
 * records each document's URL, accession, byte count, SHA-256 and retrieval
 * time, and a `observed` block counted by the harvester with regular
 * expressions over the raw bytes — deliberately different code from the parser
 * under test, so row-count reconciliation is not the parser marking its own
 * homework.
 */

const FIXTURE_DIR = join(import.meta.dirname, "fixtures", "form4");
const DOCUMENTS = join(FIXTURE_DIR, "documents");

interface ManifestEntry {
  file: string;
  accession: string;
  documentType: string;
  schemaVersion: string;
  issuerSymbol: string;
  issuerCik: string;
  documentName: string;
  documentUrl: string;
  indexUrl: string;
  sha256: string;
  bytes: number;
  coverage: string;
  observed: {
    codes: string[];
    owners: number;
    nonDerivTx: number;
    nonDerivHold: number;
    derivTx: number;
    derivHold: number;
    footnotes: number;
    zeroPrice: boolean;
    aff10b5: string;
  };
}

const manifest: { count: number; filings: ManifestEntry[] } = JSON.parse(
  readFileSync(join(FIXTURE_DIR, "manifest.json"), "utf8")
);

function xmlFor(entry: ManifestEntry): string {
  return readFileSync(join(DOCUMENTS, entry.file), "utf8");
}

function parse(entry: ManifestEntry, over: Record<string, unknown> = {}): Form4Filing {
  const result = parseForm4({
    xml: xmlFor(entry),
    accessionNumber: entry.accession,
    documentUrl: entry.documentUrl,
    indexUrl: entry.indexUrl,
    documentName: entry.documentName,
    importRunId: "test_run",
    firstObservedAt: "2026-09-04T00:00:00.000Z",
    ...over,
  });
  assert.equal(result.ok, true, `${entry.accession} should parse`);
  return (result as { ok: true; filing: Form4Filing }).filing;
}

const byAccession = (accession: string): ManifestEntry => {
  const entry = manifest.filings.find((f) => f.accession === accession);
  assert.ok(entry, `fixture ${accession} must exist`);
  return entry;
};

// --- the corpus --------------------------------------------------------------

test("the fixture set meets the coverage the contract requires", () => {
  assert.ok(manifest.count >= 25, `need >= 25 fixtures, have ${manifest.count}`);

  const codes = new Set(manifest.filings.flatMap((f) => f.observed.codes));
  for (const required of ["P", "S", "A", "M", "F", "G"]) {
    assert.ok(codes.has(required), `fixture set must include code ${required}`);
  }

  const types = new Set(manifest.filings.map((f) => f.documentType));
  assert.ok(types.has("4") && types.has("4/A"), "both 4 and 4/A must be represented");

  const schemas = new Set(manifest.filings.map((f) => f.schemaVersion));
  assert.ok(schemas.size >= 3, `expected several schema versions, got ${[...schemas].join(",")}`);

  assert.ok(
    manifest.filings.some((f) => f.observed.owners > 1),
    "a multi-owner filing must be covered"
  );
  assert.ok(
    manifest.filings.some((f) => f.observed.nonDerivTx === 0 && f.observed.derivTx === 0),
    "a holdings-only filing must be covered"
  );
  assert.ok(
    manifest.filings.some((f) => f.observed.derivTx > 0 && f.observed.nonDerivTx > 0),
    "a filing populating both tables must be covered"
  );
});

test("every archived document still hashes to its manifest value", () => {
  // Guards the fixtures themselves: an edited fixture is not the filing it claims.
  for (const entry of manifest.filings) {
    assert.equal(sha256(xmlFor(entry)), entry.sha256, `${entry.accession} bytes changed`);
    assert.equal(Buffer.byteLength(xmlFor(entry), "utf8"), entry.bytes);
  }
});

test("every fixture parses, and row counts reconcile against the raw byte scan", () => {
  for (const entry of manifest.filings) {
    const filing = parse(entry);
    const o = entry.observed;

    const count = (table: string, kind: string) =>
      filing.rows.filter((r) => r.table === table && r.rowKind === kind).length;

    assert.equal(count("nonDerivative", "transaction"), o.nonDerivTx, `${entry.accession} nd tx`);
    assert.equal(count("nonDerivative", "holding"), o.nonDerivHold, `${entry.accession} nd holdings`);
    assert.equal(count("derivative", "transaction"), o.derivTx, `${entry.accession} deriv tx`);
    assert.equal(count("derivative", "holding"), o.derivHold, `${entry.accession} deriv holdings`);
    assert.equal(filing.reportingOwners.length, o.owners, `${entry.accession} owners`);
    assert.equal(Object.keys(filing.footnotes).length, o.footnotes, `${entry.accession} footnotes`);
    assert.equal(filing.documentType, entry.documentType);
    assert.equal(filing.sourceSchemaVersion, entry.schemaVersion);
  }
});

test("no fixture row is silently lost: every source row is accounted for", () => {
  for (const entry of manifest.filings) {
    const filing = parse(entry);
    const expected =
      entry.observed.nonDerivTx + entry.observed.nonDerivHold +
      entry.observed.derivTx + entry.observed.derivHold;
    assert.equal(filing.rows.length, expected, `${entry.accession} total rows`);
  }
});

// --- a filing read field by field --------------------------------------------

test("a real gift filing reads exactly as the document states", () => {
  // NVDA 0001197647-26-000009. Values below were read from the XML by hand.
  const filing = parse(byAccession("0001197647-26-000009"));

  assert.equal(filing.documentType, "4");
  assert.equal(filing.sourceSchemaVersion, "X0609");
  assert.equal(filing.issuer.cik, "0001045810");
  assert.equal(filing.issuer.name, "NVIDIA CORP");
  assert.equal(filing.issuer.tradingSymbol, "NVDA");
  assert.equal(filing.periodOfReport.value, "2026-09-02");

  assert.equal(filing.reportingOwners.length, 1);
  const [owner] = filing.reportingOwners;
  assert.equal(owner.cik, "0001197647");
  assert.equal(owner.name, "COXE TENCH");
  assert.equal(owner.isDirector, true);
  assert.equal(owner.isOfficer, false);
  assert.equal(owner.isTenPercentOwner, false);

  const [gift, ...holdings] = filing.rows;
  assert.equal(gift.rowKind, "transaction");
  assert.equal(gift.transactionCodeRaw, "G");
  assert.equal(gift.classification, "gift");
  assert.equal(gift.transactionDate.value, "2026-09-02");
  assert.equal(gift.shares.value, "500000");
  assert.equal(gift.acquiredDisposedRaw, "D");
  assert.equal(gift.ownership, "indirect");
  assert.equal(gift.natureOfOwnership.value, "By Trust");
  assert.equal(gift.sharesOwnedFollowingTransaction.value, "24171360");

  assert.equal(holdings.length, 2);
  for (const holding of holdings) {
    assert.equal(holding.rowKind, "holding");
    assert.equal(holding.classification, "holding");
    assert.equal(holding.transactionDate.value, null, "a holding reports no transaction date");
    assert.equal(holding.transactionDate.reason, "not_present_in_source");
  }

  assert.equal(Object.keys(filing.footnotes).length, 4);
  assert.match(filing.footnotes.F2, /Gift without consideration/);
});

test("an explicit zero price stays zero and keeps its footnote", () => {
  // The defining case: a gift reports price 0 *and* explains it in a footnote.
  // Treating the footnote as a replacement would lose the zero; treating the
  // zero as absence would lose the fact that the filer stated it.
  const filing = parse(byAccession("0001197647-26-000009"));
  const [gift] = filing.rows;

  assert.equal(gift.pricePerShare.value, "0", "explicit zero is preserved");
  assert.equal(gift.pricePerShare.reason, null, "zero is a value, not an absence");
  assert.deepEqual(gift.pricePerShare.footnoteIds, ["F2"], "footnotes coexist with the value");
  assert.ok(gift.pricePerShare.raw !== null, "raw text is retained");
});

test("a filing-level 10b5-1 indication is not copied onto rows", () => {
  const filing = parse(byAccession("0001197647-26-000009"));
  assert.equal(filing.aff10b5One, true, "the filing carries the indication");
  assert.equal(filing.aff10b5OneRaw, "1", "the raw checkbox value is kept");
  for (const row of filing.rows) {
    assert.ok(
      !("aff10b5One" in row),
      "no row may inherit a filing-level plan indication"
    );
  }
});

// --- multi-owner --------------------------------------------------------------

test("regression: ten reporting owners do not multiply the transaction", () => {
  // VRT 0000899243-21-043640 — ten filing entities, one sale.
  const entry = byAccession("0000899243-21-043640");
  const filing = parse(entry);

  assert.equal(filing.reportingOwners.length, 10);
  assert.equal(
    filing.rows.length,
    entry.observed.nonDerivTx + entry.observed.nonDerivHold +
      entry.observed.derivTx + entry.observed.derivHold,
    "row count is independent of owner count"
  );
  assert.equal(filing.rows.filter((r) => r.rowKind === "transaction").length, 1);
});

test("entity owners are not given invented personal attributes", () => {
  const filing = parse(byAccession("0000899243-21-043640"));
  for (const owner of filing.reportingOwners) {
    assert.ok(owner.cik.length === 10, "owner CIK is zero-padded");
    assert.ok(
      !("isPerson" in owner) && !("firstName" in owner),
      "nothing may infer a natural person from an entity name"
    );
  }
  assert.match(filing.reportingOwners[0].name ?? "", /LLC|L\.L\.C|Holdings|Inc/i);
});

// --- classification never becomes a trade direction ---------------------------

test("acquired/disposed is never translated into bought/sold", () => {
  for (const entry of manifest.filings) {
    for (const row of parse(entry).rows) {
      if (row.rowKind !== "transaction") continue;
      const code = (row.transactionCodeRaw ?? "").toUpperCase();
      if (row.acquiredDisposedRaw === "A" && code !== "P") {
        assert.notEqual(row.classification, "reported_purchase", `${entry.accession} ${code}`);
      }
      if (row.acquiredDisposedRaw === "D" && code !== "S") {
        assert.notEqual(row.classification, "reported_sale", `${entry.accession} ${code}`);
      }
    }
  }
});

test("gifts, awards and withholding never classify as purchases or sales", () => {
  const forbidden = new Set(["reported_purchase", "reported_sale"]);
  for (const [code, expected] of [
    ["G", "gift"], ["A", "award"], ["F", "withholding_or_exercise_cost"],
    ["M", "exercise_or_conversion"], ["D", "disposition_to_issuer"],
  ] as const) {
    const { classification } = classifyRow("transaction", code);
    assert.equal(classification, expected);
    assert.ok(!forbidden.has(classification), `${code} must not be a buy or sell`);
  }
});

test("derivative rows are excluded from ordinary-share screens even when coded P or S", () => {
  assert.equal(isOrdinaryShareTrade("nonDerivative", "reported_purchase"), true);
  assert.equal(isOrdinaryShareTrade("derivative", "reported_purchase"), false);
  assert.equal(isOrdinaryShareTrade("derivative", "reported_sale"), false);
  assert.equal(isOrdinaryShareTrade("nonDerivative", "award"), false);
});

test("exercise legs stay separate rows, never paired automatically", () => {
  // An M exercise reports a derivative disposal and a non-derivative
  // acquisition. They must remain two source rows; linking them is a later
  // derived feature that requires evidence.
  const withBoth = manifest.filings.filter(
    (f) => f.observed.derivTx > 0 && f.observed.nonDerivTx > 0
  );
  assert.ok(withBoth.length > 0, "need a fixture with both tables");
  for (const entry of withBoth) {
    const filing = parse(entry);
    const ids = new Set(filing.rows.map((r) => r.id));
    assert.equal(ids.size, filing.rows.length, "every row keeps a distinct identity");
    for (const row of filing.rows) {
      assert.ok(!("linkedRowId" in row), "no automatic exercise pairing");
    }
  }
});

test("K and V are modifiers, not transaction events", () => {
  assert.equal(classifyRow("transaction", "K").classification, "unknown_code");
  assert.equal(classifyRow("transaction", "V").classification, "unknown_code");
  assert.match(classifyRow("transaction", "K").warnings[0], /modifier_code/);
});

test("an unrecognized code is preserved and flagged, never guessed", () => {
  const { classification, warnings } = classifyRow("transaction", "Q");
  assert.equal(classification, "unknown_code");
  assert.deepEqual(warnings, ["unrecognized_transaction_code:Q"]);
});

// --- identity is stable across re-parsing -------------------------------------

test("regression: re-parsing identical bytes reproduces identical row ids", () => {
  for (const entry of manifest.filings.slice(0, 8)) {
    const first = parse(entry);
    const second = parse(entry, { importRunId: "later_run", firstObservedAt: "2027-01-01T00:00:00.000Z" });
    assert.deepEqual(
      second.rows.map((r) => r.id),
      first.rows.map((r) => r.id),
      `${entry.accession} row ids must not move between runs`
    );
    assert.equal(second.id, first.id, "filing identity is tied to bytes, not to the run");
    assert.equal(second.documentSha256, first.documentSha256);
  }
});

test("row identity is scoped to accession, document, table, kind and ordinal", () => {
  const filing = parse(byAccession("0001197647-26-000009"));
  const [row] = filing.rows;
  assert.equal(
    row.id,
    `${filing.accessionNumber}::${filing.documentSha256}::nonDerivative::transaction::0`
  );
  const ordinals = filing.rows.map((r) => `${r.table}/${r.rowKind}/${r.sourceOrdinal}`);
  assert.equal(new Set(ordinals).size, ordinals.length, "ordinals are unique within a table");
});

test("identical-looking rows within one document remain distinct", () => {
  const filing = parse(byAccession("0001197647-26-000009"));
  const holdings = filing.rows.filter((r) => r.rowKind === "holding");
  assert.equal(holdings.length, 2);
  assert.notEqual(holdings[0].id, holdings[1].id, "same security, two holdings, two rows");
});

// --- amendments ---------------------------------------------------------------

test("a 4/A is never auto-linked to the filing it amends", () => {
  const amendments = manifest.filings.filter((f) => f.documentType === "4/A");
  assert.ok(amendments.length >= 3, "need amendment fixtures");
  for (const entry of amendments) {
    const filing = parse(entry);
    assert.ok(filing.amendment, "an amendment carries a link record");
    assert.equal(filing.amendment!.status, "unresolved", `${entry.accession} must not self-resolve`);
    assert.equal(filing.amendment!.originalAccession, null);
  }
});

test("an ordinary Form 4 carries no amendment record at all", () => {
  const original = manifest.filings.find((f) => f.documentType === "4")!;
  assert.equal(parse(original).amendment, null);
});
