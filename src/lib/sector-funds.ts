/** Manually verified issuer directory and dated fee reference, not a live feed.
 * Source checks: 2026-09-13. No vendor logos, prices or performance data.
 * SPDR suite: issuer sector overview publishes 8 bps; individual product links
 * independently identify the eleven equity ETFs (not the premium-income suite).
 * Vanguard: p954 prospectus fee tables, printed pages 1/8/15/22/28/34/40/46/53/59,
 * December 19, 2025 as supplemented June 30, 2026. VNQ uses its May 28 prospectus.
 * Fees are percentages (0.09 means 0.09%), never decimal fractions.
 * No holdings joins may use this display catalog; series/class identity is needed.
 */
export const SECTOR_FUND_CHECKED = "2026-09-13";
const spdrSource = "https://www.ssga.com/us/en/individual/capabilities/equities/sector-investing/select-sector-etfs";
const vanguardSource = "https://www.vanguard.com/pub/Pdf/p954.pdf";
export interface SectorFund {
  ticker: string;
  provider: string;
  name: string;
  source: string;
  sectorId: string;
  expensePercent: number;
  expenseLabel: string;
  expenseSource: string;
  expenseAsOf: string;
}
const directory: Record<string, readonly [string, string, string]> = {
  technology: ["XLK", "VGT", "Technology"],
  financials: ["XLF", "VFH", "Financials"],
  communication: ["XLC", "VOX", "Communication Services"],
  healthcare: ["XLV", "VHT", "Health Care"],
  discretionary: ["XLY", "VCR", "Consumer Discretionary"],
  industrials: ["XLI", "VIS", "Industrials"],
  staples: ["XLP", "VDC", "Consumer Staples"],
  energy: ["XLE", "VDE", "Energy"],
  utilities: ["XLU", "VPU", "Utilities"],
  materials: ["XLB", "VAW", "Materials"],
  "real-estate": ["XLRE", "VNQ", "Real Estate"],
};
export function sectorFunds(id: string): SectorFund[] {
  const entry = directory[id];
  if (!entry) return [];
  const [spdr, vanguard, label] = entry;
  const spdrLabel = id === "financials" ? "Financial" : id === "industrials" ? "Industrial" : label;
  const spdrPage = `https://www.ssga.com/us/en/intermediary/etfs/state-street-${spdrLabel.toLowerCase().replaceAll(" ", "-")}-select-sector-spdr-etf-${spdr.toLowerCase()}`;
  const vanguardPages: Record<string, number> = { VOX: 3, VCR: 10, VDC: 17, VDE: 24, VFH: 30, VHT: 36, VIS: 42, VGT: 48, VAW: 55, VPU: 61 };
  const vanguardPage = id === "real-estate"
    ? "https://www.sec.gov/Archives/edgar/data/734383/000073438326000136/f45323d1.htm"
    : `${vanguardSource}#page=${vanguardPages[vanguard]}`;
  return [
    { ticker: spdr, provider: "State Street · Select Sector SPDR", name: `State Street ${spdrLabel} Select Sector SPDR ETF`,
      sectorId: id, source: spdrPage, expensePercent: 0.08, expenseLabel: "Gross expense ratio",
      expenseSource: spdrSource, expenseAsOf: SECTOR_FUND_CHECKED },
    { ticker: vanguard, provider: "Vanguard", name: `Vanguard ${id === "technology" ? "Information Technology" : label} ETF`,
      sectorId: id, source: vanguardPage, expensePercent: id === "real-estate" ? 0.13 : 0.09,
      expenseLabel: "Annual fund operating expenses", expenseSource: vanguardPage,
      expenseAsOf: id === "real-estate" ? "2026-05-28" : "2026-06-30" },
  ];
}
export function allSectorFunds(): SectorFund[] { return Object.keys(directory).flatMap(sectorFunds); }
export function findSectorFund(ticker: string): SectorFund | undefined {
  return allSectorFunds().find(fund => fund.ticker === ticker.trim().toUpperCase());
}
