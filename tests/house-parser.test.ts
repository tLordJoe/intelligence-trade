import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyZeroRow,
  parseAmount,
  parseFilingRows,
  stripPageFurniture,
} from "../src/lib/house-parser.ts";

/**
 * Regression fixtures taken verbatim from real filings.
 *
 * Each one is a defect that reached production, kept here as the source text
 * that exposed it. Filing ids are in the file names so a reader can pull the
 * original PDF from the Clerk's site and check the claim.
 */

function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
}

// --- exact amounts were read as "no amount" ---------------------------------

test("regression: an exact disclosed figure is an amount, not an absence", () => {
  // Filing 20034999 (Wasserman Schultz, ICHR) discloses $2,722.50 — an exact
  // figure, not a bracket. The old pattern matched only `$X - $Y`, so the row
  // was stored with amount "" and bounds 0/0.
  const text = fixture("20034999-ichor-exact-amount.txt");
  const { rows } = parseFilingRows(text);

  const ichor = rows.find((r) => r.tickerText === "ICHR");
  assert.ok(ichor, "the ICHR row must parse");
  assert.equal(ichor.amount.status, "disclosed_exact");
  assert.equal(ichor.amount.low, 2722.5);
  assert.equal(ichor.amount.high, 2722.5);
  assert.equal(ichor.amount.text, "$2,722.50");
  assert.equal(ichor.type, "Sell");
  assert.equal(ichor.issuerName, "Ichor Holdings - Ordinary Shares");
});

test("regression: the Versant spinoff exchange discloses $15.00", () => {
  // Filing 20033725 (Pelosi, VSNT). Recorded as amountless; the filing states
  // an exact $15.00 against a spinoff share surrender.
  const text = fixture("20033725-versant-exact-amount.txt");
  const { rows } = parseFilingRows(text);

  const versant = rows.find((r) => r.tickerText === "VSNT");
  assert.ok(versant, "the VSNT row must parse");
  assert.equal(versant.type, "Exchange");
  assert.equal(versant.amount.status, "disclosed_exact");
  assert.equal(versant.amount.low, 15);
  assert.equal(versant.amount.high, 15);
});

// --- rows lost to a page break ----------------------------------------------

test("regression: a row whose symbol prints after its cells is not dropped", () => {
  // Filing 20033725 (Pelosi, TEM). The issuer name wrapped across a page break,
  // so `(TEM) [ST]` printed after the type, dates and the start of the amount.
  // The old parser looked for the type only in the 30 characters *after* the
  // symbol, found none, and dropped the transaction without a trace.
  const text = fixture("20033725-tempus-page-break.txt");
  const { rows, skipped } = parseFilingRows(text);

  const tem = rows.find((r) => r.tickerText === "TEM");
  assert.ok(tem, "the Tempus AI transaction must survive the page break");
  assert.equal(tem.type, "Buy");
  assert.equal(tem.transactionDateText, "01/16/2026");
  assert.equal(tem.wrappedLayout, true, "and be marked as reassembled");
  assert.equal(
    tem.issuerName,
    "Tempus AI, Inc. - Class A Common Stock",
    "the name is rejoined from both sides of the break"
  );
  assert.equal(skipped.length, 0, "nothing is silently skipped");
});

test("regression: an amount range split across a page break is rejoined", () => {
  // Same filing: "$50,001 -" ends one page, "$100,000" resumes on the next.
  const text = fixture("20033725-tempus-page-break.txt");
  const tem = parseFilingRows(text).rows.find((r) => r.tickerText === "TEM");

  assert.equal(tem?.amount.status, "disclosed_range");
  assert.equal(tem?.amount.low, 50001);
  assert.equal(tem?.amount.high, 100000);
});

test("regression: Exxon's split range rejoins to $15,001 - $50,000", () => {
  // Filing 20034660 (Walberg, XOM), the same wrap in a different filing.
  const text = fixture("20034660-exxon-split-range.txt");
  const xom = parseFilingRows(text).rows.find((r) => r.tickerText === "XOM");

  assert.ok(xom, "the XOM row must parse");
  assert.equal(xom.type, "Buy");
  assert.equal(xom.amount.low, 15001);
  assert.equal(xom.amount.high, 50000);
  assert.equal(xom.issuerName, "Exxon Mobil Corporation Common Stock");
});

