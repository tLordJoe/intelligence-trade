import CompanyMark from "@/components/CompanyMark";
import { companyMark } from "@/lib/company-marks";
import type { InsiderActivity } from "@/lib/form4/activity";
export default function InsiderDisclosureCards({ records }: { records: InsiderActivity[] }) {
  return <div className="sector-fund-grid">{records.map(record => <article className="home-panel" key={record.id}>
    <div className="instrument-title"><CompanyMark ticker={record.ticker} src={companyMark(record.ticker, record.issuerCik)} /><h3>{record.ticker} · Reported {record.classification === "reported_purchase" ? "purchase" : "sale"}</h3></div>
    <p>{record.issuerName} · {record.securityTitle}</p>
    <p>{record.reportingOwners.map(owner => `${owner.name ?? owner.cik}${owner.officerTitle ? ` — ${owner.officerTitle}` : ""}`).join("; ")}</p>
    <dl className="instrument-facts"><div><dt>Transaction date</dt><dd>{record.transactionDate}</dd></div><div><dt>Filed</dt><dd>{record.filedDate}</dd></div><div><dt>Reported shares</dt><dd>{record.reportedShares}</dd></div><div><dt>Reported price per share</dt><dd>{record.reportedPrice.value ?? "Not specified"}</dd></div></dl>
    <p>Price basis: {record.priceQuality === "weighted_average" ? "Weighted average—not an individual execution price" : record.priceQuality === "footnote_only" ? "See source footnotes" : record.priceQuality === "exact" ? "Source-reported numeric price" : "Not established"}. Ownership: {record.ownership}.</p>
    {record.natureOfOwnership.value && <p>Ownership as disclosed: {record.natureOfOwnership.value}</p>}
    <p>Filing-level trading-plan indicator: {record.filingPlanIndicator === null ? "Not specified" : record.filingPlanIndicator ? "Indicated—not assigned to every row" : "Not indicated"}.</p>
    {record.sourceRemarks && <p><strong>Filing remarks:</strong> {record.sourceRemarks}</p>}
    {Object.keys(record.footnotes).length > 0 && <details><summary>Source footnotes</summary><p>Footnotes belong to the filing; numbered references identify the affected fields. They are not automatically assigned to every row.</p>{Object.entries(record.footnotes).map(([id, note]) => <p key={id}><strong>{id}:</strong> {note}</p>)}</details>}
    {record.warnings.length > 0 && <details><summary>Source and parsing caveats</summary>{record.warnings.map((warning, i) => <p key={i}>{warning.replaceAll("_", " ")}</p>)}</details>}
    <a className="home-text-link" href={record.sourceUrl} target="_blank" rel="noopener noreferrer">Inspect original SEC filing ↗</a>
  </article>)}</div>;
}
