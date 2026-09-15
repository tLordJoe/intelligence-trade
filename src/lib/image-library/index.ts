/**
 * The one lookup for company marks, ETF marks and portraits.
 *
 * Server-side only: this module imports the full catalog, provenance included,
 * and must never be pulled into a client component. Pages resolve here and
 * hand the resulting `src` to the client as a prop. A test guards the import
 * boundary.
 *
 * Every function returns an `ImageResolution`. A fallback is a value with a
 * reason, not an exception, so a missing or ambiguous image can never block a
 * page that has data to show. A resolution is served only from an entry whose
 * status is `resolved`; anything else — including a candidate awaiting review —
 * is a fallback.
 *
 * Identity rules the resolvers enforce:
 *   - A CIK, class id or Bioguide id is authoritative. When one is supplied and
 *     the ticker or name disagrees with it, the answer is `mismatch`, not the
 *     image of whichever side happens to have one.
 *   - A ticker alone resolves only when exactly one identity currently claims it.
 *   - A person's name resolves only together with chamber, state and district.
 */

import catalogJson from "./catalog.json" with { type: "json" };

import { bioguideIdentity, cikIdentity, classIdentity, isCompanyEntry, normalizePersonName, personAliasKey, tickerSpellings } from "./identity.ts";
import type { Catalog, CatalogEntry, ImageResolution } from "./types.ts";

const catalog = catalogJson as unknown as Catalog;

interface Index {
  byIdentity: Map<string, CatalogEntry>;
  byTicker: Map<string, Set<string>>;
  byRetiredTicker: Map<string, Set<string>>;
  byFilerKey: Map<string, Set<string>>;
  byPersonAlias: Map<string, Set<string>>;
}

let index: Index | null = null;

function add(map: Map<string, Set<string>>, key: string, identity: string) {
  const set = map.get(key) ?? new Set<string>();
  set.add(identity);
  map.set(key, set);
}

function build(): Index {
  const built: Index = {
    byIdentity: new Map(), byTicker: new Map(), byRetiredTicker: new Map(), byFilerKey: new Map(), byPersonAlias: new Map(),
  };
  for (const entry of catalog.entries) {
    built.byIdentity.set(entry.identity, entry);
    for (const alias of entry.aliases) {
      if (alias.type === "ticker") {
        const target = alias.status === "retired" ? built.byRetiredTicker : built.byTicker;
        for (const spelling of tickerSpellings(alias.value)) add(target, spelling, entry.identity);
      } else if (alias.type === "filer_key") {
        add(built.byFilerKey, alias.value, entry.identity);
      } else if (alias.type === "person_name" && alias.chamber && alias.state) {
        add(built.byPersonAlias, personAliasKey(alias.chamber, alias.state, alias.district ?? null, alias.value), entry.identity);
      }
    }
  }
  return built;
}

function getIndex(): Index {
  if (!index) index = build();
  return index;
}

/** Exposed for tests that need to swap the catalog; not for pages. */
export function __resetIndexForTests() { index = null; }

export function catalogSummary() {
  return { generatedAt: catalog.generatedAt, universes: catalog.universes, entries: catalog.entries.length };
}

export function getEntry(identity: string): CatalogEntry | undefined {
  return getIndex().byIdentity.get(identity);
}

function fallback(reason: Extract<ImageResolution, { status: "fallback" }>["reason"], label: string): ImageResolution {
  return { status: "fallback", reason, label };
}

function serve(entry: CatalogEntry, label: string): ImageResolution {
  if (entry.status !== "resolved" || !entry.asset) return fallback("not_resolved", label);
  return {
    status: "resolved", src: entry.asset.file.path, role: entry.asset.role,
    identity: entry.identity, label: entry.label, basis: entry.asset.rights.basis,
  };
}

/** Resolve a ticker alone to exactly one current identity, else a reason. */
function identityForTicker(ticker: string): { identity?: string; reason?: "missing" | "ambiguous" } {
  const idx = getIndex();
  for (const spelling of tickerSpellings(ticker)) {
    const current = idx.byTicker.get(spelling);
    if (current && current.size === 1) return { identity: [...current][0] };
    if (current && current.size > 1) return { reason: "ambiguous" };
  }
  // A retired symbol resolves only when nobody currently holds it and it
  // pointed at exactly one identity when it was live.
  for (const spelling of tickerSpellings(ticker)) {
    const retired = idx.byRetiredTicker.get(spelling);
    if (retired && retired.size === 1) return { identity: [...retired][0] };
    if (retired && retired.size > 1) return { reason: "ambiguous" };
  }
  return { reason: "missing" };
}

// --- companies ---------------------------------------------------------------

