import house from "./congress-live.json";
import senate from "./senate-live.json";
import identities from "./sector-company-identities.json";
import { readApprovedSenateRelease } from "./senate/public-view";
import { buildRadar } from "./radar";
import type { DisclosureRecord } from "./congress-schema";

/** Server projection only; never imported by a client component. */
export function currentRadar(asOf = new Date().toISOString().slice(0,10)) {
  return buildRadar(house.trades as DisclosureRecord[], readApprovedSenateRelease(senate), identities.entries, asOf);
}
