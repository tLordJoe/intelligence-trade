/**
 * One colour per fund, everywhere.
 *
 * The obvious implementation — index into a palette by the fund's position in
 * the current list — is wrong, and wrong in a way that is hard to see in a
 * screenshot. Sort the table by return and SMH's line changes colour. Remove
 * VOO and every fund after it shifts one place along. A reader who has learned
 * "the orange line is the utilities fund" is then quietly misinformed by the
 * next interaction, and the legend still agrees with the chart, so nothing
 * looks broken.
 *
 * So the mapping is keyed on the symbol and derived from the provider's
 * universe, which does not change when the selection or the sort does. The same
 * symbol gets the same colour in the chart, the legend, the table, the tooltip
 * and the selection chips, for the life of the dataset.
 */

/**
 * Palette.
 *
 * Ten entries, distinguishable in both themes, and ordered so that adjacent
 * entries differ in lightness as well as hue — a reader who cannot separate red
 * from green can still separate these lines, and the table carries every value
 * regardless.
 */
export const SERIES_PALETTE = [
  "#2563EB", // blue
  "#F59E0B", // amber
  "#10B981", // emerald
  "#EF4444", // red
  "#A855F7", // violet
  "#14B8A6", // teal
  "#EC4899", // pink
  "#F97316", // orange
  "#6366F1", // indigo
  "#84CC16", // lime
] as const;

/** Used only when a symbol is absent from the universe the map was built from. */
const FALLBACK_COLOR = "#64748B";

export interface ColorAssignment {
  colorFor(symbol: string): string;
  /** Every assignment, for tests and for rendering a full legend. */
  entries(): Array<{ symbol: string; color: string }>;
}

/**
 * Build the mapping from the full universe of symbols.
 *
 * The universe is sorted first, so the assignment depends only on *which*
 * symbols exist — not on the order the provider happened to list them, and not
 * on which of them a reader has currently selected.
 */
export function buildColorAssignment(universe: string[]): ColorAssignment {
  const ordered = [...new Set(universe.map((s) => s.trim().toUpperCase()))].sort();
  const map = new Map<string, string>();
  ordered.forEach((symbol, index) => {
    map.set(symbol, SERIES_PALETTE[index % SERIES_PALETTE.length]);
  });

  return {
    colorFor(symbol: string): string {
      return map.get(symbol.trim().toUpperCase()) ?? FALLBACK_COLOR;
    },
    entries() {
      return ordered.map((symbol) => ({ symbol, color: map.get(symbol) as string }));
    },
  };
}
