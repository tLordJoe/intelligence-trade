/**
 * Stable record identity.
 *
 * Identity has to survive two things that will happen: the parser improving,
 * and a filing genuinely containing the same transaction twice.
 *
 * An earlier design used `{docId}#{ordinal}`, where ordinal counted
 * symbol-bearing blocks in document order. That breaks under parser
 * improvement: the moment a future parser recognizes a row it previously
 * skipped, every ordinal after it shifts by one and every later transaction in
 * that filing changes identity. Records would appear to vanish and be replaced
 * by near-identical new ones.
 *
 * Identity is therefore derived from the row's own canonical content within its
 * document, plus an occurrence counter so two genuinely identical transactions
 * in one filing remain distinct:
 *
 *     {docId}::{contentHash}::{occurrence}
 *
 * Recognizing a new earlier row with *different* content leaves every other
 * row's hash and occurrence untouched. Recognizing a new earlier row with
 * *identical* content does shift the later twin's occurrence — which is
 * correct, because a real additional duplicate has been found.
 */

import { createHash } from "node:crypto";

/** The raw fields that define a transaction row's content. */
export interface IdentityInput {
  issuerName: string;
  tickerText: string;
  typeText: string;
  amountText: string;
  transactionDateText: string;
  ownerText: string;
}

/**
 * Canonical form of a row's content.
 *
 * Whitespace and case are normalized so cosmetic parser changes — an extra
 * space, different capitalization — do not alter identity. Nothing semantic is
 * discarded.
 */
export function canonicalRowText(input: IdentityInput): string {
  const norm = (v: string) =>
    String(v ?? "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
  return [
    norm(input.tickerText),
    norm(input.typeText),
    norm(input.amountText),
    norm(input.transactionDateText),
    norm(input.ownerText),
    norm(input.issuerName),
  ].join("|");
}

/** First 16 hex characters of the SHA-256 of the canonical row text. */
export function contentHash(input: IdentityInput): string {
  return createHash("sha256")
    .update(canonicalRowText(input))
    .digest("hex")
    .slice(0, 16);
}

/**
 * The economic core of a transaction: what was done, for how much, when, and by
 * whose account.
 *
 * Deliberately excludes issuer name and ticker text. Those are the two fields a
 * parser improvement is most likely to change — correcting a truncated name, or
 * reading BRK.B where it previously read CARR — and if identity moved with them,
 * a correction would arrive as a brand new record rather than a revision of the
 * existing one.
 *
 * What remains is stable across parser changes but still distinguishes two
 * different transactions filed on the same day.
 */
export function stableCoreText(input: IdentityInput): string {
  const norm = (v: string) =>
    String(v ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  return [
    norm(input.typeText),
    norm(input.amountText),
    norm(input.transactionDateText),
    norm(input.ownerText),
  ].join("|");
}

/** Hash of the economic core, used to reconcile a corrected row to its original. */
export function stableCoreHash(input: IdentityInput): string {
  return createHash("sha256")
    .update(stableCoreText(input))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Assign stable ids to every row parsed from one filing.
 *
 * Occurrence is scoped to identical content within the same document, counted
 * in document order, so a duplicated transaction gets `::0` and `::1`.
 */
export function assignRowIds(
  docId: string,
  rows: IdentityInput[]
): Array<{
  id: string;
  contentHash: string;
  occurrence: number;
  reconciliationKey: string;
}> {
  const seenContent = new Map<string, number>();
  const seenCore = new Map<string, number>();

  return rows.map((row) => {
    const hash = contentHash(row);
    const occurrence = seenContent.get(hash) ?? 0;
    seenContent.set(hash, occurrence + 1);

    // The reconciliation key is counted independently, so a corrected row keeps
    // the same key even though its content hash moved.
    const core = stableCoreHash(row);
    const coreOccurrence = seenCore.get(core) ?? 0;
    seenCore.set(core, coreOccurrence + 1);

    return {
      id: `${docId}::${hash}::${occurrence}`,
      contentHash: hash,
      occurrence,
      reconciliationKey: `${docId}::${core}::${coreOccurrence}`,
    };
  });
}

/** Extract the document id from a content-addressed record id. */
export function docIdFromRecordId(id: string): string {
  const value = String(id ?? "");
  const cut = value.indexOf("::");
  if (cut > 0) return value.slice(0, cut);
  // Legacy `{docId}#{n}` and `{docId}-{n}` forms, for reconciliation only.
  const hash = value.indexOf("#");
  if (hash > 0) return value.slice(0, hash);
  const dash = value.lastIndexOf("-");
  return dash > 0 ? value.slice(0, dash) : value;
}
