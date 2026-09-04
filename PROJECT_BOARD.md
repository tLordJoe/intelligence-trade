# Outfox Markets — Project Board

Last updated: September 3, 2026

## Current execution order — overrides older queue labels below

Outfox owns its source collection, historical archive, analysis, and future API.
Coverage is broader than AI: full covered-stock browsing with an AI filter.
Do not use Quiver's API as the core database.

1. **Repair release (in progress, local only):** visible-row statistics, explicit
   loaded/available counts, mobile navigation, homepage wording. Then test theme
   persistence repeatedly, trace quote missing-versus-zero behavior, news failures,
   and add the briefing redirect. Do not mark intermittent issues disproven after
   one passing trial. Do not mark reported causes confirmed without evidence.
2. **Supervised refresh:** one operator; review additions/revisions/quarantine
   and freshness before publishing. Parsed-row subtraction is not a verified
   count of new disclosures. Ship honest count labels before or with the refresh.
3. **Archive access:** all/AI scope, search, sorting, real pagination beyond 250,
   accurate totals and dates. Current API has no offset/cursor; backend work needed.
4. **Stock research pages + Form 4:** reusable ticker pages, source history,
   shared provenance contract, original-source collection and backfills.
5. **Managers/private capital:** 13F snapshots, 13D/13G significant ownership,
   source-rich family offices with exact entity attribution and coverage limits.
6. **Analysis, reports, retention, API:** cross-source comparisons, saved alerts,
   original reports, then versioned external API with rights and reliability gates.

### Owners and acceptance gates

- Codex: implement/integrate; one owner per file/task, no overlapping edits.
- Claude: independent review and supervised import coordination; do not dispatch
  another import until the operator and current baseline are agreed.
- Perplexity: source inventory and repeatable live acceptance trials; record URL,
  time, viewport, navigation sequence, response payload and trial counts.
- SuperGrok: reader questions, evidence-linked story candidates and UX critique;
  never treat social claims as verified production records.
- Release: regression tests + lint/build → independent review → deploy → live QA.
- Browser QA: all nav/theme controls accessible at 375px; statistics equal visible
  rows including empty filters; at least 10 theme-navigation trials in both themes.
- Quote QA: genuine zero stays zero, missing stays unavailable, loading distinct.
- Observability backlog: structured provider failures, visible freshness, synthetic
  endpoint checks and privacy-safe error tracking. Provider/account and recurring
  monitoring setup require explicit configuration; none has been enabled here.
- Legal/licensing review runs alongside engineering before monetizing restricted
  sources or redistributing identifiers/data. Learn supports research, not a new
  standalone course business.

Local repair changes are not yet browser-verified, independently reviewed or live.

### September 3 — discovery and performance additions

- [x] Implement local "Understand the buildout" panel below the layer detail:
  five sourced native expand/collapse questions, first open, layer links, mobile
  stacking and HTML answers without client fetches. Agreed stack headings applied.
- [ ] Browser/keyboard and desktop/mobile visual QA for the new panel; independent
  editorial/source review and production verification before marking published.

- [x] Locally reframe the AI stack as "Behind the data-center boom" with an
  introductory explanation; preserve the map and distinguish the broader AI
  economy from data-center construction. Pending release verification.
- [ ] Add stock performance since reported transaction date and since public
  availability, benchmarked over identical periods. Label as stock performance,
  not the filer's actual profit. Record price basis, splits/dividends, missing
  history, options exclusions, and non-trading-day rules.
- [ ] Add disclosure-aware hypothetical baskets only after historical coverage
  supports them: explicit entry timing, weighting, exits, rebalancing, costs,
  delisted securities and no look-ahead. Do not equate sales with short positions.
- [ ] Keep brokerage execution separate from informational tracking. No trading
  integration or public API launch required; Outfox's website is the flagship.
- [ ] Audience-first model: free readership and email subscribers now. External
  API access, advertising and paid subscriptions remain optional future choices.

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

### Pinned product positioning

**Primary pitch:** Outfox tracks what influential investors, corporate insiders,
and members of Congress are doing with their money. We turn those public
disclosures into understandable patterns that help ordinary investors discover
what may be worth investigating.

All website UI, Outfox Reports, email, and social work must follow the approved
[brand messaging and voice rules](docs/BRAND_MESSAGING.md).

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
