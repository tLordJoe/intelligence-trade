/** Offline, reproducible source-review candidate. Does not promote public data. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { loadSenateCandidateReview } from "../src/lib/senate/candidate-review.ts";
import { senatePeopleFromRoster } from "../src/lib/senate/candidate.ts";
import { prepareSenatePublicRelease } from "../src/lib/senate/public-view.ts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rosterPath = resolve(root, "data/senate-roster-source.json");
if (existsSync(rosterPath)) {
  const bytes = readFileSync(rosterPath);
  const people = senatePeopleFromRoster(JSON.parse(bytes.toString("utf8")));
  writeFileSync(resolve(root, "data/senate-identity-roster.json"), JSON.stringify({ schemaVersion: 1,
    source: "https://unitedstates.github.io/congress-legislators/legislators-current.json",
    sourceSha256: createHash("sha256").update(bytes).digest("hex"), people }, null, 2));
}
const candidate = loadSenateCandidateReview(root);
writeFileSync(resolve(root, "data/senate-candidate-review.json"), JSON.stringify(candidate, null, 2));
writeFileSync(resolve(root, "data/senate-public-candidate.json"), JSON.stringify(prepareSenatePublicRelease(candidate), null, 2));
console.log(JSON.stringify({ reports: candidate.filings.length, rows: candidate.rows.length,
  repeatedReports: candidate.repeatedReports, unresolvedReports: candidate.unresolved.length,
  identityLinkedRows: candidate.identityLinkedRows, securityLinkedRows: candidate.securityLinkedRows,
  partialDisclosureRows: candidate.disclosureRows.length,
  reconciliationBlockers: candidate.blockers, holdCounts: candidate.holdCounts,
  from: candidate.from, to: candidate.to, publicationApproved: false }, null, 2));
