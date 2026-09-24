import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseForm4 } from "../src/lib/form4/parse.ts";
import { reconcileForm4Rows } from "../src/lib/form4/reconcile.ts";
import { buildInsiderActivity } from "../src/lib/form4/activity.ts";

function setup() {
  const dir = join(import.meta.dirname, "fixtures", "form4");
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const entry = manifest.filings.find((item: { accession: string }) => item.accession === "0001045810-23-000006");
  const parsed = parseForm4({
    xml: readFileSync(join(dir, "documents", entry.file), "utf8"), accessionNumber: entry.accession,
    documentUrl: entry.documentUrl, indexUrl: entry.indexUrl, documentName: entry.documentName,
    importRunId: "test", firstObservedAt: "2026-09-13T00:00:00.000Z", filedDate: "2023-01-25",
  });
  assert.ok(parsed.ok);
  // These test-only values isolate view-model behavior from fixture content.
  const filing = parsed.filing;
  const row = filing.rows[0];
  row.classification = "reported_purchase";
  row.transactionCodeRaw = "P";
  row.acquiredDisposedRaw = "A";
  row.transactionDate = { value: "2023-01-20", raw: "2023-01-20", reason: null, footnoteIds: [] };
  row.shares = { value: "100", raw: "100", reason: null, footnoteIds: [] };
  assert.equal(row.table, "nonDerivative");
  filing.rows = [row];
  const identities = [{ ticker: filing.issuer.tradingSymbol!, cik: filing.issuer.cik }];
  const run = () => buildInsiderActivity(reconcileForm4Rows([filing], []), identities, "2023-01-01", "2023-01-31");
  return { filing, row, identities, run };
}
test("activity keeps source context and never computes cash paid", () => {
  const { run, filing, row } = setup();
  const result = run();
  assert.equal(result.records.length, 1);
  const record = result.records[0];
  assert.equal(record.sourceUrl, filing.documentUrl);
  assert.equal(record.reportedShares, "100");
  assert.deepEqual(record.footnotes, filing.footnotes);
  assert.equal(record.priceQuality, row.priceQuality);
  assert.equal("transactionValue" in record, false);
});
test("joint reporting owners do not multiply source rows", () => {
  const { filing, run } = setup();
  filing.reportingOwners.push({ ...filing.reportingOwners[0], cik: "0000000001" });
  const result = run();
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].reportingOwners.length, 2);
});
test("awards and derivative purchases are excluded", () => {
  const { row, run } = setup();
  row.classification = "award";
  assert.equal(run().records.length, 0);
  row.classification = "reported_purchase";
  row.table = "derivative";
  row.id = `${row.filingId}::${row.table}::${row.rowKind}::${row.sourceOrdinal}`;
  assert.equal(run().excluded.not_non_derivative_purchase_or_sale, 1);
});
test("raw code and acquisition/disposition conflicts cannot become purchases", () => {
  const { row, run } = setup();
  row.acquiredDisposedRaw = "D";
  assert.equal(run().excluded.classification_conflict, 1);
});
test("symbol lookup requires matching issuer identity and unambiguous mapping", () => {
  const { identities, run } = setup();
  identities.push({ ...identities[0], cik: "0000000001" });
  assert.equal(run().excluded.unresolved_issuer_symbol, 1);
});
test("missing price stays null with its reason", () => {
  const { row, run } = setup();
  row.pricePerShare = { value: null, raw: null, reason: "footnote_instead_of_value", footnoteIds: ["F1"] };
  row.priceQuality = "footnote_only";
  const record = run().records[0];
  assert.equal(record.reportedPrice.value, null);
  assert.equal(record.priceQuality, "footnote_only");
});
test("missing filing dates are not inferred from observation timestamps", () => {
  const { filing, run } = setup();
  filing.timestamps.filedDate.value = null;
  assert.equal(run().excluded.missing_or_invalid_dates, 1);
});
test("filter follows transaction date, not filing date", () => {
  const { row, run } = setup();
  row.transactionDate.value = "2022-12-31";
  assert.equal(run().excluded.outside_transaction_window, 1);
});
test("non-SEC URLs are refused", () => {
  const { filing, run } = setup();
  filing.documentUrl = "https://www.sec.gov.attacker.example/Archives/edgar/data/test";
  assert.equal(run().excluded.invalid_source, 1);
});
test("zero or negative shares cannot appear as reported purchases", () => {
  const { row, run } = setup();
  row.shares.value = "0.00";
  assert.equal(run().records.length, 0);
  row.shares.value = "-1";
  assert.equal(run().records.length, 0);
});
test("unreconciled input and invalid date windows are refused", () => {
  const { filing, identities } = setup();
  const ready = reconcileForm4Rows([filing], []);
  assert.throws(() => buildInsiderActivity({ ...ready, ready: false }, identities, "2023-01-01", "2023-01-31"));
  assert.throws(() => buildInsiderActivity(ready, identities, "2023-02-31", "2023-03-10"));
});
