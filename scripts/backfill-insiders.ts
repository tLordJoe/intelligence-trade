/** Resumable, sequential two-day windows. Stops on failed evidence gates; never publishes. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { datesInRange } from "../src/lib/form4/enumerate.ts";
import { readInsiderUniverse, insiderUniverseHash } from "../src/lib/form4/universe.ts";
const root = resolve(import.meta.dirname, ".."), args = process.argv.slice(2);
const arg = (key: string, fallback = "") => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const from = arg("--from"), to = arg("--to"), universePath = arg("--universe", "data/form4-universe.json"), size = Number(arg("--batch-size", "250"));
if (!Number.isSafeInteger(size) || size < 1 || size > 1000) throw new Error("Batch size must be1–1000");
const days = datesInRange(from, to), universe = readInsiderUniverse(JSON.parse(readFileSync(resolve(root, universePath), "utf8"))), hash = insiderUniverseHash(universe);
const runsDirectory = resolve(root, "data/form4-runs");
if (existsSync(resolve(runsDirectory, ".import.lock"))) throw new Error("Another import is active; wait for it to finish");
for (let day = 0; day < days.length; day += 2) {
  const start = days[day], end = days[Math.min(day + 1, days.length - 1)];
  while (true) {
    const archivePath = resolve(root, "data/form4-candidate.json");
    const runIds: string[] = existsSync(archivePath) ? JSON.parse(readFileSync(archivePath, "utf8")).runIds : [];
    const runs = (existsSync(runsDirectory) ? readdirSync(runsDirectory) : []).filter(id => /^form4_[A-Za-z0-9_-]+$/.test(id)).flatMap(id => {
      const dir = resolve(runsDirectory, id);
      if (!existsSync(resolve(dir, "summary.json")) || !existsSync(resolve(dir, "selection.json"))) return [];
      const summary = JSON.parse(readFileSync(resolve(dir, "summary.json"), "utf8")), selection = JSON.parse(readFileSync(resolve(dir, "selection.json"), "utf8"));
      return summary.source === "edgar" && summary.selection.from === start && summary.selection.to === end && selection.universeSha256 === hash ? [{ id, summary, selection }] : [];
    }).sort((a, b) => a.id.localeCompare(b.id));
    const successful = runs.filter(run => run.summary.passed && run.summary.promoted && runIds.includes(run.id));
    const known = runs.at(-1)?.selection.allAccessions as string[] | undefined;
    const collected = new Set(successful.flatMap(run => run.selection.batchAccessions as string[]));
    const offset = known ? known.findIndex(accession => !collected.has(accession)) : 0;
    if (known && runs.at(-1)?.summary.enumeration?.complete && successful.length && (known.length === 0 || offset === -1)) { console.log(`Complete source selection ${start}–${end}: ${known.length} filings`); break; }
    const needed = known?.slice(offset, offset + size);
    const reusable = needed && [...runs].reverse().find(run => needed.every(id => run.selection.batchAccessions.includes(id)) && run.summary.counts?.downloaded === run.selection.batchAccessions.length);
    const command = ["--experimental-strip-types", "scripts/import-form4.ts", "--mode", "candidate", "--source", "edgar", "--from", start, "--to", end,
      "--universe", universePath, "--offset", String(offset), "--max-filings", String(size), ...(reusable ? ["--reuse-run", reusable.id] : [])];
    console.log(`Collecting ${start}–${end}, offset ${offset}, at most ${size} filings${reusable ? " from verified archived bytes" : ""}`);
    const result = spawnSync(process.execPath, command, { cwd: root, stdio: "inherit", env: process.env });
    if (result.error || result.status !== 0) throw new Error(`Backfill stopped without advancing failed slice: ${result.error?.message ?? result.status}`);
  }
}
console.log("Requested source windows collected. Run replay, coverage and amendment review before preparing a release.");