test("regression: a wrapped row interrupted by a filing id still parses", () => {
  // Filing 20033737 (McClain Delaney, IDXX). Here the wrap put "Filing ID #..."
  // between the cells and the symbol.
  const text = fixture("20033737-idexx-wrapped.txt");
  const idxx = parseFilingRows(text).rows.find((r) => r.tickerText === "IDXX");

  assert.ok(idxx, "the IDXX row must parse");
  assert.equal(idxx.type, "Sell");
  assert.equal(idxx.amount.low, 1001);
  assert.equal(idxx.amount.high, 15000);
  assert.doesNotMatch(idxx.issuerName, /Filing ID/, "the filing id is not a name");
  assert.equal(idxx.issuerName, "IDEXX Laboratories, Inc. - Common Stock");
});

// --- page furniture ----------------------------------------------------------

test("page footers are removed and the column header leaves an anchor", () => {
  const text = "Alpha $50,001 -\n\n-- 2 of 3 --\n\nID \tOwner Asset \tTransaction\nType\nDate \tNotification\nDate\nAmount \tCap.\nGains >\n$200?\nBeta";
  const stripped = stripPageFurniture(text);

  assert.doesNotMatch(stripped, /-- 2 of 3 --/, "the footer is gone");
  assert.doesNotMatch(stripped, /\$200\?/, "the header's $200 is not an amount");
  assert.match(stripped, /Amount/, "an anchor survives for name bounding");
});

test("the header's $200 is never read as a transaction amount", () => {
  const amount = parseAmount("Something Cap. Gains > $200? and nothing else");
  assert.equal(amount.status, "not_disclosed");
  assert.equal(amount.low, null);
});

// --- amount interpretation ---------------------------------------------------

test("a range is preferred over any single figure in the same block", () => {
  const amount = parseAmount("P 01/02/2026 $1,001 - $15,000 extra $99");
  assert.equal(amount.status, "disclosed_range");
  assert.equal(amount.low, 1001);
  assert.equal(amount.high, 15000);
});

test("a dangling lower bound with no closing figure is a parse failure", () => {
  // Distinct from "the filer disclosed nothing": a number is visibly present.
  const amount = parseAmount("P 01/02/2026 $50,001 - ");
  assert.equal(amount.status, "parse_failed");
  assert.equal(amount.low, null);
  assert.equal(amount.high, null);
});

test("a split range is only rejoined when the bounds are ordered", () => {
  // Guards the rejoin against fusing two unrelated figures.
  const bad = parseAmount("$50,001 - Stock (X) [ST] $1,000");
  assert.notEqual(bad.status, "disclosed_range");
  assert.equal(bad.low, null);
});

test("no amount at all is not-disclosed, with null bounds", () => {
  const amount = parseAmount("P 01/02/2026 no figures here");
  assert.equal(amount.status, "not_disclosed");
  assert.equal(amount.low, null);
  assert.equal(amount.high, null);
});

test("an explicit N/A is not-applicable", () => {
  const amount = parseAmount("E 01/02/2026 N/A");
  assert.equal(amount.status, "not_applicable");
  assert.equal(amount.low, null);
});

test("no parsed amount is ever zero", () => {
  for (const block of [
    "P 01/02/2026 $1,001 - $15,000",
    "S 01/02/2026 $2,722.50",
    "E 01/02/2026 N/A",
    "P 01/02/2026 nothing",
    "P 01/02/2026 $50,001 - ",
  ]) {
    const amount = parseAmount(block);
    assert.notEqual(amount.low, 0, block);
    assert.notEqual(amount.high, 0, block);
  }
});

// --- issuer names ------------------------------------------------------------

test("a corporate suffix does not end the issuer name", () => {
  // "ServiceNow, Inc. Common Stock" must not be cut to "Common Stock", and
  // "C.H. Robinson" must not lose its initials.
  const text =
    "SP C.H. Robinson Worldwide, Inc. - Common Stock (CHRW) [ST] P 05/21/2026 05/28/2026 $1,001 - $15,000";
  const row = parseFilingRows(text).rows[0];
  assert.equal(row.issuerName, "C.H. Robinson Worldwide, Inc. - Common Stock");
});

test("a filer's free-text description does not bleed into the next name", () => {
  const text =
    "SP D: Cash-out payment due to privatization of Something. Hologic, Inc. - Common Stock (HOLX) [ST] S 04/08/2026 05/03/2026 $1,001 - $15,000";
  const row = parseFilingRows(text).rows[0];
  assert.equal(row.issuerName, "Hologic, Inc. - Common Stock");
});

// --- zero-row classification -------------------------------------------------

