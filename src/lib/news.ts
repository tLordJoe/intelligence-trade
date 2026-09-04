/**
 * News normalization, attribution and timestamp handling.
 *
 * Split out of the route handler and the component so the rules can be
 * exercised against fixtures instead of a live provider.
 *
 * The attribution rule is the point of this module. Finnhub's `company-news`
 * endpoint returns a `related` field, and it is tempting to read that as the
 * provider's judgement about which company an article concerns. It is not.
 * Sampling the live endpoint on 2026-09-03 for NVDA, CRWD and ZS returned
 * 249/249, 141/141 and 12/12 items whose `related` was exactly the symbol that
 * had been queried, and never empty. `related` echoes the request; it carries
 * no independent signal.
 *
 * Two consequences shape everything below:
 *
 *  - The old component rendered `item.related || ticker`, which fabricated an
 *    association whenever the provider supplied none. Absent attribution is now
 *    absent, never backfilled from the query.
 *  - What we can honestly show is "the provider returned this under SYMBOL",
 *    which is a *query association*, not verified relevance. Nothing here
 *    establishes that an article is actually about a company, so nothing here
 *    may be labelled as verified.
 */

/** An article as the provider sends it, before validation. */
export interface RawNewsItem {
  id?: unknown;
  headline?: unknown;
  source?: unknown;
  datetime?: unknown;
  url?: unknown;
  related?: unknown;
  summary?: unknown;
}

/** An article that passed validation. */
export interface NewsItem {
  id: number;
  headline: string;
  source: string;
  /** Unix seconds as supplied. May be absent, future, or otherwise unusable. */
  datetime: number | null;
  url: string;
  /**
   * The symbol the provider returned this article under, when it matches what
   * we asked for. `null` means no association was supplied — never the
   * requested ticker as a stand-in.
   */
  tickerAssociation: string | null;
}

const HTTP_URL = /^https?:\/\//i;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Split a `related` field into symbols.
 *
 * `company-news` returns a single symbol, but sibling Finnhub endpoints return
 * a comma-separated list, so both are handled.
 */
