import assert from "node:assert/strict";
import test from "node:test";

import { parseForm4 } from "../src/lib/form4/parse.ts";
import { DEFAULT_LIMITS, parseXml, XmlError } from "../src/lib/form4/xml.ts";
import {
  normalizeAccession,
  normalizeCik,
  parseBoolean,
  parseDate,
  parseDecimal,
  unresolvedFootnoteIds,
} from "../src/lib/form4/validate.ts";
import type { Form4Filing, UnsupportedDocument } from "../src/lib/form4/types.ts";

/**
 * Hostile and malformed input, and the value rules that keep "we do not know"
 * from becoming "zero", "false", or a date that never happened.
 *
 * Synthetic documents, deliberately: the cases here are ones no legitimate
 * filing contains, and waiting to encounter a malicious one in production is
 * not a test strategy.
 */

const BASE = {
  accessionNumber: "0001234567-26-000001",
  documentUrl: "https://www.sec.gov/Archives/edgar/data/1/000/doc.xml",
  indexUrl: "https://www.sec.gov/Archives/edgar/data/1/000/index.htm",
  documentName: "doc.xml",
  importRunId: "safety_test",
  firstObservedAt: "2026-09-04T00:00:00.000Z",
};

const run = (xml: string) => parseForm4({ ...BASE, xml });
const asUnsupported = (r: ReturnType<typeof run>): UnsupportedDocument => {
  assert.equal(r.ok, false, "expected the document to be refused");
  return (r as { ok: false; unsupported: UnsupportedDocument }).unsupported;
};
const asFiling = (r: ReturnType<typeof run>): Form4Filing => {
  assert.equal(r.ok, true, "expected the document to parse");
  return (r as { ok: true; filing: Form4Filing }).filing;
};

function doc(body: string, type = "4"): string {
  return `<?xml version="1.0"?><ownershipDocument><schemaVersion>X0609</schemaVersion>
<documentType>${type}</documentType><periodOfReport>2026-09-02</periodOfReport>
<issuer><issuerCik>0000123456</issuerCik><issuerName>Test Co</issuerName>
<issuerTradingSymbol>TST</issuerTradingSymbol></issuer>
<reportingOwner><reportingOwnerId><rptOwnerCik>0000999999</rptOwnerCik>
<rptOwnerName>DOE JANE</rptOwnerName></reportingOwnerId>
<reportingOwnerRelationship><isDirector>1</isDirector></reportingOwnerRelationship></reportingOwner>
${body}</ownershipDocument>`;
}

// --- hostile XML --------------------------------------------------------------

test("regression: an external entity declaration is refused, never expanded", () => {
  // The classic XXE payload. It must not be parsed, and must not be read from.
  const xxe = `<?xml version="1.0"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<ownershipDocument><documentType>4</documentType><remarks>&xxe;</remarks></ownershipDocument>`;

  const unsupported = asUnsupported(run(xxe));
  assert.equal(unsupported.reason, "xml_refused");
  assert.match(unsupported.detail, /doctype/i);
  assert.doesNotMatch(unsupported.detail, /root:/, "no file content may leak into the record");
});

test("an entity declaration without a doctype is also refused", () => {
  assert.throws(
    () => parseXml(`<!ENTITY x "y"><ownershipDocument/>`),
    (e: unknown) => e instanceof XmlError && e.code === "entity_forbidden"
  );
});

test("an unknown named entity is refused rather than passed through", () => {
  assert.throws(
    () => parseXml(`<ownershipDocument><remarks>&secret;</remarks></ownershipDocument>`),
    (e: unknown) => e instanceof XmlError && e.code === "unexpected_entity"
  );
});

test("the five predefined entities and numeric references still decode", () => {
  const node = parseXml(
    `<ownershipDocument><remarks>A &amp; B &lt;x&gt; &quot;q&quot; &#65;&#x42;</remarks></ownershipDocument>`
  );
  assert.equal(node.children[0].text, 'A & B <x> "q" AB');
});

test("oversized input is refused before it is parsed", () => {
  const huge = "x".repeat(DEFAULT_LIMITS.maxBytes + 1);
  assert.throws(
    () => parseXml(huge),
    (e: unknown) => e instanceof XmlError && e.code === "too_large"
  );
});

test("deeply nested input is refused rather than recursed", () => {
  const depth = DEFAULT_LIMITS.maxDepth + 5;
  const nested = "<a>".repeat(depth) + "</a>".repeat(depth);
  assert.throws(
    () => parseXml(`<ownershipDocument>${nested}</ownershipDocument>`),
    (e: unknown) => e instanceof XmlError && e.code === "too_deep"
  );
});

