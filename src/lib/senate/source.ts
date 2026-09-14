/** Official eFD transport. Session cookies stay in memory and never enter artifacts. */
import { createHash } from "node:crypto";
export const SENATE_ORIGIN = "https://efdsearch.senate.gov";
/** Exact visible notice reviewed when the owner authorized access on 2026-09-14. */
export const SENATE_NOTICE_SHA256 = "d2c1e392d1a2341298378d3cc246ffd43236230fbb6ad8dc2cbaeeaeb5f4d000";

export function officialSenateUrl(value: string): string {
  const url = new URL(value, SENATE_ORIGIN);
  if (url.origin !== SENATE_ORIGIN || url.username || url.password || url.hash ||
      !url.pathname.startsWith("/search/")) throw new Error("Non-official Senate source URL");
  return url.href;
}

export function isoDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  const result = match ? `${match[3]}-${match[1]}-${match[2]}` : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error("Invalid Senate date");
  const date = new Date(`${result}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== result) throw new Error("Invalid Senate date");
  return result;
}

export function htmlText(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity: string) => {
      if (entity.startsWith("#")) {
        const n = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
      }
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[entity.toLowerCase()];
    }).replace(/\s+/g, " ").trim();
}

export interface SenateReportReference {
  id: string; url: string; firstName: string; lastName: string; office: string;
  reportTitle: string; receivedDate: string; format: "electronic" | "paper" | "unsupported";
}

export function paperScanUrls(html: string): string[] {
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].filter(m => /class=["'][^"']*\bfilingImage\b/.test(m[0]));
  const urls = images.map(m => {
    const src = /src=["']([^"']+)["']/.exec(m[0])?.[1];
    if (!src) throw new Error("Senate scan lacks its source URL");
    const url = new URL(src);
    if (url.origin !== "https://efd-media-public.senate.gov" || url.username || url.password || url.search || url.hash ||
        !/^\/media\/[0-9/]+\.(gif|png|jpg)$/i.test(url.pathname)) throw new Error("Unrecognized Senate scan source");
    return url.href;
  });
  const pageTotals = [...htmlText(html).matchAll(/Page\s+\d+\s+of\s+(\d+)/g)].map(m => Number(m[1]));
  if (!urls.length || urls.length > 250 || new Set(urls).size !== urls.length || !pageTotals.length || pageTotals.some(n => n !== urls.length)) {
    throw new Error("Senate scanned-page count is missing or inconsistent");
  }
  return urls;
}

export async function fetchSenateScan(url: string): Promise<Buffer> {
  // This public media host receives no session cookies from the search host.
  paperScanUrls(`<img class="filingImage" src="${url}">Page 1 of 1`);
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30_000),
    headers: { "User-Agent": "Outfox Markets research (contact: hello@outfoxmarkets.com)" } });
  if (!response.ok) throw new Error(`Senate scan request failed (${response.status})`);
  const reader = response.body?.getReader(); if (!reader) throw new Error("Empty Senate scan");
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > 20_000_000) { await reader.cancel(); throw new Error("Senate scan exceeds size limit"); }
    chunks.push(part.value);
  }
  const data = Buffer.concat(chunks);
  const gif = /^GIF8[79]a$/.test(data.subarray(0, 6).toString("ascii"));
  const png = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = data[0] === 255 && data[1] === 216 && data[2] === 255;
  if (!gif && !png && !jpeg) throw new Error("Senate scan is not a recognized image");
  return data;
}

export function parseSearchPage(payload: unknown): { total: number; reports: SenateReportReference[] } {
  const page = payload as { recordsFiltered?: unknown; data?: unknown };
  if (!Number.isSafeInteger(page?.recordsFiltered) || Number(page.recordsFiltered) < 0 || !Array.isArray(page?.data)) {
    throw new Error("Unexpected Senate search response");
  }
  const reports = page.data.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== 5 || row.some(cell => typeof cell !== "string")) throw new Error("Unexpected Senate index row");
    const links = [...row[3].matchAll(/href\s*=\s*["']([^"']+)["']/gi)];
    if (links.length !== 1) throw new Error("Missing or ambiguous Senate report link");
    const url = officialSenateUrl(links[0][1]);
    const match = /^\/search\/view\/([^/]+)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/$/i.exec(new URL(url).pathname);
    if (!match) throw new Error("Unknown Senate report identity");
    const [firstName, lastName, office, reportTitle] = row.slice(0, 4).map(htmlText);
    if (!firstName || !lastName || !(office === "Senator" || /\(Senator\)/.test(office)) || !/Periodic Transaction Report/i.test(reportTitle)) {
      throw new Error("Search returned a report outside the requested Senator PTR scope");
    }
    return { id: match[2].toLowerCase(), url, firstName, lastName, office, reportTitle,
      receivedDate: isoDate(htmlText(row[4])), format: match[1] === "ptr" ? "electronic" as const : match[1] === "paper" ? "paper" as const : "unsupported" as const };
  });
  return { total: Number(page.recordsFiltered), reports };
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class SenateSession {
  private cookies = new Map<string, string>();
  private lastRequest = 0;
  private accessAccepted = false;
  private fetcher: Fetcher;
  private delayMs: number;
  constructor(fetcher: Fetcher = fetch, delayMs = 1100) { this.fetcher = fetcher; this.delayMs = delayMs; }

  private async request(path: string, form?: URLSearchParams): Promise<string> {
    const url = officialSenateUrl(path);
    const pause = Math.max(0, this.lastRequest + this.delayMs - Date.now());
    if (pause) await new Promise(resolve => setTimeout(resolve, pause));
    this.lastRequest = Date.now();
    const response = await this.fetcher(url, {
      method: form ? "POST" : "GET", redirect: "manual", signal: AbortSignal.timeout(30_000),
      headers: { "User-Agent": "Outfox Markets research (contact: hello@outfoxmarkets.com)",
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "), Referer: `${SENATE_ORIGIN}/search/`,
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded", "X-CSRFToken": this.cookies.get("csrftoken") ?? "" } : {}) },
      body: form?.toString(),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";"); const at = pair.indexOf("=");
      if (at > 0) this.cookies.set(pair.slice(0, at).trim(), pair.slice(at + 1));
    }
    if (response.status >= 300 && response.status < 400) {
      // Surface redirects to the caller; do not forward session cookies to another origin.
      const location = response.headers.get("location");
      if (!location) throw new Error("Senate redirect lacks a destination");
      throw new Error(`Senate redirected to ${officialSenateUrl(location)}`);
    }
    if (!response.ok) throw new Error(`Senate request failed (${response.status}); run stopped, not treated as empty`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty Senate response");
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 8_000_000) { await reader.cancel(); throw new Error("Senate response exceeds size limit"); }
      chunks.push(part.value);
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  async acceptAccess(acknowledged: boolean): Promise<void> {
    if (!acknowledged) throw new Error("Explicit Senate source-use acknowledgment required before access");
    const home = await this.request("/search/home/");
    const text = htmlText(home);
    const start = text.indexOf("Title 1 of the Ethics in Government Act");
    const end = text.indexOf("I understand the prohibitions", start);
    const notice = start >= 0 && end > start ? text.slice(start, end).trim() : "";
    if (createHash("sha256").update(notice).digest("hex") !== SENATE_NOTICE_SHA256) {
      throw new Error("Senate access agreement changed; review required");
    }
    const csrf = /name=["']csrfmiddlewaretoken["'][^>]*value=["']([^"']+)["']/.exec(home)?.[1];
    if (!csrf || !/prohibition_agreement/.test(home)) throw new Error("Senate access agreement changed; review required");
    try {
      await this.request("/search/home/", new URLSearchParams({ csrfmiddlewaretoken: csrf, prohibition_agreement: "1" }));
    } catch (error) {
      if (!(error instanceof Error) || error.message !== `Senate redirected to ${SENATE_ORIGIN}/search/`) throw error;
    }
    const search = await this.request("/search/");
    if (!/id=["']searchForm["']/.test(search) || /name=["']prohibition_agreement["']/.test(search)) throw new Error("Senate access was not established");
    this.accessAccepted = true;
  }

  async searchPage(from: string, to: string, start: number, capture?: (raw: string) => void): Promise<{ raw: string; total: number; reports: SenateReportReference[] }> {
    if (!this.accessAccepted) throw new Error("Senate session not authorized");
    const a = isoDate(from), b = isoDate(to);
    if (a > b || !Number.isSafeInteger(start) || start < 0) throw new Error("Invalid Senate search window");
    const us = (d: string) => `${d.slice(5, 7)}/${d.slice(8)}/${d.slice(0, 4)}`;
    const form = new URLSearchParams({ draw: String(start / 100 + 1), start: String(start), length: "100",
      report_types: "[11]", filer_types: "[1]", submitted_start_date: `${us(a)} 00:00:00`,
      submitted_end_date: `${us(b)} 23:59:59`, first_name: "", last_name: "", senator_state: "", candidate_state: "", office_id: "",
      "search[value]": "", "search[regex]": "false", "order[0][column]": "1", "order[0][dir]": "asc",
      "order[1][column]": "0", "order[1][dir]": "asc" });
    for (let i = 0; i < 5; i++) {
      form.set(`columns[${i}][data]`, String(i)); form.set(`columns[${i}][name]`, "");
      form.set(`columns[${i}][searchable]`, "true"); form.set(`columns[${i}][orderable]`, "true");
      form.set(`columns[${i}][search][value]`, ""); form.set(`columns[${i}][search][regex]`, "false");
    }
    const raw = await this.request("/search/report/data/", form);
    capture?.(raw);
    const parsed = parseSearchPage(JSON.parse(raw));
    if (parsed.reports.some(r => r.receivedDate < a || r.receivedDate > b)) throw new Error("Senate returned reports outside the requested filing window");
    return { raw, ...parsed };
  }

  async report(reference: SenateReportReference): Promise<string> {
    if (!this.accessAccepted) throw new Error("Senate session not authorized");
    if (reference.format === "unsupported") throw new Error("Unknown report format needs separate extraction review");
    return this.request(reference.url);
  }
}
