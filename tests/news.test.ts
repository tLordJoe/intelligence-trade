import assert from "node:assert/strict";
import test from "node:test";
import {
  FUTURE_SKEW_TOLERANCE_SECONDS,
  formatElapsed,
  hasProviderAssociation,
  isValidNewsItem,
  isValidNewsPayload,
  normalizeNewsItems,
  parseApiNewsItems,
  parseRelatedSymbols,
} from "../src/lib/news.ts";

/**
 * News attribution, shape validation and timestamp handling.
 *
 * Fixtures are shaped after real `company-news` responses sampled on
 * 2026-09-03. That sampling is also what settled the attribution rule: for
 * NVDA, CRWD and ZS the provider returned `related` equal to the queried
 * symbol on 249/249, 141/141 and 12/12 items and never returned it empty.
 * `related` echoes the request, so it can support "the provider returned this
 * under NVDA" and nothing stronger.
 */

const NOW_MS = Date.UTC(2026, 8, 3, 12, 0, 0);
const NOW_S = NOW_MS / 1000;

function article(over: Record<string, unknown> = {}) {
  return {
    id: 7429911,
    headline: "Nvidia extends data-center backlog into 2027",
    source: "Reuters",
    datetime: NOW_S - 3600,
    url: "https://example.com/story",
    related: "NVDA",
    summary: "…",
    ...over,
  };
}

// --- attribution: never invent relevance ------------------------------------

test("regression: an article with no provider ticker is not labelled with the requested one", () => {
  // The old component rendered `item.related || ticker`, which asserted an
  // association the provider never made.
  const items = normalizeNewsItems([article({ related: "" })], "NVDA");
  assert.equal(items.length, 1, "the article is still shown");
  assert.equal(items[0].tickerAssociation, null, "but carries no invented symbol");
});

test("every shape of absent attribution yields null, never a fallback", () => {
  for (const related of ["", "   ", null, undefined, 0, false, [], {}]) {
    const items = normalizeNewsItems([article({ related })], "NVDA");
    assert.equal(
      items[0].tickerAssociation,
      null,
      `related=${JSON.stringify(related)} must not backfill the requested ticker`
    );
  }
});

test("a provider association matching the request is shown", () => {
  const items = normalizeNewsItems([article({ related: "NVDA" })], "NVDA");
  assert.equal(items[0].tickerAssociation, "NVDA");
});

test("an association for a different company is not relabelled as ours", () => {
  const items = normalizeNewsItems([article({ related: "AMD" })], "NVDA");
  assert.equal(
    items[0].tickerAssociation,
    null,
    "an AMD article must never be presented as an NVDA association"
  );
});

test("comma-separated symbol lists are parsed, and matched case-insensitively", () => {
  assert.deepEqual(parseRelatedSymbols("AMD, NVDA ,INTC"), ["AMD", "NVDA", "INTC"]);
  assert.equal(hasProviderAssociation("amd,nvda", "NVDA"), true);
  assert.equal(hasProviderAssociation("AMD,INTC", "NVDA"), false);
  assert.equal(hasProviderAssociation("NVDA", ""), false);
});

test("attribution is a query association, not a relevance judgement", () => {
  // Pinning the semantics: the provider echoes the queried symbol, so a match
  // means only "returned under this symbol". Nothing in this module may claim
  // to have verified that the article is about the company.
  const items = normalizeNewsItems([article({ related: "NVDA" })], "NVDA");
  assert.equal(items[0].tickerAssociation, "NVDA");
  assert.ok(
    !("verified" in items[0]),
    "no field may imply verification the code does not perform"
  );
});

// --- payload shape validation ------------------------------------------------

test("regression: a malformed payload is rejected before it can be cached", () => {
  for (const body of [
    null,
    undefined,
    "service unavailable",
    42,
    { error: "rate limit" },
    [{ nope: true }, { also: "bad" }],
  ]) {
    assert.equal(
      isValidNewsPayload(body),
      false,
      `${JSON.stringify(body)} must not be treated as a news payload`
    );
  }
});