export function resolveCompanyMark(input: { ticker: string; cik?: string | null }): ImageResolution {
  const label = input.ticker.trim().toUpperCase();
  const idx = getIndex();

  if (input.cik != null) {
    if (!/^\d{1,10}$/.test(input.cik)) return fallback("unknown", label);
    const identity = cikIdentity(input.cik);
    const entry = idx.byIdentity.get(identity);
    if (!entry) return fallback("missing", label);
    // The CIK is authoritative, but a ticker that belongs to a *different*
    // identity means the caller's record is inconsistent; refuse rather than
    // show the CIK's mark next to somebody else's symbol.
    const byTicker = identityForTicker(label);
    if (byTicker.reason === "ambiguous") return fallback("ambiguous", label);
    if (byTicker.identity && byTicker.identity !== identity) return fallback("mismatch", label);
    return serveCompany(entry, label);
  }

  const found = identityForTicker(label);
  if (!found.identity) return fallback(found.reason ?? "missing", label);
  const entry = idx.byIdentity.get(found.identity);
  if (!entry) return fallback("missing", label);
  return serveCompany(entry, label);
}

function serveCompany(entry: CatalogEntry, label: string): ImageResolution {
  if (!isCompanyEntry(entry)) return fallback("missing", label);
  const result = serve(entry, label);
  return result.status === "resolved" ? { ...result, role: "company_mark" } : result;
}

// --- funds -------------------------------------------------------------------

export function resolveFundMark(input: { ticker: string; classId?: string | null }): ImageResolution {
  const label = input.ticker.trim().toUpperCase();
  const idx = getIndex();

  let entry: CatalogEntry | undefined;
  if (input.classId != null) {
    if (!/^C\d{9}$/.test(input.classId)) return fallback("unknown", label);
    entry = idx.byIdentity.get(classIdentity(input.classId));
    if (!entry) return fallback("missing", label);
    const byTicker = identityForTicker(label);
    if (byTicker.reason === "ambiguous") return fallback("ambiguous", label);
    if (byTicker.identity && byTicker.identity !== entry.identity) return fallback("mismatch", label);
  } else {
    const found = identityForTicker(label);
    if (!found.identity) return fallback(found.reason ?? "missing", label);
    entry = idx.byIdentity.get(found.identity);
  }
  if (!entry || entry.kind !== "fund") return fallback("missing", label);
  if (entry.status !== "resolved") return fallback("not_resolved", label);

  // A fund with its own logo serves it. Otherwise it borrows the sponsor's mark
  // — and says so, through `role: "sponsor_mark"`, so a page can caption it.
  if (entry.status === "resolved" && entry.asset) return serve(entry, label);
  if (entry.sponsorIdentity) {
    const sponsor = idx.byIdentity.get(entry.sponsorIdentity);
    if (sponsor?.status === "resolved" && sponsor.asset) {
      return {
        status: "resolved", src: sponsor.asset.file.path, role: "sponsor_mark",
        identity: entry.identity, label: `${sponsor.label} (sponsor)`, basis: sponsor.asset.rights.basis,
      };
    }
  }
  return fallback(entry.status === "resolved" ? "missing" : "not_resolved", label);
}

// --- people ------------------------------------------------------------------

export function resolvePortrait(input: {
  bioguide?: string | null;
  filerKey?: string | null;
  name?: string | null;
  chamber?: string | null;
  state?: string | null;
  district?: string | null;
}): ImageResolution {
  const idx = getIndex();
  const label = (input.name ?? input.filerKey ?? input.bioguide ?? "").trim();

  if (input.bioguide != null) {
    if (!/^[A-Z]\d{6}$/.test(input.bioguide)) return fallback("unknown", label);
    const entry = idx.byIdentity.get(bioguideIdentity(input.bioguide));
    if (!entry || entry.kind !== "person") return fallback("missing", label);
    if (input.filerKey) {
      const ids = idx.byFilerKey.get(input.filerKey);
      if (!ids?.has(entry.identity) || ids.size !== 1) return fallback("mismatch", label);
    }
    return personAgrees(entry, input) ? serve(entry, label) : fallback("mismatch", label);
  }

  const candidates = new Set<string>();
  if (input.filerKey) for (const id of idx.byFilerKey.get(input.filerKey) ?? []) candidates.add(id);
  if (input.name && input.chamber && input.state) {
    const key = personAliasKey(input.chamber, input.state, input.district ?? null, normalizePersonName(input.name));
    for (const id of idx.byPersonAlias.get(key) ?? []) candidates.add(id);
  }
  if (candidates.size === 0) return fallback("missing", label);
  if (candidates.size > 1) return fallback("ambiguous", label);
  const entry = idx.byIdentity.get([...candidates][0]);
  if (!entry || entry.kind !== "person") return fallback("missing", label);
  return personAgrees(entry, input) ? serve(entry, label) : fallback("mismatch", label);
}

function personAgrees(entry: CatalogEntry, input: {
  name?: string | null; chamber?: string | null; state?: string | null; district?: string | null;
}): boolean {
  if (input.name == null && input.chamber == null && input.state == null && input.district == null) return true;
  return entry.aliases.some(alias => alias.type === "person_name" &&
    (input.name == null || normalizePersonName(input.name) === normalizePersonName(alias.value)) &&
    (input.chamber == null || input.chamber === alias.chamber) &&
    (input.state == null || input.state === alias.state) &&
    (input.district == null || input.district === (alias.district ?? "")));
}

/** Convenience for pages that only want a path or null. */
export function srcOrNull(resolution: ImageResolution): string | null {
  return resolution.status === "resolved" ? resolution.src : null;
}
