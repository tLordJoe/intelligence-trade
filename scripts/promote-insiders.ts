/** Two-stage local preparation/promotion; never pushes or deploys. */
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { loadInsiderCandidateReview } from "../src/lib/form4/candidate-review.ts";
import { prepareInsiderRelease, insiderPayloadHash, readApprovedInsiderRelease, type InsiderRelease } from "../src/lib/form4/public-view.ts";
import { isExpectedFilingDay } from "../src/lib/form4/enumerate.ts";
const root = resolve(import.meta.dirname, ".."), args = process.argv.slice(2);
const arg = (name: string) => args[args.indexOf(name) + 1];
const through = args.includes("--through") ? arg("--through") : "";
if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) throw new Error("--through latest-available-SEC-filing-date is required");
const today = new Date().toISOString().slice(0, 10);
let minimum = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
while (!isExpectedFilingDay(minimum)) minimum = new Date(Date.parse(`${minimum}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
if (through < minimum || through > today) throw new Error(`Refresh collection through the latest available SEC index (at least ${minimum}); stale or future cutoff refused`);
const fresh = prepareInsiderRelease(loadInsiderCandidateReview(root), through);
const candidatePath = resolve(root, "data/insider-public-candidate.json");
if (args.includes("--prepare")) { writeFileSync(candidatePath, JSON.stringify(fresh, null, 2)); console.log("Prepared pending insider candidate; nothing published."); }
else {
  if (!args.includes("--reviewed-by") || !arg("--reviewed-by")?.trim() || !args.includes("--acknowledge-bounded-coverage")) throw new Error("Explicit reviewer and bounded-coverage acknowledgement required");
  const prepared: InsiderRelease = JSON.parse(readFileSync(candidatePath, "utf8"));
  if (insiderPayloadHash(fresh.payload) !== insiderPayloadHash(prepared.payload)) throw new Error("Prepared payload is stale; replay and review again");
  fresh.approval = { reviewedBy: arg("--reviewed-by"), reviewedAt: new Date().toISOString(), payloadSha256: insiderPayloadHash(fresh.payload), boundedCoverageAcknowledged: true };
  readApprovedInsiderRelease(fresh);
  const target = resolve(root, "src/lib/insider-live.json"), temporary = `${target}.next`;
  writeFileSync(temporary, JSON.stringify(fresh, null, 2), { flag: "wx" }); renameSync(temporary, target);
  console.log("Reviewed insider payload promoted locally; no push or deployment performed.");
}
