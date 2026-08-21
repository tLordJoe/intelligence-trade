# Outfox Markets — Definitive Product and Growth Roadmap

> Day-to-day status is tracked in `PROJECT_BOARD.md`. This file remains the comprehensive long-term roadmap.

Last updated: August 11, 2026

## Destination

Outfox becomes the trusted intelligence layer between ordinary investors and the financial system. It helps people understand the forces shaping the future, identify the companies that participate in those forces, monitor informed market activity, and eventually act through regulated financial partners.

Outfox should own:

- The brand and customer relationship
- The community
- The AI-economy taxonomy and investment methodology
- The research, data presentation, baskets, alerts, and agent experience
- First-party information about what members follow and find useful

Partners can provide:

- Market-data infrastructure
- Brokerage connectivity and execution
- Custody and clearing
- Registered investment-advisory services
- ETF operations and administration

## North-star outcome

Build Outfox into a valuable, independent business that is also strategically acquirable.

Long-term proof points:

- 100,000+ registered members
- 25,000+ paying members
- Strong direct and organic traffic
- High repeat usage and newsletter engagement
- Thousands of securely connected portfolios
- Measurable assets influenced or connected through Outfox
- Proprietary, documented investment methodologies
- Multiple revenue streams without sacrificing editorial trust

## Operating rules

1. Trust before monetization.
2. Verify financial data; never silently display invented or stale figures.
3. Explain every basket holding and methodology decision.
4. Keep Outfox broker-neutral until exclusivity creates an unmistakable advantage.
5. Introduce account access as read-only before requesting trading authority.
6. Use regulated partners instead of prematurely becoming a brokerage.
7. Measure retention and conversion, not just page views.
8. Complete each phase's exit gate before expanding into the next high-risk phase.

## Product promise and editorial position

Outfox translates market activity, institutional positioning, public-official disclosures, and thematic research into understandable choices for ordinary investors. The product should help a user answer:

1. What happened?
2. Why does it matter?
3. Who may benefit or face risk?
4. What are the reasonable ways to express the thesis?
5. What evidence would confirm or disprove it?
6. What can I learn, watch, compare, or contribute next?

The editorial position is nonpartisan and investor-first: **follow the money, not the party**. Outfox reports Democratic, Republican, independent, institutional, executive, and billionaire activity using the same methodology and evidentiary standard. Political identity is context, never the investment thesis.

Every major research experience should serve three levels without splitting the brand into separate products:

- **Start here:** plain-language explanation, definitions, and risks for a new investor
- **Build conviction:** comparisons, thesis, counter-thesis, catalysts, and valuation context
- **Deep dive:** source records, methodology, holdings, calculations, and downloadable data for advanced users

Outfox may publish general, impersonal research, ratings, watchlists, model baskets, and educational scenarios. Personalized recommendations based on a user's holdings, goals, finances, taxes, or risk tolerance require securities counsel and potentially a registered advisory partner or appropriate registration before launch.

---

## Phase 0 — Establish the baseline

Goal: Know exactly what exists, what is reliable, and what must be corrected before growing traffic.

- [x] Establish Outfox name, domain, visual direction, and tail logo
- [x] Deploy the live Next.js website on Vercel
- [x] Build the AI-economy stack visualization
- [x] Add market-performance comparisons
- [x] Add congressional-trading presentation
- [x] Add watchlist prototype
- [x] Add articles, signals, layer pages, and company information
- [x] Create a complete inventory of pages, components, APIs, data sources, and scheduled scripts (`SITE_INVENTORY.md`)
- [ ] Create a verified master security list with ticker, company, exchange, status, and source
- [ ] Identify every simulated, stale, delisted, duplicate, or unsupported security
- [ ] Document which live features rely on Finnhub, Yahoo Finance, static JSON, or other sources
- [ ] Add a staging/preview checklist for every deployment
- [ ] Establish a weekly backup of source code, content, and data

Exit gate:

- Every public number has an identified source or is clearly labeled as illustrative.
- The master company and ticker list has been reviewed.
- We can deploy and roll back changes reliably.

## Phase 1 — Make the public product trustworthy

Goal: Turn the prototype into a reliable financial-information destination.

### Data integrity

- [x] Remove simulated price fallbacks from production
- [x] Show an honest unavailable state when a quote source fails
- [x] Display data source, freshness, and delay information
- [ ] Replace or formalize the unofficial historical-price source
- [ ] Handle splits, dividends, ticker changes, mergers, acquisitions, and delistings
- [x] Validate core percentage-performance calculations with automated tests
- [ ] Add monitoring for broken or empty API responses
  - [x] Add a no-cache health endpoint that detects empty, stale, duplicate, malformed, or unverified House records
  - [ ] Connect the health endpoint to an external uptime monitor and alert destination
