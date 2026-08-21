# Outfox Markets — Project Board

Last updated: August 12, 2026

This board is the day-to-day operating view. `ROADMAP.md` remains the complete long-term plan.

## Current objective

Publish a trustworthy, searchable foundation and create the recurring Outfox Report audience loop.

## Done

- [x] Establish Outfox name, domain, tail logo, favicon, and X brand assets
- [x] Deploy the Next.js site through GitHub and Vercel
- [x] Build the AI-economy stack and company layers
- [x] Build stock/ETF and layer performance comparisons
- [x] Add aligned chart crosshairs, prices, dates, and tooltips
- [x] Add verified House disclosure records with official filing links
- [x] Add honest missing-data states and core calculation tests
- [x] Create the definitive product and growth roadmap
- [x] Create the X Premium+ growth strategy
- [x] Inventory public pages, APIs, data sources, and operational risks
- [x] Build public methodology and corrections pages locally
- [x] Remove unsupported quantitative claims from prominent stack cards locally
- [x] Review Claude's SEO, newsletter, automation, and ratings patch

## Doing now — Release 1: Trust and discovery

- [x] Integrate the corrected sitemap
  - Include homepage, Congress, blog, layer, methodology, and corrections pages
  - Use honest last-modified dates
  - Exclude the browser-only watchlist from priority indexing
- [x] Integrate corrected `robots.ts`
  - Allow public editorial pages
  - Keep raw API routes out of search results
- [x] Integrate corrected `llms.txt`
  - Point to the dedicated methodology and corrections pages
  - State House-only coverage and unofficial historical-price integration
- [x] Combine with the completed methodology, corrections, and stack-copy changes
- [x] Run tests, lint, and production build
- [ ] Publish through GitHub and Vercel
- [ ] Verify every new page on the live domain

Release gate: the live site builds successfully, new trust pages work, and search/AI discovery files describe the product accurately.

## Next — Release 2: Article credibility

- [ ] Audit all four existing articles claim by claim
- [ ] Remove claims that cannot be verified
- [ ] Add dated primary or authoritative sources
- [ ] Add author, reviewer, published date, updated date, and correction area
- [ ] Distinguish facts, calculations, interpretation, and scenarios
- [ ] Improve internal links to companies, layers, methodology, and disclosures
- [ ] Test, publish, and verify live

Release gate: every material quantitative claim is cited and dated.

## Next — Release 3: Measurement

- [ ] Select a privacy-conscious analytics provider
- [ ] Publish a short analytics/cookie explanation
- [ ] Track acquisition source, X campaign, page engagement, charts, disclosures, and signup intent
- [ ] Create the weekly growth scorecard
- [ ] Add error and performance monitoring
- [ ] Connect `/api/health` to an external uptime alert
- [ ] Test, publish, and verify live

Release gate: we can measure discovery, activation, return visits, and conversion without collecting unnecessary personal data.

## Next — Release 4: Outfox Report

- [ ] Select and configure the email provider
- [ ] Finalize signup consent and privacy language
- [ ] Add signup-source and campaign tracking
- [ ] Add rate limiting and bot protection
- [ ] Build the weekly report template and publishing checklist
- [ ] Prepare the first complete report before promising a delivery date
- [ ] Add signup placements to the homepage, Congress, blog, and articles
- [ ] Send and verify a complete test subscription flow
- [ ] Publish and verify live

Release gate: an address is stored with consent, receives the promised message, and can unsubscribe successfully.

## Next — Release 5: Disclosure reliability

- [ ] Repair ticker extraction errors and truncated company names
- [ ] Add party and filer normalization without guessing unknown values
- [ ] Preserve historical records during incremental refreshes
- [ ] Detect amendments and superseded filings
- [ ] Add regression fixtures using hand-verified government PDFs
- [ ] Reject suspicious ticker, asset, record-count, and freshness changes
- [ ] Stage refreshes for review rather than pushing directly to production
- [ ] Enable scheduled House refresh only after the safety suite passes
- [ ] Begin the separately reviewed Senate pipeline

Release gate: a bad parse cannot silently delete history or deploy incorrect records.

## Then — Retention and paid value

- [ ] Member accounts and server-side watchlists
- [ ] Alerts for companies, layers, officials, disclosures, reports, and earnings
- [ ] Committee, legislation, hearing, lobbying, and government-contract context
- [ ] Supplier and dependency maps
- [ ] Filing-date versus transaction-date performance analysis
- [ ] ETF comparison and overlap tools
- [ ] Validate Exposure Ratings on a small ETF test set
- [ ] Launch paid Outfox Pro only after free-product retention is demonstrated
- [ ] Add a sourced Outfox research agent
- [ ] Evaluate read-only portfolio and regulated brokerage partnerships

## Deliberately waiting

- [ ] Automatic House workflow from Claude's patch — blocked by parsing and history-loss risks
- [ ] Public Exposure Ratings methodology — blocked by validation and legal review
- [ ] Personalized investment recommendations — blocked pending securities counsel and regulated structure
- [ ] Trade execution or fund launch — blocked until audience, methodology, compliance, and partner requirements are proven

## Operating rule

Complete one release at a time: implement → test → publish → verify live → report the result → identify the next release.