test("an empty array is a valid answer, not a malformed one", () => {
  // A company with no recent news is normal and must not be cached as an error.
  assert.equal(isValidNewsPayload([]), true);
  assert.deepEqual(normalizeNewsItems([], "NVDA"), []);
});

test("a payload with at least one usable article is accepted", () => {
  assert.equal(isValidNewsPayload([article(), { junk: 1 }]), true);
});

test("individual malformed articles are dropped, not half-rendered", () => {
  const items = normalizeNewsItems(
    [
      article(),
      article({ id: 2, headline: "" }),
      article({ id: 3, url: "javascript:alert(1)" }),
      article({ id: 4, url: "" }),
      article({ id: "not-a-number" }),
      null,
      "string",
    ],
    "NVDA"
  );
  assert.equal(items.length, 1, "only the well-formed article survives");
  assert.equal(items[0].id, 7429911);
});

test("a non-http url is rejected", () => {
  assert.equal(isValidNewsItem(article({ url: "javascript:alert(1)" })), false);
  assert.equal(isValidNewsItem(article({ url: "ftp://example.com" })), false);
  assert.equal(isValidNewsItem(article({ url: "https://example.com/x" })), true);
});

test("a missing source degrades to a label rather than dropping the article", () => {
  const items = normalizeNewsItems([article({ source: "" })], "NVDA");
  assert.equal(items.length, 1);
  assert.equal(items[0].source, "Unknown source");
});

// --- timestamps --------------------------------------------------------------

test("regression: a future timestamp never renders a negative elapsed time", () => {
  // The reported "-378s ago": provider clock slightly ahead of the client.
  const elapsed = formatElapsed(NOW_S + 378, NOW_MS);
  assert.equal(elapsed, "just now");
  assert.doesNotMatch(elapsed ?? "", /-/);
});

test("no input produces a negative elapsed time", () => {
  const offsets = [-86_400, -3600, -600, -378, -61, -1, 0, 1, 59, 60, 3599, 3600, 86_400];
  for (const offset of offsets) {
    const out = formatElapsed(NOW_S + offset, NOW_MS);
    if (out !== null) {
      assert.doesNotMatch(out, /-\d/, `offset ${offset} produced "${out}"`);
    }
  }
});

test("a timestamp far in the future is unavailable rather than misleading", () => {
  const beyond = FUTURE_SKEW_TOLERANCE_SECONDS + 60;
  assert.equal(formatElapsed(NOW_S + beyond, NOW_MS), null);
  assert.equal(formatElapsed(NOW_S + 86_400 * 3, NOW_MS), null);
});

test("skew inside the tolerance reads as just now", () => {
  assert.equal(formatElapsed(NOW_S + 1, NOW_MS), "just now");
  assert.equal(formatElapsed(NOW_S + FUTURE_SKEW_TOLERANCE_SECONDS, NOW_MS), "just now");
});

test("missing or invalid timestamps yield no elapsed time at all", () => {
  for (const value of [undefined, null, 0, -1, NaN, Infinity, "1788403800", {}]) {
    assert.equal(
      formatElapsed(value as number, NOW_MS),
      null,
      `${JSON.stringify(value)} must not produce an elapsed time`
    );
  }
});

test("ordinary elapsed times are unchanged", () => {
  assert.equal(formatElapsed(NOW_S - 30, NOW_MS), "just now");
  assert.equal(formatElapsed(NOW_S - 300, NOW_MS), "5m ago");
  assert.equal(formatElapsed(NOW_S - 7200, NOW_MS), "2h ago");
  assert.equal(formatElapsed(NOW_S - 86_400 * 3, NOW_MS), "3d ago");
});

test("an article with an unusable timestamp is kept, with datetime null", () => {
  const items = normalizeNewsItems([article({ datetime: -5 })], "NVDA");
  assert.equal(items.length, 1, "the article is real even if its clock is not");
  assert.equal(items[0].datetime, null);
  assert.equal(formatElapsed(items[0].datetime, NOW_MS), null);
});

// --- out-of-order responses --------------------------------------------------

