/**
 * The documented sources, each behind a small function that returns data the
 * importer can judge. Judgement itself — accept, review, refuse — lives in the
 * importer, so every rule is in one place.
 *
 * Sources and their terms were established in docs/homepage-image-sources.md
 * and the image-sourcing memo; nothing here adds a source.
 */

import { fetchAllowed, fetchJson } from "./net.ts";

// --- SEC ---------------------------------------------------------------------

export interface SecIssuer { cik: string; title: string; tickers: string[] }

export async function secCompanyTickers(): Promise<Map<string, SecIssuer>> {
  const raw = await fetchJson<Record<string, { cik_str: number; ticker: string; title: string }>>("https://www.sec.gov/files/company_tickers.json");
  const byCik = new Map<string, SecIssuer>();
  for (const row of Object.values(raw)) {
    const cik = String(row.cik_str).padStart(10, "0");
    const issuer = byCik.get(cik) ?? { cik, title: row.title, tickers: [] };
    issuer.tickers.push(row.ticker);
    byCik.set(cik, issuer);
  }
  return byCik;
}

export interface SecFormerNames { cik: string; name: string; formerNames: Array<{ name: string; from?: string; to?: string }>; fetchedAt: string }

/** EDGAR's submissions record: the current registrant name and every former name. Authoritative rename evidence. */
export async function secSubmissions(cik: string): Promise<SecFormerNames> {
  const padded = cik.padStart(10, "0");
  const data = await fetchJson<{ name: string; formerNames?: Array<{ name: string; from?: string; to?: string }> }>(`https://data.sec.gov/submissions/CIK${padded}.json`, { maxBytes: 8 * 1024 * 1024 });
  return { cik: padded, name: data.name, formerNames: data.formerNames ?? [], fetchedAt: new Date().toISOString() };
}

export interface SecFundClass { symbol: string; cik: string; seriesId: string; classId: string }

export async function secFundClasses(): Promise<Map<string, SecFundClass>> {
  const raw = await fetchJson<{ fields: string[]; data: Array<Array<string | number>> }>("https://www.sec.gov/files/company_tickers_mf.json");
  const idx = Object.fromEntries(raw.fields.map((f, i) => [f, i]));
  const out = new Map<string, SecFundClass>();
  for (const row of raw.data) {
    const symbol = String(row[idx.symbol]);
    out.set(symbol, { symbol, cik: String(row[idx.cik]).padStart(10, "0"), seriesId: String(row[idx.seriesId]), classId: String(row[idx.classId]) });
  }
  return out;
}

// --- Wikidata ----------------------------------------------------------------

export interface WikidataCompany { qid: string; label: string; ciks: string[]; logos: string[]; simpleIcons: string[];
  /** Ticker qualifiers on NYSE or Nasdaq listings only; other exchanges' codes are not US symbols. */
  tickers: string[]; exchangesSeen: string[] }

/** NYSE and Nasdaq. A listing anywhere else carries a code that is not a US symbol. */
export const US_EXCHANGES = new Set(["Q13677", "Q82059"]);

/** S&P 500 membership as Wikidata records it (P361 = Q242345), with CIK, logo and Simple Icons links. */
export async function wikidataSp500(): Promise<WikidataCompany[]> {
  const query = `SELECT ?item ?itemLabel ?cik ?logo ?si ?ticker ?exchange WHERE {
    ?item wdt:P361 wd:Q242345 .
    OPTIONAL { ?item wdt:P5531 ?cik }
    OPTIONAL { ?item wdt:P154 ?logo }
    OPTIONAL { ?item wdt:P8972 ?si }
    OPTIONAL { ?item p:P414 ?listing . ?listing ps:P414 ?exchange . ?listing pq:P249 ?ticker }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
  }`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const data = await fetchJson<{ results: { bindings: Array<Record<string, { value: string }>> } }>(url, { accept: "application/sparql-results+json", timeoutMs: 60_000 });
  const items = new Map<string, WikidataCompany>();
  for (const b of data.results.bindings) {
    const qid = b.item.value.split("/").pop() as string;
    const item = items.get(qid) ?? { qid, label: b.itemLabel?.value ?? qid, ciks: [], logos: [], simpleIcons: [], tickers: [], exchangesSeen: [] };
    const push = (arr: string[], v?: string) => { if (v && !arr.includes(v)) arr.push(v); };
    push(item.ciks, b.cik?.value ? b.cik.value.padStart(10, "0") : undefined);
    push(item.logos, b.logo?.value ? decodeURIComponent(b.logo.value.split("/Special:FilePath/").pop() as string) : undefined);
    push(item.simpleIcons, b.si?.value);
    const exchange = b.exchange?.value ? b.exchange.value.split("/").pop() as string : undefined;
    if (exchange) push(item.exchangesSeen, exchange);
    if (b.ticker?.value && exchange && US_EXCHANGES.has(exchange)) push(item.tickers, b.ticker.value.toUpperCase().trim());
    items.set(qid, item);
  }
  return [...items.values()].sort((a, b) => a.label.localeCompare(b.label));
}

