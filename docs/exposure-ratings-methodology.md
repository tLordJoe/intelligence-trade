# Outfox Exposure Ratings — Methodology

**Version 0.1 (draft for review) · Not yet published · Last updated: 2026-08-12**

---

## What this measures

One question, asked precisely:

> **If you put $100 into this fund, how much of it is actually working in the AI economy — and where is it concentrated?**

Thematic funds are marketed on a story. This rating replaces the story with a
number derived from disclosed holdings and a published map of the AI supply
chain. It is not a prediction, a recommendation, or a forecast of returns.

## What this is not

- **Not a buy/sell rating.** A high exposure score is not an endorsement. A fund
  can be highly AI-exposed and a poor investment.
- **Not a performance ranking.** Past returns are not an input.
- **Not personalized advice.** Every reader sees the same rating.
- **Not paid placement.** No issuer can pay to be rated, rated sooner, or rated
  higher.

## Design principles

1. **Reproducible.** Every input is public. A third party with the same filings
   should reach the same score. Where we exercise judgment, we publish the
   judgment and its source.
2. **Component scores, never a single blended grade.** One number hides
   tradeoffs. A concentrated fund and a diversified one can share an exposure
   score while being entirely different instruments.
3. **Sourced or flagged.** Every company input is marked `reported` (from a
   filing) or `estimated` (our attribution, with reasoning shown).
4. **Free forever.** The ratings themselves are never paywalled. Tools built on
   top of them may be.

---

## Layer 1 — Company AI Exposure Score (0–100)

Computed for every company on the Outfox map.

### A. Revenue attribution — up to 60 points

What share of the company's revenue derives from AI demand?

| Band | AI-derived revenue | Points |
|------|-------------------|--------|
| A | more than 75% | 60 |
| B | 50–75% | 45 |
| C | 25–50% | 30 |
| D | 10–25% | 15 |
| E | under 10% | 5 |

Assigned from segment disclosures in the most recent 10-K or 20-F where the
company reports them, and marked `reported`. Where a company does not break out
AI revenue, we assign a band from disclosed segment data plus management
commentary and mark it `estimated`, with the reasoning and source link shown on
the company page. Estimated bands are conservative: when the evidence spans two
bands, we assign the lower one.

### B. Chain criticality — up to 25 points

How replaceable is this company in the supply chain?

| Position | Points |
|----------|--------|
| Sole viable supplier | 25 |
| Duopoly or tight oligopoly | 18 |
| Competitive but specialized | 10 |
| Commodity input | 4 |

Judged on disclosed market share and the existence of qualified alternatives.
This is where the supply-chain map does work no sector classification can: a
company can be small by market cap and critical by position.

### C. Dependency breadth — up to 15 points

How much of the stack above it depends on this company?

| Breadth | Points |
|---------|--------|
| Entire stack depends on it | 15 |
| Several layers depend on it | 10 |
| One layer depends on it | 5 |

**Company score = A + B + C**, capped at 100.

---

## Layer 2 — ETF ratings

Four independent scores. They are published side by side and never averaged
into one grade.

### 1. Effective AI Exposure (0–100)

```
Effective Exposure = Σ (holding weight × that company's AI Exposure Score)
```

Read it as: *of every $100 invested, roughly $X is working in the AI economy.*
Holdings not on the Outfox map score zero — including cash, and including
companies with no identifiable AI revenue.

### 2. Stack Coverage

Which of the ten layers the fund touches, and how evenly. Reported as the
number of layers with at least 1% weight, plus a **breadth index** — normalized
entropy across layers, 0 to 100.

A fund with 90% in Processors covers the AI trade narrowly. A fund spread across
eight layers covers the supply chain. Neither is "better"; they are different
instruments, and the buyer deserves to know which one they hold.

### 3. Concentration

- **Top-10 weight** — share of assets in the ten largest positions
- **HHI** — Herfindahl–Hirschman Index across all holdings
- **Single-name maximum** — largest individual position

Reported as measurements, not judgments.

### 4. Cost & Tradability

Expense ratio, assets under management, average daily volume, and median bid-ask
spread. Sourced from the fund's prospectus and market data.

### Overlap Matrix

For every pair of rated funds, the percentage of overlapping holdings by weight.
Published as a public matrix.

This answers a question retail investors routinely get wrong: *owning three AI
ETFs is not diversification if they hold the same twelve companies.* We know of
no free, public source for this on AI-themed funds.

---

## Layer 3 — Layer scores

Each of the ten layers receives a market-cap-weighted average of its
constituents' Company AI Exposure Scores, plus concentration within the layer.
This makes the map itself measurable, and it is what the weekly Report tracks
over time.

---

## Data sources

| Input | Source | Cadence | Lag |
|-------|--------|---------|-----|
| Fund holdings | SEC **N-PORT** filings | Quarterly | up to ~60 days |
| Fund holdings (supplementary) | Issuer daily holdings files | Daily | 1 day |
| Revenue segments | SEC 10-K / 20-F | Annual | varies |
| Expense ratio, AUM | Fund prospectus | As filed | varies |
| Prices, volume | Finnhub / Yahoo Finance | Daily | delayed |
| Layer assignment | Outfox editorial map | Reviewed quarterly | — |

**SEC N-PORT is the primary source.** It is authoritative, free, permanent, and
citable. Issuer files are used to supplement between quarters and are labeled
as such wherever they change a score.

---

## Governance

- **Versioned.** This document carries a version number. Changes are logged,
  and scores computed under an older version stay labeled with that version.
- **Dated.** Every rating shows its computation date and the filing dates behind
  it.
- **Recomputed quarterly**, following the N-PORT cycle, and out of cycle when a
  fund changes its index or a company's disclosures materially change.
- **No pay-for-rating.** Payment cannot secure, accelerate, or improve a rating.
  Any commercial relationship with a rated issuer is disclosed on the rating.
- **Corrections.** Errors are corrected publicly, with the original value, the
  corrected value, and the date, kept permanently on a corrections page.
- **Challengeable.** Anyone may dispute a rating with evidence. Substantiated
  disputes are corrected and logged.

---

## Known limitations

Stated plainly, because a standard that hides its weaknesses is not a standard.

1. **Revenue attribution involves judgment.** Most companies do not report "AI
   revenue" as a segment. Estimated bands are our reasoning, not a disclosure,
   and are marked as such.
2. **N-PORT is quarterly and lagged.** A fund can change holdings between
   filings. Ratings reflect the most recent verified holdings, dated.
3. **Coverage is US-listed.** Foreign-listed suppliers appear only where they
   trade as ADRs.
4. **Chain criticality is a point-in-time judgment.** Monopolies erode. Scores
   are reviewed quarterly.
5. **Exposure is not quality.** This measures what a fund holds, not whether it
   is a good investment.

---

## Open questions for review

Marked explicitly so reviewers can attack them:

1. Are the 60/25/15 weights defensible, or should chain criticality carry more?
   The case for more: position in the chain is the differentiated insight and the
   hardest thing for a competitor to copy. The case against: revenue is the more
   objective input.
2. Should companies absent from the map score zero, or should there be an
   "adjacent" tier? Zero is simpler and harder to game; a tier is more accurate.
3. Should the breadth index reward coverage, or stay purely descriptive?
   Rewarding it embeds a view that diversification is better — arguably a
   recommendation in disguise.
4. Is quarterly recomputation frequent enough to be useful, or does it need a
   monthly supplement from issuer files?

---

*Outfox Markets publishes information and analysis. Nothing here is investment
advice, and Outfox is not an investment adviser. Ratings measure disclosed
exposure to the AI supply chain — not investment merit.*