- [ ] Add rate limiting to public endpoints
- [x] Add ticker and range input validation to public endpoints

### Congressional data

- [x] Document the original House government filing source and ingestion method
- [ ] Automate congressional-data updates
- [ ] Add official U.S. Senate financial-disclosure ingestion and clearly distinguish House and Senate coverage
  - [x] Confirm the authoritative public source: Secretary of the Senate eFD search (`efdsearch.senate.gov`)
  - [x] Confirm PTR timing and scope from the Senate Ethics Committee (over $1,000; generally due within 30 days of notice and no later than 45 days after the transaction)
  - [ ] Obtain legal review of the eFD statutory-use acknowledgement before automated collection or commercial publication
  - [ ] Build a Senate search-results collector that respects the eFD acknowledgement and session flow
  - [ ] Parse Senate PTR HTML/PDF records into a separate staging dataset
  - [ ] Normalize owner, asset/ticker, transaction type, amount range, transaction date, filing date, and amendment status
  - [ ] Attach the official eFD report URL to every staged record
  - [ ] Keep House and Senate source adapters separate, then merge only through a shared validated record model
- [ ] Backfill, deduplicate, and verify Senate transactions before showing them publicly
- [ ] Preserve the transaction date, disclosure date, owner, amount range, and source filing
- [x] Link each displayed House transaction to its official source PDF
- [ ] Detect amended filings and reconcile superseded records
- [x] Remove duplicate record IDs before display
- [x] Explain the STOCK Act reporting delay and data limitations
- [x] Avoid implying that a filing proves illegal insider knowledge

### Editorial and methodology

- [x] Publish a public methodology and data-sources page
- [ ] Publish the AI-stack methodology
- [ ] Publish the congressional-data methodology
- [ ] Add source citations to investment claims
- [ ] Add author and reviewer information
- [x] Add a public corrections policy
- [ ] Add visible correction dates and entries to individual articles when applicable
- [ ] Add clear educational-use and risk disclosures
- [ ] Review privacy policy, terms, cookies, and data-use disclosures

### Product polish

- [x] Add an inspiration-site-style crosshair to the market-performance chart: snap to the nearest date, draw vertical and horizontal guides, show the date on the x-axis, and show the active value on the y-axis
- [x] Show a compact Outfox tooltip beside that crosshair with each visible ticker, its price, and its percentage change at the selected date
- [x] Add the same crosshair interaction to the congressional trade-timing chart, with historical price plus filer, transaction type, disclosed amount range, transaction date, and filing date when a trade marker is selected
- [x] Make chart inspection work with mouse, touch, and keyboard without obscuring the plotted lines
- [x] Correct responsive chart coordinate mapping so the crosshair and pointer remain aligned from edge to edge
- [x] Add separate Stocks & ETFs and By Layer chart modes
- [x] Add equal-weight performance lines for every stack layer with All, None, and individual on/off controls

- [ ] Audit mobile, tablet, and desktop layouts
- [ ] Test keyboard navigation and accessibility
- [x] Add honest quote/news loading and error states
- [ ] Improve company-logo reliability and fallbacks
- [ ] Rename the current “portfolio” implementation to “watchlist” wherever appropriate
- [x] Remove the misleading one-share “total portfolio value” calculation

Exit gate:

- No knowingly fabricated financial figures can appear in production.
- Core pages work on mobile and desktop.
- Methodology, sources, limitations, and disclosures are visible.
- A failed data provider produces a clear error rather than misleading output.

## Phase 2 — Build the audience engine

Goal: Give people recurring reasons to discover, return to, and share Outfox.

### Search and discovery

- [ ] Define the primary audience and three most important user problems
- [ ] Create a keyword and editorial map around AI infrastructure, congressional activity, and thematic investing
- [ ] Add sitemap, robots controls, canonical URLs, and structured data
- [ ] Create indexable company pages
- [ ] Create indexable layer and theme pages
- [ ] Improve article metadata and internal linking
- [ ] Create original charts and research that other sites can cite

### Newsletter and recurring content

