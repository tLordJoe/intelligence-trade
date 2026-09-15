/** Explicit reviewed promotion; verifies the prepared payload against current archived evidence. */
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSenateCandidateReview } from "../src/lib/senate/candidate-review.ts";
import { prepareSenatePublicRelease, readApprovedSenateRelease, senatePayloadHash, senateCoverageReady, type SenatePublicRelease } from "../src/lib/senate/public-view.ts";
const args = process.argv.slice(2);
const reviewer = args.includes("--reviewed-by") ? args[args.indexOf("--reviewed-by") + 1] : "";
if (!reviewer?.trim() || reviewer.startsWith("--") || !args.includes("--acknowledge-partial-coverage")) throw new Error("Supply the completed source review identity and explicitly acknowledge partial coverage");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prepared: SenatePublicRelease = JSON.parse(readFileSync(resolve(root, "data/senate-public-candidate.json"), "utf8"));
const replayed = prepareSenatePublicRelease(loadSenateCandidateReview(root));
if (!senateCoverageReady(replayed.payload.windows, new Date().toISOString().slice(0, 10))) throw new Error("Collect and validate January 1 through the current date before Senate publication");
if (senatePayloadHash(prepared.payload) !== senatePayloadHash(replayed.payload)) throw new Error("Prepared Senate release differs from current verified source replay; rebuild and review it again");
const release: SenatePublicRelease = { payload: prepared.payload, approval: { reviewedBy: reviewer.trim(), reviewedAt: new Date().toISOString(),
  payloadSha256: senatePayloadHash(prepared.payload), partialCoverageAcknowledged: true } };
readApprovedSenateRelease(release);
const target = resolve(root, "src/lib/senate-live.json");
const temporary = `${target}.next`;
writeFileSync(temporary, JSON.stringify(release, null, 2) + "\n", { flag: "wx" });
renameSync(temporary, target);
console.log(`Prepared ${release.payload.records.length} reviewed Senate disclosure rows in the local public archive. Nothing has been pushed or deployed.`);
