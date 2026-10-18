import house from "./congress-live.json";
import senateRelease from "./senate-live.json";
import insiderRelease from "./insider-live.json";
import { readApprovedSenateRelease } from "./senate/public-view";
import { readApprovedInsiderRelease } from "./form4/public-view";
import { buildHomeWindow, buildSenateHomeWindow, buildInsiderHomeWindow, mergeHomeWindows, type HomePeriod } from "./homepage-market";
import type { DisclosureRecord } from "./congress-schema";

/** Full projections stay on the server. The homepage sends only bounded previews. */
export function homeMarketData(asOf = new Date().toISOString().slice(0,10)) {
  const senate = readApprovedSenateRelease(senateRelease), insiders = readApprovedInsiderRelease(insiderRelease);
  const periods = ["ytd","30","90"] as HomePeriod[];
  const houseWindows = Object.fromEntries(periods.map(period => [period,buildHomeWindow(house.trades as DisclosureRecord[],period,asOf)])) as Record<HomePeriod,ReturnType<typeof buildHomeWindow>>;
  const senateWindows = senate ? Object.fromEntries(periods.map(period=>[period,buildSenateHomeWindow(senate,period,asOf)])) as typeof houseWindows : null;
  const insiderWindows = insiders?.schemaVersion===1 ? Object.fromEntries(periods.map(period=>[period,buildInsiderHomeWindow(insiders,period,asOf)])) as typeof houseWindows : null;
  const windows = Object.fromEntries(periods.map(period=>{
    const congress=senateWindows?mergeHomeWindows(houseWindows[period],senateWindows[period]):houseWindows[period];
    return [period,insiderWindows?mergeHomeWindows(congress,insiderWindows[period]):congress];
  })) as typeof houseWindows;
  return {windows,houseWindows,senateWindows,insiderWindows};
}
