# Homepage discovery and comparison search — review notes

## Delivery scope

Local implementation for review, not a production release. Based on the existing fund-comparison preview branch. No source-data refresh, paid service, scheduled importer, public Form 4 route, or production deployment was performed.

- Homepage retains the real Outfox mark, typography, colors, and approved headline. Latest House purchase disclosures and clusters now lead; the AI buildout is a featured destination underneath.
- `/explore` preserves the interactive stack, company details, questions, quotes, and existing charts.
- `/congress` searches and paginates the full 997-record archive instead of restricting discovery to the stack's sample. Pages contain 25 records and preserve search/ticker filters.
- `/compare` accepts ticker entry and name lookup across the six starter funds plus the existing Explore-company catalog. Other syntactically valid tickers can be retained, explicitly unverified and without price history. This is not a market-wide security master.
- Five-year views retain short-history selections but exclude them from five-year charts and rankings. Shared-history is explicit; it cannot imply all selections have data when some have no series.

## Evidence rules

Clusters consider filings within 30 inclusive calendar dates, using filing dates, not a claim of present-day trading. They count normalized filer names scoped to chamber/state/district separately for purchases and sales, with narrow reviewed aliases. Repeated transactions do not create more people. Filers are name-based, not authoritative person IDs; ownership can include family or joint holdings.

The archived names `John J Mr McGuire` and `John McGuire`, both House/VA/VA05, now share one counting identity. Archive evidence: official filing links ending in `20035367.pdf`, `20034521.pdf`, and `20033956.pdf`. No source records were rewritten. Middle names are not generally stripped, and district alone is never treated as a person identity. Real-archive and synthetic regression tests cover this correction. This is not a completed audit of all identities or source coverage.

The homepage now explicitly labels its clusters as readable House-archive results, not a complete Congress leaderboard. Last import evidence reports 43 unreadable scanned filings; Senate is not connected. The 997 rows include sales, exchanges, and older transaction years, not 997 purchases this year.

Options, exchanges, unknown tickers, quarantined records, conflicting issuer CIKs, invalid chronology, future filings, and duplicate identities cannot inflate clusters. Minimum two purchasing filers; up to five results, with no filler when fewer qualify. All archive tickers are considered, not only AI companies.

Two existing chronology anomalies are retained in the archive with visible warnings, excluded from homepage calculations, and **not corrected in source data**:

- `20033889::c1adbdc4e6134daa::0`: transaction date follows filing date.
- `20034099::359625a8460ca7d0::0`: transaction date follows filing date.

These need a separate original-document audit before any source correction.

## Verification

- Full suite: 492 tests, 490 passed, 2 skipped, 0 failed. The existing two House end-to-end tests require a local cache absent from this checkout.
- Missing-history behavior is a tested, framework-independent dataset function. Unavailable symbols appear in both result-level and endpoint-level exclusions. One measurable selection is never labeled a ranked winner; all-missing selections never yield prices.
- Lint and TypeScript passed.
- Production and preview webpack builds passed.
- Both builds: 54 public/browser assets scanned, zero fixture markers. Production comparison refuses access, with no demonstration values in five rendered artifacts. Preview receives demonstration data only after the server access gate.
- Browser: original filing details expand; archive name search and page two work; Compare name lookup and custom ticker entry work; unsupported tickers and SOXX remain selected without blocking five years for other funds; URL reload restores the selection.
- Responsive checks at 375px and desktop; no horizontal page overflow on the checked mobile homepage, archive, Explore, or comparison. Navbar's browser-only theme initializer was replaced with a hydration-safe external-store subscription. Fresh R1 browser verification confirms dark-mode reload/navigation without recorded hydration errors. See `r1-verification-2026-09-08.md` for the final receipt and test limitations.

## Remaining limits

### Required outcome tracking: what happened after a disclosed purchase

Preserve the "pull back the curtain" positioning while evaluating outcomes, not assuming prominent buyers are successful. Build two separately labeled measurements using permitted, corporate-action-adjusted history: movement since the reported transaction date, and movement since the disclosure was publicly available (the first actionable point for a reader). Identify the historical observation-price convention and show an appropriate benchmark over identical dates. Include distributions for total-return claims.

These are observed security returns, not the filer's actual profit or verified account performance. Do not infer execution price, exact position size, continuing ownership, or a matched exit from incomplete disclosures. A closed-trade result requires substantiated linkage; otherwise label the position/outcome as unknown. No invented prices, retroactive information advantage, or guarantees of future returns. This remains unimplemented until real history and publication timing are connected.

### Required destination: all three branches of federal government

User clarification, September 8: political coverage is incomplete until it spans the legislative (House and Senate), executive (covered officials including Cabinet), and judicial branches (covered federal judges). House-only is an initial release, not complete political coverage.

- Build distinct source adapters and coverage inventories for each system; preserve source-specific filing types, dates, ownership, amendments, and access constraints.
- Show collected versus missing/unreadable/request-pending records. Do not claim every official or every trade is observable, or label a partial archive a complete government leaderboard.
- Public financial disclosures and transaction reports are different evidence types. Do not convert a reported holding into an invented purchase.
- Executive and judicial access requirements must be verified before collection; do not submit requests with user identity or accept access agreements without the necessary authorization.
- Keep political disclosures, corporate-insider transactions, and institutional holdings as separate categories before presenting cross-category overlap.

### Requested next: congressional purchases inside ETFs

- Connect dated, permitted ETF holdings to the existing House disclosure archive using verified security identities.
- Show the overlapping stocks, distinct purchasing/selling filers, filing and transaction dates, and each stock's reported ETF weight.
- Clearly distinguish purchases of underlying stocks from purchases of ETF shares. Do not imply Congress bought the ETF or that a filer personally owns all reported family holdings.
- Label holdings dates and partial coverage; do not present top-holdings overlap as a complete portfolio calculation. Preserve separate purchase/sale counts and disclosure delays.
- Measure the starter ETFs' actual coverage of disclosed purchases before claiming the starter set represents congressional activity. No invented holdings or price data, and no paid source without approval.

Comparison prices are still generated demonstration values. Adding a ticker does not connect historical data. No actual market returns are offered by this preview. It remains noindex and blocked on production, with no production navigation or sitemap link.

The existing live quote and historical endpoints are unchanged. No new market-data rights or provider costs were approved. Real historical integration, a broader security master, and production publication are separate follow-ups.

The aggregation is reusable server-side code with tests; this work does not publish a new customer API.
