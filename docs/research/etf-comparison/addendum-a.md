# Addendum A — Starter 5, XLK/XLU Profiles, Overlap Correction, Vendor Verification

**Date:** 2026-09-05 · **Status:** research and specification only · **Applies to:** `docs/research/etf-comparison/implementation-packet-v2.md`

This addendum amends the active packet. It does not replace it. Where the two conflict, **this addendum controls** for sections 2.2, 4.7, 8, 11 and 12 of the packet; everything else in the packet stands unchanged. No application code was edited.

Three findings here overturn conclusions in the active packet. They are flagged **CORRECTION** and listed in §10.

---

## 1. The Starter 5

| Slot | Ticker | Category | Role in the demonstration |
|---|---|---|---|
| 1 | **VOO** | Broad market | Broad large-company exposure; the reference line |
| 2 | **QQQ** | Technology and growth | Nasdaq-100 growth exposure |
| 3 | **XLK** | Technology and growth | Technology-sector exposure |
| 4 | **SMH** | Semiconductors | Semiconductor exposure |
| 5 | **XLU** | Power and utilities | Utilities and power exposure |

**SOXX is not in the Starter 5.** It moves to the semiconductor **category comparison**, where SMH versus SOXX is the canonical pair. SOXX remains a first-class fund in the dataset, carries the same data-quality gates, and is the primary test case for the corporate-action system in §6. It simply does not occupy a second semiconductor slot in the default view.

**Simplest two-fund example:** VOO versus SMH, unchanged from the packet.

---

## 2. Primary-source profiles — XLK and XLU

### 2.1 Identifiers — verified firsthand

Retrieved directly from `https://www.sec.gov/files/company_tickers_mf.json` on 2026-09-05:

| Ticker | CIK | Series ID | Class ID | CUSIP | ISIN |
|---|---|---|---|---|---|
| **XLK** | 1064641 | S000006415 | C000017601 | 81369Y803 | US81369Y8030 |
| **XLU** | 1064641 | S000006416 | C000017602 | 81369Y886 | US81369Y8865 |

**XLK and XLU share one CIK.** They are separate series of the same registrant. A CIK-level join returns both funds plus dozens of siblings and is a defect, not a shortcut. **The series identifier is the only thing that separates them.** This is a stronger version of the share-class warning already in the packet, and it applies to every Select Sector SPDR fund.

### 2.2 Issuer and structure

