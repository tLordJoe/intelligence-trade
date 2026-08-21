# Outfox Markets — Site, Data, and Operations Inventory

Last audited: August 11, 2026

This document is the source of truth for what the public product contains, where its information comes from, how it is refreshed, and what must be completed before Outfox deliberately drives traffic.

## Public product surfaces

| Route | Purpose | Primary dependencies | Current state |
| --- | --- | --- | --- |
| `/` | Homepage, AI stack, quotes, market comparison, House preview | Static stack taxonomy, Finnhub quotes, unofficial Yahoo chart endpoint, House JSON | Live; needs editorial sourcing and responsive audit |
| `/about` | Product explanation and source summary | Static editorial content | Live; needs methodology, corrections, terms, and privacy links |
| `/congress` | House disclosure table and trade-timing chart | House JSON, unofficial Yahoo chart endpoint | Live; House only; Senate not yet ingested |
| `/signals` | Technical-analysis experience | Disabled technicals endpoint | Public shell; indicators intentionally unavailable pending validation |
| `/portfolio` | Browser-only saved ticker list | `localStorage`, Finnhub quotes | Works as a watchlist; naming must be corrected |
| `/layer/[slug]` | Layer detail and company quotes | Static taxonomy, Finnhub quotes | Live; ten valid layer slugs |
| `/blog` | Article index | Static article module | Live; four articles require claim-level source review |
| `/blog/[slug]` | Article detail | Static article module | Live; author/reviewer/citations/corrections missing |

## API and data-source register

| Endpoint | Source | Refresh/cache | Failure behavior | Risk/status |
| --- | --- | --- | --- | --- |
| `/api/stocks` | Finnhub quote API via `FINNHUB_API_KEY` | In-memory cache, 60 seconds | Explicit 503/502; no fabricated fallback | Acceptable for prototype; provider terms and production limits must be formalized |
| `/api/news` | Finnhub company-news API | In-memory cache, 5 minutes | Explicit unavailable response | Acceptable for prototype; add monitoring |
| `/api/history` | Unofficial Yahoo Finance chart endpoint | One-hour cache | Explicit 502 | Must replace or formally license before meaningful scale |
| `/api/layer-history` | Unofficial Yahoo Finance chart endpoint; equal-weight calculation | One-hour cache | Explicit 502 | Methodology needs a public explanation; source must be formalized |
| `/api/congress` | Checked-in House PTR dataset | Manual refresh | Returns last valid checked-in dataset | Official source links retained; freshness monitoring and automation required |
| `/api/health` | Internal House-data assessment and Finnhub configuration check | No cache | Reports degraded/error state | Exists; must connect to an external monitor and alert |
| `/api/technicals` | None | None | Always 503 | Safely disabled until methodology is validated |

## Static and generated information

| Asset | Current contents | Refresh method | Required action |
| --- | --- | --- | --- |
| `src/lib/data.ts` | Ten AI-economy layers and approximately 90 security entries | Manual code edit | Create a verified master security register; cite and date quantitative layer claims |
| `src/lib/subcategories.ts` | Editorial subcategories and approximate market-cap weights | Manual code edit | Label estimates visibly and document how sizing is calculated |
| `src/lib/blog-data.ts` | Four static articles | Manual code edit | Add sources, author, reviewer, published/updated dates, and correction history |
| `src/lib/congress-live.json` | 203 House transactions, 22 filers, 110 disclosed tickers | `node scripts/scrape-congress.mjs` | Automate, monitor, deduplicate amendments, and add Senate through a separate adapter |
| `scripts/scrape-congress.mjs` | House XML/PDF collection and parsing | Manual terminal run | Add repeatable validation, staging, review, and scheduled execution |

House dataset at audit time:

- Source: Clerk of the U.S. House of Representatives STOCK Act PTR filings
- Generated: August 6, 2026 at 23:15 UTC
- Transaction-date coverage in the checked-in dataset: March 15, 2025 through July 31, 2026
- Scope: House only

## Browser-only state

- Theme preference is stored in `localStorage`.
- The current `/portfolio` list is stored in `localStorage` under `portfolio`.
- No account, database, server-side watchlist, alert, email preference, or saved comparison exists yet.
- The current “portfolio” is a watchlist and must not imply connected holdings or account value.

## Operations inventory

- Hosting: Vercel production deployment connected to the GitHub project.
- Framework: Next.js 16.3.0, React 19.2.8, TypeScript.
- Required production secret: `FINNHUB_API_KEY`.
- Automated tests: Node test suite exists for core market calculations and data-health logic.
- Monitoring: internal `/api/health` exists; no external uptime/error alert is configured.
- Analytics: no product analytics implementation identified.
- Scheduled jobs: none identified.
- Database/authentication: none.
- Email/newsletter provider: none.
- Backups: source exists on GitHub; no documented content/data backup and recovery procedure.
- Deployment checklist and rollback procedure: not documented.

## Highest-priority unresolved risks

1. **Uncited quantitative editorial claims.** Market-share, market-size, cost, energy, and growth claims appear in stack copy and articles without claim-level citations or dates.
2. **Unofficial historical-price dependency.** Both comparison experiences depend on an undocumented Yahoo chart endpoint.
3. **Manual disclosure freshness.** The House dataset becomes stale unless the scraper is deliberately run, reviewed, and deployed.
4. **Incomplete congressional scope.** The product clearly discloses House-only coverage, but Senate ingestion remains unfinished.
5. **No production observability.** A health endpoint exists, but no service is watching it and no owner receives alerts.
6. **No owned audience system.** There is no newsletter signup, email provider, subscriber database, or consent record.
7. **No product analytics.** Outfox cannot yet measure activation, retention, report conversion, or X-to-site outcomes.
8. **Incomplete publishing controls.** Articles have no author/reviewer workflow, citations, correction log, or documented release checklist.

## Launch-readiness checklist

Before deliberately increasing traffic, Outfox should complete these in order:

1. Review and source every quantitative editorial claim.
2. Publish methodology, sourcing, corrections, risk, privacy, and terms pages.
3. Configure external health/error monitoring.
4. Document deployment preview, production verification, rollback, and backup steps.
5. Install privacy-conscious analytics with a defined event dictionary.
6. Add the Outfox Report signup and consent flow.
7. Establish a weekly House refresh and review process.
8. Complete mobile, browser, keyboard, and accessibility QA.

## Definition of done for the baseline phase

The baseline phase is complete when every public number is sourced, dated, calculated by a published methodology, or visibly labeled as approximate; every production dependency has a named failure state and owner; and a bad deployment or stale dataset can be detected and safely rolled back.
