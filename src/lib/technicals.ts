export type Signal = "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";

export interface TechnicalData {
  ticker: string;
  price: number;
  sma20: number;
  sma50: number;
  sma200: number;
  rsi: number;
  macdSignal: "bullish" | "bearish" | "neutral";
  priceTarget: number;
  priceTargetSource: string;
  support: number;
  resistance: number;
  signal: Signal;
  volume24h: string;
  avgVolume: string;
  weekHigh52: number;
  weekLow52: number;
  fromHigh52: number;
}

export function getSignalColor(signal: Signal): string {
  switch (signal) {
    case "STRONG_BUY": return "#10B981";
    case "BUY": return "#34D399";
    case "NEUTRAL": return "#F59E0B";
    case "SELL": return "#F87171";
    case "STRONG_SELL": return "#EF4444";
  }
}

export function getSignalLabel(signal: Signal): string {
  switch (signal) {
    case "STRONG_BUY": return "Strong Buy";
    case "BUY": return "Buy";
    case "NEUTRAL": return "Neutral";
    case "SELL": return "Sell";
    case "STRONG_SELL": return "Strong Sell";
  }
}

function generateTechnicals(ticker: string, basePrice: number): TechnicalData {
  const seed = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const noise = (offset: number) => ((seed * (offset + 1) * 7) % 200 - 100) / 1000;

  const sma20 = basePrice * (1 + noise(1) * 3);
  const sma50 = basePrice * (1 + noise(2) * 5);
  const sma200 = basePrice * (1 + noise(3) * 8);
  const rsi = 30 + ((seed * 13) % 40);

  const aboveSma20 = basePrice > sma20;
  const aboveSma50 = basePrice > sma50;
  const aboveSma200 = basePrice > sma200;
  const bullishCount = [aboveSma20, aboveSma50, aboveSma200].filter(Boolean).length;

  let signal: Signal;
  if (bullishCount === 3 && rsi < 70) signal = "STRONG_BUY";
  else if (bullishCount >= 2) signal = "BUY";
  else if (bullishCount === 1) signal = "NEUTRAL";
  else if (rsi > 70) signal = "SELL";
  else signal = "STRONG_SELL";

  const macdSignal = bullishCount >= 2 ? "bullish" : bullishCount === 1 ? "neutral" : "bearish";

  const priceTarget = basePrice * (1.05 + noise(4) * 10);
  const support = basePrice * (0.92 + noise(5) * 3);
  const resistance = basePrice * (1.08 + noise(6) * 3);
  const weekHigh52 = basePrice * (1.1 + Math.abs(noise(7)) * 5);
  const weekLow52 = basePrice * (0.6 + Math.abs(noise(8)) * 3);
  const fromHigh52 = ((basePrice - weekHigh52) / weekHigh52) * 100;

  const volBase = 10 + (seed % 90);
  const volume24h = `${(volBase * 0.8 + ((seed * 3) % 50)).toFixed(1)}M`;
  const avgVolume = `${volBase.toFixed(1)}M`;

  return {
    ticker,
    price: basePrice,
    sma20: Math.round(sma20 * 100) / 100,
    sma50: Math.round(sma50 * 100) / 100,
    sma200: Math.round(sma200 * 100) / 100,
    rsi: Math.round(rsi),
    macdSignal,
    priceTarget: Math.round(priceTarget * 100) / 100,
    priceTargetSource: "Analyst Consensus",
    support: Math.round(support * 100) / 100,
    resistance: Math.round(resistance * 100) / 100,
    signal,
    volume24h,
    avgVolume,
    weekHigh52: Math.round(weekHigh52 * 100) / 100,
    weekLow52: Math.round(weekLow52 * 100) / 100,
    fromHigh52: Math.round(fromHigh52 * 10) / 10,
  };
}

const PRICES: Record<string, number> = {
  NVDA: 189, AMD: 120, AVGO: 238, QCOM: 167, ARM: 165, INTC: 44, MRVL: 118,
  SMCI: 32, MSFT: 448, GOOGL: 200, META: 580, AMZN: 210, CRM: 330, ORCL: 175,
  NOW: 950, SNOW: 180, PLTR: 65, CRWD: 370, PANW: 340, ZS: 240, FTNT: 95,
  NET: 115, CYBR: 310, OKTA: 105, TSM: 185, ASML: 760, AMAT: 210, LRCX: 95,
  KLAC: 720, CSCO: 58, ANET: 340, CEG: 280, VST: 140, MU: 115, EQIX: 870,
  VRT: 120, GEV: 340, S: 25, VRNS: 50, QLYS: 140,
};

export function getTechnicalsForTicker(ticker: string): TechnicalData {
  const price = PRICES[ticker] || 100 + (ticker.charCodeAt(0) % 200);
  return generateTechnicals(ticker, price);
}

export function getAllSignals(): TechnicalData[] {
  return Object.entries(PRICES).map(([ticker, price]) =>
    generateTechnicals(ticker, price)
  );
}

export function getStrongBuys(): TechnicalData[] {
  return getAllSignals().filter((t) => t.signal === "STRONG_BUY" || t.signal === "BUY");
}
