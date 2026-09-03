# Outfox Markets — Project Board

Last updated: September 2, 2026

This board is the day-to-day operating view. `ROADMAP.md` remains the complete long-term plan.

## Current objective

Build the Outfox intelligence loop: verified informed-money data, understandable
education, repeatable reports, distribution, return visits, and paid value.

## Execution map

```text
Official filings and current data
              ↓
Protected importers and source evidence
              ↓
Congress + insiders + influential managers
              ↓
Convergence analysis with visible disagreements
              ↓
Outfox Report + Academy + original charts
              ↓
Search, ChatGPT, Claude, email, and X discovery
              ↓
Watchlists, alerts, scorecards, and subscriptions
```

## Active build queue

Each release follows the same rule: implement → test → independent review →
publish → verify live. Codex owns implementation; Claude performs the first
adversarial review when a release reaches its review gate. Grok is used for
outside-reader and positioning feedback, not as a source of financial facts.

### Release A — Outfox Academy foundation (doing now)

- [x] Create the reusable `/learn` index and definition-page system
- [x] Publish the first five primary-sourced guides: Form 4, Form 13F,
  congressional PTR, corporate insider, and transaction date versus filing date
- [x] Add canonical metadata, structured page data, sitemap entries, internal
  links, crawl access, review dates, authorship, limitations, and corrections path
- [x] Add Academy navigation and AI-readable site-guide links
- [ ] Test, review, publish, and verify every page on the live domain

Release gate: all five guides are readable without JavaScript, cite official
sources, state their limitations, and appear in the production sitemap.

### Release B — SEC Form 4 corporate-insider pipeline (next)

- [ ] Define the shared informed-money schema and provenance contract
- [ ] Collect official SEC ownership XML with accession numbers and source URLs
- [ ] Parse reporting person, issuer, role, dates, security, shares, price,
  transaction code, ownership form, remaining ownership, footnotes, and amendments
- [ ] Separate open-market purchases/sales from awards, exercises, gifts, tax
  withholding, derivatives, and other transaction classes
- [ ] Reuse last-known-good protection, append-only history, revisions,
  quarantine, run evidence, and blocking completeness gates
- [ ] Hand-verify at least 25 filings and add permanent regression fixtures
- [ ] Build the first insider activity page and connect terms to Academy guides
- [ ] Test, review, publish, and verify live

Release gate: every displayed transaction reconciles to official SEC XML and a
failed import cannot change production data.

### Release C — SEC Form 13F influential-manager pipeline

- [ ] Publish transparent criteria for the initial 10–15 manager cohort
- [ ] Resolve each manager to the correct filing entity, CIK, and filing history
- [ ] Import at least nine quarter-end snapshots, including amendments
- [ ] Normalize holdings without describing snapshots as exact or current trades
- [ ] Calculate newly reported, increased, reduced, exited, and unchanged holdings
- [ ] Build manager profiles, quarter comparisons, concentration views, and
  cross-manager convergence tables
- [ ] Layer institutional holdings against House and Form 4 activity while
  preserving each source’s as-of date and disclosure lag
- [ ] Test, review, publish, and verify live

Release gate: selected managers and every calculated change reproduce the
official filings, with filing-entity and delay limitations visible.

### Release D — Informed Money and Outfox Report

- [ ] Build the combined Congress / corporate-insider / manager signalboard
- [ ] Show agreement, disagreement, freshness, source evidence, and counterpoints
- [ ] Finalize the recurring Outfox Report template and editorial checklist
- [ ] Configure email consent, delivery, unsubscribe, bot protection, and analytics
- [ ] Turn each report into a permanent web page, email, X Article, short posts,
  and shareable original charts
- [ ] Publish Report No. 1 only after every statement passes evidence review

Release gate: one evidence-backed report completes the full web-to-email loop and
every material claim can be traced to a source record.

### Release E — ETF scorecards, retention, and paid validation

- [ ] Define transparent ETF scorecard dimensions, weights, update schedule,
  limitations, and conflict policy
- [ ] Compare accessible ETFs against themes identified by informed-money analysis
- [ ] Add server-side accounts, watchlists, and company/manager/theme alerts
- [ ] Measure return usage and willingness to pay before launching Outfox Pro
- [ ] Keep issuer sponsorship separate from editorial scoring and disclose conflicts

Release gate: users return for alerts and comparisons, and paid demand is measured
before a subscription promise is made.

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
