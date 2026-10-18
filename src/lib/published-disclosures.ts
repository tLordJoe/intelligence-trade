/** Server-side data loading avoids compiling large source datasets into JS or
 * sending the full archive to a visitor who only needs one results page. */
import { join } from "node:path";
import { readDisclosureRelease } from "./disclosure-storage.ts";
import { readApprovedInsiderRelease, type InsiderPayload } from "./form4/public-view.ts";
import { approvedInstitutions, type InstitutionPayload } from "./institutions/release.ts";

let insiders: InsiderPayload | null | undefined;
let institutions: InstitutionPayload | null | undefined;
export function publishedInsiders() {
  if (insiders === undefined) insiders = readApprovedInsiderRelease(readDisclosureRelease(join(process.cwd(), "src/lib/insider-live.json")));
  return insiders;
}
export function publishedInstitutions() {
  if (institutions === undefined) institutions = approvedInstitutions(readDisclosureRelease(join(process.cwd(), "src/lib/institutions-live.json")));
  return institutions;
}