- [x] Rewrite the homepage hero around the broader Outfox value proposition and add direct paths into the AI stack and verified House disclosures
- [ ] Add newsletter signup throughout the site
- [ ] Create the recurring “Outfox Report” format and publish it on a reliable schedule
  - [ ] Begin weekly; add a shorter daily edition only after the workflow and data are reliable
  - [ ] Include: what moved, why it moved, notable public-official/institutional activity, thesis implications, what to watch next, and risks
  - [ ] Include a clearly labeled action ladder: Learn, Watch, Compare, and Contribute
  - [ ] Show multiple ways to express a theme—individual equities, diversified ETFs, and waiting—without implying guaranteed outcomes
- [ ] Add beginner, intermediate, and advanced reading paths to every flagship report
- [ ] Create a repeatable editorial calendar
- [ ] Publish one flagship research piece each month
- [ ] Publish timely, shorter updates during the week
- [ ] Create automated weekly summaries from verified data
- [ ] Add share cards for charts, baskets, and notable transactions

### X distribution engine

- [x] Create the Outfox X avatar and final vector-clean banner
- [x] Document the Premium+ operating strategy in `X_GROWTH_STRATEGY.md`
- [ ] Finalize the X bio and publish a pinned orientation post
- [ ] Configure X Pro columns for AI companies, specialists, disclosure sources, journalists, competitors, and Outfox mentions
- [ ] Prepare a ten-post evergreen content bank
- [ ] Publish one strong original weekday post using the five Outfox content pillars
- [ ] Adapt the weekly Outfox Report into a native X Article
- [ ] Use tagged links to measure site sessions and report signups by post
- [ ] Review X and site conversion performance every Friday

### Outfox Ratings

- [ ] Define the first transparent rating category, beginning with ETF scorecards rather than a universal security score
- [ ] Publish the rating methodology, inputs, weights, update schedule, limitations, and conflict policy
- [ ] Score relevant dimensions separately: cost, liquidity, diversification, concentration, holdings overlap, tracking, risk, and thesis exposure
- [ ] Show the underlying evidence and date beside every rating
- [ ] Never accept payment for a higher score; disclose advertising, affiliate, issuer, and data-provider relationships
- [ ] Add compare pages that explain who an ETF may or may not fit without personalizing the recommendation
- [ ] Require editorial, data, and legal review before marketing Outfox as a ratings authority

### Search and AI discovery quality

- [ ] Make reports, ratings, methodologies, company pages, and source tables crawlable without login
- [ ] Add author, reviewer, publication date, updated date, citations, corrections, and structured data
- [ ] Publish original calculations and datasets that can be cited instead of commodity summaries
- [ ] Give important charts descriptive text, tables, and stable URLs so search engines and AI systems can understand them
- [ ] Use consistent definitions and entity names across tickers, companies, people, layers, ETFs, and filings

### Measurement

- [ ] Install privacy-conscious product analytics
- [ ] Define events for stack interaction, chart use, watchlist use, article reading, and signup
- [ ] Measure acquisition source, activation, return visits, and newsletter conversion
- [ ] Create a weekly growth scorecard
- [ ] Add error and performance monitoring

Target gate:

- 10,000 monthly unique visitors
- 2,000 email subscribers
- At least 25% of traffic is direct or returning
- A repeatable publishing process exists

## Phase 3 — Accounts, database, and administration

Goal: Convert anonymous traffic into an owned member relationship and stop managing the product through source-code edits.

### Platform foundation

- [ ] Choose the production database and authentication provider
- [ ] Design the data model for users, companies, securities, layers, articles, trades, watchlists, baskets, and alerts
- [ ] Add registration, login, logout, email verification, and password recovery
- [ ] Add secure sessions and authorization rules
- [ ] Add profile, preferences, export, and account-deletion controls
- [ ] Migrate watchlists from browser-only storage to member accounts
- [ ] Preserve a guest experience for people who do not register

### Outfox administration

- [ ] Build a protected administrator area
- [ ] Add company and ticker management
- [ ] Add stack-layer management
- [ ] Add congressional-record review and correction tools
- [ ] Add article drafting, previewing, scheduling, and publishing
- [ ] Add basket creation, weighting, versioning, and change notes
- [ ] Add role-based permissions and an audit log

### Security and reliability

- [ ] Establish development, preview, and production environments
- [ ] Store secrets securely and rotate exposed credentials
- [ ] Add database backups and restore testing
- [ ] Add automated tests for authentication and financial calculations
- [ ] Add dependency and vulnerability monitoring
- [ ] Create an incident-response checklist

Exit gate:

- Members can use the same account across devices.
- Content and company data can be managed without editing code.
- Administrator changes are recorded and reversible.
- Backups and recovery have been tested.

## Phase 4 — Outfox Baskets