test("malformed XML is refused, never half-parsed", () => {
  for (const bad of [
    "<ownershipDocument><a></b></ownershipDocument>",
    "<ownershipDocument><a>",
    "<ownershipDocument",
    "not xml at all",
  ]) {
    const result = run(bad);
    assert.equal(result.ok, false, `${bad.slice(0, 24)} must be refused`);
  }
});

// --- documents we recognise but do not support --------------------------------

test("Forms 3 and 5 are recognised and refused, not parsed as Form 4", () => {
  for (const type of ["3", "5", "3/A", "5/A"]) {
    const unsupported = asUnsupported(run(doc("", type)));
    assert.equal(unsupported.reason, "unsupported_form_type");
    assert.equal(unsupported.declaredType, type);
  }
});

test("a non-ownership document is refused", () => {
  const unsupported = asUnsupported(run(`<?xml version="1.0"?><submission><type>13F</type></submission>`));
  assert.equal(unsupported.reason, "not_an_ownership_document");
});

test("an unfamiliar schema version is refused rather than guessed at", () => {
  const xml = doc("").replace("X0609", "X9999");
  const unsupported = asUnsupported(run(xml));
  assert.equal(unsupported.reason, "unsupported_schema_version");
});

// --- unknown is not zero, false, or a date ------------------------------------

test("regression: a missing numeric is null, never zero", () => {
  const xml = doc(`<nonDerivativeTable><nonDerivativeTransaction>
<securityTitle><value>Common</value></securityTitle>
<transactionDate><value>2026-09-02</value></transactionDate>
<transactionCoding><transactionCode>P</transactionCode></transactionCoding>
<transactionAmounts><transactionShares><value>100</value></transactionShares>
<transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts>
</nonDerivativeTransaction></nonDerivativeTable>`);
  const [row] = asFiling(run(xml)).rows;

  assert.equal(row.pricePerShare.value, null, "an absent price is not zero");
  assert.equal(row.pricePerShare.reason, "not_present_in_source");
  assert.notEqual(row.pricePerShare.value, "0");
});

test("a price expressed only as a footnote is absence with a reason", () => {
  const xml = doc(`<nonDerivativeTable><nonDerivativeTransaction>
<securityTitle><value>Common</value></securityTitle>
<transactionDate><value>2026-09-02</value></transactionDate>
<transactionCoding><transactionCode>S</transactionCode></transactionCoding>
<transactionAmounts><transactionShares><value>10</value></transactionShares>
<transactionPricePerShare><footnoteId id="F1"/></transactionPricePerShare>
<transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode></transactionAmounts>
</nonDerivativeTransaction></nonDerivativeTable>
<footnotes><footnote id="F1">Weighted average price.</footnote></footnotes>`);
  const [row] = asFiling(run(xml)).rows;

  assert.equal(row.pricePerShare.value, null);
  assert.equal(row.pricePerShare.reason, "footnote_instead_of_value");
  assert.deepEqual(row.pricePerShare.footnoteIds, ["F1"]);
});

test("impossible calendar dates are rejected, not rolled forward", () => {
  // new Date("2026-02-31") silently becomes March 3.
  for (const bad of ["2026-02-31", "2025-02-29", "2026-13-01", "2026-00-10", "2026-04-31"]) {
    const parsed = parseDate(bad);
    assert.equal(parsed.value, null, `${bad} must not parse`);
    assert.equal(parsed.reason, "unparseable");
    assert.equal(parsed.raw, bad, "the raw text is retained for review");
  }
  assert.equal(parseDate("2024-02-29").value, "2024-02-29", "a real leap day parses");
});

test("an absent boolean is null, never false", () => {
  const xml = doc(``).replace("<isDirector>1</isDirector>", "");
  const filing = asFiling(run(xml));
  const [owner] = filing.reportingOwners;
  assert.equal(owner.isDirector, null, "absence is not a denial");
  assert.equal(owner.isOfficer, null);
  assert.notEqual(owner.isDirector, false);
});

test("boolean spellings across schema versions all normalize", () => {
  assert.equal(parseBoolean("1"), true);
  assert.equal(parseBoolean("0"), false);
  assert.equal(parseBoolean("true"), true);
  assert.equal(parseBoolean("false"), false);
  assert.equal(parseBoolean(""), null);
  assert.equal(parseBoolean(undefined), null);
  assert.equal(parseBoolean("yes"), null, "an unrecognized value is unknown, not true");
});

