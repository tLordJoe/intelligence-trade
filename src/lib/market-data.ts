export interface Quote {
  price: number;
  change: number;
}

export interface DataMeta {
  source: string;
  updatedAt: string;
  delay: string;
}

export interface StockQuoteResponse {
  quotes: Record<string, Quote>;
  unavailable: string[];
  meta: DataMeta;
}

export function normalizeTickers(values: string[], maximum = 100): string[] {
  return [...new Set(values.map((value) => value.trim().toUpperCase()))]
    .filter((value) => /^[A-Z.]{1,6}$/.test(value))
    .slice(0, maximum);
}

export function percentagePerformance(base: number, current: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(current) || base <= 0) {
    throw new Error("Prices must be finite and the base price must be positive");
  }
  return ((current / base) - 1) * 100;
}
