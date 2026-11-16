import assert from "node:assert/strict";
import test from "node:test";
import { executiveRows, queryExecutiveRows, trumpReport } from "../src/lib/executive-disclosures.ts";

test("indexed rows span only the two reviewed pages and retain unique source positions", () => {
  assert.deepEqual(executiveRows.map(row => row.line), Array.from({ length: 55 }, (_, n) => n + 463));
  assert.equal(executiveRows.filter(row => row.side === "purchase").length, 40);
  assert.equal(executiveRows.filter(row => row.side === "sale").length, 15);
  for (const row of executiveRows) {
    assert.ok(row.tradedAt < trumpReport.signedDate);
    assert.ok(row.amountLow < row.amountHigh);
    assert.equal(row.sourceUrl, `${trumpReport.sourceUrl}#page=${row.line <= 495 ? 16 : 17}`);
  }
});

test("Nvidia’s sale and purchase search as separate source rows", () => {
  const both = queryExecutiveRows({ q: "NVDA" });
  assert.deepEqual(both.rows.map(row => [row.side, row.tradedAt, row.line, row.amountLow, row.amountHigh]), [
    ["sale", "2026-08-21", 473, 500001, 1000000],
    ["purchase", "2026-08-17", 508, 500001, 1000000],
  ]);
  assert.equal(queryExecutiveRows({ q: " nvidia ", side: "sale" }).total, 1);
  assert.equal(queryExecutiveRows({ q: "SPACEX", side: "purchase" }).rows[0]?.line, 517);
});

test("filters and pagination handle repeated, invalid and out-of-range parameters", () => {
  assert.equal(queryExecutiveRows({}).pageCount, 4);
  assert.equal(queryExecutiveRows({ page: "500" }).rows.length, 10);
  assert.equal(queryExecutiveRows({ page: "-2", side: "bad" }).page, 1);
  assert.deepEqual(queryExecutiveRows({ q: ["GOOGL", "nvidia"] }).rows.map(row => row.line), [510, 511]);
  assert.equal(queryExecutiveRows({ q: "no such issuer" }).total, 0);
});
