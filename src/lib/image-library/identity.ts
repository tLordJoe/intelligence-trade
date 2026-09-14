/**
 * Identity keys and alias normalisation.
 *
 * Kept free of the catalog so both the importer and the runtime lookup build
 * keys the same way; a key computed two different ways is a miss nobody can
 * explain.
 */

export function cikIdentity(cik: string | number): string {
  const digits = String(cik).replace(/\D/g, "");
  if (!digits || digits.length > 10) throw new Error(`Not a CIK: ${cik}`);
  return `sec:cik:${digits.padStart(10, "0")}`;
}

export function classIdentity(classId: string): string {
  if (!/^C\d{9}$/.test(classId)) throw new Error(`Not an SEC class id: ${classId}`);
  return `sec:class:${classId}`;
}

export function bioguideIdentity(id: string): string {
  if (!/^[A-Z]\d{6}$/.test(id)) throw new Error(`Not a Bioguide id: ${id}`);
  return `bioguide:${id}`;
}

export function sponsorIdentity(slug: string): string {
  const clean = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!clean) throw new Error(`Empty sponsor slug`);
  return `sponsor:${clean}`;
}

/** Uppercase, trimmed; dots and hyphens both kept because share classes use them. */
export function normalizeTicker(raw: string): string {
  return String(raw ?? "").toUpperCase().trim().replace(/[^A-Z0-9.\-]/g, "");
}

/** Spellings of one symbol that filings and the SEC master use interchangeably. */
export function tickerSpellings(ticker: string): string[] {
  const t = normalizeTicker(ticker);
  const out = new Set([t]);
  if (t.includes(".")) out.add(t.replace(/\./g, "-"));
  if (t.includes("-")) out.add(t.replace(/-/g, "."));
  return [...out].filter(Boolean);
}

/**
 * A person's name as a matchable token: lower case, no punctuation, courtesy
 * titles and generational suffixes removed, single spaces.
 *
 * This is the same shape the disclosure filer key uses for its name segment,
 * so an alias built from the legislators dataset lines up with a key built
 * from a filing without any fuzzy step.
 */
export function normalizePersonName(raw: string): string {
  return String(raw ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\b(?:mr|mrs|ms|hon|dr)\b\.?/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b(?:jr|sr|ii|iii|iv)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Variants of an official name that filings are known to use. All exact, none fuzzy. */
export function personNameVariants(parts: { first: string; middle?: string | null; last: string; official?: string | null; nickname?: string | null }): string[] {
  const out = new Set<string>();
  const add = (s: string | null | undefined) => { const n = normalizePersonName(s ?? ""); if (n) out.add(n); };
  add(parts.official);
  add(`${parts.first} ${parts.last}`);
  if (parts.middle) {
    add(`${parts.first} ${parts.middle} ${parts.last}`);
    add(`${parts.first} ${parts.middle[0]} ${parts.last}`);
  }
  if (parts.nickname) add(`${parts.nickname} ${parts.last}`);
  return [...out];
}

/** Seat-scoped key for a person alias. A name without a seat never matches. */
export function personAliasKey(chamber: string, state: string, district: string | null | undefined, normalizedName: string): string {
  return `${chamber}|${state}|${district ?? ""}|${normalizedName}`;
}