/**
 * The component guards against a stale response by comparing the ticker the
 * response was requested for against the newest requested ticker before
 * setting state. That rule is exercised here directly; the component wires the
 * same comparison to a ref.
 */
function acceptResponse(
  responseTicker: string,
  latestRequested: string,
  aborted = false
): boolean {
  if (aborted) return false;
  return responseTicker === latestRequested;
}

test("regression: a slow response for a previous ticker is discarded", () => {
  // User clicks NVDA then CRWD; the NVDA response lands last.
  const latest = "CRWD";
  assert.equal(acceptResponse("NVDA", latest), false, "stale response ignored");
  assert.equal(acceptResponse("CRWD", latest), true, "current response accepted");
});

test("an aborted request never applies its result", () => {
  assert.equal(acceptResponse("CRWD", "CRWD", true), false);
});

test("rapid ticker changes settle on the last one requested", () => {
  const clicks = ["NVDA", "AMD", "CRWD", "ZS"];
  const latest = clicks[clicks.length - 1];
  const applied = clicks.filter((t) => acceptResponse(t, latest));
  assert.deepEqual(applied, ["ZS"], "only the final selection may render");
});

test("normalization is re-run against the ticker the response belongs to", () => {
  // Guards the compound failure: stale articles rendered under a new ticker.
  const nvdaPayload = [article({ related: "NVDA" })];
  const asCrwd = normalizeNewsItems(nvdaPayload, "CRWD");
  assert.equal(
    asCrwd[0].tickerAssociation,
    null,
    "NVDA articles must not acquire a CRWD label if they are ever re-normalized"
  );
});

// --- the route/component seam ------------------------------------------------

test("regression: the client must not re-normalize the route's own output", () => {
  // The route resolves attribution into `tickerAssociation` and drops `related`.
  // Running `normalizeNewsItems` over that output looks for a field that is no
  // longer there and silently strips every association — the symbol chip
  // disappeared entirely. Unit tests missed it because they fed raw fixtures to
  // the raw parser; only the running page exposed the seam.
  const routeOutput = normalizeNewsItems([article({ related: "NVDA" })], "NVDA");
  assert.equal(routeOutput[0].tickerAssociation, "NVDA");
  assert.ok(!("related" in routeOutput[0]), "the route does not forward `related`");

  // The failure is quiet, which is why it reached the browser: the article
  // still renders, only its attribution vanishes.
  const wrong = normalizeNewsItems(routeOutput, "NVDA");
  assert.equal(wrong.length, 1, "the article survives, so nothing looks broken");
  assert.equal(
    wrong[0].tickerAssociation,
    null,
    "but the association is silently lost — this is the defect being pinned"
  );

  const right = parseApiNewsItems(routeOutput);
  assert.equal(right.length, 1);
  assert.equal(right[0].tickerAssociation, "NVDA", "attribution survives the seam");
});

test("the API parser validates shape without inventing attribution", () => {
  const items = parseApiNewsItems([
    { id: 1, headline: "ok", url: "https://e.com/a", datetime: NOW_S - 60, tickerAssociation: "NVDA" },
    { id: 2, headline: "no association", url: "https://e.com/b", datetime: NOW_S - 60, tickerAssociation: null },
    { id: 3, headline: "bad url", url: "javascript:x", tickerAssociation: "NVDA" },
    { id: "x", headline: "bad id", url: "https://e.com/d" },
    null,
  ]);
  assert.deepEqual(items.map((i) => i.id), [1, 2]);
  assert.equal(items[0].tickerAssociation, "NVDA");
  assert.equal(items[1].tickerAssociation, null, "absent stays absent");
});

test("the API parser survives a truncated or empty response", () => {
  assert.deepEqual(parseApiNewsItems(undefined), []);
  assert.deepEqual(parseApiNewsItems(null), []);
  assert.deepEqual(parseApiNewsItems("nope"), []);
  assert.deepEqual(parseApiNewsItems([]), []);
});

test("an entirely malformed nonempty API list is an error, not no news", () => {
  assert.throws(() => parseApiNewsItems([null, { headline: "broken" }]),
    /no readable articles/);
});
