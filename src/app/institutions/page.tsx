import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import release from "@/lib/institutions-live.json";
import { approvedInstitutions } from "@/lib/institutions/release";
import "../homepage.css";

export const metadata:Metadata={title:"Institutional holdings · Outfox",description:"Inspect source-linked quarterly reported institutional holdings—not executed trades.",alternates:{canonical:"/institutions"}};
export default async function InstitutionsPage({searchParams}:{searchParams:Promise<{q?:string;page?:string;period?:string}>}){
  const data=approvedInstitutions(release);if(!data)notFound();
  const params=await searchParams,q=(params.q??"").trim().slice(0,100);
  const periods=[...new Set(data.filings.map(f=>f.period))].sort().reverse(), period=periods.includes(params.period??"")?params.period!:periods[0];
  const filings=data.filings.filter(f=>f.period===period);
  const rows=filings.flatMap(f=>f.holdings.map(row=>({filing:f,row}))).filter(({filing,row})=>!q||`${filing.managerName} ${row.issuerName} ${row.cusip}`.toLowerCase().includes(q.toLowerCase()));
  const pages=Math.max(1,Math.ceil(rows.length/25)),page=Math.min(pages,Math.max(1,/^\d+$/.test(params.page??"")?Number(params.page):1));
  const pageUrl=(value:number)=>`/institutions?${new URLSearchParams({q,period,page:String(value)})}`;
  return <><Navbar showCompare={false}/><main className="home-shell instrument-page">
    <nav className="instrument-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span aria-current="page">Institutional holdings</span></nav>
    <header className="instrument-hero"><p className="kicker">Funds / institutions · Partial manager coverage</p><h1>What institutions reported holding</h1><p className="instrument-summary">Quarter-end positions from SEC Form 13F. A portfolio snapshot—not a list of purchases or sales.</p></header>
    <section className="home-panel"><h2>Understand the coverage</h2><p>{data.limitations}</p><p>{data.filings.length} reviewed filings across {new Set(data.filings.map(f=>f.reference.cik)).size} managers. Only selected collection windows are included; missing data does not mean no holdings.</p>
      <details><summary>Collection windows by manager CIK</summary><ul>{data.coverage.map((c,i)=><li key={i}>{c.cik}: filed {c.from}–{c.to}; collected {c.collectedAt}</li>)}</ul></details></section>
    <section className="sector-page-section"><h2>Reported positions</h2><form action="/institutions"><label htmlFor="institution-query">Manager, issuer or CUSIP </label><input id="institution-query" name="q" defaultValue={q} maxLength={100}/>{" "}<label htmlFor="institution-period">Quarter ended </label><select id="institution-period" name="period" defaultValue={period}>{periods.map(p=><option key={p}>{p}</option>)}</select>{" "}<button type="submit">View holdings</button></form><p>{rows.length} matching source rows · Page {page} of {pages}. Rows may repeat a security under different discretion or managers.</p>
      <div className="sector-fund-grid">{rows.slice((page-1)*25,page*25).map(({filing,row})=><article className="home-panel" key={row.id}>
        <h3>{row.issuerName}</h3><p>{row.titleOfClass} · CUSIP {row.cusip}{row.figi?` · FIGI ${row.figi}`:""}</p><p>Reporting manager: {filing.managerName} · CIK {filing.reference.cik}</p><p>Discretion: {row.investmentDiscretion==="SOLE"?"sole":row.investmentDiscretion==="DFND"?"shared—defined":"shared—other"}. These are reported positions, not separate purchases by each included manager.</p>
        <dl className="instrument-facts"><div><dt>Quarter ended</dt><dd>{filing.period}</dd></div><div><dt>Filed</dt><dd>{filing.reference.filedDate}</dd></div><div><dt>Reported value (USD)</dt><dd>${BigInt(row.valueUsd).toLocaleString("en-US")}</dd></div><div><dt>{row.quantityType==="SH"?"Reported shares":"Reported principal amount"}</dt><dd>{row.quantity}{row.putCall?` · ${row.putCall} option`:""}</dd></div></dl>
        <details><summary>Source units and reporting details</summary><p>Value as filed: {row.valueAsFiled} {filing.valueUnit}. Discretion code: {row.investmentDiscretion}. Filing-local manager numbers: {row.otherManagers||"none listed"}. Voting authority: sole {row.voting.sole}, shared {row.voting.shared}, none {row.voting.none}.</p>{row.otherManagerIds.length>0&&<><p>Included managers attributed to this row:</p><ul>{filing.includedManagers.filter(m=>row.otherManagerIds.includes(m.stableId)).map(m=><li key={m.stableId}>{m.name} · {m.form13FFileNumber?`13F file ${m.form13FFileNumber}`:`CIK ${m.cik}`}</li>)}</ul></>}<p>Accession {filing.reference.accession}. No ticker or issuer CIK has been inferred from this CUSIP. Shared positions must not be added across managers without checking for duplicate reporting.</p></details>
        <a className="home-text-link" href={filing.sourceUrl} target="_blank" rel="noopener noreferrer">Original SEC submission ↗</a>
      </article>)}</div><nav aria-label="Holdings pages">{page>1&&<Link href={pageUrl(page-1)}>Previous</Link>}{" "}{page<pages&&<Link href={pageUrl(page+1)}>Next</Link>}</nav>
    </section></main><SiteFooter/></>;
}
