import type { FilingParseResult } from "./house-parser.ts";
import { stripPageFurniture } from "./house-parser.ts";

/** Independent conservation check, deliberately not based on the parser's block
 * counter: that counter can miss several transactions inside one owner block.
 * A mention is not automatically a trade; unexplained surplus requires review.
 */
export function assessHouseSymbolCoverage(text: string, parsed: FilingParseResult) {
  // A tag can resume after the transaction cells on the next page. Count
  // those candidates too, without using the parser's segmented row count.
  const source=stripPageFurniture(text.replace(/\x00/g, "")).replace(/\s+/g," ");
  const mentions = [...source.matchAll(/\(([A-Z][A-Z0-9.\-]{0,6})\)(?:\s*(?:P|S\s*\(partial\)|S|E)\s+\d{2}\/\d{2}\/\d{4}[^\[\]]{0,180})?\s*\[(?:ST|OP|CS|ET)\]/g)].length;
  const accounted = parsed.rows.length + parsed.skipped.length;
  return { mentions, accounted, unaccounted: Math.max(0, mentions - accounted) };
}
