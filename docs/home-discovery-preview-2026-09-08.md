# Homepage discovery and comparison search — review notes

## Delivery scope

Local implementation for review, not a production release. Based on the existing fund-comparison preview branch. No source-data refresh, paid service, scheduled importer, public Form 4 route, or production deployment was performed.

- Homepage retains the real Outfox mark, typography, colors, and approved headline. Latest House purchase disclosures and clusters now lead; the AI buildout is a featured destination underneath.
- `/explore` preserves the interactive stack, company details, questions, quotes, and existing charts.
- `/congress` searches and paginates the full 997-record archive instead of restricting discovery to the stack's sample. Pages contain 25 records and preserve search/ticker filters.
- `/compare` accepts ticker entry and name lookup across the six starter funds plus the existing Explore-company catalog. Other syntactically valid tickers can be retained, explicitly unverified and without price history. This is not a market-wide security master.
- Five-year views retain short-history selections but exclude them from five-year charts and rankings. Shared-history is explicit; it cannot imply all selections have data when some have no series.

## Evidence rules

Clusters consider filings within 30 inclusive calendar dates, using filing dates, not a claim of present-day trading. They count distinct normalized filer names separately for purchases and sales. Repeated transactions do not create more people. Filers are name-based, not authoritative person IDs; ownership can include family or joint holdings.

Options, exchanges, unknown tickers, quarantined records, conflicting issuer CIKs, invalid chronology, future filings, and duplicate identities cannot inflate clusters. Minimum two purchasing filers; up to five results, with no filler when fewer qualify. All archive tickers are considered, not only AI companies.

Two existing chronology anomalies are retained in the archive with visible warnings, excluded from homepage calculations, and **not corrected in source data**:

- `20033889::c1adbdc4e6134daa::0`: transaction date follows filing date.
- `20034099::359625a8460ca7d0::0`: transaction date follows filing date.

These need a separate original-document audit before any source correction.

## Verification

- Full suite: 483 tests, 481 passed, 2 skipped, 0 failed. The existing two House end-to-end tests require a local cache absent from this checkout.
- Lint and TypeScript passed.
- Production and preview webpack builds passed.
- Both builds: 54 public/browser assets scanned, zero fixture markers. Production comparison refuses access, with no demonstration values in five rendered artifacts. Preview receives demonstration data only after the server access gate.
- Browser: original filing details expand; archive name search and page two work; Compare name lookup and custom ticker entry work; unsupported tickers and SOXX remain selected without blocking five years for other funds; URL reload restores the selection.
- Responsive checks at 375px and desktop 1440px; no horizontal page overflow on the checked mobile homepage, archive, Explore, or comparison. Light/dark navigation preserves the selected theme. No captured browser errors on the checked homepage/comparison.

## Remaining limits

Comparison prices are still generated demonstration values. Adding a ticker does not connect historical data. No actual market returns are offered by this preview. It remains noindex and blocked on production, with no production navigation or sitemap link.

The existing live quote and historical endpoints are unchanged. No new market-data rights or provider costs were approved. Real historical integration, a broader security master, and production publication are separate follow-ups.

The aggregation is reusable server-side code with tests; this work does not publish a new customer API.
