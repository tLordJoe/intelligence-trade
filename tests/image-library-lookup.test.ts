/**
 * The lookup: identity rules, aliases, fallbacks.
 *
 * Runs against the committed catalog. Each case names a real identity so a
 * regression in the catalog itself (a lost alias, a demoted status) fails
 * here rather than as a blank tile on the site.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { catalogSummary, getEntry, resolveCompanyMark, resolveFundMark, resolvePortrait } from "../src/lib/image-library/index.ts";
import { cikIdentity, normalizePersonName, personNameVariants, tickerSpellings } from "../src/lib/image-library/identity.ts";
import type { Catalog } from "../src/lib/image-library/types.ts";

test("malformed authoritative identifiers return fallbacks, never throw or use a ticker", () => {
  for (const bad of ["", "bad-id", " 1045810", "12345678901"]) {
    assert.equal(resolveCompanyMark({ ticker: "NVDA", cik: bad }).status, "fallback");
    assert.equal(resolveFundMark({ ticker: "XLK", classId: bad }).status, "fallback");
    assert.equal(resolvePortrait({ bioguide: bad }).status, "fallback");
  }
});

test("a supplied portrait identity must agree with the supplied person and seat", () => {
  for (const evidence of [
    { name: "Ro Khanna", chamber: "House", state: "CA", district: "CA17" },
    { name: "Nancy Pelosi", state: "TX" },
    { name: "Nancy Pelosi", district: "CA17" },
    { filerKey: "House:CA:CA17:ro khanna" },
  ]) {
    assert.deepEqual(resolvePortrait({ bioguide: "P000197", ...evidence }).status, "fallback");
  }
  assert.equal(resolvePortrait({ bioguide: "P000197", name: "Nancy Pelosi", chamber: "House", state: "CA", district: "CA11" }).status, "resolved");
  assert.equal(resolvePortrait({ filerKey: "House:CA:CA11:nancy pelosi", name: "Someone Else" }).status, "fallback");
});

test("every unresolved fund state blocks sponsor fallback", () => {
  const entry = getEntry("sec:class:C000017601")!;
  const original = entry.status;
  try {
    for (const status of ["missing", "ambiguous", "failed", "awaiting_review"] as const) {
      entry.status = status;
      assert.deepEqual(resolveFundMark({ ticker: "XLK" }), { status: "fallback", reason: "not_resolved", label: "XLK" });
    }
  } finally { entry.status = original; }
});

test("an issuer that also sponsors funds resolves consistently with either lookup", () => {
  const byTicker = resolveCompanyMark({ ticker: "STT" });
  const byCik = resolveCompanyMark({ ticker: "STT", cik: "93751" });
  assert.equal(byTicker.status, "resolved");
  assert.deepEqual(byTicker, byCik);
  if (byTicker.status === "resolved") {
    assert.equal(byTicker.role, "company_mark");
    const fund = resolveFundMark({ ticker: "XLK" });
    assert.equal(fund.status, "resolved");
    if (fund.status === "resolved") { assert.equal(fund.src, byTicker.src); assert.equal(fund.role, "sponsor_mark"); }
  }
  // Old BlackRock Finance CIK has no current SEC ticker evidence; do not invent
  // a BLK alias merely because its corporate sponsor mark is available.
  assert.equal(resolveCompanyMark({ ticker: "BLK", cik: "1364742" }).status, "fallback");
});

const catalog = JSON.parse(readFileSync(new URL("../src/lib/image-library/catalog.json", import.meta.url), "utf8")) as Catalog;

// --- companies ---------------------------------------------------------------

test("a reviewed company mark resolves by CIK and keeps its original file", () => {
  const r = resolveCompanyMark({ ticker: "NVDA", cik: "1045810" });
  assert.equal(r.status, "resolved");
  if (r.status !== "resolved") return;
  assert.equal(r.src, "/company-logos/nvda.svg");
  assert.equal(r.role, "company_mark");
  assert.equal(getEntry(cikIdentity(1045810))?.asset?.source.reviewedBy, "manual");
});

test("a ticker that belongs to a different issuer than the CIK is a mismatch, not a logo", () => {
  // MSFT's CIK with Apple's ticker: the record is inconsistent, so neither mark is shown.
  const r = resolveCompanyMark({ ticker: "AAPL", cik: "0000789019" });
  assert.equal(r.status, "fallback");
  if (r.status === "fallback") assert.equal(r.reason, "mismatch");
});

test("two tickers of one issuer resolve to the same identity", () => {
  const a = resolveCompanyMark({ ticker: "GOOGL" }), b = resolveCompanyMark({ ticker: "GOOG" });
  if (a.status === "resolved" && b.status === "resolved") assert.equal(a.identity, b.identity);
  const entry = catalog.entries.find((e) => e.aliases.some((x) => x.type === "ticker" && x.value === "GOOGL"));
  assert.ok(entry && entry.aliases.some((x) => x.type === "ticker" && x.value === "GOOG"), "GOOG and GOOGL share one issuer entry");
});

test("share-class spellings are interchangeable and stay on one issuer", () => {
  assert.deepEqual(tickerSpellings("BRK.B"), ["BRK.B", "BRK-B"]);
  const dot = resolveCompanyMark({ ticker: "BRK.B" }), dash = resolveCompanyMark({ ticker: "BRK-B" });
  assert.equal(dot.status, dash.status);
  if (dot.status === "resolved" && dash.status === "resolved") assert.equal(dot.identity, dash.identity);
});

test("an unknown ticker is a missing fallback carrying the label", () => {
  const r = resolveCompanyMark({ ticker: "ZZZZ9" });
  assert.deepEqual(r, { status: "fallback", reason: "missing", label: "ZZZZ9" });
});

test("a CIK without an entry is missing, never a guess from the ticker", () => {
  const r = resolveCompanyMark({ ticker: "NVDA", cik: "0000000001" });
  assert.equal(r.status, "fallback");
});

test("an entry that is not resolved is never served, even with a candidate on file", () => {
  const pending = catalog.entries.find((e) => e.kind === "company" && e.status !== "resolved");
  if (!pending) return;
  const ticker = pending.aliases.find((a) => a.type === "ticker")?.value;
  if (!ticker) return;
  const r = resolveCompanyMark({ ticker, cik: pending.identity.replace("sec:cik:", "") });
  assert.equal(r.status, "fallback");
});

// --- funds -------------------------------------------------------------------

test("an ETF resolves to its sponsor's mark and says so", () => {
  const r = resolveFundMark({ ticker: "XLK", classId: "C000017601" });
  assert.equal(r.status, "resolved");
  if (r.status !== "resolved") return;
  assert.equal(r.role, "sponsor_mark");
  assert.match(r.label, /sponsor/);
  assert.equal(r.identity, "sec:class:C000017601");
});

test("two funds sharing a sponsor share a file but keep distinct identities", () => {
  const xlk = resolveFundMark({ ticker: "XLK" }), xlu = resolveFundMark({ ticker: "XLU" });
  assert.equal(xlk.status, "resolved"); assert.equal(xlu.status, "resolved");
  if (xlk.status !== "resolved" || xlu.status !== "resolved") return;
  assert.equal(xlk.src, xlu.src);
  assert.notEqual(xlk.identity, xlu.identity);
});

test("a fund whose sponsor has no cleared mark falls back, and the reason is recorded", () => {
  const r = resolveFundMark({ ticker: "QQQ" });
  assert.equal(r.status, "fallback");
  const entry = getEntry("sec:class:C000271435");
  assert.equal(entry?.status, "missing");
  assert.match(entry?.reason ?? "", /Invesco/);
});

test("a fund class id that disagrees with the ticker is a mismatch", () => {
  const r = resolveFundMark({ ticker: "XLU", classId: "C000017601" });
  assert.equal(r.status, "fallback");
  if (r.status === "fallback") assert.equal(r.reason, "mismatch");
});

// --- people ------------------------------------------------------------------

test("a reviewed portrait resolves by its reviewed filer key and by name plus seat", () => {
  const byKey = resolvePortrait({ filerKey: "House:CA:CA11:nancy pelosi" });
  const bySeat = resolvePortrait({ name: "Nancy Pelosi", chamber: "House", state: "CA", district: "CA11" });
  assert.equal(byKey.status, "resolved"); assert.equal(bySeat.status, "resolved");
  if (byKey.status === "resolved" && bySeat.status === "resolved") {
    assert.equal(byKey.src, "/portraits/P000197.jpg"); assert.equal(byKey.identity, bySeat.identity);
  }
});

test("the archive's courtesy-title spelling still resolves through name variants", () => {
  assert.equal(normalizePersonName("John J Mr McGuire"), "john j mcguire");
  assert.ok(personNameVariants({ first: "John", middle: "J.", last: "McGuire", official: "John J. McGuire III" }).includes("john j mcguire"));
  const r = resolvePortrait({ name: "John J Mr McGuire", chamber: "House", state: "VA", district: "VA05" });
  assert.equal(r.status, "resolved");
});

test("a name without a seat never resolves, and a wrong seat never resolves", () => {
  assert.equal(resolvePortrait({ name: "Nancy Pelosi" }).status, "fallback");
  assert.equal(resolvePortrait({ name: "Nancy Pelosi", chamber: "House", state: "CA", district: "CA12" }).status, "fallback");
  assert.equal(resolvePortrait({ name: "Nancy Pelosi", chamber: "Senate", state: "CA", district: null }).status, "fallback");
});

test("a bioguide id is authoritative on its own", () => {
  const r = resolvePortrait({ bioguide: "P000197" });
  assert.equal(r.status, "resolved");
});

test("a duplicate surname in a different seat does not collide", () => {
  const people = catalog.entries.filter((e) => e.kind === "person");
  const byLast = new Map<string, number>();
  for (const p of people) { const last = p.label.split(" ").at(-1) ?? ""; byLast.set(last, (byLast.get(last) ?? 0) + 1); }
  const shared = [...byLast.entries()].find(([, n]) => n > 1)?.[0];
  if (!shared) return;
  const same = people.filter((p) => p.label.endsWith(` ${shared}`));
  const seats = new Set(same.map((p) => p.aliases.find((a) => a.type === "person_name")).map((a) => `${a?.chamber}|${a?.state}|${a?.district}`));
  assert.equal(seats.size, same.length, `members surnamed ${shared} must occupy distinct seats`);
});

// --- catalog integrity -------------------------------------------------------

test("every resolved asset exists on disk with the recorded hash and a recorded rights basis", () => {
  const seen = new Set<string>();
  for (const e of catalog.entries) {
    if (e.status !== "resolved" || !e.asset) continue;
    const path = new URL(`../public${e.asset.file.path}`, import.meta.url);
    assert.ok(existsSync(path), `${e.identity}: ${e.asset.file.path} missing`);
    if (!seen.has(e.asset.file.path)) {
      seen.add(e.asset.file.path);
      assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), e.asset.file.sha256, `${e.identity}: hash changed`);
    }
    assert.ok(e.asset.source.url.startsWith("https://"));
    assert.equal(e.asset.rights.apiRedistribution, "not_established");
    assert.ok(e.asset.rights.basis.length > 40);
  }
});

test("no alias of one type maps a current ticker to two company identities", () => {
  const owners = new Map<string, Set<string>>();
  for (const e of catalog.entries.filter((x) => x.kind === "company")) for (const a of e.aliases) {
    if (a.type !== "ticker" || a.status === "retired") continue;
    owners.set(a.value, (owners.get(a.value) ?? new Set()).add(e.identity));
  }
  const dupes = [...owners.entries()].filter(([, s]) => s.size > 1);
  assert.deepEqual(dupes, []);
});

test("the ten reviewed marks and fourteen reviewed portraits are present and untouched", () => {
  const manualMarks = catalog.entries.filter((e) => e.kind === "company" && e.asset?.source.reviewedBy === "manual");
  const manualPortraits = catalog.entries.filter((e) => e.kind === "person" && e.asset?.source.reviewedBy === "manual");
  assert.equal(manualMarks.length, 10); assert.equal(manualPortraits.length, 14);
  const manifest = JSON.parse(readFileSync(new URL("../docs/company-logo-manifest.json", import.meta.url), "utf8")) as Array<{ ticker: string; sha256: string }>;
  for (const m of manifest) {
    const entry = manualMarks.find((e) => e.aliases.some((a) => a.type === "ticker" && a.value === m.ticker));
    assert.equal(entry?.asset?.file.sha256, m.sha256, `${m.ticker} bytes must match the reviewed manifest`);
  }
});

test("universes are dated and counted", () => {
  const s = catalogSummary();
  for (const u of Object.values(s.universes)) { assert.match(u!.asOf, /^\d{4}-\d{2}-\d{2}$/); assert.ok(u!.identities > 0); }
});
