import type { DisclosureRecord } from "./congress-schema.ts";

/** One source-reviewed identity link, not a general amount-matching heuristic.
 * Original PDF 20034346 has ONE IBIT row, $100,001-$250,000. The old parser
 * borrowed $1,001-$15,000 from the preceding unsupported Apollo asset. Preserve
 * the published ID/raw values and let mergeRecords record the normalized fix.
 * Receipt and original bytes: tests/fixtures/house-recovery/README.md.
 */
export function applyReviewedHouseCorrections(
  existing: DisclosureRecord[], incoming: DisclosureRecord[], sourceHashes: ReadonlyMap<string,string>
): DisclosureRecord[] {
  const docId="20034346";
  const oldId="20034346::64e178ecd1db53c5::0";
  const prior=existing.find(r=>r.id===oldId);
  if (!prior || !sourceHashes.has(docId)) return incoming;
  if (sourceHashes.get(docId)!=="29b16843a82ef1f91b5578f02640ab2841dba2ccf76771886312bca272464319") {
    throw new Error("Reviewed IBIT source changed; manual correction review required.");
  }
  if (prior.raw.tickerText!=="IBIT" || prior.raw.amountText!=="$1,001 - $15,000" ||
      prior.raw.transactionDateText!=="03/04/2026") throw new Error("Reviewed IBIT baseline changed.");
  const rows=incoming.filter(r=>r.provenance.docId===docId && r.ticker==="IBIT");
  if (rows.length!==1 || rows[0].type!=="Buy" || rows[0].transactionDate!=="2026-03-04" ||
      rows[0].amountLow!==100001 || rows[0].amountHigh!==250000 ||
      rows[0].amountStatus!=="disclosed_range") throw new Error("Reviewed IBIT row no longer matches source proof.");
  return incoming.map(r=>r===rows[0]?{...r,id:oldId}:r);
}
