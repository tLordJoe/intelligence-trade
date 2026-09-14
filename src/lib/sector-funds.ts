/** Manually verified issuer directory, not a holdings feed or investment ranking.
 * Source checks: 2026-09-13. No vendor logos, prices or performance data.
 */
export const SECTOR_FUND_CHECKED = "2026-09-13";
const spdrSource = "https://www.ssga.com/us/en/individual/capabilities/equities/sector-investing/select-sector-etfs";
const vanguardSource = "https://www.vanguard.com/pub/Pdf/p954.pdf";
export interface SectorFund {
  ticker: string;
  provider: string;
  name: string;
  source: string;
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
  return [
    { ticker: spdr, provider: "State Street · Select Sector SPDR", name: `${label} sector ETF`, source: spdrSource },
    { ticker: vanguard, provider: "Vanguard", name: `${label} ETF`, source: id === "real-estate" ? "https://investor.vanguard.com/investment-products/etfs/sector-etfs" : vanguardSource },
  ];
}
