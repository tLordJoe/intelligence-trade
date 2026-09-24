# Outfox competitive baseline

Status: product constraint approved by Joe  
Recorded: September 24, 2026

## Governing decision

Outfox may offer the same broad product categories as established alternative-data competitors. Brand, design, explanation, evidence quality, and the way those capabilities work together are valid sources of differentiation. We will not remove a useful capability merely because a competitor already offers it.

Quiver's public offering is the minimum competitive reference set for planning. This is a category baseline, not permission to copy Quiver's wording, visual design, proprietary models, data, or unsupported performance claims. Every Outfox implementation must use Outfox's own sources, methods, interface, and disclosures.

## Baseline capability set

### Public data and research

- Congressional trading, with House and Senate coverage
- Corporate-insider transactions
- Institutional holdings and reported quarter-to-quarter changes
- Government contracts
- Corporate lobbying
- Media stock picks
- Search-interest trends
- Corporate-flight activity
- Inflation forecasts or comparable macro signals
- Social-media trends
- App-store ratings
- U.S. patents
- Stock, politician, insider, manager, fund, and dataset-specific research pages

### Member and research tools

- Data-driven strategies with published methodology and limitations
- Alerts
- Politician portfolio and performance views
- Stock screening across datasets
- Congressional and institutional backtesting
- Explainable stock scoring or bull/bear analysis
- Watchlists
- Exportable data
- Useful editorial, video, and educational material that explains what the evidence means

### Distribution and commercial access

- A documented, dependable API
- A read-only MCP server that exposes approved Outfox datasets to compatible assistants
- Connector-directory distribution where available, including Claude and other supported clients
- Website, email/newsletter, and mobile-friendly access
- Partnership evaluation for capabilities Outfox should not build alone

## Current execution order

1. Finish the four core evidence lanes: House, Senate, corporate insiders, and institutional holdings.
2. Make those lanes understandable on the website through profiles, comparisons, source links, limitations, and contextual explanations.
3. Turn the stable shared data contract into a sellable API.
4. Expose the same approved read-only capabilities through an Outfox MCP server and pursue connector-directory listings.
5. Build alerts, screening, watchlists, exports, backtests, portfolios, and editorial workflows on top of that reliable base.
6. Evaluate broader datasets and partnerships against the remaining baseline.

This ordering is sequencing, not deletion. Items later in the list remain part of the baseline unless Joe explicitly changes the product direction.

## Quiver developments that changed urgency

- Quiver publicly launched a remote MCP server and, on September 22, 2026, announced that it was listed in Anthropic's Claude connector directory. It exposes 18 tools and requires an active Quiver API subscription. This validates API-to-MCP distribution as a product and acquisition channel, not a novelty.
- Quiver's September 20, 2026 newsletter combined automated insider stories, congressional performance, editorial interpretation, a new API endpoint, and MCP promotion. Outfox therefore needs both dependable data access and a repeatable explanation/editorial layer.

References:

- https://quiverquant.beehiiv.com/p/quiver-is-now-a-claude-connector
- https://quiverquant.beehiiv.com/p/a-gamestop-director-just-bought-1m-of-stock
- https://www.quiverquant.com/
- https://www.quiverquant.com/quantbase/

## Partnership baseline

Quiver describes its Quantbase relationship as a copy-trading distribution partnership: Quiver builds and markets data-derived strategies, while selected strategies are deployed through Quantbase's investment platform. It is not merely a data-source partnership.

Outfox should evaluate partners when they can add a regulated or operational capability faster and more credibly than an internal build. Initial partnership categories to investigate are:

- strategy execution or model-portfolio distribution;
- brokerage or registered-investment-platform infrastructure;
- market-data and ETF-holdings distribution;
- email, alert, and mobile delivery;
- API and MCP distribution channels.

No partner should influence Outfox rankings or evidence. Any execution/copy-trading partnership requires separate legal, compliance, economics, custody, disclosure, and reputation review before it becomes a product commitment.

## Non-deviation checks

Before closing a roadmap or release review, verify:

1. Does the roadmap still retain every baseline category?
2. Are the four core evidence lanes moving toward complete, source-linked coverage?
3. Does the website explain the information rather than only display tables?
4. Are API and MCP treated as first-class distribution products?
5. Are omitted or delayed baseline items explicitly queued with a reason?
6. Are partnerships evaluated where they could create a genuine speed, trust, or distribution advantage?

