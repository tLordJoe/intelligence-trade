/**
 * Bounded, respectful fetching for the image library importer.
 *
 * Every request goes through `fetchAllowed`, which refuses any host not on
 * the list below. The importer therefore cannot be pointed at an arbitrary
 * URL by a catalog entry, a Wikidata value, or a Commons redirect: a source
 * that resolves to an unexpected host is a failure, not a download.
 */

import { setTimeout as sleep } from "node:timers/promises";

export const USER_AGENT = "OutfoxImageLibrary/1.0 (https://outfoxmarkets.com; hello@outfoxmarkets.com)";

/** Hosts the documented sources live on. Nothing else is reachable. */
export const ALLOWED_HOSTS = new Set([
  "query.wikidata.org",
  "www.wikidata.org",
  "commons.wikimedia.org",
  "upload.wikimedia.org",
  "cdn.simpleicons.org",
  "raw.githubusercontent.com",
  "unitedstates.github.io",
  "www.sec.gov",
  "data.sec.gov",
]);

export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

const lastRequestAt = new Map<string, number>();
/** Per-host spacing. Starts polite and doubles (to a ceiling) every time a host answers 429. */
const gapMs = new Map<string, number>();
const MIN_GAP_MS = 350;
const MAX_GAP_MS = 4000;

export interface FetchOptions {
  accept?: string;
  retries?: number;
  timeoutMs?: number;
  maxBytes?: number;
}

export class FetchRefused extends Error {}

export async function fetchAllowed(url: string, options: FetchOptions = {}): Promise<{ bytes: Buffer; contentType: string; finalUrl: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new FetchRefused(`Not https: ${url}`);
  if (!ALLOWED_HOSTS.has(parsed.hostname)) throw new FetchRefused(`Host not allowed: ${parsed.hostname}`);

  const retries = options.retries ?? 3;
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    // One request at a time per host, spaced out. These are volunteer and
    // public-sector services; the importer is a guest.
    const gap = (gapMs.get(parsed.hostname) ?? MIN_GAP_MS) - (Date.now() - (lastRequestAt.get(parsed.hostname) ?? 0));
    if (gap > 0) await sleep(gap);
    lastRequestAt.set(parsed.hostname, Date.now());

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: options.accept ?? "*/*" },
        redirect: "manual",
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`Redirect without location from ${url}`);
        const next = new URL(location, url);
        if (!ALLOWED_HOSTS.has(next.hostname)) throw new FetchRefused(`Redirect to disallowed host: ${next.hostname}`);
        url = next.href;
        continue;
      }
      if (response.status === 429 || response.status >= 500) {
        // Back off hard and stay slower for the rest of the run: a 429 means
        // the host has already asked once.
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        gapMs.set(parsed.hostname, Math.min(MAX_GAP_MS, (gapMs.get(parsed.hostname) ?? MIN_GAP_MS) * 2));
        const error = new Error(`HTTP ${response.status}`) as Error & { waitMs?: number };
        error.waitMs = Math.max(retryAfter * 1000, 5000 * 2 ** attempt);
        throw error;
      }
      if (!response.ok) {
        return Promise.reject(Object.assign(new Error(`HTTP ${response.status} for ${url}`), { status: response.status, permanent: true }));
      }
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > maxBytes) throw new FetchRefused(`Response too large (${declared} bytes): ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > maxBytes) throw new FetchRefused(`Response too large (${bytes.length} bytes): ${url}`);
      return { bytes, contentType: response.headers.get("content-type") ?? "", finalUrl: url };
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof FetchRefused || (error as { permanent?: boolean }).permanent) throw error;
      lastError = error;
      attempt += 1;
      if (attempt <= retries) await sleep((error as { waitMs?: number }).waitMs ?? 800 * 2 ** (attempt - 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { bytes } = await fetchAllowed(url, { accept: "application/json", ...options });
  return JSON.parse(bytes.toString("utf8")) as T;
}