test("a present but malformed number is quarantined, not coerced", () => {
  const xml = doc(`<nonDerivativeTable><nonDerivativeTransaction>
<securityTitle><value>Common</value></securityTitle>
<transactionDate><value>2026-09-02</value></transactionDate>
<transactionCoding><transactionCode>P</transactionCode></transactionCoding>
<transactionAmounts><transactionShares><value>1,00O</value></transactionShares>
<transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts>
</nonDerivativeTransaction></nonDerivativeTable>`);
  const [row] = asFiling(run(xml)).rows;

  assert.equal(row.shares.value, null);
  assert.equal(row.shares.reason, "unparseable");
  assert.equal(row.validation, "quarantined");
  assert.ok(row.warnings.includes("shares_unparseable"));
});

test("decimals are normalized as strings and never become floats", () => {
  assert.equal(parseDecimal("0").value, "0");
  assert.equal(parseDecimal("0.00").value, "0", "zero in any spelling is zero");
  assert.equal(parseDecimal("1234.5600").value, "1234.56");
  assert.equal(parseDecimal("0.1").value, "0.1");
  // A share count beyond exact float representation survives intact.
  assert.equal(parseDecimal("9007199254740993").value, "9007199254740993");
  assert.equal(parseDecimal("1e5").value, null, "scientific notation is not the source grammar");
  assert.equal(parseDecimal("").value, null);
});

test("an unresolved footnote reference blocks the row", () => {
  const xml = doc(`<nonDerivativeTable><nonDerivativeTransaction>
<securityTitle><value>Common</value></securityTitle>
<transactionDate><value>2026-09-02</value></transactionDate>
<transactionCoding><transactionCode>P</transactionCode></transactionCoding>
<transactionAmounts><transactionShares><value>10</value><footnoteId id="F9"/></transactionShares>
<transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts>
</nonDerivativeTransaction></nonDerivativeTable>`);
  const [row] = asFiling(run(xml)).rows;

  assert.equal(row.validation, "quarantined");
  assert.ok(row.warnings.some((w) => w === "unresolved_footnote:F9"));
  assert.deepEqual(unresolvedFootnoteIds(["F1", "F9"], { F1: "declared" }), ["F9"]);
});

// --- repeated vs singleton elements -------------------------------------------

test("a single row and many rows are handled identically", () => {
  const one = `<nonDerivativeHolding><securityTitle><value>Common</value></securityTitle>
<postTransactionAmounts><sharesOwnedFollowingTransaction><value>5</value></sharesOwnedFollowingTransaction></postTransactionAmounts>
<ownershipNature><directOrIndirectOwnership><value>D</value></directOrIndirectOwnership></ownershipNature></nonDerivativeHolding>`;

  const single = asFiling(run(doc(`<nonDerivativeTable>${one}</nonDerivativeTable>`)));
  const triple = asFiling(run(doc(`<nonDerivativeTable>${one}${one}${one}</nonDerivativeTable>`)));

  assert.equal(single.rows.length, 1);
  assert.equal(triple.rows.length, 3, "repeated identical elements are all kept");
  assert.deepEqual(triple.rows.map((r) => r.sourceOrdinal), [0, 1, 2]);
  assert.equal(new Set(triple.rows.map((r) => r.id)).size, 3, "and stay distinct");
});

test("an empty table element yields no rows and no error", () => {
  const filing = asFiling(run(doc(`<nonDerivativeTable></nonDerivativeTable><derivativeTable></derivativeTable>`)));
  assert.deepEqual(filing.rows, []);
});

// --- identifier normalization --------------------------------------------------

test("CIKs and accessions normalize to their canonical forms", () => {
  assert.equal(normalizeCik("1045810"), "0001045810");
  assert.equal(normalizeCik("0001045810"), "0001045810");
  assert.equal(normalizeCik(""), null);
  assert.equal(normalizeAccession("000119764726000009"), "0001197647-26-000009");
  assert.equal(normalizeAccession("0001197647-26-000009"), "0001197647-26-000009");
  assert.equal(normalizeAccession("123"), null, "a short accession is refused, not padded");
});

// --- provenance ----------------------------------------------------------------

test("publiclyAvailableAt is never fabricated", () => {
  const filing = asFiling(run(doc("")));
  assert.equal(filing.timestamps.publiclyAvailableAt.value, null);
  assert.equal(filing.timestamps.publiclyAvailableAt.reason, "not_present_in_source");
});

test("the issuer's own symbol is not promoted to a resolved ticker", () => {
  const filing = asFiling(run(doc("")));
  assert.equal(filing.issuer.tradingSymbol, "TST", "the filed symbol is kept");
  assert.equal(filing.issuer.resolvedTicker, null, "but resolution has not happened");
  assert.equal(filing.issuer.tickerResolution, "unresolved");
});
