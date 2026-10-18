import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Landmark, Building2, BriefcaseBusiness } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import NewsletterSignup from "@/components/NewsletterSignup";
import HomeTradingTable from "@/components/HomeTradingTable";
import HomeSectorExplorer from "@/components/HomeSectorExplorer";
import RadarCards from "@/components/RadarCards";
import liveData from "@/lib/congress-live.json";
import { homeMarketData } from "@/lib/home-market-data";
import { previewHomeWindows } from "@/lib/homepage-market";
import { currentRadar } from "@/lib/radar-data";
import { previewAccessFromEnv } from "@/lib/funds/access";
import "./homepage.css";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Outfox — Financial intelligence for the rest of us",
  description: "Follow repeat disclosed buying, inspect the people and filings behind every highlight, and explore stocks by sector.",
  alternates: { canonical: "/" },
  openGraph: { title: "Outfox — Follow the buying. Find your next idea.", description: "The stocks. The people. The bigger picture.", url: "/" },
};
export default function Home() {
  const asOf = new Date().toISOString().slice(0,10);
  const {windows,houseWindows,senateWindows,insiderWindows}=homeMarketData(asOf);
  const radar=currentRadar(asOf);
  return <><Navbar showCompare={previewAccessFromEnv().allowed}/><main className="home-shell flex-1">
    <section className="home-hero"><div><p className="kicker">The stocks. The people. The bigger picture.</p><h1>Follow the buying.<br/><span>Find your next idea.</span></h1><p>Start with the patterns. Follow the filings behind them.</p><div className="home-hero-actions"><a className="home-primary-link" href="#on-the-radar">See what’s on the Radar <ArrowUpRight size={17}/></a><Link href="/explore">Explore the market →</Link></div></div></section>
    <nav className="home-section-jumps" aria-label="Homepage sections"><a href="#on-the-radar">On the Radar</a><a href="#trading-activity">Trading activity</a><a href="#home-sectors-title">Market sectors</a></nav>
    <RadarCards view={radar} preview/>
    <section className="home-source-hub" aria-labelledby="source-hub-title"><div className="home-section-intro"><h2 id="source-hub-title">Follow the people behind the positions</h2><p>Four different views. One place to start.</p></div><div className="source-hub-grid">
      <Link href="/congress"><Landmark size={22}/><span><strong>House</strong><small>Member disclosures</small></span><ArrowUpRight size={17}/></Link>
      <Link href="/senate"><Landmark size={22}/><span><strong>Senate</strong><small>Senator disclosures</small></span><ArrowUpRight size={17}/></Link>
      <Link href="/insiders"><Building2 size={22}/><span><strong>Corporate insiders</strong><small>Latest SEC filings</small></span><ArrowUpRight size={17}/></Link>
      <Link href="/institutions"><BriefcaseBusiness size={22}/><span><strong>Funds / institutions</strong><small>Quarterly holdings</small></span><ArrowUpRight size={17}/></Link>
    </div></section>
    <HomeTradingTable windows={previewHomeWindows(windows)} houseWindows={previewHomeWindows(houseWindows)} senateWindows={senateWindows?previewHomeWindows(senateWindows):null} insiderWindows={insiderWindows?previewHomeWindows(insiderWindows):null} updatedAt={liveData.updatedAt} scans={liveData.counts.scannedFilings}/>
    <HomeSectorExplorer companies={windows.ytd.companies.map(({ticker,name,buyers,mark})=>({ticker,name,buyers,mark}))}/>
    <NewsletterSignup variant="banner"/>
  </main><SiteFooter/></>;
}
