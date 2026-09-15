/**
 * The coverage report must be honest by construction: every identity the
 * catalog does not resolve appears in it by name, and the counts it quotes are
 * the catalog's counts, not a number typed in.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

import type { Catalog } from "../src/lib/image-library/types.ts";
import { isCompanyEntry } from "../src/lib/image-library/identity.ts";

const catalog = JSON.parse(readFileSync(new URL("../src/lib/image-library/catalog.json", import.meta.url), "utf8")) as Catalog;
const reportPath = new URL("../data/image-library/coverage.json", import.meta.url);
const markdownPath = new URL("../docs/image-library-coverage.md", import.meta.url);

test("the coverage report exists and was built from the current catalog", () => {
  assert.ok(existsSync(reportPath) && existsSync(markdownPath), "run scripts/image-library-report.ts");
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as { catalogGeneratedAt: string; unresolved: Array<{ identity: string }>; companies: Record<string, number> };
  assert.equal(report.catalogGeneratedAt, catalog.generatedAt, "report is stale relative to the catalog");
  const unresolved = catalog.entries.filter((e) => e.status !== "resolved").map((e) => e.identity).sort();
  assert.deepEqual(report.unresolved.map((u) => u.identity).sort(), unresolved, "every unresolved identity must be listed");
  assert.equal(report.companies.resolved, catalog.entries.filter((e) => isCompanyEntry(e) && e.status === "resolved").length);
  const universe = JSON.parse(readFileSync(new URL("../data/image-library/universe-companies.json", import.meta.url), "utf8"));
  const uniqueCiks = new Set(universe.members.filter((m: { ciks: string[] }) => m.ciks.length === 1).map((m: { ciks: string[] }) => m.ciks[0]));
  assert.equal(report.companies.issuersInUniverse, uniqueCiks.size);
});

test("the markdown names every unresolved identity and separates issuer from ticker coverage", () => {
  const md = readFileSync(markdownPath, "utf8");
  for (const e of catalog.entries.filter((x) => x.status !== "resolved")) assert.ok(md.includes(e.identity), `${e.identity} missing from the report`);
  assert.match(md, /Issuers resolved: \d+ of \d+/);
  assert.match(md, /Tickers resolved: \d+ of \d+/);
  assert.ok(!/100% coverage|complete coverage/i.test(md));
});

test("no entry claims a right the sources do not document", () => {
  for (const e of catalog.entries) {
    if (!e.asset) continue;
    assert.equal(e.asset.rights.apiRedistribution, "not_established", e.identity);
    assert.equal(e.asset.rights.websiteDisplay, "documented", e.identity);
  }
});