Goal: Turn the stack and research into transparent, followable investment strategies.

### Basket product

- [ ] Define the first three basket concepts
- [ ] Choose the first flagship basket
- [ ] Write its eligibility, selection, weighting, and rebalancing rules
- [ ] Establish benchmark and inception date
- [ ] Create basket, holding, and methodology database records
- [ ] Build basket detail pages
- [ ] Show holdings, weights, layer exposure, rationale, and risks
- [ ] Show historical basket versions and rebalance explanations
- [ ] Show performance with dividends, fees, and assumptions disclosed
- [ ] Compare baskets with SPY, QQQ, SMH, SOXX, and relevant benchmarks
- [ ] Let members follow baskets and receive change alerts

### Validation

- [ ] Have the methodology and performance presentation independently reviewed
- [ ] Test for survivorship and look-ahead bias
- [ ] Separate live results from hypothetical backtests
- [ ] Track how many users view, follow, and return to each basket

Exit gate:

- At least one basket has a complete written methodology.
- Every rebalance is reproducible from the rules and archived.
- Performance presentation is transparent and reviewed.
- Users can follow a basket without executing a trade.

## Phase 5 — Outfox Pro and community

Goal: Prove that users will pay for Outfox intelligence and participate in a durable community.

### Membership

- [ ] Define free and Pro feature boundaries
- [ ] Add subscription billing, receipts, cancellations, and failed-payment handling
- [ ] Launch monthly and annual plans
- [ ] Add premium basket alerts and research
- [ ] Add saved comparisons and custom watchlists
- [ ] Add personalized news and signal feeds
- [ ] Add member onboarding and activation guidance

### Community

- [ ] Decide whether discussion begins with article comments, basket discussions, or member posts
- [ ] Publish community standards
- [ ] Build moderation and reporting tools before public discussion
- [ ] Add member profiles with privacy controls
- [ ] Test live events, research calls, or office hours
- [ ] Identify and reward constructive expert contributors

Target gate:

- 10,000 registered members
- 1,000 paying members
- Sustainable free-to-paid conversion
- Monthly paying-member churn below an agreed threshold
- Community participation is constructive and moderated

## Phase 6 — Outfox intelligence agent

Goal: Let members interact naturally with trusted Outfox and portfolio information.

### Read-only agent

- [ ] Define exactly what the agent may and may not do
- [ ] Ground answers in Outfox research and cited source data
- [ ] Add questions about stack layers, companies, baskets, and congressional activity
- [ ] Let users request beginner, intermediate, or advanced explanations
- [ ] Explain Outfox ETF ratings dimension by dimension rather than returning an unexplained “best ETF” answer
- [ ] Present thesis, counter-thesis, alternatives, and uncertainty before any action-oriented conclusion
- [ ] Add saved watchlist analysis
- [ ] Show citations, data timestamps, and uncertainty
- [ ] Prevent fabricated prices, transactions, holdings, and performance claims
- [ ] Add feedback, evaluation, and escalation workflows
- [ ] Measure answer quality, usefulness, cost, and retention impact

### Portfolio-aware agent

- [ ] Add explicit permission and privacy controls for connected-account data
- [ ] Explain position, sector, layer, geographic, and concentration exposure
- [ ] Compare an actual portfolio with Outfox baskets
- [ ] Generate educational scenarios rather than undisclosed recommendations
- [ ] Maintain an audit trail of agent outputs affecting financial decisions

Exit gate:

- The agent consistently cites its sources.
- Sensitive data is permissioned and isolated correctly.
- A documented evaluation suite tests financial accuracy and unsafe behavior.
- Users find the agent useful enough to improve retention or conversion.

## Phase 7 — Connected portfolios

Goal: Bridge Outfox intelligence to institutions users already trust.

### Read-only connection

- [ ] Compare SnapTrade, Plaid Investments, and other qualified providers
- [ ] Review security, pricing, broker coverage, data rights, uptime, and exit terms
- [ ] Obtain securities and privacy counsel before launch
- [ ] Build the consent and connection flow
- [ ] Import accounts, holdings, balances, and transactions
- [ ] Calculate actual allocation, gains, concentration, and basket overlap
- [ ] Let users revoke access and delete imported data
- [ ] Clearly distinguish imported facts from Outfox analysis

### Proposed-action experience

- [ ] Create transparent proposed basket orders
- [ ] Show shares, dollars, weights, price assumptions, risks, and estimated consequences
- [ ] Require explicit user review and approval
- [ ] Confirm the legal status of Outfox recommendations and compensation
- [ ] Add immutable order and consent records
- [ ] Add customer support and incident procedures

