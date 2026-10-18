import { notFound } from "next/navigation";
import RadarEvidencePage from "@/components/RadarEvidencePage";
import { currentRadar } from "@/lib/radar-data";
import "../../../homepage.css";
export default async function RadarHolding({params}:{params:Promise<{cusip:string}>}){
  const cusip=(await params).cusip.toUpperCase(),view=currentRadar(),item=[...view.items,...view.watchItems].find(i=>i.cusips.includes(cusip));
  if(!item)notFound();return <RadarEvidencePage view={view} item={item}/>;
}
