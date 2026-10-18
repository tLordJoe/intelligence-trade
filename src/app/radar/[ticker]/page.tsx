import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import RadarEvidencePage from "@/components/RadarEvidencePage";
import { currentRadar,radarIdentity } from "@/lib/radar-data";
import "../../homepage.css";
export async function generateMetadata({params}:{params:Promise<{ticker:string}>}):Promise<Metadata>{const ticker=(await params).ticker.toUpperCase();return {title:`${ticker} · On the Radar`,alternates:{canonical:`/radar/${ticker}`}};}
export default async function RadarStock({params}:{params:Promise<{ticker:string}>}){
  const ticker=(await params).ticker.toUpperCase(),view=currentRadar(),item=[...view.items,...view.watchItems].find(i=>i.tickers.includes(ticker));
  if(item)return <RadarEvidencePage view={view} item={item}/>;
  if(!radarIdentity(ticker))notFound();
  return <><Navbar/><main className="home-shell instrument-page"><nav className="instrument-breadcrumb"><Link href="/radar">On the Radar</Link></nav><header className="instrument-hero"><p className="kicker">Current Radar status · Evidence v2</p><h1>{ticker.slice(0,20)}</h1><p className="instrument-summary">This name does not currently qualify for the stronger Radar shortlist. A handful of purchases alone is not sufficient. That is not a claim that no activity occurred.</p></header><p>As of {view.asOf}. <Link href="/radar/how-it-works">Inspect the published criteria</Link> or <Link href="/radar">explore the current evidence-led candidates</Link>.</p></main><SiteFooter/></>;
}
