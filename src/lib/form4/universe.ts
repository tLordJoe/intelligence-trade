import { createHash } from "node:crypto";
export interface InsiderUniverse {
  schemaVersion: 1; source: "sec-company-tickers"; sourceSha256: string;
  capturedAt: string; entries: { cik: string; ticker: string; title: string }[];
}
export const insiderUniverseHash = (universe: InsiderUniverse) => createHash("sha256").update(JSON.stringify(universe)).digest("hex");
export function readInsiderUniverse(value: unknown): InsiderUniverse {
  const universe = value as InsiderUniverse;
  if (universe?.schemaVersion !== 1 || universe.source !== "sec-company-tickers" || !/^[a-f0-9]{64}$/.test(universe.sourceSha256) ||
      !Number.isFinite(Date.parse(universe.capturedAt)) || !Array.isArray(universe.entries) || !universe.entries.length) throw new Error("Invalid insider universe");
  const symbols = new Set<string>();
  for (const entry of universe.entries) {
    if (!/^\d{10}$/.test(entry.cik) || !/^[A-Z0-9.-]+$/.test(entry.ticker) || !entry.title?.trim() || symbols.has(entry.ticker)) throw new Error("Invalid or duplicated insider universe entry");
    symbols.add(entry.ticker);
  }
  return universe;
}
