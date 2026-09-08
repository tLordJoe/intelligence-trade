/** Search metadata is not price coverage or a recommendation. */
export interface SearchInstrument {
  symbol: string;
  name: string;
  kind: "fund" | "stock";
}

export function normalizeTypedSymbol(value: string): string | null {
  const symbol = value.trim().toUpperCase();
  return /^[A-Z][A-Z0-9]{0,9}(?:[.-][A-Z0-9]{1,4})?$/.test(symbol) ? symbol : null;
}

export function searchInstruments(catalog: SearchInstrument[], query: string): SearchInstrument[] {
  const q = query.trim().toLowerCase().slice(0, 100);
  if (!q) return [];
  return catalog.filter((item) => item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q))
    .sort((a, b) => Number(b.symbol.toLowerCase() === q) - Number(a.symbol.toLowerCase() === q) || a.symbol.localeCompare(b.symbol))
    .slice(0, 8);
}