export function parseRelatedSymbols(related: unknown): string[] {
  if (!isNonEmptyString(related)) return [];
  return related
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Whether the provider associated this article with the symbol we requested.
 *
 * This is the whole of the attribution rule. It is deliberately not a relevance
 * test: it reports what the provider said, and says nothing when the provider
 * said nothing.
 */
export function hasProviderAssociation(
  related: unknown,
  requestedTicker: string
): boolean {
  const wanted = requestedTicker.trim().toUpperCase();
  if (!wanted) return false;
  return parseRelatedSymbols(related).includes(wanted);
}

/**
 * Whether a raw item carries the fields required to render it safely.
 *
 * `datetime` is deliberately not required — an article with an unusable
 * timestamp is still a real article, and is rendered without an elapsed time
 * rather than dropped.
 */
export function isValidNewsItem(raw: unknown): raw is RawNewsItem {
  if (!raw || typeof raw !== "object") return false;
  const item = raw as RawNewsItem;
  if (!isNonEmptyString(item.headline)) return false;
  if (!isNonEmptyString(item.url) || !HTTP_URL.test(item.url.trim())) return false;
  if (typeof item.id !== "number" || !Number.isFinite(item.id)) return false;
  return true;
}

/**
 * Whether an upstream payload is shaped the way this code expects.
 *
 * Checked before anything is cached: a provider that starts returning an error
 * object, a string, or `null` must not populate the cache with it and serve it
 * for the rest of the TTL.
 */
export function isValidNewsPayload(payload: unknown): payload is RawNewsItem[] {
  if (!Array.isArray(payload)) return false;
  // An empty list is a valid answer — the company simply has no recent news.
  if (payload.length === 0) return true;
  // A payload of entirely unusable entries indicates a shape change upstream,
  // not a quiet week.
  return payload.some((entry) => isValidNewsItem(entry));
}

/** Coerce a provider timestamp to usable Unix seconds, or `null`. */
function normalizeTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

/**
 * Validate and normalize an upstream payload.
 *
 * Invalid entries are dropped rather than rendered half-formed. Attribution is
 * resolved here so the component never has to decide what to show.
 */
export function normalizeNewsItems(
  payload: unknown,
  requestedTicker: string
): NewsItem[] {
  if (!Array.isArray(payload)) return [];

  const items: NewsItem[] = [];
  for (const raw of payload) {
    if (!isValidNewsItem(raw)) continue;
    const item = raw as RawNewsItem;
    items.push({
      id: item.id as number,
      headline: (item.headline as string).trim(),
      source: isNonEmptyString(item.source) ? item.source.trim() : "Unknown source",
      datetime: normalizeTimestamp(item.datetime),
      url: (item.url as string).trim(),
      tickerAssociation: hasProviderAssociation(item.related, requestedTicker)
        ? requestedTicker.trim().toUpperCase()
        : null,
    });
  }
  return items;
}

/**
 * Validate items that have already been normalized by our own route.
 *
 * The client must not re-run `normalizeNewsItems` over the API response.
 * Attribution is resolved server-side into `tickerAssociation`, and `related`
 * is gone by then — re-normalizing looks for a field that no longer exists and
 * silently drops every association. The component still validates, because a
 * response can be truncated or malformed in transit, but it validates the
 * normalized contract rather than re-deriving it.
 */
export function parseApiNewsItems(payload: unknown): NewsItem[] {
  if (!Array.isArray(payload)) return [];

  const items: NewsItem[] = [];
  for (const raw of payload) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;

    if (typeof item.id !== "number" || !Number.isFinite(item.id)) continue;
    if (!isNonEmptyString(item.headline)) continue;
    if (!isNonEmptyString(item.url) || !HTTP_URL.test(item.url.trim())) continue;

    const association =
      isNonEmptyString(item.tickerAssociation) ? item.tickerAssociation.trim().toUpperCase() : null;

    items.push({
      id: item.id,
      headline: item.headline.trim(),
      source: isNonEmptyString(item.source) ? item.source.trim() : "Unknown source",
      datetime: normalizeTimestamp(item.datetime),
      url: item.url.trim(),
      tickerAssociation: association,
    });
  }
  return items;
}

/**
 * Tolerance for a timestamp that sits slightly ahead of our clock.
 *
 * Small skew between the provider's clock and the reader's is ordinary and
 * should read as "just now". Anything further ahead is not skew, and is
 * reported as unavailable rather than rendered as a date that has not happened.
 *
 * Set at fifteen minutes because the defect that prompted this — a headline
 * rendering as "-378s ago" — was six minutes of skew on a real client. A
 * tolerance tighter than the failure it exists to absorb would push that case
 * into "no timestamp at all", which is a worse answer than "just now" for an
 * article that genuinely was published moments ago. Unsynchronized client
 * clocks drift by minutes routinely; they do not drift by hours.
 */
export const FUTURE_SKEW_TOLERANCE_SECONDS = 15 * 60;

/**
 * Human elapsed time, or `null` when no honest one can be produced.
 *
 * The previous implementation was `Math.floor(Date.now() / 1000 - timestamp)`
 * with no guard, so a timestamp ahead of the client clock rendered as a
 * negative age — "-378s ago". Elapsed time is never negative here: it is either
 * a real duration, "just now", or nothing at all.
 */
export function formatElapsed(
  datetime: number | null | undefined,
  nowMs: number = Date.now()
): string | null {
  if (typeof datetime !== "number" || !Number.isFinite(datetime) || datetime <= 0) {
    return null;
  }

  const seconds = Math.floor(nowMs / 1000 - datetime);

  if (seconds < 0) {
    // Ahead of our clock. Benign skew reads as "just now"; anything beyond the
    // tolerance is treated as an unusable timestamp.
    return seconds >= -FUTURE_SKEW_TOLERANCE_SECONDS ? "just now" : null;
  }

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
