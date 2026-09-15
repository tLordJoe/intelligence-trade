import { digest, filingUrl, type InstitutionalFiling } from "./parse.ts";
import { reconcileInstitutions } from "./reconcile.ts";
export interface InstitutionPayload {
  schemaVersion:1; source:"SEC Form 13F"; semantics:"quarter_end_reported_holdings";
  coverage:{cik:string;from:string;to:string;collectedAt:string}[];
  limitations:string; filings:InstitutionalFiling[];
}
export interface InstitutionRelease { payload:InstitutionPayload|null; approval:null|{reviewedBy:string;reviewedAt:string;sha256:string;partialCoverageAcknowledged:true} }
export const payloadHash=(payload:InstitutionPayload)=>digest(JSON.stringify(payload));
export const limitations="Partial manager coverage. Form 13F reports quarter-end holdings, usually filed later; not exact trades, transaction dates, current portfolios or ETF constituent data. Short positions, some securities, confidential holdings and unreviewed amendments may be absent. CUSIP and issuer names are preserved as filed; ticker/issuer-CIK matching is not inferred. Values use the SEC filing-date format (USD from January 3, 2023; thousands of USD before).";
export function approvedInstitutions(value:unknown):InstitutionPayload|null{
  const release=value as InstitutionRelease;
  if(!release?.approval)return null;
  const {payload,approval}=release;
  if(!payload||payload.schemaVersion!==1||payload.source!=="SEC Form 13F"||payload.semantics!=="quarter_end_reported_holdings"||!payload.filings.length||!payload.coverage.length||
    !approval.reviewedBy.trim()||!Number.isFinite(Date.parse(approval.reviewedAt))||approval.partialCoverageAcknowledged!==true||payloadHash(payload)!==approval.sha256||!payload.limitations)throw new Error("Invalid institutional release approval");
  if(reconcileInstitutions(payload.filings).held.length||new Set(payload.filings.map(f=>f.reference.accession)).size!==payload.filings.length)throw new Error("Held institutional reports cannot be published");
  for(const filing of payload.filings){
    if(filing.sourceUrl!==filingUrl(filing.reference)||!/^[a-f0-9]{64}$/.test(filing.sourceSha256)||
      !payload.coverage.some(c=>c.cik===filing.reference.cik&&c.from<=filing.reference.filedDate&&filing.reference.filedDate<=c.to))throw new Error("Invalid release lineage");
  }
  return payload;
}