Target gate:

- 2,500 securely connected portfolios
- Strong connection persistence and low support burden
- Users repeatedly use connected analysis
- Legal and compliance review is complete before any trading launch

## Phase 8 — Managed products and institutional partnerships

Goal: Decide which financial layer Outfox should own after demand has been proven.

### Strategic decision

- [ ] Compare four models: remain intelligence-only, partner with an RIA, establish an RIA, or launch embedded brokerage accounts
- [ ] Model revenue, costs, licensing, staffing, insurance, and liability for each
- [ ] Determine whether Outfox should charge subscriptions, advisory fees, licensing fees, or a combination
- [ ] Preserve data ownership, brand ownership, customer portability, and non-exclusivity where possible

### Potential partner paths

- [ ] Evaluate an RIA/custody path with institutions such as Schwab or Fidelity
- [ ] Evaluate branded embedded brokerage through infrastructure providers
- [ ] Evaluate index licensing
- [ ] Evaluate a white-label ETF with an established ETF platform
- [ ] Require legal review of every referral, revenue-sharing, and transaction-based compensation agreement

Exit gate:

- The selected model has demonstrated customer demand.
- Unit economics and compliance costs are understood.
- Outfox retains a defensible customer relationship and proprietary assets.

## Phase 9 — Scale and acquisition readiness

Goal: Create strategic options without depending on a sale.

- [ ] Maintain clean corporate ownership of code, trademarks, domains, research, data rights, and designs
- [ ] Confirm every contractor and contributor has assigned intellectual-property rights
- [ ] Maintain accurate financial statements and contracts
- [ ] Document security, privacy, compliance, data lineage, and vendor relationships
- [ ] Track recurring revenue, retention, acquisition cost, lifetime value, and contribution margin
- [ ] Track registered members, paying members, connected portfolios, and assets influenced
- [ ] Avoid partner terms that prevent a future acquisition
- [ ] Prepare a quarterly strategic-partner update
- [ ] Build relationships with brokerages, asset managers, data companies, publishers, and ETF platforms before seeking a transaction
- [ ] Create a data room only when the company has meaningful strategic interest or financing needs

Acquisition-readiness signals:

- The audience returns directly rather than depending entirely on paid advertising
- Revenue is recurring and diversified
- Outfox owns differentiated data, methodology, or community behavior
- Members convert from research into measurable financial action
- The platform can change infrastructure partners without losing the customer relationship

---

## Metrics scorecard

Review weekly:

- Unique visitors
- Returning visitors
- Direct and organic traffic share
- Newsletter signups and engagement
- Registered-user activation
- Watchlist and basket follows
- Seven-day and 30-day retention
- Pro trials, conversion, monthly recurring revenue, and churn
- Connected portfolios and connection health
- Agent usage and rated helpfulness
- Data failures, stale records, and corrections
- Site speed, uptime, and application errors

Review monthly:

- Publishing output and organic rankings
- Cost per acquired registered user
- Free-to-paid conversion
- Revenue and gross margin
- Most useful layers, baskets, companies, and features
- Assets connected or influenced where measurable and legally appropriate
- Partner pipeline
- Security and compliance issues

## Immediate execution queue

Work on these items next, in this order:

1. [ ] Produce the full data-source and feature inventory
2. [ ] Audit and correct the master ticker/company list
3. [x] Remove simulated production prices and implement honest error states
4. [x] Add source and freshness labels to financial data
5. [x] Remove the misleading one-share portfolio calculation; finish renaming remaining portfolio references to watchlist
6. [ ] Finalize the proposed Edge & Devices and Connectivity & Access taxonomy and review GLW, AAPL, and SPCX placement
7. [ ] Publish methodology, data limitations, corrections, and risk-disclosure pages
8. [ ] Define and publish the first weekly Outfox Report
9. [ ] Add newsletter capture connected to the Outfox Report
10. [ ] Add monitoring for production errors and failed data feeds
11. [ ] Design the transparent Outfox ETF Rating methodology and sample scorecard
12. [ ] Install product analytics and define the weekly scorecard
13. [ ] Design the database and account architecture

## How we will use this roadmap

- We work from the Immediate Execution Queue unless a production emergency intervenes.
- When an item is completed, change `[ ]` to `[x]` and record the date or relevant link when useful.
- New ideas go into the appropriate later phase instead of interrupting the current phase.
- At the end of each phase, verify the exit gate before advancing.
- Revisit priorities monthly, but do not casually reorder dependencies.
