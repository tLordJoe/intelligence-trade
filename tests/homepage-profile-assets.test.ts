import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildFilerProfile, filerProfilePath, filerKeyFromRoute } from "../src/lib/filer-profile.ts";
import { disclosureFilerKey } from "../src/lib/home-discovery.ts";
import { HOME_FILER_IMAGES } from "../src/lib/home-filer-images.ts";
import { HOME_SECTORS, SECTOR_WEIGHTS, sectorDisplayWidth } from "../src/lib/home-sectors.ts";
import type { DisclosureRecord } from "../src/lib/congress-schema.ts";
const records = JSON.parse(readFileSync(new URL("../src/lib/congress-live.json", import.meta.url), "utf8")).trades as DisclosureRecord[];
test("each buying filer's profile uses an exact scoped counting key, not fuzzy search", () => {
  for (const key of new Set(records.filter(r => r.type === "Buy").map(disclosureFilerKey))) {
    const profile = buildFilerProfile(records, key, "2026-09-13");
    assert.ok(profile);
    assert.ok(profile.records.every(r => disclosureFilerKey(r) === key));
    const routeKey = filerKeyFromRoute(filerProfilePath(key).split("/").at(-1)!);
    assert.equal(routeKey, key);
    assert.ok(buildFilerProfile(records, routeKey!, "2026-09-13"));
  }
  assert.equal(buildFilerProfile(records, "invented-person", "2026-09-13"), null);
});
test("profile routes reject malformed escapes and never decode twice", () => {
  assert.equal(filerKeyFromRoute("bad%escape"), null);
  assert.equal(filerKeyFromRoute("House%253ACA"), "House%3ACA");
  assert.equal(filerKeyFromRoute("house:va05:john-mcguire"), "house:va05:john-mcguire");
});
test("every mapped portrait exists with unchanged bytes and recorded source", () => {
  const manifest = JSON.parse(readFileSync(new URL("../docs/homepage-portrait-manifest.json", import.meta.url), "utf8")) as {bioguide:string;sha256:string;source:string}[];
  for (const [key, id] of Object.entries(HOME_FILER_IMAGES)) {
    assert.ok(records.some(r => disclosureFilerKey(r) === key));
    const path = new URL(`../public/portraits/${id}.jpg`, import.meta.url);
    assert.ok(existsSync(path));
    const evidence = manifest.find(m => m.bioguide === id);
    assert.ok(evidence?.source.startsWith("https://unitedstates.github.io/images/congress/"));
    assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), evidence?.sha256);
  }
});
test("sector map has eleven distinct groups and disclosed minimum-width scaling", () => {
  assert.equal(HOME_SECTORS.length, 11);
  assert.equal(new Set(HOME_SECTORS.map(s => s.id)).size, 11);
  assert.ok(Math.abs(Object.values(SECTOR_WEIGHTS).reduce((a,b) => a+b,0) - 100) < .05);
  assert.equal(sectorDisplayWidth("technology"), 100);
  for (const sector of HOME_SECTORS) assert.ok(sectorDisplayWidth(sector.id) >= 40 && sectorDisplayWidth(sector.id) <= 100);
  assert.ok(HOME_SECTORS.find(s => s.id === "discretionary")!.tickers.includes("TSLA" as never));
  assert.ok(HOME_SECTORS.find(s => s.id === "staples")!.tickers.includes("KHC" as never));
});
