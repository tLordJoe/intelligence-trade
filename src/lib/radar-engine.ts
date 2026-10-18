/** Evidence-led Radar v2. Different source clocks remain different clocks.
 * There is no inferred trade date, cash flow, profit, or predictive score. */
import type { DisclosureRecord } from "./congress-schema.ts";
import type { SenatePublicPayload } from "./senate/public-view.ts";
import type { InsiderPayload } from "./form4/public-view.ts";
import type { InstitutionPayload } from "./institutions/release.ts";
import type { InstitutionalFiling, Holding } from "./institutions/parse.ts";
import { archiveRecords, disclosureFilerKey, displayFiler, validDisclosureDate } from "./home-discovery.ts";
import { filerProfilePath } from "./filer-profile.ts";

export const RADAR_V2_RULES = {
  version:"2.0", transactionDays:90, freshPurchaseDays:30, managerFilingDays:120, maximumQuarterAgeDays:150,
  minimumManagers:2, minimumPositionWeight:1, minimumWeightIncreasePoints:0.5, minimumQuantityIncreasePercent:10,
  minimumCongressBuyers:5, minimumCongressEvents:7, minimumCongressRepeats:2,
  minimumInsiderBuyers:3, minimumInsiderEvents:5, minimumInsiderRepeats:2,
  minimumCrossSourceBuyers:3, minimumCrossSourceEvents:5, maximumHighlights:12,
} as const;
/** Named active-manager research cohort, not a list ranked by AUM. Related
 * Pershing entities share one group and never manufacture a second manager. */
export const RADAR_ACTIVE_MANAGERS: Record<string,{name:string;group:string}> = {
  "0001067983":{name:"Berkshire Hathaway",group:"berkshire"},
  "0001541617":{name:"Brad Gerstner · Altimeter",group:"altimeter"},
  "0001656456":{name:"David Tepper · Appaloosa",group:"appaloosa"},
  "0001040273":{name:"Daniel Loeb · Third Point",group:"third-point"},
  "0001647251":{name:"Chris Hohn · TCI",group:"tci"},
  "0001536411":{name:"Stanley Druckenmiller · Duquesne",group:"duquesne"},
  "0001336528":{name:"Bill Ackman · Pershing Square Capital Management",group:"pershing"},
  "0002026053":{name:"Bill Ackman · Pershing Square Inc.",group:"pershing"},
  "0001135730":{name:"Coatue",group:"coatue"},"0001167483":{name:"Tiger Global",group:"tiger"},
  "0001350694":{name:"Bridgewater",group:"bridgewater"},"0001037389":{name:"Renaissance Technologies",group:"renaissance"},
};
type Identities=Record<string,{ticker:string;cik:string;title:string}>;
export interface RadarSecurityLink {cusip:string;ticker:string;cik:string;name:string;shareClass:string;sources:string[]}
export interface RadarTradeEvidence {
  id:string;source:"House"|"Senate"|"Corporate insiders";side:"Buy"|"Sell";actor:string;name:string;href:string;
  traded:string;filed:string;amount:string;sourceUrl:string;owner:string|null;
}
export interface RadarFundEvidence {
  cik:string;group:string;manager:string;cusip:string;issuerName:string;shareClass:string;
  previousPeriod:string;currentPeriod:string;previousShares:string|null;currentShares:string;
  previousWeight:number;currentWeight:number;weightChangePoints:number;quantityChangePercent:number|null;
  status:"newly_reported"|"expanded"|"reduced"|"other";qualifies:boolean;meaningfulReduction:boolean;
  filed:string;previousSource:string;currentSource:string;previousAccession:string;currentAccession:string;
}
export interface RadarV2Item {
  key:string;ticker:string|null;cik:string|null;name:string;tickers:string[];cusips:string[];href:string;
  kind:"manager_convergence"|"cross_source"|"insider_cluster"|"congress_cluster"|"divided";
  headline:string;reasons:string[];sourceLabels:string[];latestEvidenceFiled:string;
  managers:number;existingExpansionManagers:number;newlyReportedOnly:boolean;reducingManagers:number;buyers:number;sellers:number;buyEvents:number;sellEvents:number;repeatBuyers:number;
  trades:RadarTradeEvidence[];funds:RadarFundEvidence[];history:RadarTradeEvidence[];identityLinks:RadarSecurityLink[];
}
export interface RadarV2View {
  asOf:string;start:string;freshFrom:string;universeSize:number;items:RadarV2Item[];watchItems:RadarV2Item[];qualifyingCount:number;
  coverage:{houseRows:number;senateRows:number;insiderRows:number;holdingRows:number;fundSecuritiesScreened:number;comparableManagers:number;latestQuarter:string|null;insiderWindows:{from:string;to:string}[]};
}
const DAY=86400000,offset=(date:string,days:number)=>new Date(Date.parse(date)-days*DAY).toISOString().slice(0,10);
const percent=(value:bigint,total:bigint)=>total>BigInt(0)?Number(value*BigInt(1000000)/total)/10000:0;
const fixed=(value:string)=>{const [whole,fraction=""]=value.split(".");return BigInt(whole)*BigInt(10000)+BigInt(fraction.padEnd(4,"0"));};
const printable=(value:bigint)=>`${value/BigInt(10000)}.${String(value%BigInt(10000)).padStart(4,"0")}`.replace(/\.?0+$/,"");
const company=(title:string)=>!(/\b(?:ETF|ETN|FUND|FUNDS|WARRANT|PREFERRED|ACQUISITION)\b|ISHARES|SPDR|PROSHARES|DIREXION|(?:VANGUARD|INVESCO|PIMCO|NUVEEN).*(?:TRUST|FUND|ETF)/i.test(title));
const longShares=(row:Holding)=>row.quantityType==="SH"&&!row.putCall;
const ordinary=(row:Holding)=>longShares(row)&&/\bCOM(?:MON)?\b|\bORD(?:INARY)?\b|\bCL(?:ASS)?\b|CAP\s*STK|\bSHS\b/i.test(row.titleOfClass)&&!(/PFD|PREF|WARR|\bUNIT\b|NOTE|BOND|DEBT/i.test(row.titleOfClass))&&company(row.issuerName);

