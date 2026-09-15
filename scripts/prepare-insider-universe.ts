/** Freeze the existing SEC symbol directory so every backfill batch has the same scope. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readInsiderUniverse, insiderUniverseHash } from "../src/lib/form4/universe.ts";
const root = resolve(import.meta.dirname, "..");
const bytes = readFileSync(resolve(root, "data/security-master.json"));
const master = JSON.parse(bytes.toString("utf8"));
const entries = (Object.values(master.entries) as { cik: string; ticker: string; title: string }[])
  .map(({ cik, ticker, title }) => ({ cik, ticker, title })).sort((a, b) => a.ticker.localeCompare(b.ticker));
const universe = readInsiderUniverse({ schemaVersion: 1, source: "sec-company-tickers", sourceSha256: createHash("sha256").update(bytes).digest("hex"), capturedAt: master.updatedAt, entries });
const target = resolve(root, "data/form4-universe.json");
// Refuse accidental replacement during a running backfill; changing scope is explicit.
writeFileSync(target, JSON.stringify(universe, null, 2), { flag: "wx" });
console.log(JSON.stringify({ path: target, symbols: entries.length, issuerCiks: new Set(entries.map(entry => entry.cik)).size, sha256: insiderUniverseHash(universe) }));
