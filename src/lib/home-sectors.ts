/** Editorial discovery examples, not a complete security master or fund holdings feed.
 * Sector weights are a dated S&P 500 snapshot, not whole-market capitalization.
 */
export const HOME_SECTORS = [
  { id: "technology", name: "Information Technology", icon: "monitor", colors: ["#b91c1c", "#ef4444"], width: 100, description: "Software, computing hardware, and the chips that connect the digital economy.", tickers: ["AAPL", "MSFT", "NVDA", "AMD", "AVGO", "AMAT"] },
  { id: "financials", name: "Financials", icon: "wallet", colors: ["#0f766e", "#14b8a6"], width: 93, description: "Banks, insurers, payment networks, and investment businesses.", tickers: ["JPM", "BAC", "GS", "V", "MA", "BRK-B"] },
  { id: "communication", name: "Communication Services", icon: "messages", colors: ["#0e7490", "#22b8cf"], width: 86, description: "The networks, platforms, media, and entertainment that connect people.", tickers: ["GOOGL", "GOOG", "META", "NFLX", "DIS", "T", "VZ"] },
  { id: "healthcare", name: "Health Care", icon: "heart", colors: ["#b45309", "#f59e0b"], width: 89, description: "Medicines, care providers, medical devices, and the businesses that help pay for care.", tickers: ["UNH", "LLY", "ABBV", "JNJ", "PFE", "MRK"] },
  { id: "discretionary", name: "Consumer Discretionary", icon: "cart", colors: ["#6d28d9", "#8b5cf6"], width: 86, description: "Vehicles, shopping, travel, and services people choose beyond everyday essentials. A primary sector does not describe every business a company operates.", tickers: ["TSLA", "AMZN", "HD", "LOW", "MCD", "NKE"] },
  { id: "industrials", name: "Industrials", icon: "factory", colors: ["#047857", "#10b981"], width: 80, description: "Manufacturing, transportation, aerospace, and the equipment behind the economy.", tickers: ["CAT", "GE", "HON", "RTX", "UPS", "DE"] },
  { id: "staples", name: "Consumer Staples", icon: "basket", colors: ["#be185d", "#ec4899"], width: 73, description: "Food, drinks, household goods, and other everyday essentials.", tickers: ["KHC", "KO", "PEP", "PG", "WMT", "COST"] },
  { id: "energy", name: "Energy", icon: "flame", colors: ["#c2410c", "#f97316"], width: 68, description: "Oil and gas production, pipelines, refining, and energy services.", tickers: ["XOM", "CVX", "COP", "HAL", "SLB", "EOG"] },
  { id: "utilities", name: "Utilities", icon: "bolt", colors: ["#4338ca", "#6366f1"], width: 62, description: "Electricity, gas, and water providers serving homes and businesses.", tickers: ["AEP", "NEE", "DUK", "SO", "CEG", "VST"] },
  { id: "materials", name: "Materials", icon: "layers", colors: ["#44403c", "#78716c"], width: 57, description: "Chemicals, metals, packaging, and raw materials used throughout industry.", tickers: ["LIN", "APD", "FCX", "NEM", "SHW", "NUE"] },
  { id: "real-estate", name: "Real Estate", icon: "building", colors: ["#be4840", "#f77769"], width: 52, description: "Property owners and operators, including infrastructure and data-center real estate.", tickers: ["PLD", "AMT", "EQIX", "DLR", "O", "SPG"] },
] as const;

/** State Street's published Index Sector Breakdown, 2026-09-09.
 * Display uses a 40% floor plus 60% proportional width, matching the original stack.
 */
export const SECTOR_WEIGHT_DATE = "2026-09-09";
export const SECTOR_WEIGHT_SOURCE = "https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy";
export const SECTOR_WEIGHTS: Record<string, number> = {
  technology: 38.28, financials: 12.23, communication: 9.62, healthcare: 9.12,
  discretionary: 8.90, industrials: 8.20, staples: 4.44, energy: 3.58,
  utilities: 2.03, materials: 1.79, "real-estate": 1.78,
};
export function sectorDisplayWidth(id: string): number {
  const weight = SECTOR_WEIGHTS[id];
  if (weight === undefined) throw new Error("Unknown sector weight");
  return 40 + weight / Math.max(...Object.values(SECTOR_WEIGHTS)) * 60;
}
