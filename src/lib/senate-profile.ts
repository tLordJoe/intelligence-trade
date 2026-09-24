import type { SenatePublicPayload } from "./senate/public-view.ts";

export function senateProfilePath(bioguide: string): string {
  return `/senate/filers/${encodeURIComponent(bioguide)}`;
}

export function senateBioguideFromRoute(segment: string): string | null {
  try {
    const value = decodeURIComponent(segment);
    return /^[A-Z]\d{6}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function buildSenateProfile(payload: SenatePublicPayload, bioguide: string, asOf: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf))) throw new Error("Invalid Senate profile as-of date");
  const records = payload.records.filter(row => row.bioguide === bioguide && row.filedDate <= asOf)
    .sort((a, b) => b.filedDate.localeCompare(a.filedDate) || b.transactionDate.localeCompare(a.transactionDate) || a.id.localeCompare(b.id));
  if (!records.length) return null;
  return {
    bioguide,
    name: records[0].politician,
    state: records[0].state,
    records,
    purchases: records.filter(row => row.type === "Buy").length,
    sales: records.filter(row => row.type === "Sell").length,
    filingCount: new Set(records.map(row => row.reportId)).size,
  };
}