// --- Wikimedia Commons -------------------------------------------------------

export interface CommonsFileInfo {
  title: string;
  missing: boolean;
  url?: string;
  descriptionUrl?: string;
  mime?: string;
  size?: number;
  licenseShortName?: string;
  licenseTemplate?: string;
  copyrighted?: string;
  restrictions?: string;
  attributionRequired?: string;
  credit?: string;
  artist?: string;
}

const metaField = (m: Record<string, { value: string }> | undefined, k: string) => m?.[k]?.value;

/** Batched imageinfo lookups; Commons allows 50 titles per request. */
export async function commonsFileInfo(fileNames: string[]): Promise<Map<string, CommonsFileInfo>> {
  const out = new Map<string, CommonsFileInfo>();
  for (let i = 0; i < fileNames.length; i += 50) {
    const batch = fileNames.slice(i, i + 50);
    const params = new URLSearchParams({
      action: "query", format: "json", prop: "imageinfo", iiprop: "url|extmetadata|mime|size",
      titles: batch.map((f) => `File:${f}`).join("|"),
    });
    const data = await fetchJson<{ query: { normalized?: Array<{ from: string; to: string }>; pages: Record<string, { title: string; missing?: string; imageinfo?: Array<{ url: string; descriptionurl: string; mime: string; size: number; extmetadata: Record<string, { value: string }> }> }> } }>(`https://commons.wikimedia.org/w/api.php?${params}`);
    const normalized = new Map((data.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of Object.values(data.query.pages)) {
      const requested = (normalized.get(page.title) ?? page.title).replace(/^File:/, "");
      const info = page.imageinfo?.[0];
      const m = info?.extmetadata;
      out.set(requested, {
        title: page.title, missing: page.missing !== undefined || !info,
        url: info?.url, descriptionUrl: info?.descriptionurl, mime: info?.mime, size: info?.size,
        licenseShortName: metaField(m, "LicenseShortName"), licenseTemplate: metaField(m, "License"),
        copyrighted: metaField(m, "Copyrighted"), restrictions: metaField(m, "Restrictions"),
        attributionRequired: metaField(m, "AttributionRequired"), credit: metaField(m, "Credit"), artist: metaField(m, "Artist"),
      });
    }
  }
  return out;
}

export async function downloadCommonsFile(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const clean = new URL(url); clean.search = "";
  return fetchAllowed(clean.href);
}

// --- Simple Icons ------------------------------------------------------------

export interface SimpleIconRecord { title: string; slug: string; license?: { type: string; url?: string } }

/** The project's slug rule, so a title can be matched against a Wikidata P8972 value. */
export function simpleIconsSlug(title: string): string {
  return title.toLowerCase()
    .replace(/\+/g, "plus").replace(/\./g, "dot").replace(/&/g, "and").replace(/đ/g, "d").replace(/ħ/g, "h").replace(/ı/g, "i").replace(/ĸ/g, "k").replace(/ŀ/g, "l").replace(/ł/g, "l").replace(/ß/g, "ss").replace(/ŧ/g, "t")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

export async function simpleIconsIndex(): Promise<Map<string, SimpleIconRecord>> {
  const raw = await fetchJson<{ icons?: Array<{ title: string; slug?: string; license?: { type: string; url?: string } }> } | Array<{ title: string; slug?: string; license?: { type: string; url?: string } }>>(
    "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/data/simple-icons.json"
  );
  const list = Array.isArray(raw) ? raw : raw.icons ?? [];
  const out = new Map<string, SimpleIconRecord>();
  for (const icon of list) {
    const slug = icon.slug ?? simpleIconsSlug(icon.title);
    out.set(slug, { title: icon.title, slug, license: icon.license });
  }
  return out;
}

export async function downloadSimpleIcon(slug: string): Promise<{ bytes: Buffer; contentType: string }> {
  if (!/^[a-z0-9]+$/.test(slug)) throw new Error(`Bad Simple Icons slug: ${slug}`);
  return fetchAllowed(`https://cdn.simpleicons.org/${slug}`);
}

// --- unitedstates ------------------------------------------------------------

export interface Legislator {
  id: { bioguide: string; wikidata?: string };
  name: { first: string; middle?: string; last: string; official_full?: string; nickname?: string };
  terms: Array<{ type: "rep" | "sen"; state: string; district?: number; party: string; start: string; end: string }>;
}

export async function legislatorsCurrent(): Promise<Legislator[]> {
  return fetchJson<Legislator[]>("https://unitedstates.github.io/congress-legislators/legislators-current.json", { maxBytes: 8 * 1024 * 1024 });
}

export function portraitUrl(bioguide: string): string {
  if (!/^[A-Z]\d{6}$/.test(bioguide)) throw new Error(`Bad Bioguide id: ${bioguide}`);
  return `https://unitedstates.github.io/images/congress/225x275/${bioguide}.jpg`;
}
