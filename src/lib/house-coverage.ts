import type { FilingParseResult } from "./house-parser.ts";

/** Independent conservation check, deliberately not based on the parser's block
 * counter: that counter can miss several transactions inside one owner block.
 * A mention is not automatically a trade; unexplained surplus requires review.
 */
export function assessHouseSymbolCoverage(text: string, parsed: FilingParseResult) {
  const mentions = [...text.matchAll(/\(([A-Z][A-Z0-9.\-]{0,6})\)\s*\[(?:ST|OP|CS|ET)\]/g)].length;
  const accounted = parsed.rows.length + parsed.skipped.length;
  return { mentions, accounted, unaccounted: Math.max(0, mentions - accounted) };
}