/** Each CUSIP is screened even if no ticker link has been reviewed yet. */
export function radarFundEvidence(payload:InstitutionPayload|null,asOf:string) {
  const eligible=(payload?.filings??[]).filter(f=>RADAR_ACTIVE_MANAGERS[f.reference.cik]&&f.reference.filedDate<=asOf);
  const latestQuarter=(payload?.filings??[]).filter(f=>f.reference.filedDate<=asOf).map(f=>f.period).sort().at(-1)??null;
  const evidence:RadarFundEvidence[]=[],securities=new Set<string>();let comparableManagers=0;
  for(const cik of [...new Set(eligible.map(f=>f.reference.cik))]){
    const all=eligible.filter(f=>f.reference.cik===cik).sort((a,b)=>b.period.localeCompare(a.period));
    const current=all[0];
    // Never skip a more recent held/partial quarter to make an old one look current.
    if(!current||current.period!==latestQuarter||current.period<offset(asOf,RADAR_V2_RULES.maximumQuarterAgeDays)||current.reference.filedDate<offset(asOf,RADAR_V2_RULES.managerFilingDays))continue;
    const previousDate=new Date(`${current.period}T00:00:00Z`);previousDate.setUTCMonth(previousDate.getUTCMonth()-2,0);
    const previous=all.find(f=>f.period===previousDate.toISOString().slice(0,10));
    const complete=(f:InstitutionalFiling)=>!f.amendment&&!f.confidentialOmitted&&f.reportType==="13F HOLDINGS REPORT"&&f.computedEntries===f.declaredEntries&&f.computedValue===f.declaredValue;
    if(!previous||!complete(previous)||!complete(current)||all.filter(f=>f.period===current.period).length!==1||all.filter(f=>f.period===previous.period).length!==1)continue;
    comparableManagers++;
    const sum=(f:InstitutionalFiling)=>f.holdings.filter(longShares).reduce((n,r)=>n+BigInt(r.valueUsd),BigInt(0));
    const beforeTotal=sum(previous),afterTotal=sum(current);
    if(beforeTotal<=BigInt(0)||afterTotal<=BigInt(0))continue;
    const aggregate=(f:InstitutionalFiling)=>{
      const map=new Map<string,{row:Holding;quantity:bigint;value:bigint}>();
      for(const row of f.holdings.filter(ordinary)){
        const old=map.get(row.cusip);
        // Different class/manager-discretion rows are not separate purchases.
        map.set(row.cusip,{row,quantity:(old?.quantity??BigInt(0))+fixed(row.quantity),value:(old?.value??BigInt(0))+BigInt(row.valueUsd)});
      }return map;
    };
    const before=aggregate(previous),after=aggregate(current),manager=RADAR_ACTIVE_MANAGERS[cik];
    for(const cusip of new Set([...before.keys(),...after.keys()])){
      securities.add(cusip);const a=before.get(cusip),b=after.get(cusip),row=(b??a)!.row;
      const previousWeight=a?percent(a.value,beforeTotal):0,currentWeight=b?percent(b.value,afterTotal):0;
      const quantityChangePercent=a&&a.quantity>BigInt(0)?Number(((b?.quantity??BigInt(0))-a.quantity)*BigInt(1000000)/a.quantity)/10000:null;
      const status=!a?"newly_reported":!b||b.quantity<a.quantity?"reduced":b.quantity>a.quantity?"expanded":"other";
      // Exact rational gates; rounded display percentages cannot manufacture a
      // threshold crossing. Constants encode 10%, 1%, and 0.5 percentage points.
      const qualifies=!!b&&b.quantity>BigInt(0)&&(!a||(b.quantity-a.quantity)*BigInt(100)>=a.quantity*BigInt(10))&&
        b.value*BigInt(100)>=afterTotal&&
        (b.value*beforeTotal-(a?.value??BigInt(0))*afterTotal)*BigInt(200)>=beforeTotal*afterTotal;
      const meaningfulReduction=!!a&&((a.quantity-(b?.quantity??BigInt(0)))*BigInt(100)>=a.quantity*BigInt(10))&&a.value*BigInt(100)>=beforeTotal;
      evidence.push({cik,group:manager.group,manager:manager.name,cusip,issuerName:row.issuerName,shareClass:row.titleOfClass,
        previousPeriod:previous.period,currentPeriod:current.period,previousShares:a?printable(a.quantity):null,currentShares:printable(b?.quantity??BigInt(0)),
        previousWeight,currentWeight,weightChangePoints:currentWeight-previousWeight,quantityChangePercent,status,qualifies,meaningfulReduction,
        filed:current.reference.filedDate,previousSource:previous.sourceUrl,currentSource:current.sourceUrl,previousAccession:previous.reference.accession,currentAccession:current.reference.accession});
    }
  }
  return {evidence,latestQuarter,securities:securities.size,comparableManagers};
}

