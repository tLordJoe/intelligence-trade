/** Call with the visible rows, never the unfiltered fetched page. */
export function disclosureStats(rows: ReadonlyArray<{ type: string; politician: string; ticker: string }>) {
  return {
    totalTrades: rows.length,
    buyRatio: rows.length ? Math.round(100 * rows.filter(row => row.type === "Buy").length / rows.length) : null,
    uniquePoliticians: new Set(rows.map(row => row.politician)).size,
    uniqueTickers: new Set(rows.map(row => row.ticker)).size,
  };
}
