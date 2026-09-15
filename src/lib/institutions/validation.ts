import type { InstitutionalFiling, InstitutionalNotice } from "./parse.ts";
import { reconcileInstitutions, positionChanges } from "./reconcile.ts";

/** No fallback to older unamended quarters when the latest reported quarter is held. */
export function validateManagerCorpus(filings: InstitutionalFiling[], failures: string[] = [], notices:InstitutionalNotice[] = []) {
  const ciks = [...new Set([...filings,...notices].map(f => f.reference.cik))];
  if (ciks.length > 1) throw new Error("Validate one manager at a time");
  const reconciliation = reconcileInstitutions(filings, failures.length ? ciks : [],notices);
  const latestPeriods = [...new Set([...filings,...notices].map(f => f.period))].sort().reverse().slice(0, 2);
  const current = reconciliation.active.find(f => f.period === latestPeriods[0]);
  const previous = reconciliation.active.find(f => f.period === latestPeriods[1]);
  let comparison: { previousPeriod: string; currentPeriod: string; positions: ReturnType<typeof positionChanges> } | null = null;
  let comparisonHold = failures.length ? "Missing or unparsed official filings" : "Two latest reported quarters are not both eligible";
  if (current && previous && !failures.length) {
    try { comparison = { previousPeriod: previous.period, currentPeriod: current.period, positions: positionChanges(previous, current) }; }
    catch (error) { comparisonHold = String(error); }
  }
  return { ciks, notices, latestReportedPeriods: latestPeriods, parsedFilings: filings.length,
    parsedRows: filings.reduce((sum,f) => sum + f.holdings.length,0),
    filings: filings.map(f => ({ accession:f.reference.accession, filedDate:f.reference.filedDate, period:f.period, manager:f.managerName, rows:f.holdings.length, sourceSha256:f.sourceSha256, sourceUrl:f.sourceUrl, amendment:f.amendment, amendmentType:f.amendmentType })),
    eligibleFilings:reconciliation.active.length, held:reconciliation.held, failures,
    comparison, comparisonHold: comparison ? null : comparisonHold, publicChanged:false };
}
