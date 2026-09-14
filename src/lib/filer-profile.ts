import type { DisclosureRecord } from "./congress-schema.ts";
import { archiveRecords, disclosureFilerKey, displayFiler } from "./home-discovery.ts";

export function filerProfilePath(key: string): string { return `/congress/filers/${encodeURIComponent(key)}`; }
/** Next's route parameter retains URL escapes in this app's runtime. Decode once;
 * malformed input must not become a fuzzy name lookup or a server error. */
export function filerKeyFromRoute(segment: string): string | null {
  try { return decodeURIComponent(segment); } catch { return null; }
}
export function buildFilerProfile(records: DisclosureRecord[], key: string, asOf: string) {
  const matches = archiveRecords(records, asOf).filter(r => disclosureFilerKey(r) === key);
  if (!matches.length) return null;
  return { key, name: displayFiler(matches[0].politician), state: matches[0].state, district: matches[0].district,
    records: matches, purchases: matches.filter(r => r.type === "Buy").length,
    sales: matches.filter(r => r.type === "Sell").length,
    filingCount: new Set(matches.map(r => r.source)).size };
}
