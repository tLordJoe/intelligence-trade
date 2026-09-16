import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import NewsletterSignup from "@/components/NewsletterSignup";
import HomeTradingTable from "@/components/HomeTradingTable";
import HomeSectorExplorer from "@/components/HomeSectorExplorer";
import liveData from "@/lib/congress-live.json";
import senateRelease from "@/lib/senate-live.json";
import { readApprovedSenateRelease } from "@/lib/senate/public-view";
import type { DisclosureRecord } from "@/lib/congress-schema";
import { buildHomeWindow, buildSenateHomeWindow, mergeHomeWindows, type HomePeriod } from "@/lib/homepage-market";
import { previewAccessFromEnv } from "@/lib/funds/access";
import "./homepage.css";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Outfox — Financial intelligence for the rest of us",
  description: "See what U.S. House members disclosed buying, compare activity across distinct filers, and explore companies by sector. Inspect the original filings.",
  alternates: { canonical: "/" },
  openGraph: { title: "Outfox — Trade smarter than the people in charge.", description: "The stocks. The people. The bigger picture.", url: "/" },
};
export default function Home() {
  const asOf = new Date().toISOString().slice(0, 10);
  const records = liveData.trades as DisclosureRecord[];
  const senate = readApprovedSenateRelease(senateRelease);
  const houseWindows = {
    ytd: buildHomeWindow(records, "ytd", asOf),
    "30": buildHomeWindow(records, "30", asOf),
    "90": buildHomeWindow(records, "90", asOf),
  };
  const senateWindows = senate ? {
    ytd: buildSenateHomeWindow(senate, "ytd", asOf),
    "30": buildSenateHomeWindow(senate, "30", asOf),
    "90": buildSenateHomeWindow(senate, "90", asOf),
  } : null;
  const windows = senateWindows ? Object.fromEntries((["ytd", "30", "90"] as HomePeriod[]).map(period =>
    [period, mergeHomeWindows(houseWindows[period], senateWindows[period])])) as typeof houseWindows : houseWindows;
  return <>
    <Navbar showCompare={previewAccessFromEnv().allowed} />
    <main className="home-shell flex-1">
      <section className="home-hero">
        <div><h1>Trade smarter than<br /><span>the people in charge.</span></h1><p>Spot the stocks drawing attention.</p></div>
        <p className="home-hero-aside">The stocks. The people.<br />The bigger picture.</p>
      </section>
      <HomeTradingTable windows={windows} houseWindows={houseWindows} senateWindows={senateWindows} updatedAt={liveData.updatedAt} scans={liveData.counts.scannedFilings} />
      <HomeSectorExplorer companies={windows.ytd.companies} />
      <NewsletterSignup variant="banner" />
    </main>
    <SiteFooter />
  </>;
}