| | **XLK** | **XLU** |
|---|---|---|
| Full legal name | State Street Technology Select Sector SPDR ETF | State Street Utilities Select Sector SPDR ETF |
| Registrant | Select Sector SPDR Trust (renamed from "Sector SPDR Trust" 2004-11-29), Massachusetts business trust formed 1998-06-10, file nos. 333-57791 / 811-08837 ([485BPOS](https://www.sec.gov/Archives/edgar/data/1064641/000119312526027312/d15107d485bpos.htm)) | same |
| Series status | Separate, non-diversified series | Separate, non-diversified series |
| Adviser | SSGA Funds Management — **no sub-adviser** | same |
| Distributor | **State Street Global Advisors Funds Distributors, LLC effective 2025-12-01** (previously ALPS) | same |
| Structure | Open-end management company; **relies on Rule 6c-11**, confirmed in Form N-CEN `relyOnRuleType` ([N-CEN](https://www.sec.gov/Archives/edgar/data/1064641/000141036825034452/primary_doc.xml)) | same |
| Exchange | NYSE Arca | NYSE Arca |
| Pending relief | 40-APP/A, file 812-15653, seeking multi-class ETF and mutual-fund-class relief ([40-APP/A](https://www.sec.gov/Archives/edgar/data/1064641/000119312525225139/d44290d40appa.htm)) | same |

**Both funds were renamed effective 2025-12-01** to the "State Street … Select Sector SPDR ETF" form. Interface copy must use the current legal name with the familiar ticker, and the profile record needs a rename history so a 2024-dated document citing the old name still reconciles.

### 2.3 Inception, index, and index history

| | **XLK** | **XLU** |
|---|---|---|
| Inception | 1998-12-16; listed 1998-12-22 | 1998-12-16; listed 1998-12-22 |
| Index | Technology Select Sector Index | Utilities Select Sector Index |
| Index provider | S&P Dow Jones Indices — **unaffiliated** with State Street | same |

**The index methodology changed on 2024-10-04.** The single-stock cap moved from 25% to 24%, and holdings above 4.8% are now proportionally reduced to an aggregate 45% with two additional steps. Verified by diffing the October 2024 Form 497 supplement ([497, 2024-10](https://www.sec.gov/Archives/edgar/data/1064641/000119312524232956/d835962d497.htm)) against the March 2024 statement of additional information ([497, 2024-03](https://www.sec.gov/Archives/edgar/data/1064641/000119312524055178/d788397d497.htm)).

This is a **methodology break inside the five-year window**, and it matters for the same reason the SOXX benchmark splice matters: a ten-year XLK return spans two different index rulebooks. It is not an error and it does not need correcting, but a long-window benchmark label must be date-qualified and the methodology page should disclose it.

### 2.4 Fees — identical for both funds

Management 0.03% + distribution and service (12b-1) 0.02% + other expenses 0.03% = **total annual fund operating expenses 0.08%, gross equals net**, no waiver (`isExpenseLimitationInPlace = N`) ([497K XLK](https://www.sec.gov/Archives/edgar/data/1064641/000119312526031725/d27499d497k.htm), [497K XLU](https://www.sec.gov/Archives/edgar/data/1064641/000119312526031732/d96415d497k.htm)).

Historical expense ratios, FY2025 back to FY2021: 0.08%, 0.08%, 0.09%, 0.10%, 0.11%. **The expense ratio is not a constant.** Any historical cost illustration must use the ratio in force in that year, or must be labelled as using the current ratio throughout.

On a $1,000 amount, the approximate current annual fund cost is **$0.80** for each.

### 2.5 Portfolio — as of 2026-09-03

| | **XLK** | **XLU** |
|---|---|---|
| Holdings | 73 (fund page) / 76 file lines | 31 (fund page) / 34 file lines |
| Net assets | $121,079.86M | $22,374.22M |
| NAV | $186.00 | $43.02 |
| Top three | NVDA 14.90%, AAPL 12.99%, MSFT 10.21% | NEE 13.07%, SO 7.46%, DUK 7.06% |
| Turnover, FY ended 2025-09-30 | 5% | 2% |

**The count discrepancy is real and must be handled, not reconciled away.** The holdings files contain **negative weights** — futures and US-dollar cash lines — and a Sector column populated entirely with `-`. Equity-only counts and total-line counts legitimately differ. **Five conflicting XLK holdings counts are live simultaneously across issuer surfaces: 70, 71, 73, 74, and 76.** The pipeline must define which count it publishes, derive it from the file it actually parsed rather than from a page label, and state the definition.

### 2.6 Performance — NAV and market price published separately

Standardized average annual total returns, period ended **2026-07-31**, 1-year / 5-year / 10-year / since-inception, in percent:

| Fund | Basis | 1y | 5y | 10y | Since inception |
|---|---|---|---|---|---|
| XLK | **NAV** | 34.26 | 18.86 | 23.68 | 10.48 |
| XLK | **Market price** | 34.28 | 18.86 | 23.68 | 10.48 |
| XLU | **NAV** | 6.29 | 9.33 | 8.83 | 7.76 |
| XLU | **Market price** | 6.30 | 9.33 | 8.83 | 7.76 |

Both bases are published, which satisfies the packet's §3 requirement. Note that the **497K performance tables dated 2025-12-31 are NAV-only** ([497K XLK](https://www.sec.gov/Archives/edgar/data/1064641/000119312526031725/d27499d497k.htm)) — a Gate A match must therefore record `BasedonNAV` and must not silently pair a filed NAV figure against a computed market-price figure.

Rule 6c-11 data as of 2026-09-03: premium/discount XLK −0.01%, XLU 0.00%; 30-day median bid-ask spread XLK 0.01%, XLU 0.02%.

### 2.7 Distributions and splits

Distributions are **quarterly** for both. Most recent ex-date 2026-06-22: XLK $0.227918, XLU $0.284415. Full history at [SSGA historical distributions](https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-etf-historical-distributions.xlsx) and the [dividend distribution schedule](https://www.ssga.com/library-content/products/fund-data/etfs/us/distribution/SPDR_Dividend_Distribution_Schedule.pdf).

**Complete split history is three events, not zero.**

| Fund | Event | Effective | Source |
|---|---|---|---|
| XLK | Reverse split **1-for-3.009** at inception | 1998-12-16 | [FY2001 N-30D](https://www.sec.gov/Archives/edgar/data/1064641/000095013501503726/b41067ssn-30d.txt) |
| XLU | Reverse split **1-for-2.906** at inception | 1998-12-16 | [FY2001 N-30D](https://www.sec.gov/Archives/edgar/data/1064641/000095013501503726/b41067ssn-30d.txt) |
| Both | **2-for-1 forward split**, payable after close | 2025-12-04 | [N-CSR/A Note 13](https://www.sec.gov/Archives/edgar/data/1064641/000119312526031265/d81465dncsra.htm) |

The December 2025 forward split sits **inside the one-year window** the interface will offer on launch day. It is not an edge case.

### 2.8 Downloadable data availability — tested

| Asset | URL | Result |
|---|---|---|
| Daily complete holdings, XLK | [holdings-daily-us-en-xlk.xlsx](https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-xlk.xlsx) | Genuine XLSX, correct Content-Type |
| Daily complete holdings, XLU | [holdings-daily-us-en-xlu.xlsx](https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-xlu.xlsx) | Genuine XLSX, correct Content-Type |
| NAV history | [navhist-us-en-xlk.xlsx](https://www.ssga.com/library-content/products/fund-data/etfs/us/navhist-us-en-xlk.xlsx), [XLU](https://www.ssga.com/library-content/products/fund-data/etfs/us/navhist-us-en-xlu.xlsx) | Genuine XLSX. **Not split-adjusted — see §6** |
| Premium/discount history | [pdhist-us-en-xlk.xlsx](https://www.ssga.com/library-content/products/fund-data/etfs/us/pdhist-us-en-xlk.xlsx), [XLU](https://www.ssga.com/library-content/products/fund-data/etfs/us/pdhist-us-en-xlu.xlsx) | Genuine XLSX |
| Product master | [spdr-product-data-us-en.xlsx](https://www.ssga.com/library-content/products/fund-data/etfs/us/spdr-product-data-us-en.xlsx) | Genuine XLSX |
| Fact sheets | [XLK](https://www.ssga.com/library-content/products/factsheets/etfs/us/factsheet-us-en-xlk.pdf), [XLU](https://www.ssga.com/library-content/products/factsheets/etfs/us/factsheet-us-en-xlu.pdf) | Genuine PDF |

**Good news relative to iShares: no HTML-masquerading-as-CSV.** Every data endpoint returned a genuine binary with a correct Content-Type header, and bad holdings paths return an honest 404. Gate G5 still applies universally — it is cheap and the iShares behaviour proves the failure mode exists — but SSGA is not itself an offender.

`ssga.com/robots.txt` sets **no Crawl-delay** and disallows `/doc/Legal`, `/disclaimers/`, and `/library-content/assets/pdf/documents`; every fund-data path used above is allowed ([robots.txt](https://www.ssga.com/robots.txt)). `sectorspdrs.com/robots.txt` returns a 302 with an empty body. `spglobal.com/spdji` **403-gates curl by user-agent**, including on robots.txt.

### 2.9 Display, caching, and redistribution restrictions

**Quoted controlling text — SSGA** ([terms and conditions](https://www.ssga.com/us/en/footer/terms-and-conditions)): permission extends only to "print-outs for your own personal use, or … a reasonable number of copies … for internal use within your organization," and database information may not "be published, redistributed or retransmitted for other than use for or on behalf of yourself."

**Quoted controlling text — S&P Dow Jones Indices** ([terms of use](https://www.spglobal.com/spdji/en/terms-of-use/)): "You agree not to copy, reproduce, modify, display, perform, publish, distribute, transmit, broadcast, circulate, create derivative works from, store, or link to the web site or any Content without the express prior written consent of S&P Dow Jones Indices."

**Legal fact:** commercial republication by an unaffiliated third party is prohibited by both the issuer's and the index provider's terms absent written authorization. Note that the S&P DJI clause expressly reaches "create derivative works from" and even "link to."

**Unaddressed, not permitted:** SSGA's terms say nothing about automated access or caching. Silence is not a grant. Treat it as unresolved and tag the data `permission_pending`, consistent with the packet's §5.4.

**Uncertainty, restated:** whether these contractual restrictions bind a party who never assented, for data Rule 6c-11 compels the fund to publish free of charge, remains unresolved by any source located in this or the prior research. Do not treat either answer as settled.

### 2.10 Pipeline hazards specific to these two funds

1. **The NAV history file is not split-adjusted.** XLK prints 291.04 on 2025-12-04 and 146.62 on 2025-12-05 — a fabricated −49.6% day. Distribution history is likewise unadjusted. **This is the single most important finding in this addendum** and it drives §6.
2. NAV history begins **2003-12-01**, not at the 1998 inception. A "since inception" claim cannot be computed from this file.
3. XLK dividend history has **multi-year gaps**, 1999 through 2002.
4. Holdings files carry **negative weights** and an all-`-` Sector column.
5. Fund pages **mix as-of dates** — 2026-09-03 portfolio data displayed beside 2026-07-31 performance. Never inherit a single page-level as-of date for every value on that page.
6. A **silent slug rewrite**, `…spdr-fund-xlk` to `…spdr-etf-xlk`, resolves through a four-hop redirect.
7. **Four different issuer domains** are cited authoritatively across filings, including `sectorspdr.com` without the trailing "s" inside Form N-CEN.
8. The FY2025 annual report exists as **both N-CSR and N-CSR/A**. The amendment carries the split note. Always prefer the amendment and record `is_amendment`.
9. N-CEN still carries **pre-rename fund names**, and the distributor appears as both "Inc." and "LLC."
10. **N-PORT must be queried as `NPORT-P`** — the literal form type `N-PORT` returns an empty feed.
11. **Sibling tickers XLKI and XLUI** are monthly-paying funds that share the same issuer data files. Naive parsing cross-contaminates them with XLK and XLU. This is the series-identifier warning from §2.1 with a concrete failure mode.
12. Guessed footer and legal URLs return **HTTP 200 on the wrong page** rather than 404 — a soft-404 pattern that Gate G5's payload validation should catch.

---

## 3. Fund-category framework

Categories are assigned by **disclosed methodology**. Prospective or actual advertiser, sponsor, or partner status is **never** an input to category membership, ordering, or inclusion, and this exclusion is stated on the methodology page.

### 3.1 Categories

| Category | Definition basis |
|---|---|
| Broad market | Prospectus-stated objective tracks a broad, multi-sector equity index with no sector or theme restriction |
| Technology and growth | Prospectus-stated objective tracks a technology-sector or growth-style index |
| Semiconductors | Prospectus-stated objective tracks a semiconductor or semiconductor-equipment index |
| Cybersecurity | Prospectus-stated objective names cybersecurity or information security |
| AI and automation | Prospectus-stated objective names artificial intelligence, robotics, or automation |
| Infrastructure | Prospectus-stated objective names infrastructure |
| Power and utilities | Prospectus-stated objective tracks a utilities-sector or power-generation index |

### 3.2 Assignment rules

1. **Primary evidence is the fund's own prospectus** — the stated investment objective, principal investment strategy, and named index. Nothing else may originate a category assignment.
2. **Secondary evidence is the index provider's published methodology**, used only to resolve an ambiguous prospectus.
3. **A quantitative sanity check** is recorded but is not dispositive: the share of complete holdings weight falling in the category. A fund whose prospectus names a category but whose holdings do not support it gets a published note, not a silent reclassification.
4. **A fund may belong to more than one category**, capped at two. QQQ and XLK are both "technology and growth"; VOO is "broad market" only. Multi-category funds display all their categories.
5. **Every assignment is dated and versioned**: `(fund_id, category, effective_from, effective_to, evidence_document_url, evidence_quote, reviewer, methodology_version)`.
6. **Point-in-time correctness.** A category view as of a past date uses the assignment in force then. Never restate history with today's mapping.
7. **A public change log** records every addition, removal, and category rename with its date and reason.
8. **Categories are descriptive, never evaluative.** No category is presented as better, safer, or more attractive than another.

### 3.3 Relationship to the AI and data-centre stack

The category framework and the Outfox AI/data-centre stack are **different objects and must not be merged**. Categories classify **funds** from their own prospectus disclosure. The stack classifies **underlying securities** by Outfox's editorial judgment. "AI and automation" as a category means the fund says so; stack exposure means Outfox says so. Both carry disclosure, but only one is editorial, and conflating them would launder an editorial judgment into apparent fund disclosure.

---

## 4. List types and labelling

Four distinct list concepts. Each has its own label, its own method, and its own on-page disclosure. **They must never share a heading, and none may be labelled "Top 10" unless it is genuinely ranked by a published method.**

| List | What it is | How ordered | Required on-page text |
|---|---|---|---|
| **Starter 5** | A fixed, editorially chosen set of five funds spanning five categories, for first-time users | **Not a ranking.** Fixed display order by category breadth | "A starting set chosen to span different kinds of exposure. Not a ranking and not a recommendation." |
| **Category comparisons** | Funds within one category, compared against each other | Alphabetical by ticker, or by a **user-selected** column | "All funds in this category that Outfox covers. Ordering is alphabetical unless you sort." |
| **Most compared by Outfox users** | Observed pair and set frequency from Outfox's own usage | Descending count over a **stated window** | The window, the minimum count threshold, and "reflects what visitors compared, not fund quality." |
| **Historical performance leaders** | Funds ranked by a **single stated metric** over a **single stated period** | Descending on that metric | The exact metric, the exact period, the return basis, the universe considered, and "past performance is not a good predictor of future performance." |

### 4.1 Labelling rules

1. **"Top 10" is reserved for a genuine ranking** with a published method, a stated metric, and a stated universe. A coverage list, a starter set, or an alphabetical category list may **never** carry it.
2. **A coverage list is called "Funds Outfox covers,"** never a superlative.
3. **Historical performance leaders always carry their period in the heading** — "Highest 5-year NAV total return among the 31 funds Outfox covers, period ended 2026-08-31" — not "Best performers."
4. **Universe disclosure is mandatory** on any ranked list: how many funds were considered, and any selectivity applied.
5. **"Most compared" must never be ordered by performance**, and performance leaders must never be ordered by popularity. Mixing the two would make a popularity signal look like a quality signal.
6. **No composite score, no overall winner, no cross-category ranking.** Unchanged from the packet §1 and §12.21.

---

## 5. Holdings-overlap correction

**CORRECTION.** The active packet §4.7 concluded that any comparison including VOO renders the partial-overlap label. That was an over-broad inference from VOO's monthly disclosure cadence, and it is wrong. The correct rule turns on whether complete holdings **exist** for every selected fund, not on how frequently each fund publishes them.

### 5.1 The rule

**If complete licensed holdings exist for every selected fund**, compute **complete overlap** at the **latest common available as-of date** — the most recent date on or before which every selected fund has a complete holdings snapshot.

\[
\text{overlap}_{A,B} = \sum_{i \in A \cap B}\min(w_{i,A},\, w_{i,B})
\]

Display, always:

- **Each fund's own source date** — the actual as-of date of the snapshot used for that fund.
- **The common comparison date** — the single date the overlap is computed at.
- Where a fund's snapshot is older than the freshest available for that fund, say so.

**A worked case.** XLK and XLU publish complete holdings daily; VOO publishes monthly with a fifteen-day lag. On 2026-09-05, VOO's most recent complete snapshot is the 2026-07-31 month-end. The common comparison date is therefore **2026-07-31**, and XLK's and XLU's 2026-07-31 snapshots are used — not their 2026-09-03 files. The panel shows all three source dates and the common date. Complete overlap is computed, correctly, at a slightly stale but **simultaneous** date.

**The prohibition:** never pair one fund's daily snapshot with another fund's month-end snapshot and present them as simultaneous. Using SMH's 2026-09-03 holdings against VOO's 2026-07-31 holdings and calling the result today's overlap is a false statement about a five-week gap, and it is exactly the error a naive "use the latest file for each fund" implementation makes.

### 5.2 Staleness bound

The common comparison date must be within **45 calendar days** of the request date. Beyond that, show the overlap with a prominent staleness notice giving the age in days. Below the bound, the source dates alone are sufficient disclosure. The bound is 45 days because a month-end snapshot published on a fifteen-day lag is already up to 46 days old at worst, and a tighter bound would suppress a legitimately computable figure.

### 5.3 Partial fallback

**If complete licensed holdings do not exist for every selected fund**, fall back to **"Overlap among reported top holdings."** Requirements:

- The label is different, visibly, from complete overlap. Never reuse the complete-overlap heading.
- Show **how many holdings were covered on each side**, and each side's as-of date, and the common comparison date.
- State the weight fraction each side's covered holdings represent.

**Never renormalize partial holdings to 100%.** If a fund's reported top ten represent 62% of its portfolio, the weights stay at 62% and the uncovered 38% is displayed as uncovered. Renormalizing inflates every weight by a factor of 1.61 and produces an overlap figure that is not merely imprecise but systematically overstated. This is a hard rule, enforced in code, not a display convention. Partial and complete results are also never mixed in one panel and never averaged together.

### 5.4 Gate changes

Gate **G15** is replaced:

> **G15 (revised).** If every selected fund has `coverage_basis = complete` and a common as-of date exists within 45 days, compute and label complete overlap at that common date. Otherwise fall back to the partial label. In either case, block the panel unless every fund's own source date **and** the common comparison date are displayed. Reject any computation in which the selected snapshots do not share one as-of date.

New gate:

> **G18.** Partial holdings weights must sum to their true covered fraction. Any renormalization to 1.0 is a build failure. Test: a fund whose top ten cover 62% must produce weights summing to 0.62.

---

## 6. Generic corporate-action system

**The SOXX split is a test case, not a feature.** It must be handled by a general mechanism. No ticker-specific patch, no hard-coded date, no `if ticker == "SOXX"` anywhere in the codebase.

Two independent facts make this non-negotiable. SOXX has a 3-for-1 forward split effective 2026-11-04. **XLK and XLU already had a 2-for-1 forward split effective 2025-12-04, inside the one-year window**, plus reverse splits at their 1998 inception. And SSGA's own NAV history file is **unadjusted**, printing a fabricated −49.6% single-day move for XLK across the December 2025 split. A ticker-specific SOXX patch would have shipped a broken XLK chart on day one.

### 6.1 Requirements

1. A single `corporate_action` table: `(fund_id, action_type, ex_date, effective_date, ratio_numerator, ratio_denominator, source_document_url, accession_number, second_source_url, verified_at)`. Types cover forward split, reverse split, distribution, and reverse-split-at-inception.
2. **Every price series is split-adjusted before use**, on one declared convention recorded in `series_adjustment_convention`. Ratios are exact rationals — 1-for-3.009 is stored as a numerator and denominator, never as a rounded float.
3. **Adjustment is applied to the share count, never to the price**, per the packet §4.1.
4. **Every known distribution and split is checked against a second, independent source** before the series is publishable.
5. Handling is uniform across every fund in the dataset. A newly added fund inherits the whole mechanism with no code change.

### 6.2 The gate

> **G19 — corporate-action completeness and adjustment.** For every fund in a comparison, over the full requested window:
>
> **(a) Adjustment.** The price series must be split-adjusted under a declared convention.
>
> **(a1) Anomaly detection — detection only.** A single-day total return beyond ±35% is an **anomaly requiring investigation**. It is **not** evidence of a split and must never be treated as one. The threshold's only function is to stop the row from rendering and raise it for review. The XLK 2025-12-05 −49.6% print must trip this on unadjusted input, and must not trip it after adjustment — but tripping it proves only that something is wrong, not what.
>
> **(a2) Resolution — evidence required, no inference.** A tripped anomaly may be cleared **only** by one of:
>
> - an authoritative primary record of the corporate action (an SEC filing with an accession number, or an exchange or issuer corporate-action notice), or
> - agreement between **two independent sources** on the ratio and effective date.
>
> Absent one of those, the anomaly stays unresolved and the fund and window stay quarantined. Legitimate causes other than a split include a vendor data error, a currency or unit change, a feed gap, a mis-keyed decimal, a reverse split, a large special distribution, a share-class change, or a genuine market move. **The system must never synthesise, infer, or back out a split ratio from the size of a price move.** No `corporate_action` row may be created by the detector; rows come only from a sourced record carrying `source_document_url` and, where applicable, `accession_number`. A ratio derived from a price gap is a fabricated record and is a build failure.
>
> **(a3) Recorded outcome.** Every tripped anomaly gets a stored disposition — `confirmed_action`, `vendor_error`, `genuine_move`, or `unresolved` — with its evidence reference. An anomaly cleared as `genuine_move` requires the same two-source agreement as an action; a large real move is a factual claim about the market and needs corroboration too.
>
> **(b) Second-source agreement.** Every split ratio and effective date, and every distribution amount and ex-date, must match an independent second source within tolerance — exact match on split ratio and date, and one cent or 0.5% on distribution amount, whichever is looser.
>
> **(c) Completeness.** The count of distributions per fiscal year must match the fund's prospectus-stated frequency, or carry a recorded exception. XLK's 1999–2002 dividend gap is a recorded exception, not a silent pass.
>
> **(d) Forward-looking registration.** An announced-but-not-yet-effective action must be present before its effective date. SOXX's 2026-11-04 split and any future analogue are covered by the same rule. Absence is a build failure, superseding the ticker-specific Gate G8.
>
> **Failure action:** quarantine the affected fund and window; do not render. A quarantine is visible in monitoring as a corporate-action failure, distinguishable from a vendor outage.

Gate **G8** in the packet is replaced by G19(d). The ticker-specific formulation is withdrawn.

---

## 7. Reconciliation gates — preserved, with worse coverage

The packet's §6.3 two-gate design **stands unchanged**. Both gates are preserved exactly:

- **Gate A** — reproduce historical SEC-filed standardized returns at their original measurement dates, only where all seven match conditions of §6.2 are satisfied.
- **Gate B** — validate current rolling interactive returns against an independently licensed source, labelled as agreement between two computations rather than validation against an authority.

**New finding: Gate A coverage across the Starter 5 plus SOXX is one fund of six.** Re-examining the 2026Q2 Risk/Return Summary file for the new funds:

- XLK class C000017601 and XLU class C000017602: **zero rows.** Their series identifiers S000006415 and S000006416 also return zero rows.
- The Select Sector SPDR Trust **did** file a 485BPOS in that quarter, accession `0001193125-26-177416`, contributing 77 rows. **But those rows cover eleven entirely different series** (S000093831 through S000093841, classes C000262279 through C000262289 — newly registered funds), **and contain no return tags at all** — only `ExpensesOverAssets`, `ManagementFeesOverAssets`, `OtherExpensesOverAssets`, `DistributionAndService12b1FeesOverAssets`, `PortfolioTurnoverRate`, and expense-example tags.

**The lesson generalizes:** the presence of a registrant's filing in a quarter tells you nothing about whether your fund's standardized returns are in that quarter's dataset. Coverage must be probed per series and per class, per quarter, and the probe must look inside `otherdims`.

Combined with the earlier finding that only VOO among VOO, QQQ, SMH and SOXX appears in 2026Q2, **Gate A can currently validate the engine against one fund: VOO.** That is still enough to prove the engine correct — one exact reproduction against a filed figure is a real proof — but it must be reported honestly as 1-of-6 coverage, and coverage must be accumulated backward across earlier quarterly files rather than assumed.

The XLK and XLU 497K performance tables dated 2025-12-31 are **NAV-only**, so where those become the Gate A target the `measure` must be recorded as `BasedonNAV` and no market-price comparison may be attempted against them.

---

## 8. Twelve Data Venture — direct verification

**CORRECTION, and it is severe.** The packet §11.2 recommended Twelve Data Venture at $499/month as the production primary source, on the basis that it was the lowest published display tier bundling ETF reference data with prices. Direct verification of Twelve Data's own current documents shows **the price was wrong in both directions and the bundling claim was wrong.**

### 8.1 Corrections to the packet

**Venture starts at $149/month, not $499.** Venture is one tier with three published credit configurations — $149, $299, $499 — and **all three carry `External display data access`** ([business pricing](https://twelvedata.com/pricing-business), [machine-readable pricing](https://twelvedata.com/pricing.md)). The comparison table reads "Venture From $149 /mo"; the $299 and $499 rows are described as "More throughput on the same Venture feature set" and "Top of Venture tier." **The extra $350 buys throughput, not rights.** Venture is **self-serve**; only Enterprise and above are contact-sales.

**ETF reference data is not on Venture at any price.** All five `/etfs/world/*` endpoints carry an identical note: **"available on the Ultra plan (individual) and the Enterprise plan (business) and above."** That gates `expense_ratio_net`, `nav`, `net_assets`, `share_class_inception_date`, and `top_holdings` ([ETF all-data docs](https://twelvedata.com/docs/llms/etfs/etf-all-data.md), [composition](https://twelvedata.com/docs/llms/etfs/etf-composition.md)). Twelve Data's support FAQ confirms **"we don't offer datasets separately."** So **Outfox's expense ratios and holdings overlap are unavailable on Venture**, and the required tier is **Enterprise at $1,099/month**.

**One thing genuinely better than the packet claimed:** Twelve Data does expose `nav` and `expense_ratio_net` **for ETFs**, with IVV as the documented example. It does **not** have Tiingo's mutual-fund-only NAV limitation. `/time_series`, `/dividends`, `/splits`, `/profile`, and `/statistics` **are** available on Venture.

### 8.2 The thirteen rights, question by question

| # | Right sought | Verdict | Controlling text |
|---|---|---|---|
| 1 | Public display on Outfox | **CONTRADICTORY — written vendor confirmation required** | Pricing grants "External display data access" ([pricing-business](https://twelvedata.com/pricing-business)), but Terms §2.2(e) permits external display **"only if and as expressly authorized by a Redistribution Rights Add-On or separate written agreement"**, and §14.5 makes the Terms operative ([terms](https://twelvedata.com/terms)) |
| 2 | Derived charts, rankings, comparisons | **PARTLY PERMITTED, with a live risk** | **No clause bars publishing analysis of the data** — a genuine advantage over Tiingo. But §2.3(d) prohibits "Use the Platform to build competitive products or services" and §2.3(k) prohibits "Combine Data with other sources to create competing products without permission" ([terms](https://twelvedata.com/terms)) |
| 3 | Adjusted ETF price history | **PERMITTED, split-adjustment only** | `/time_series` needs no tier; full history from first trading date, 5,000 points per request ([time-series docs](https://twelvedata.com/docs/llms/market-data/time-series.md)). `adjust` accepts `all`/`dividends`, but support states **"All prices are adjusted to … splits"** and directs dividend adjustment **client-side** ([are the prices adjusted](https://support.twelvedata.com/en/articles/5179064-are-the-prices-adjusted)). **Dividend adjustment is unconfirmed** |
| 4 | Distributions and splits | **PERMITTED on Venture** | `/dividends` and `/splits` ([dividends](https://twelvedata.com/docs/llms/fundamentals/dividends.md), [splits](https://twelvedata.com/docs/llms/fundamentals/splits.md)) |
| 5 | Caching and retention | **PROHIBITED BEYOND AN UNDEFINED LIMIT; deletion is hard** | §2.3(g) forbids caching "beyond permitted timeframes specified in the Documentation" — **no such timeframe exists in the Documentation**, a broken cross-reference. §16.2: **"All Data must be deleted within 30 days"** and **"Certification of deletion required if requested"** ([terms](https://twelvedata.com/terms)) |
| 6 | Published volatility and drawdown | **SILENT — written vendor confirmation required** | No prohibition on publishing analysis. But Twelve Data sells `/etfs/world/risk` ([risk docs](https://twelvedata.com/docs/llms/etfs/etf-risk.md)), so §2.3(d) competitive-products risk attaches |
| 7 | Published hypothetical growth | **SILENT — written vendor confirmation required** | Same posture as #6; `/etfs/world/performance` is a sold product ([performance docs](https://twelvedata.com/docs/llms/etfs/etf-performance.md)) |
| 8 | Advertising-supported commercial use | **APPARENTLY PERMITTED — confirmation advisable** | Commercial use is contemplated ([commercial and personal usage](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage)); no clause addresses advertising monetisation specifically |
| 9 | Redistribution to anonymous visitors | **UNRESOLVED AND THE HIGHEST RISK IN THE STACK** | Anonymous visitors are not "Authorized Users" (defined as employees, contractors, systems), so serving them is literally "publication … of Data to third parties" = **Redistribution** under §1. Venture grants "External display"; Enterprise grants "External distribution"; **neither term is defined anywhere in the Terms.** The Venture card says *"client-facing"* — Outfox's visitors are not clients ([terms](https://twelvedata.com/terms)) |
| 10 | Later/downstream subscriber use | **NOT ON VENTURE** | Requires Enterprise "External distribution" |
| 11 | Exchange or provider fees | **ALL-IN for this use case, with a reservation** | **"No additional exchange fees are required to access the default feed"**, and end-of-day **"does not require additional licensing and covers 100% of total US trading volume"** ([US equities market data](https://support.twelvedata.com/en/articles/9935903-us-equities-market-data), [EOD pricing](https://support.twelvedata.com/en/articles/12682324-end-of-day-eod-pricing-market-data)). But §3.1(c) reserves pass-through of **"exchange fees or professional subscriber rates"**, and **no fee schedule and no professional-subscriber page is published** |
| 12 | Attribution | **MANDATORY AND SPECIFIC** | **"Data provided by Twelve Data"** as a **dofollow** link, **"clearly visible near the displayed data"**, in **each relevant section**. Waivable only via Enterprise+ white-label ([attribution guidelines](https://support.twelvedata.com/en/articles/12647398-attribution-guidelines-for-using-twelve-data)) |
| 13 | Outfox's own API or bulk download later | **NOT ON VENTURE — and §2.3(d) risk** | Requires Enterprise external distribution; an Outfox data product is the clearest possible "competitive product" |

### 8.3 Two structural findings

**There is an anti-competition clause, and it is broader than Tiingo's.** Terms §2.3(d) prohibits "Use the Platform to build competitive products or services" — bare, undefined, no "similar" qualifier, no carve-out. Twelve Data sells the exact outputs Outfox plans to publish free: `/etfs/world/performance`, `/etfs/world/risk`, `/etfs/world/composition`. **This is a live commercial risk, not boilerplate.** Twelve Data is cleaner than Tiingo on the second limb — no clause bars publishing analysis of the data, and only non-public contract terms are confidential under §1 and §7.1(b).

**No headcount, revenue, or company-size restriction exists on any tier.** Headcount appears only in optional startup-discount eligibility. This is a real advantage over Tiingo's sub-five-employee cap on its display tier.

### 8.4 Revised cost picture

| Configuration | Price | What it actually delivers |
|---|---|---|
| Venture entry | $149/mo | Prices, dividends, splits, profile, statistics + "External display" — **no expense ratio, no NAV field, no holdings** |
| Venture top | $499/mo | Same rights, more throughput |
| **Enterprise** | **$1,099/mo** | Adds `/etfs/world/*`: expense ratio, NAV, net assets, inception, top holdings + "External distribution" |

**The realistic figure for the packet's intended feature set is Enterprise at $1,099/month — about $13,200/year — not $6,000.** And even Enterprise does not resolve question 1 or question 9, because §2.2(e) points to a Redistribution Rights Add-On or separate written agreement that is not publicly priced. **Treat the vendor line as unpriced pending written confirmation.** Documents that do not exist publicly: any DPA, any standalone service-level document, any exchange-fee schedule, any professional-subscriber page. `twelvedata.com/legal` and `/previous-terms` both 404; the Terms is the only contract, its §15 commits to 99.9% against 99.95% advertised elsewhere, and §17 is the acceptable-use policy.

### 8.5 Consequence for the source stack

The packet §11.2 production stack is **not confirmed**. Twelve Data remains the leading candidate, but:

- **Week one is unaffected.** The trial covers prices, dividends, and splits, which is what week one needs. Expense ratios come from Form 497K filings — free, authoritative, and already the packet's stated source.
- **For production, EDGAR should remain the source of record for expense ratios, net assets, turnover, and distribution policy** even after a vendor is signed. It is free, it is authoritative, it carries an accession number, and it removes the single most expensive line from the vendor requirement. The $950/month delta between Venture entry and Enterprise buys reference data that EDGAR supplies for nothing.
- **Holdings remain the genuinely hard line item.** Neither Venture nor EDGAR N-PORT gives licensed daily complete holdings for every fund. This is unresolved.
- **Gate B still requires a second licensed source** and is still unpriced.

---

## 9. Amendments to the packet's acceptance criteria

The packet §12 criteria stand, with these changes. Numbering continues from 22.

**Replaced**

- **§12.5 replaced by 12.5R.** The corporate-action system is generic. A repository-wide search for any fund ticker inside conditional logic returns nothing. Synthetic runs across **XLK's 2025-12-04 2-for-1**, **XLU's 2025-12-04 2-for-1**, **SOXX's 2026-11-04 3-for-1**, and **XLK's and XLU's 1998-12-16 reverse splits at exact rational ratios** all produce continuous total-return indices with no discontinuity.
- **§12.19 replaced by 12.19R.** A comparison including VOO computes **complete** overlap at the latest common as-of date when complete holdings exist for every selected fund, and displays each fund's source date plus the common comparison date. It falls back to the partial label only when complete holdings are genuinely unavailable for some selected fund.

**New**

23. All five Starter 5 funds — VOO, QQQ, XLK, SMH, XLU — resolve by SEC series and class identifier. **XLK and XLU are distinguished by series identifier alone**, and a regression test confirms a CIK-level lookup for 1064641 is not used anywhere.
24. XLKI and XLUI do not contaminate XLK or XLU despite sharing issuer data files.
25. Ingesting SSGA's unadjusted NAV history for XLK trips Gate G19(a1) on the 2025-12-05 −49.6% print, and passes after split adjustment.
25a. **No `corporate_action` row can be created by the anomaly detector.** A unit test feeding a fabricated −50% single-day move with no sourced action available produces an `unresolved` disposition and a quarantine — never an inferred 2-for-1 row. Attempting to write a `corporate_action` row without a `source_document_url` fails the build (G19(a2)).
25b. Every tripped anomaly stores a disposition of `confirmed_action`, `vendor_error`, `genuine_move`, or `unresolved` with its evidence reference; an unresolved anomaly keeps the fund and window quarantined and the comparison unrendered (G19(a3)).
26. Every split ratio and distribution in the dataset matches a second independent source before the series is publishable (G19(b)).
27. SOXX's 2026-11-04 split is registered before its effective date **through the generic mechanism**, with no ticker-specific code path (G19(d)).
28. Partial holdings weights sum to their true covered fraction; a renormalization to 1.0 fails the build (G18).
29. No holdings panel renders without every fund's own source date and the common comparison date (G15 revised).
30. A comparison whose selected holdings snapshots do not share one as-of date is rejected.
31. The common comparison date is refused beyond 45 days without a prominent staleness notice.
32. XLK's and XLU's expense ratios resolve to 0.08% with an as-of date and a source 497K accession number, and a historical cost illustration uses the ratio in force in that year or is labelled as using the current ratio throughout.
33. No value inherits a page-level as-of date. XLK's 2026-09-03 portfolio data and 2026-07-31 performance data carry different as-of dates in the same view.
34. The FY2025 N-CSR/A is preferred over the N-CSR and `is_amendment` is recorded.
35. N-PORT retrieval uses form type `NPORT-P`.
36. Every category assignment carries its evidence document URL, evidence quote, effective dates, and methodology version. A category view as of a past date uses the mapping in force then.
37. Advertiser, sponsor, and partner status is not an input to any category assignment, list ordering, or inclusion decision — verified by a code path review and stated on the methodology page.
38. Category assignment and AI/data-centre stack mapping are separate tables with separate methodology pages and are never merged in a single display claim.
39. The string "Top" followed by a number does not appear in any heading unless that view is a genuine ranking with a published method, a stated metric, a stated period, and a stated universe.
40. "Most compared by Outfox users" displays its window and minimum count and is never ordered by performance; "Historical performance leaders" displays its metric, period, basis, and universe size and is never ordered by popularity.
41. The Starter 5 view carries the text "Not a ranking and not a recommendation."
42. Any Twelve Data display carries "Data provided by Twelve Data" as a dofollow link, clearly visible near the data, in each relevant section — or the vendor is not used in production.
43. No production dependency exists on Twelve Data `/etfs/world/*` endpoints unless an Enterprise subscription is active; expense ratios, net assets, and turnover come from EDGAR.

---

## 10. Corrections to the active packet, consolidated

| # | Packet section | What it said | What is correct |
|---|---|---|---|
| 1 | §4.7, §12.19 | Any comparison including VOO renders the partial-overlap label | Complete overlap is computed whenever complete holdings exist for every selected fund, at the latest **common** as-of date. VOO's monthly cadence changes the date, not the method (§5) |
| 2 | §11.2 | Twelve Data Venture at $499/mo bundles ETF reference data with prices | Venture starts at **$149/mo** with identical rights at all three configurations, and **excludes** expense ratio, NAV, net assets, and holdings. Those need **Enterprise at $1,099/mo**. Terms §2.2(e) may require a further add-on for public display (§8) |
| 3 | §8 Gate G8 | Ticker-specific SOXX split pre-registration | Replaced by generic **G19**, which XLK's and XLU's 2025-12-04 split and SSGA's unadjusted NAV file prove was necessary — a SOXX-specific patch would have shipped a broken XLK chart (§6) |

Unchanged and reaffirmed: the two-gate reconciliation design (§7), the net-asset-value default basis, the mixing prohibition and Gate G10, the Yahoo exclusion, the benchmark and index licensing posture, and the separation of legal facts from risk-management recommendations.

---

## 11. Unresolved licensing questions

Carried forward from the packet, still open: whether issuer republication restrictions bind an unassenting third party for Rule 6c-11 data; whether an interactive calculator stays impersonal under *Lowe*; whether Rules 482 and 34b-1 reach an unaffiliated publisher; whether to license a benchmark index for charting.

New and open after this addendum:

1. **Does "External display data access" on Venture permit serving data to anonymous public visitors?** Neither "external display" nor "external distribution" is defined in the Terms, and anonymous visitors are not Authorized Users. **Highest-priority question in the stack.**
2. **Does Terms §2.2(e) require a Redistribution Rights Add-On for Outfox's use even on Enterprise**, and what does that add-on cost?
3. **Does §2.3(d) "competitive products or services" reach a free public comparison site**, given that Twelve Data sells performance, risk, and composition endpoints commercially?
4. **What is the permitted cache duration?** §2.3(g) cross-references a Documentation timeframe that does not exist.
5. **Are published volatility, drawdown, and hypothetical-growth figures permitted derived works** under the Venture or Enterprise licence?
6. **Are professional-subscriber rates or exchange pass-through fees applicable** to a public advertising-supported site? No schedule is published.
7. **Is dividend adjustment available server-side**, or must Outfox compute it, and does computing it create a derived work needing consent?
8. **Would an Outfox API or bulk-download product ever be licensable**, at what tier and price?
9. **Will SSGA grant written permission** to display and cache XLK and XLU holdings, NAV, and distribution data commercially? SSGA's terms are silent on automated access and caching, and silence is not a grant.
10. **Will S&P Dow Jones Indices' terms reach Outfox's display of XLK and XLU holdings**, given that the S&P DJI clause expressly covers "create derivative works from" and "link to," and that the holdings reveal the index constituents?
11. **Does the 2024-10-04 Select Sector index methodology change** require any disclosure Outfox is not already planning for a ten-year XLK window?

The full Twelve Data report ends with 25 numbered questions written to be pasted directly into an email to the vendor. Nothing in §8 should be treated as settled until those are answered in writing.

---

## 12. Verification note

Verified firsthand by the author of this addendum, not taken from secondary reporting: the SEC series and class identifiers for XLK and XLU from `company_tickers_mf.json`; the shared CIK 1064641; zero rows for both funds' class and series identifiers in the 2026Q2 Risk/Return Summary dataset; and the content of accession `0001193125-26-177416` — 77 rows covering eleven unrelated series S000093831 through S000093841 and classes C000262279 through C000262289, carrying only fee-table and turnover tags and no return tags at all.

Fund attributes, endpoint behaviour, split history, and issuer and index-provider terms for XLK and XLU were established by dedicated primary-source research against SEC EDGAR, ssga.com, and spglobal.com, and are cited inline. Twelve Data findings were established by direct retrieval of Twelve Data's own pricing, terms, documentation, and support articles. Where a value could not be confirmed from a fetched page it is marked `n.a.`. Contract language is quoted rather than paraphrased; every conclusion that rests on inference rather than quoted text is labelled as requiring written vendor confirmation.
