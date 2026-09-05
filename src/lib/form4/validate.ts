/**
 * Runtime validation for values taken from a filing.
 *
 * TypeScript describes what we expect; this file checks what actually arrived.
 * Every function returns the parsed value *and* the raw text, so a corrected
 * reading can always be compared against what the document said.
 *
 * The recurring rule: a missing value and a zero are different facts. A gift
 * reports a price of exactly zero and means it; a transaction whose price sits
 * in a footnote reports no price at all. Collapsing either into the other is
 * how a $0 sale appears in a total.
 */

import type { AbsenceReason, DecimalString, Nullable } from "./types.ts";

function absent(raw: string | null, reason: AbsenceReason, footnoteIds: string[]): Nullable<never> {
  return { value: null, raw, reason, footnoteIds } as Nullable<never>;
}

/**
 * A calendar date, validated by exact round-trip.
 *
 * `new Date("2026-02-31")` rolls forward to March 3 rather than failing, so a
 * round-trip comparison is the only reliable check. Ownership documents may
 * append a time component; the date portion is what is validated.
 */
export function parseDate(
  raw: string | null,
  footnoteIds: string[] = []
): Nullable<string> {
  if (raw === null) {
    return absent(null, footnoteIds.length ? "footnote_instead_of_value" : "not_present_in_source", footnoteIds);
  }
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (!match) return absent(raw, "unparseable", footnoteIds);

  const [, y, m, d] = match;
  const iso = `${y}-${m}-${d}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return absent(raw, "unparseable", footnoteIds);
  if (parsed.toISOString().slice(0, 10) !== iso) {
    // 2026-02-31 and friends.
    return absent(raw, "unparseable", footnoteIds);
  }
  return { value: iso, raw, reason: null, footnoteIds };
}

/** Grammar for a decimal as ownership documents write them. */
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

/**
 * A decimal, kept as a normalized string.
 *
 * Never converted to a JavaScript number: 0.1 + 0.2 is not 0.3, and share
 * counts routinely exceed what a float represents exactly. Downstream
 * arithmetic is expected to use a decimal library or integer math.
 */
export function parseDecimal(
  raw: string | null,
  footnoteIds: string[] = []
): Nullable<DecimalString> {
  if (raw === null) {
    return absent(null, footnoteIds.length ? "footnote_instead_of_value" : "not_present_in_source", footnoteIds);
  }
  const trimmed = raw.trim().replace(/,/g, "");
  if (!DECIMAL_RE.test(trimmed)) return absent(raw, "unparseable", footnoteIds);

  // Normalize so "0", "0.00" and "0.0" compare equal as stored strings, while
  // preserving the distinction from absence.
  let normalized = trimmed;
  if (normalized.includes(".")) {
    normalized = normalized.replace(/0+$/, "").replace(/\.$/, "");
  }
  if (normalized === "-0") normalized = "0";
  return { value: normalized, raw, reason: null, footnoteIds };
}

/** Plain text, preserved as written. */
export function parseText(
  raw: string | null,
  footnoteIds: string[] = []
): Nullable<string> {
  if (raw === null) {
    return absent(null, footnoteIds.length ? "footnote_instead_of_value" : "not_present_in_source", footnoteIds);
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return absent(raw, footnoteIds.length ? "footnote_instead_of_value" : "not_present_in_source", footnoteIds);
  }
  return { value: trimmed, raw, reason: null, footnoteIds };
}

/**
 * A boolean flag.
 *
 * Ownership documents write these as `1`/`0`, and older ones as
 * `true`/`false`. An absent flag returns null: "the filing did not say" is not
 * "the filing said no".
 */
export function parseBoolean(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const value = raw.trim().toLowerCase();
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return null;
}

/** CIKs are compared as zero-padded ten-digit strings. */
export function normalizeCik(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.trim().replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(10, "0");
}

/** An accession as `0001234567-26-000012`. */
export function normalizeAccession(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.trim().replace(/\D/g, "");
  if (digits.length !== 18) return null;
  return `${digits.slice(0, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
}

/**
 * Whether every footnote reference on a row resolves to a declared footnote.
 *
 * An unresolved reference means we are showing a value whose explanation is
 * missing, which the contract treats as a blocking condition rather than a
 * cosmetic gap.
 */
export function unresolvedFootnoteIds(
  referenced: string[],
  declared: Record<string, string>
): string[] {
  return [...new Set(referenced)].filter((id) => !(id in declared));
}
