import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import type { DisclosureArchive, ImportCounts } from "../src/lib/congress-schema.ts";

const archivePath = "src/lib/congress-live.json";
const liveApi = "https://outfoxmarkets.com/api/congress?scope=all&limit=1";
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

export function houseRunPath(runId: string): string {
  if (!/^run_\d{4}(?:-\d{2}){2}T\d{2}(?:-\d{2}){2}-\d{3}Z_[0-9a-f]{8}$/.test(runId)) {
    throw new Error("Unrecognized House run ID");
  }
  return `data/import-runs/${runId}`;
}

type Receipt = { runId: string; passed: boolean; dryRun: boolean; productionUpdated: boolean; finishedAt: string; counts: ImportCounts };
export function checkHouseCandidate(before: DisclosureArchive, after: DisclosureArchive, receipt: Receipt): boolean {
  houseRunPath(receipt.runId);
  if (receipt.passed !== true || receipt.dryRun !== false || receipt.productionUpdated !== true ||
      after.lastImportRunId !== receipt.runId || after.updatedAt !== receipt.finishedAt ||
      !(Date.parse(after.updatedAt) > Date.parse(before.updatedAt))) {
    throw new Error("Expected a newer, successful House import and its matching receipt");
  }
  for (const key of ["archiveBefore", "archiveAfter", "added", "revised", "selectedFilings", "sourceFilings"] as const) {
    if (!Number.isSafeInteger(receipt.counts[key]) || receipt.counts[key] < 0 || receipt.counts[key] !== after.counts[key]) {
      throw new Error(`Invalid House count: ${key}`);
    }
  }
  const c = receipt.counts;
  const oldIds = new Set(before.trades.map(row => row.id));
  const nextIds = new Set(after.trades.map(row => row.id));
  const recordedRevisions = after.trades.filter(row => {
    const revision = row.revisions?.at(-1);
    return oldIds.has(row.id) && revision?.importRunId === receipt.runId && revision.changes.length > 0;
  }).length;
  if (c.sourceFilings === 0 || c.selectedFilings !== c.sourceFilings ||
      c.archiveBefore !== before.trades.length || c.archiveAfter !== after.trades.length ||
      oldIds.size !== before.trades.length || nextIds.size !== after.trades.length ||
      c.archiveAfter - c.archiveBefore !== c.added || recordedRevisions !== c.revised ||
      [...oldIds].some(id => !nextIds.has(id)) || [...nextIds].some(id => typeof id !== "string" || !id)) {
    throw new Error("Expected a full, append-only House archive with unique IDs and reconciled counts");
  }
  // lastSeen and run metadata change on every re-parse. Those aren't new
  // market information. No-op runs still keep evidence in Actions artifacts.
  return c.added > 0 || c.revised > 0;
}

export function allowedHousePatchPaths(paths: string[], runId: string): void {
  const dir = houseRunPath(runId);
  const allowed = new Set([
    archivePath,
    "data/congress-quarantine.json",
    "data/last-import-report.txt",
    "data/import-runs/index.json",
    ...["summary.json", "report.txt", "quarantine.json", "unseen-ids.json", "zero-row-filings.json"].map(file => `${dir}/${file}`),
  ]);
  if (new Set(paths).size !== paths.length || paths.some(path => !allowed.has(path)) ||
      ![archivePath, `${dir}/summary.json`, `${dir}/report.txt`, `${dir}/zero-row-filings.json`].every(path => paths.includes(path))) {
    throw new Error("House handoff changes files outside its release allowlist or omits required evidence");
  }
}

export function matchesHouseRelease(expected: DisclosureArchive, actual: unknown): boolean {
  if (!actual || typeof actual !== "object") return false;
  const live = actual as { updatedAt?: unknown; total?: unknown; coverage?: unknown };
  return live.coverage === "U.S. House of Representatives" &&
    live.updatedAt === expected.updatedAt && live.total === expected.trades.length;
}

async function verifyLive(attempts: number) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 20) throw new Error("Expected 1 to 20 live checks");
  const expected = readJson<DisclosureArchive>(archivePath);
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(liveApi, { signal: AbortSignal.timeout(12_000),
        redirect: "error", headers: { "Cache-Control": "no-cache", Accept: "application/json" } });
      if (response.ok && matchesHouseRelease(expected, await response.json())) {
        console.log("Verified the archive timestamp and record count on the live site.");
        return;
      }
    } catch {
      console.warn("Unable to read the public House API.");
    }
    if (i + 1 < attempts) await delay(25_000);
  }
  throw new Error("The public House archive does not match the expected release; reconcile deployment before retrying.");
}

function patchPaths(patch: string) {
  return git("apply", "--numstat", "-z", "--", patch).split("\0").filter(Boolean).map(row => {
    const result = /^\d+\t\d+\t([A-Za-z0-9/_\-.]+)$/.exec(row);
    if (!result) throw new Error("Expected a text-only data patch with ordinary paths");
    return result[1];
  });
}

async function main() {
  const [action, runId, patch] = process.argv.slice(2);
  if (action === "verify-live") return verifyLive(Number(runId));
  const dir = houseRunPath(runId ?? "");
  const before = JSON.parse(git("show", `HEAD:${archivePath}`)) as DisclosureArchive;
  if (action === "apply") {
    if (!patch || git("status", "--porcelain").trim()) throw new Error("Publisher requires a clean checkout and a data patch");
    allowedHousePatchPaths(patchPaths(patch), runId);
    git("apply", "--index", "--", patch);
    const paths = git("diff", "--cached", "--name-only", "-z").split("\0").filter(Boolean);
    allowedHousePatchPaths(paths, runId);
    for (const path of paths) {
      const file = lstatSync(path);
      if (!file.isFile() || (file.mode & 0o111) !== 0) throw new Error(`Not ordinary data: ${path}`);
    }
  } else if (action !== "check") {
    throw new Error("Expected check or apply");
  }
  const after = readJson<DisclosureArchive>(archivePath);
  const change = checkHouseCandidate(before, after, readJson<Receipt>(`${dir}/summary.json`));
  if (action === "apply" && !change) throw new Error("Refusing to publish a no-op refresh");
  console.log(change ? "changed" : "unchanged");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
