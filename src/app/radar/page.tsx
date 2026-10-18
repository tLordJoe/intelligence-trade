import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import RadarCards from "@/components/RadarCards";
import { currentRadar } from "@/lib/radar-data";
import "../homepage.css";
export const revalidate = 3600;
export const metadata: Metadata = { title:"On the Radar · Outfox",description:"Stocks drawing repeat disclosed buying. See the rules, the filers, selling activity and original evidence.",alternates:{canonical:"/radar"} };
export default function RadarPage(){
  const view=currentRadar();
  return <><Navbar/><main className="home-shell instrument-page"><RadarCards view={view}/><p className="radar-scope">{view.items.length} qualifying stocks · {view.start}–{view.asOf}. Radar highlights disclosed activity, not expected returns. No fixed number of names is required.</p></main><SiteFooter/></>;
}
