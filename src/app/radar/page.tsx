import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import RadarCards from "@/components/RadarCards";
import { currentRadar } from "@/lib/radar-data";
import "../homepage.css";
export const revalidate = 3600;
export const metadata: Metadata = { title:"On the Radar · Outfox",description:"Meaningful portfolio expansions, repeat buying and cross-source evidence. Inspect who changed position, allocation size and opposing activity.",alternates:{canonical:"/radar"} };
export default function RadarPage(){
  const view=currentRadar();
  return <><Navbar/><main className="home-shell instrument-page"><RadarCards view={view}/><section className="home-panel"><h2>The evidence behind this scan</h2><p>{view.coverage.houseRows.toLocaleString()} House records · {view.coverage.senateRows.toLocaleString()} Senate records · {view.coverage.insiderRows.toLocaleString()} insider purchase/sale rows · {view.coverage.holdingRows.toLocaleString()} institutional position rows.</p><p>{view.coverage.fundSecuritiesScreened.toLocaleString()} distinct fund securities screened across {view.coverage.comparableManagers} active managers with comparable quarters. Insider and congressional conviction uses transaction dates {view.start}–{view.asOf}; fund evidence uses separately labeled quarter-end positions. Missing coverage does not become a zero or a positive signal.</p></section><p className="radar-scope">As of {view.asOf}. These are research candidates, not demonstrated return forecasts or trade recommendations. No fixed number of names is required.</p></main><SiteFooter/></>;
}