test("a scanned filing extracting only page footers is classified as empty", () => {
  const text = "\n\n-- 1 of 2 --\n\n\n\n-- 2 of 2 --\n\n";
  const parse = parseFilingRows(text);
  assert.equal(parse.rows.length, 0);
  assert.equal(
    classifyZeroRow(text, parse).classification,
    "empty_text_extraction"
  );
});

test("an unsupported asset type is reported as such, with the code named", () => {
  // LTC [CT] is Litecoin — a real holding, but not a public-security
  // transaction this parser handles. Naming the code is what makes the
  // exclusion reviewable rather than a silent drop.
  const text = `${"Periodic Transaction Report filler. ".repeat(12)}SP Litecoin (LTC) [CT] P 01/02/2026 $1,001 - $15,000`;
  const parse = parseFilingRows(text);
  const detail = classifyZeroRow(text, parse);

  assert.equal(parse.rows.length, 0);
  assert.equal(detail.classification, "no_supported_security_transaction");
  assert.deepEqual(detail.unsupportedAssetTypes, ["CT"]);
});

test("a supported symbol that yields no row is suspicious, never healthy", () => {
  // The blocking case: [ST] is supported, so producing nothing from it is
  // unexplained. This is the classification wired to a gate failure.
  const text = `${"Periodic Transaction Report filler. ".repeat(12)}SP Some Corp (ABC) [ST] no type marker here at all`;
  const parse = parseFilingRows(text);

  assert.equal(parse.rows.length, 0);
  assert.equal(parse.skipped.length, 1, "the block is recorded as skipped");
  assert.equal(parse.skipped[0].tickerText, "ABC");
  assert.equal(classifyZeroRow(text, parse).classification, "parser_suspicious");
});

test("a filing with a body but no ticker at all is classified separately", () => {
  const text = `${"Periodic Transaction Report. Asset holdings follow. ".repeat(10)}No securities disclosed.`;
  const parse = parseFilingRows(text);
  assert.equal(
    classifyZeroRow(text, parse).classification,
    "no_ticker_present"
  );
});

test("a document without a recognisable PTR body is an unsupported layout", () => {
  const text = "x".repeat(400);
  const parse = parseFilingRows(text);
  assert.equal(classifyZeroRow(text, parse).classification, "unsupported_layout");
});

// --- ordinary rows are unaffected -------------------------------------------

test("an ordinary row still parses unchanged", () => {
  const text =
    "SP Apple Inc. - Common Stock (AAPL) [ST] P 07/01/2026 07/14/2026 $1,001 - $15,000";
  const row = parseFilingRows(text).rows[0];

  assert.equal(row.tickerText, "AAPL");
  assert.equal(row.type, "Buy");
  assert.equal(row.amount.status, "disclosed_range");
  assert.equal(row.amount.low, 1001);
  assert.equal(row.amount.high, 15000);
  assert.equal(row.issuerName, "Apple Inc. - Common Stock");
  assert.equal(row.wrappedLayout, false, "an ordinary row is not 'reassembled'");
});

test("owner extraction is unchanged, so record identity does not move", () => {
  // `ownerText` feeds the content hash and the reconciliation key. It is read
  // from the head of the filing rather than the row, which is a real defect —
  // but correcting it would re-identify every stored record, so it is left
  // exactly as it was and fixed under its own migration. This test exists to
  // fail loudly if that behaviour is changed without one.
  const text =
    "SP Apple Inc. - Common Stock (AAPL) [ST] P 07/01/2026 07/14/2026 $1,001 - $15,000 " +
    "JT Beta Corp - Common Stock (BBB) [ST] S 07/02/2026 07/14/2026 $1,001 - $15,000";
  const { rows } = parseFilingRows(text);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].ownerText, "SP", "taken from the head of the document");
  assert.equal(
    rows[1].ownerText,
    "SP",
    "and applied to every row — the defect, pinned deliberately"
  );
});

test("row ordinals count skipped blocks, so recovering rows never shifts ids", () => {
  const text =
    "SP Alpha Corp (AAA) [ST] P 01/02/2026 $1,001 - $15,000 " +
    "SP Beta Corp (BBB) [ST] no type at all here whatsoever " +
    "SP Gamma Corp (CCC) [ST] S 01/03/2026 $1,001 - $15,000";
  const { rows, skipped } = parseFilingRows(text);

  assert.deepEqual(rows.map((r) => r.rowIndex), [0, 2]);
  assert.deepEqual(skipped.map((s) => s.rowIndex), [1]);
});
