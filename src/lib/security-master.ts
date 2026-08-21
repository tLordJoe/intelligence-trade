/**
 * Ticker validation against the SEC's own security master.
 *
 * A regex cannot do this job. `/^[A-Z]{1,5}$/` rejects 542 legitimate
 * SEC-registered symbols — preferred shares (ABR-PD), warrants (ACHR-WT),
 * units (AAC-UN) and share classes including BRK-B. It also happily accepts
 * anything shaped like a ticker whether or not the security exists.
 *
 * The master is the authority on both questions: does this symbol exist, and
 * which issuer does it belong to. That second answer is what catches a record
 * naming Berkshire Hathaway while tagged CARR.
 *
 * Source: https://www.sec.gov/files/company_tickers.json (free, no API key).
 */

import type { TickerResolution } from "./congress-schema.ts";

export interface SecurityMasterEntry {
  ticker: string;
  cik: string;
  title: string;
}

export interface SecurityMaster {
  updatedAt: string;
  /** Keyed by normalized ticker. */
  entries: Record<string, SecurityMasterEntry>;
}

export interface TickerLookup {
  resolution: TickerResolution;
  /** Canonical SEC symbol when resolved, otherwise the cleaned input. */
  ticker: string;
  cik?: string;
  /** Issuer name as registered with the SEC. */
  title?: string;
}

/**
 * Uppercase, trim, and strip characters that never appear in a symbol.
 * Punctuation is preserved here because it is meaningful (BRK-B, ABR-PD).
 */
export function cleanTickerText(raw: string): string {
  return String(raw ?? "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9.\-]/g, "");
}

/**
 * Candidate spellings for a symbol, in preference order.
 *
 * Filings write share classes with a dot (BRK.B); the SEC master uses a hyphen
 * (BRK-B). Both spellings refer to the same security, so we try each.
 */
export function tickerAliases(cleaned: string): string[] {
  const out = [cleaned];
  if (cleaned.includes(".")) out.push(cleaned.replace(/\./g, "-"));
  if (cleaned.includes("-")) out.push(cleaned.replace(/-/g, "."));
  // Some filings append the class with no separator, e.g. BRKB.
  if (/^[A-Z]+[.\-][A-Z]$/.test(cleaned)) out.push(cleaned.replace(/[.\-]/g, ""));
  return [...new Set(out)];
}

/**
 * Resolve a ticker as written in a filing against the master.
 *
 * Returns `unknown` rather than throwing — the caller decides whether an
 * unresolved symbol is quarantined or merely flagged. Unknown symbols are never
 * silently discarded.
 */
export function resolveTicker(
  rawTicker: string,
  master: SecurityMaster
): TickerLookup {
  const cleaned = cleanTickerText(rawTicker);
  if (!cleaned) return { resolution: "unknown", ticker: cleaned };

  const candidates = tickerAliases(cleaned);
  for (let i = 0; i < candidates.length; i++) {
    const hit = master.entries[candidates[i]];
    if (hit) {
      return {
        // The first candidate is the symbol exactly as filed; anything after
        // it matched only because we rewrote the punctuation.
        resolution: i === 0 ? "verified" : "aliased",
        ticker: hit.ticker,
        cik: hit.cik,
        title: hit.title,
      };
    }
  }
  return { resolution: "unknown", ticker: cleaned };
}

/** Normalize an issuer name for comparison: drop case, punctuation and suffixes. */
export function normalizeIssuerName(value: string): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(
      /\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PLC|LLC|LP|HOLDINGS|HOLDING|GROUP|THE|NEW|COMMON|STOCK|CLASS|SHARES|DEPOSITARY)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Does the issuer name in the filing plausibly belong to the resolved ticker?
 *
 * This is the check that catches the real defect from the August incident: a
 * record whose name read "Berkshire Hathaway Inc. New Common Stock (BRK.B)"
 * while its ticker field said CARR. Two different issuers, two different CIKs.
 *
 * Deliberately permissive — filings abbreviate aggressively, so we only report
 * a mismatch when the filed name contains a *different* known symbol, or when
 * neither name shares any significant token with the other.
 */
export function issuerNameMatchesTicker(
  issuerName: string,
  lookup: TickerLookup,
  master: SecurityMaster
): { matches: boolean; conflictingTicker?: string } {
  if (!lookup.title) return { matches: true };

  // A parenthesised symbol inside the name that resolves to a different issuer
  // is the strongest possible signal that the ticker field is wrong.
  const parenthesised = issuerName.match(/\(([A-Z][A-Z0-9.\-]{0,6})\)/g) ?? [];
  for (const token of parenthesised) {
    const symbol = token.slice(1, -1);
    const candidate = resolveTicker(symbol, master);
    if (
      candidate.resolution !== "unknown" &&
      candidate.cik &&
      lookup.cik &&
      candidate.cik !== lookup.cik
    ) {
      return { matches: false, conflictingTicker: candidate.ticker };
    }
  }

  const filed = normalizeIssuerName(issuerName);
  const registered = normalizeIssuerName(lookup.title);
  if (!filed || !registered) return { matches: true };

  // Compare with spaces removed as well as tokenized. Registrants and filers
  // disagree constantly about word breaks — "ExxonMobil" against "Exxon Mobil",
  // "SIRIUSXM" against "SIRIUS XM" — and those are the same issuer.
  const filedFlat = filed.replace(/\s/g, "");
  const registeredFlat = registered.replace(/\s/g, "");
  if (
    filedFlat.includes(registeredFlat) ||
    registeredFlat.includes(filedFlat)
  ) {
    return { matches: true };
  }

  const filedTokens = new Set(filed.split(" ").filter((t) => t.length > 2));
  const registeredTokens = registered.split(" ").filter((t) => t.length > 2);
  if (!filedTokens.size || !registeredTokens.length) return { matches: true };

  const overlap = registeredTokens.some((token) => filedTokens.has(token));
  return { matches: overlap };
}

/** Build the in-memory master from the SEC's raw JSON payload. */
export function buildSecurityMaster(
  payload: Record<string, { ticker?: string; cik_str?: number | string; title?: string }>,
  updatedAt: string
): SecurityMaster {
  const entries: Record<string, SecurityMasterEntry> = {};
  for (const value of Object.values(payload)) {
    const ticker = cleanTickerText(value?.ticker ?? "");
    if (!ticker) continue;
    entries[ticker] = {
      ticker,
      cik: String(value?.cik_str ?? "").padStart(10, "0"),
      title: String(value?.title ?? ""),
    };
  }
  return { updatedAt, entries };
}