function tradeStats(rows:RadarTradeEvidence[]){
  const dates=new Map<string,Set<string>>(),sellDates=new Map<string,Set<string>>();
  for(const r of rows){const map=r.side==="Buy"?dates:sellDates;map.set(r.actor,new Set([...(map.get(r.actor)??[]),r.traded]));}
  return {buyers:dates.size,sellers:sellDates.size,buyEvents:[...dates.values()].reduce((n,s)=>n+s.size,0),sellEvents:[...sellDates.values()].reduce((n,s)=>n+s.size,0),repeatBuyers:[...dates.values()].filter(s=>s.size>=2).length};
}
/** Mechanical/related-account transactions stay searchable in the archive but
 * cannot masquerade as fresh investment conviction in Radar. */
export function insiderRadarEligible(row:NonNullable<InsiderPayload>["records"][number]){
  const notes=Object.values(row.footnotes).join(" ")+" "+(row.sourceRemarks??"");
  if(!/common|ordinary|capital stock/i.test(row.securityTitle)||/preferred|warrant|\bunit\b|note|bond|debt/i.test(row.securityTitle))return false;
  // Do not suppress opposing sales because another row's shared footnote
  // mentions a gift or because the filing carries a plan flag.
  if(row.classification==="reported_sale")return true;
  if(row.filingPlanIndicator===true)return false;
  return !/dividend reinvest|reinvestment plan|employee stock purchase|payroll deduction|power to substitute|substitut(?:ion|e) (?:of )?assets|gift|estate planning|intra.family|irrevocable trust.*revocable trust/i.test(notes);
}
export function buildSubstantiveRadar(input:{house:DisclosureRecord[];senate:SenatePublicPayload|null;insiders:InsiderPayload|null;institutions:InstitutionPayload|null;identities:Identities;securityLinks:RadarSecurityLink[]},asOf:string):RadarV2View{
  if(!validDisclosureDate(asOf))throw new Error("Invalid Radar as-of date");
  const start=offset(asOf,RADAR_V2_RULES.transactionDays-1),freshFrom=offset(asOf,RADAR_V2_RULES.freshPurchaseDays-1);
  const links=new Map<string,RadarSecurityLink>();
  for(const link of input.securityLinks){
    if(!/^[A-Z0-9*@#]{9}$/.test(link.cusip)||links.has(link.cusip)||input.identities[link.ticker]?.cik!==link.cik||!link.sources.length||link.sources.some(s=>{try{const u=new URL(s);return u.protocol!=="https:"||u.hostname!=="www.sec.gov";}catch{return true;}}))throw new Error("Invalid reviewed Radar security link");
    links.set(link.cusip,link);
  }
  const linkedCommonTickers=new Map<string,Set<string>>();
  for(const link of links.values())linkedCommonTickers.set(link.cik,new Set([...(linkedCommonTickers.get(link.cik)??[]),link.ticker]));
  type Group={cik:string|null;name:string;tickers:Set<string>;cusips:Set<string>;trades:RadarTradeEvidence[];history:RadarTradeEvidence[];funds:RadarFundEvidence[]};
  const groups=new Map<string,Group>();
  const ensure=(key:string,cik:string|null,name:string)=>{if(!groups.has(key))groups.set(key,{cik,name,tickers:new Set(),cusips:new Set(),trades:[],history:[],funds:[]});return groups.get(key)!;};
  const seen=new Set<string>();
  const add=(ticker:string,cik:string,row:RadarTradeEvidence)=>{
    const identity=input.identities[ticker];
    if(identity?.cik!==cik||!company(identity.title)||(linkedCommonTickers.has(cik)&&!linkedCommonTickers.get(cik)!.has(ticker))||seen.has(row.id)||!validDisclosureDate(row.traded)||!validDisclosureDate(row.filed)||row.traded>row.filed||row.filed>asOf)return;
    seen.add(row.id);const group=ensure(cik,cik,identity.title);group.tickers.add(ticker);
    if(row.traded>=start&&row.filed>=start)group.trades.push(row);else group.history.push(row);
  };
  for(const r of archiveRecords(input.house,asOf))if(!r.isOptions&&!/preferred|mandatory convertible|\bwarrant|\bbond|\bnotes?\b/i.test(r.companyName)&&["verified","aliased"].includes(r.tickerResolution)&&["Buy","Sell"].includes(r.type))add(r.ticker,r.cik??"",{
    id:`house:${r.id}`,source:"House",side:r.type as "Buy"|"Sell",actor:disclosureFilerKey(r),name:displayFiler(r.politician),href:filerProfilePath(disclosureFilerKey(r)),traded:r.transactionDate,filed:r.filedDate,amount:r.amount,sourceUrl:r.source,owner:r.raw.ownerText||null});
  for(const r of input.senate?.records??[])add(r.ticker,r.cik,{id:`senate:${r.id}`,source:"Senate",side:r.type,actor:`senate:${r.bioguide}`,name:r.politician,href:`/senate/filers/${r.bioguide}`,traded:r.transactionDate,filed:r.filedDate,amount:r.amount,sourceUrl:r.sourceUrl,owner:r.owner});
  const ownerParents=new Map<string,string>();
  const ownerRoot=(cik:string):string=>{const parent=ownerParents.get(cik);if(!parent){ownerParents.set(cik,cik);return cik;}if(parent===cik)return cik;const root=ownerRoot(parent);ownerParents.set(cik,root);return root;};
  for(const r of input.insiders?.records??[]){const owners=r.reportingOwners.map(o=>ownerRoot(o.cik)).sort();for(const id of owners.slice(1))ownerParents.set(ownerRoot(id),ownerRoot(owners[0]));}
  for(const r of input.insiders?.records??[])if(insiderRadarEligible(r))add(r.ticker,r.issuerCik,{id:`insider:${r.id}`,source:"Corporate insiders",side:r.classification==="reported_purchase"?"Buy":"Sell",
    actor:`insider:${ownerRoot(r.reportingOwners[0].cik)}`,name:r.reportingOwners.map(o=>o.name).join(" / "),href:`/insiders?q=${encodeURIComponent(r.ticker)}`,
    traded:r.transactionDate,filed:r.filedDate,amount:`${r.reportedShares} reported shares${r.filingPlanIndicator===true?" · filing indicates a trading plan":""}`,sourceUrl:r.sourceUrl,owner:r.ownership});
  const funds=radarFundEvidence(input.institutions,asOf);
  for(const evidence of funds.evidence){
    const link=links.get(evidence.cusip),key=link?.cik??`cusip:${evidence.cusip}`;
    const group=ensure(key,link?.cik??null,link?.name??evidence.issuerName);
    group.cusips.add(evidence.cusip);if(link)group.tickers.add(link.ticker);group.funds.push(evidence);
  }
  const items:RadarV2Item[]=[];
  for(const [key,g]of groups){
    const stats=tradeStats(g.trades),congress=g.trades.filter(r=>r.source!=="Corporate insiders"),insiders=g.trades.filter(r=>r.source==="Corporate insiders"),cs=tradeStats(congress),is=tradeStats(insiders);
    const expansions=g.funds.filter(f=>f.qualifies),managerGroups=new Set(expansions.map(f=>f.group)),reductions=new Set(g.funds.filter(f=>f.meaningfulReduction).map(f=>f.group));
    const fresh=g.trades.some(r=>r.side==="Buy"&&r.filed>=freshFrom);
    const positive=stats.buyers>stats.sellers&&stats.buyEvents>stats.sellEvents;
    const cross=fresh&&positive&&cs.buyers>0&&is.buyers>0&&stats.buyers>=RADAR_V2_RULES.minimumCrossSourceBuyers&&stats.buyEvents>=RADAR_V2_RULES.minimumCrossSourceEvents&&stats.repeatBuyers>=1;
    const insiderCluster=fresh&&positive&&is.buyers>=RADAR_V2_RULES.minimumInsiderBuyers&&is.buyEvents>=RADAR_V2_RULES.minimumInsiderEvents&&is.repeatBuyers>=RADAR_V2_RULES.minimumInsiderRepeats;
    const congressCluster=fresh&&positive&&cs.buyers>=RADAR_V2_RULES.minimumCongressBuyers&&cs.buyEvents>=RADAR_V2_RULES.minimumCongressEvents&&cs.repeatBuyers>=RADAR_V2_RULES.minimumCongressRepeats;
    const fundCluster=managerGroups.size>=RADAR_V2_RULES.minimumManagers&&managerGroups.size>reductions.size;
    const divided=!fundCluster&&managerGroups.size>=RADAR_V2_RULES.minimumManagers;
    if(!cross&&!insiderCluster&&!congressCluster&&!fundCluster&&!divided)continue;
    const tickers=[...g.tickers].sort(),primary=tickers.includes("GOOGL")?"GOOGL":tickers[0]??null;
    const kind=cross?"cross_source":fundCluster?"manager_convergence":insiderCluster?"insider_cluster":congressCluster?"congress_cluster":"divided";
    const sourceLabels=[...(cs.buyers?[...new Set(congress.filter(r=>r.side==="Buy").map(r=>r.source))]:[]),...(is.buyers?["Corporate insiders"]:[]),...(expansions.length?["Funds / institutions"]:[])];
    const existingExpansionManagers=new Set(expansions.filter(f=>f.quantityChangePercent!==null).map(f=>f.group)).size,newlyReportedOnly=managerGroups.size>=2&&existingExpansionManagers===0;
    const headline=kind==="divided"?`${managerGroups.size} expanding manager groups; ${reductions.size} meaningfully reducing. A divided pattern.`:fundCluster?newlyReportedOnly?`${managerGroups.size} active managers newly reported substantial positions.`:`${managerGroups.size} active managers raised meaningful reported exposure.`:`${stats.buyers} distinct buying filers, ${stats.repeatBuyers} repeat buyers.`;
    const reasonRows=new Map<string,RadarFundEvidence>();
    for(const f of [...expansions].sort((a,b)=>b.weightChangePoints-a.weightChangePoints||a.manager.localeCompare(b.manager)||a.cusip.localeCompare(b.cusip)))if(!reasonRows.has(f.group))reasonRows.set(f.group,f);
    const reasons=fundCluster||kind==="divided"?[...reasonRows.values()].slice(0,3).map(f=>`${f.manager}: ${f.previousShares===null?"not reported":`${f.previousWeight.toFixed(1)}%`} → ${f.currentWeight.toFixed(1)}% of reported long-share value${f.quantityChangePercent===null?"; newly reported positive position":`; shares +${f.quantityChangePercent.toFixed(1)}%`}${g.cusips.size>1?` (${links.get(f.cusip)?.shareClass??f.shareClass})`:""}.`):[`${stats.buyEvents} distinct filer/date purchase events; split filing rows count once.`,`${stats.repeatBuyers} filers returned on another transaction date.`,`${stats.sellers} selling filers / ${stats.sellEvents} sale events in the same window.`];
    const tradeTimes=g.trades.filter(r=>r.side==="Buy").map(r=>r.filed),fundTimes=expansions.map(f=>f.filed);
    items.push({key,ticker:primary,cik:g.cik,name:g.name,tickers,cusips:[...g.cusips].sort(),href:primary?`/radar/${primary}`:`/radar/holding/${[...g.cusips].sort()[0]}`,
      kind,headline,reasons,sourceLabels,latestEvidenceFiled:[...tradeTimes,...fundTimes].sort().at(-1)??"",managers:managerGroups.size,existingExpansionManagers,newlyReportedOnly,reducingManagers:reductions.size,...stats,
      trades:g.trades.sort((a,b)=>b.filed.localeCompare(a.filed)||a.id.localeCompare(b.id)),funds:g.funds.sort((a,b)=>Number(b.qualifies)-Number(a.qualifies)||b.weightChangePoints-a.weightChangePoints||a.manager.localeCompare(b.manager)||a.cusip.localeCompare(b.cusip)),
      history:g.history.sort((a,b)=>b.filed.localeCompare(a.filed)||a.id.localeCompare(b.id)),identityLinks:[...g.cusips].sort().flatMap(c=>links.has(c)?[links.get(c)!]:[])});
  }
  // Evidence breadth first, not popularity, raw dollars, or a performance score.
  items.sort((a,b)=>b.existingExpansionManagers-a.existingExpansionManagers||b.managers-a.managers||b.buyers-a.buyers||b.repeatBuyers-a.repeatBuyers||b.latestEvidenceFiled.localeCompare(a.latestEvidenceFiled)||a.key.localeCompare(b.key));
  const qualified=items.filter(i=>i.kind!=="divided"),watchItems=items.filter(i=>i.kind==="divided");
  return {asOf,start,freshFrom,universeSize:Object.keys(input.identities).length,qualifyingCount:qualified.length,items:qualified.slice(0,RADAR_V2_RULES.maximumHighlights),watchItems:watchItems.slice(0,RADAR_V2_RULES.maximumHighlights),
    coverage:{houseRows:input.house.length,senateRows:input.senate?.records.length??0,insiderRows:input.insiders?.records.length??0,holdingRows:(input.institutions?.filings??[]).reduce((n,f)=>n+f.holdings.length,0),fundSecuritiesScreened:funds.securities,comparableManagers:funds.comparableManagers,latestQuarter:funds.latestQuarter,insiderWindows:input.insiders?.windows??[]}};
}
