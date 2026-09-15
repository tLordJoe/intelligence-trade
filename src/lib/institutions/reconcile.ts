import type { Holding, InstitutionalFiling, InstitutionalNotice } from "./parse.ts";
import { managerIdentity, resolveManagerQualifiers } from "./parse.ts";

function invalidManagerAttribution(f:InstitutionalFiling):boolean {
  try {
    if(!Array.isArray(f.includedManagers)||f.includedManagers.length!==f.otherIncludedManagers)return true;
    if(new Set(f.includedManagers.map(m=>m.sequenceNumber)).size!==f.includedManagers.length || new Set(f.includedManagers.map(m=>m.stableId)).size!==f.includedManagers.length)return true;
    if(f.includedManagers.some(m=>!m.name.trim()||!/^\d+$/.test(m.sequenceNumber)||BigInt(m.sequenceNumber)<BigInt(1)||m.stableId!==managerIdentity(m.cik,m.form13FFileNumber)))return true;
    return f.holdings.some(row=>JSON.stringify(row.otherManagerIds)!==JSON.stringify(resolveManagerQualifiers(row.otherManagers,f.includedManagers)));
  }catch{return true;}
}

/** Conservative v1: any amendment or conflicting version holds its whole quarter. */
export function reconcileInstitutions(filings: InstitutionalFiling[], blockedManagers: string[] = [], notices:InstitutionalNotice[] = []) {
  const versions = new Map<string, InstitutionalFiling>();
  const conflicts = new Set<string>();
  for (const filing of filings) {
    const previous = versions.get(filing.reference.accession);
    if (previous && JSON.stringify(previous) !== JSON.stringify(filing)) conflicts.add(filing.reference.cik);
    else versions.set(filing.reference.accession, filing);
  }
  const families = new Map<string, InstitutionalFiling[]>();
  for (const filing of versions.values()) {
    const key = `${filing.reference.cik}:${filing.period}`;
    families.set(key, [...(families.get(key) ?? []), filing]);
  }
  const active: InstitutionalFiling[] = [], held: { family: string; accessions: string[]; reason: string }[] = [];
  for (const [family, entries] of families) {
    const reason = entries.some(f => blockedManagers.includes(f.reference.cik)) ? "manager_has_unparsed_or_failed_filings" :
      notices.some(n=>`${n.reference.cik}:${n.period}`===family) ? "notice_family_requires_other_reporting_manager_collection" :
      entries.some(f => conflicts.has(f.reference.cik)) ? "conflicting_source_versions" :
      entries.some(f => f.amendment) ? "amendment_family_requires_review" : entries.length !== 1 ? "multiple_originals_require_review" :
      entries.some(invalidManagerAttribution) ? "invalid_included_manager_attribution" :
      entries.some(f => f.confidentialOmitted || f.reportType !== "13F HOLDINGS REPORT") ? "confidential_or_combination_report_requires_review" : null;
    if (reason) held.push({ family, accessions: entries.map(f => f.reference.accession), reason });
    else active.push(entries[0]);
  }
  for(const family of new Set(notices.map(n=>`${n.reference.cik}:${n.period}`)))if(!families.has(family))held.push({family,accessions:notices.filter(n=>`${n.reference.cik}:${n.period}`===family).map(n=>n.reference.accession),reason:"notice_family_requires_other_reporting_manager_collection"});
  return { active: active.sort((a,b) => a.reference.cik.localeCompare(b.reference.cik) || b.period.localeCompare(a.period)), held };
}

// FIGI is optional enrichment, and manager ordinals are local to a filing.
const holdingKey = (row: Holding) => JSON.stringify([row.cusip, row.titleOfClass, row.quantityType, row.putCall, row.investmentDiscretion, row.otherManagerIds]);
const fixed = (quantity: string) => { const [whole, fraction = ""] = quantity.split("."); return BigInt(whole) * BigInt(10000) + BigInt(fraction.padEnd(4, "0")); };
const decimal = (value: bigint) => { const negative = value < BigInt(0); const abs = negative ? -value : value; return `${negative ? "-" : ""}${abs / BigInt(10000)}.${String(abs % BigInt(10000)).padStart(4,"0")}`.replace(/\.?0+$/, ""); };
/** Observed quantity differences only: NOT purchases, sales, returns or split-adjusted flows. */
export function positionChanges(previous: InstitutionalFiling, current: InstitutionalFiling) {
  const nextQuarter = new Date(`${previous.period}T00:00:00Z`);
  nextQuarter.setUTCMonth(nextQuarter.getUTCMonth() + 4, 0);
  if (previous.reference.cik !== current.reference.cik || nextQuarter.toISOString().slice(0,10) !== current.period) throw new Error("Compare consecutive quarters for the same manager only");
  if (reconcileInstitutions([previous,current]).held.length) throw new Error("Held filings cannot produce changes");
  const group = (rows: Holding[]) => {
    const map = new Map<string, { row: Holding; quantity: bigint }>();
    for (const row of rows) { const key = holdingKey(row); map.set(key, { row, quantity: (map.get(key)?.quantity ?? BigInt(0)) + fixed(row.quantity) }); }
    return map;
  };
  const before = group(previous.holdings), after = group(current.holdings);
  return [...new Set([...before.keys(),...after.keys()])].map(key => {
    const a = before.get(key), b = after.get(key);
    return { security: (b ?? a)!.row, previousQuantity: a ? decimal(a.quantity) : null, currentQuantity: b ? decimal(b.quantity) : null,
      observedQuantityDifference: a && b ? decimal(b.quantity - a.quantity) : null,
      status: !a ? "newly_reported" : !b ? "no_longer_reported" : "reported_in_both",
      caveat: "Unadjusted reported quantities; changes may reflect splits, transfers, discretion or reporting changes—not executed trades." };
  });
}
