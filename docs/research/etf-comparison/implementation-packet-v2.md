# ETF Comparison Tool — Implementation Packet (Replacement, v2)

**Date:** 2026-09-05 · **Status:** research and specification only · **Supersedes:** `archive/superseded/2026-09-05-multi-fund-comparison-spec-v1-SUPERSEDED.md`

> **AMENDED BY ADDENDUM A — read both.** `docs/research/etf-comparison/addendum-a.md` (2026-09-05) amends this packet's sections 2.2, 4.7, 8, 11 and 12. Where the two conflict, **Addendum A controls** for those sections. It changes the demonstration set to the Starter 5, corrects the holdings-overlap rule, replaces Gate G8 with a generic corporate-action gate, and materially corrects the Twelve Data cost and rights findings. Everything else below stands.

This packet replaces the earlier multi-fund specification in full. The demonstration set is the **Starter 5 — VOO, QQQ, XLK, SMH, XLU** (see Addendum A §1), with **VOO versus SMH** as the simplest two-fund example. SOXX remains a first-class fund in the dataset and is the canonical semiconductor category comparison against SMH, but does not occupy a Starter 5 slot. All Fidelity mutual fund material has been removed from active product documentation and the prior packet has been archived and marked superseded.

No application code was edited.

---

## 0. What changed and why it matters

The pivot to exchange-traded funds was made for product clarity. The research shows it was also correct on the merits — but it does **not** deliver the simplification that was expected, and three of the v1 recommendations turned out to be wrong.

**Correction 1 — the vendor recommendation was wrong.** V1 recommended Tiingo at $250/month. Verification of Tiingo's current pages shows that price is real but is a **contact-sales** package restricted to firms with "less than 5 employees" ([Tiingo end-of-day product](https://www.tiingo.com/products/end-of-day-stock-price-data), [Tiingo overview](https://www.tiingo.com/documentation/general/overview)); every self-serve tier is "Internal Use Only," defined as "you may not display or share the data with another person or organization" ([Tiingo pricing](https://www.tiingo.com/pricing)). Worse for this use case, **Tiingo carries no exchange-traded fund net asset value at all** — its net asset value fields are populated only for mutual funds ([Tiingo end-of-day documentation](https://www.tiingo.com/documentation/end-of-day)). And its terms bar "publishing or otherwise making available to the public any analysis of the Service or Tiingo Data" ([Tiingo Terms of Service](https://app.tiingo.com/tos/)) — which is precisely what a derived total-return chart is. **Tiingo is not recommended.**

**Correction 2 — the reconciliation gate as designed cannot work.** V1 proposed matching computed one-, five-, and ten-year returns against the SEC Risk/Return Summary data sets within 25 basis points. Direct inspection of the 2026Q2 file shows why that fails, and the detail is in §7.

**Correction 3 — the holdings asymmetry survives the pivot, and it moved to VOO.** The expectation was that an all-exchange-traded-fund set would give uniform daily holdings. It does not. VOO is a **share class of a mutual fund**, not a standalone exchange-traded fund, so it publishes complete holdings monthly with a fifteen-day lag rather than daily under Rule 6c-11. QQQ, SMH, and SOXX publish daily. The asymmetry the pivot was meant to remove is still present in the flagship example.

**One premise is now stale in Outfox's favour.** QQQ was a unit investment trust for twenty-six years. It was reclassified as an open-end management company after the close on **19 December 2025**, and its expense ratio was cut from 0.20% to 0.18%. It now has an adviser, a Form N-1A fee table, SEC series and class identifiers, and Rule 6c-11 daily disclosure. Any design assumption that QQQ lacks fund-style fields is out of date.

---

## 1. Scope

### In scope for release one

- Two to ten exchange-traded funds compared simultaneously.
- Demonstration set: the **Starter 5 — VOO, QQQ, XLK, SMH, XLU**. Simplest example: **VOO versus SMH**. Semiconductor category comparison: **SMH versus SOXX**. Profiles for XLK and XLU are in Addendum A §2; the category framework and list-labelling rules are in Addendum A §3 and §4.
- Entered amount with a **$1,000 default** and quick amounts of $100, $500, $1,000, $5,000, plus Custom.
- One-, three-, and five-year periods where valid history exists.
- Total return on a single labelled basis; expense ratio and approximate current annual fund cost; volatility; maximum drawdown; holdings overlap; holdings concentration; Outfox AI and data-centre stack exposure; source and as-of dates; honest missing-data states.

### Explicitly out of scope

- Mutual funds. Supported later, if ever; they must not influence release-one methodology, interface copy, source selection, or engineering scope.
- Any composite score, winner, ranking, or recommendation.
- Forward projections, tax modelling, intraday pricing.
- Reproducing or charting proprietary index values (§9).

---

## 2. Primary-source fund profiles

Every value below was fetched from the cited page. Values that could not be confirmed are marked `n.a.` rather than estimated.

### 2.1 Identifiers — verified directly against the SEC

Retrieved from the SEC's own fund ticker mapping file, `https://www.sec.gov/files/company_tickers_mf.json` (28,500 rows, fetched 2026-09-05):

| Ticker | CIK | Series ID | Class ID |
|---|---|---|---|
| **VOO** | 36405 | S000002839 | C000092055 |
| **QQQ** | 1067839 | S000101292 | C000271435 |
| **XLK** | 1064641 | S000006415 | C000017601 |
| **SMH** | 1137360 | S000034411 | C000105869 |
| **XLU** | 1064641 | S000006416 | C000017602 |
| **SOXX** | 1100663 | S000004354 | C000012084 |

**These six triples are the join keys. Tickers are not.** Note that **XLK and XLU share CIK 1064641** — they are separate series of one registrant, distinguished only by series identifier, so a CIK-level join is a defect (Addendum A §2.1). This file is the authoritative, free mapping and should be refreshed weekly.

### 2.2 Fund attributes

**XLK and XLU profiles are in Addendum A §2** and are not repeated here.

| | **VOO** | **QQQ** | **SMH** | **SOXX** |
|---|---|---|---|---|
| Legal name | Vanguard 500 Index Fund, ETF Shares | Invesco QQQ Trust, Series 1 | VanEck Semiconductor ETF | iShares Semiconductor ETF |
| Registrant | Vanguard Index Funds | Invesco QQQ Trust | VanEck ETF Trust | iShares Trust |
| Structure | Open-end management company; **ETF is a share class** under Vanguard's exemptive order | Open-end management company **since 2025-12-19** (previously a unit investment trust) | Open-end management company | Open-end management company |
| CUSIP | 922908363 | 46090E103 | n.a. (ISIN US92189F6768) | 464287523 |
| Exchange | NYSE Arca | Nasdaq | Nasdaq | Nasdaq |
| Inception | 2010-09-07 (fund 1976-08-31) | 1999-03-10 | 2011-12-20 ([VanEck](https://www.vaneck.com/us/en/investments/semiconductor-etf-smh/)) | 2001-07-10 |
| Expense ratio | **0.03%** | **0.18%** (cut from 0.20% at reclassification) | **0.35%** ([VanEck](https://www.vaneck.com/us/en/investments/semiconductor-etf-smh/)) | **0.33%** |
| Net assets | ETF class $978.96B; whole fund $1,675.0B (2026-06-30) | $490.1B (2026-06-30) | $69.00B (2026-09-04) | $42.61B (2026-09-04) |
| Holdings | 506 (2026-06-30) | 102 equities + 2 short-term investment vehicles + 1 derivative (2026-06-30) | 26 (2026-09-03) | 30 (2026-09-03) |
| Index | S&P 500 | Nasdaq-100 | MVIS US Listed Semiconductor 25 Index | NYSE Semiconductor Index |
| Index owner | S&P Dow Jones Indices | Nasdaq | **MarketVector — a wholly owned VanEck subsidiary** | ICE Data Indices — unaffiliated |
| Distributions | Quarterly | Quarterly | Annual (December) | Quarterly |
| Turnover | n.a. | n.a. | 12% | 33% |
| NAV strike | 4:00 p.m. ET | 4:00 p.m. ET | 4:00 p.m. ET | 4:00 p.m. ET |
| Daily full holdings file | **No — monthly, 15-day lag** | Yes (endpoint returns HTTP 406) | Yes (XLSX, cookie-gated) | Yes (endpoint returns HTML) |
| Median bid-ask spread | 0.004% eff. 2026-08-19 | n.a. | n.a. | n.a. |

### 2.3 Four facts that change engineering scope

**VOO is a share class, not a fund.** Fund-level net assets of $1.675 trillion and ETF-class net assets of $979 billion are both correct and mean different things. Displaying the wrong one is a material error. Per Vanguard's statement of additional information, VOO publishes complete holdings **monthly with a fifteen-day lag** because it is not a standalone Rule 6c-11 exchange-traded fund. **VOO cannot support a daily complete-holdings overlap calculation.**

**SOXX has a 3-for-1 forward split scheduled, not historical.** SEC Form 497 dated 2026-08-21 sets a record date of 2026-11-03, effective after close 2026-11-04, with split-adjusted trading from 2026-11-05. This falls inside any plausible launch window and the pipeline must handle it before it happens, not after. A pre-2026 SOXX split could not be confirmed from any primary source and is marked `n.a.` — a 2016 iShares split filing found on EDGAR is for IJR, not SOXX.

**SOXX's benchmark history is spliced across three names.** PHLX Semiconductor Sector, then ICE Semiconductor from approximately 2021-06-21, then renamed NYSE Semiconductor on 2023-11-03, alongside the fund's own rename from "iShares PHLX Semiconductor ETF." Any long-window benchmark label must be date-qualified.

**SMH's index provider is owned by SMH's issuer.** MarketVector is a wholly owned VanEck subsidiary. This is not disqualifying, but it belongs in the methodology page when SMH and SOXX are compared, because SOXX's index provider is unaffiliated.

### 2.4 Issuer access behaviour, tested

| Issuer | Observed behaviour |
|---|---|
| Vanguard | No daily complete-holdings file published |
| Invesco | **HTTP 406 with an empty body** on all direct requests including the holdings CSV; served distribution table ends 2025-09-22 and premium/discount table at quarter-end 2025-09-30, both roughly a year stale |
| VanEck | Cookie-gated, not bot-gated: holdings URLs 302-loop to `/disabled-cookies/` without a session; with a seeded cookie jar a genuine XLSX returns. `robots.txt` sets `Crawl-delay: 25` and does not disallow current fund paths |
| iShares | **Fails deceptively.** The holdings CSV endpoint returns **HTTP 200 with `Content-Type: text/csv` but a 1.41 MB HTML body** — the fund landing page. Identical under no user-agent, browser user-agent, cookie jar, and Referer plus Accept headers. No 403, no CAPTCHA, not in `robots.txt` |

The iShares behaviour is the most dangerous item in this packet for a naive pipeline: a content-type check and a status check both pass while the payload is wrong. **Gate G5 in §8 exists specifically for this.**

A separate observation worth recording: three different SOXX expense ratios are live on iShares' own content network today — 0.35% in an August 2024 prospectus, 0.34% on a fact sheet, and 0.33% current — all at undated, rewritten URLs, so a stale copy is not distinguishable by URL alone.

---

## 3. Two return concepts

### 3.1 Definitions

**Net asset value total return** measures the fund's portfolio. It uses the net asset value per share struck at 4:00 p.m. Eastern, with all distributions reinvested at net asset value on the reinvestment date. It is what the fund earned.

**Market-price total return** measures the shareholder's experience. It uses the closing market price on the listing exchange, with distributions reinvested at market price. It differs from net asset value total return by the change in premium or discount over the period.

Both exist for every exchange-traded fund, and the SEC requires funds to disclose both. This is directly observable in the SEC's own data: VOO's ETF class carries average annual return values tagged `BasedonNAV` (0.1784, 0.1438, 0.1478) and separately `BasedonMarketPrice` (0.1782, 0.1438, 0.1478) for period ending 2025-12-31, alongside `AfterTaxesOnDistributions` and `AfterTaxesOnDistributionsAndSales` variants — all verified directly in the 2026Q2 Risk/Return Summary file. The two-basis distinction is a regulatory reality, not an Outfox invention.

### 3.2 Which basis the Outfox chart uses, and why

**Release one uses net asset value total return as the single default basis for the comparison chart and for every derived statistic — volatility, drawdown, and growth of the entered amount.**

Four reasons:

1. **It is the like-for-like basis.** Every fund in the set strikes net asset value at 4:00 p.m. Eastern, so the series are time-aligned across all four funds.
2. **It isolates the thing being compared.** A user comparing SMH and SOXX wants to compare semiconductor portfolios, not the two funds' momentary premium and discount behaviour.
3. **It is the basis the funds themselves lead with** in standardized disclosure.
4. **It is more stable.** Premium and discount noise adds variance that is not attributable to the portfolio.

**Market-price total return may be offered as an explicitly labelled secondary series** once net asset value history is reliable. It is not in release one.

### 3.3 The mixing prohibition

**Never place a net asset value result for one fund beside a market-price result for another without explicit per-value labelling.** This is enforced structurally, not by convention:

- Every stored return series carries a mandatory `return_basis` enum: `nav_total_return` or `market_price_total_return`.
- Every rendered chart, table, and statistic carries a visible basis label.
- Gate **G10** blocks any comparison in which the set of `return_basis` values has more than one distinct member, unless the view is explicitly a basis-comparison view for a single fund.

This is a hard failure, not a warning. A silently mixed chart is the single most misleading output this tool could produce.

---

## 4. Methodology

### 4.1 Daily total-return index

Share-accumulation, computed per fund on the chosen basis.

Initialize on the first valid date at or after the common start: `shares₀ = 1`, `TRI₀ = P₀`, where `P` is net asset value per share (or closing market price, if the basis is market price).

For each subsequent trading day *t*:

\[
\text{shares}_t = \text{shares}_{t-1} \times \text{split\_factor}_t \times \left(1 + \frac{D_t}{P^{\text{reinvest}}_t}\right)
\]

\[
\text{TRI}_t = \text{shares}_t \times P_t
\]

`split_factor` adjusts the **share count**, never the price. SOXX's 3-for-1 on 2026-11-04 sets `split_factor = 3`. If a vendor supplies an already-adjusted series, set \(D_t = 0\), do not apply splits again, and record the convention in `series_adjustment_convention`. Mixing conventions inside one computation is a build failure (Gate G9).

### 4.2 Returns

Cumulative:

\[
R_{\text{cum}} = \frac{\text{TRI}_{t_1}}{\text{TRI}_{t_0}} - 1
\]

Annualized, only for windows of at least one year, following the Form N-1A convention \(P(1+T)^n = \text{ERV}\):

\[
T = \left(\frac{\text{TRI}_{t_1}}{\text{TRI}_{t_0}}\right)^{1/n} - 1
\]

Report to the nearest hundredth of one percent. Below one year, show cumulative and say so.

### 4.3 Growth of the entered amount

\[
V_t = A \times \frac{\text{TRI}_t}{\text{TRI}_{t_0}}
\]

- **Default \(A\) = $1,000.** Quick amounts $100, $500, $1,000, $5,000, plus Custom.
- \(t_0\) is the common start across every selected fund, on the **intersection** of trading days. For VOO versus SMH that is 2011-12-20, SMH's inception. State the start date on the chart.
- Fractional shares permitted.
- **Never re-apply the expense ratio.** Net asset value is already net of fund operating expenses. This is the most common error in homemade growth calculators.
- No taxes, no commissions, no bid-ask spread, no premium or discount drag. Disclose all of these.
- Never forward-fill a missing price. A gap is a data-quality event, not an interpolation opportunity.

### 4.4 Approximate current annual fund cost

For each fund, alongside the expense ratio:

\[
\text{annual cost} \approx A \times \text{expense ratio}
\]

On a $1,000 amount that is $0.30 for VOO, $1.80 for QQQ, $3.50 for SMH, $3.30 for SOXX. Label it as an approximation on the current amount at the current expense ratio, not a projection, and not something already deducted from the growth chart — because it already is, inside net asset value.

### 4.5 Volatility

\[
\sigma_{\text{ann}} = \sqrt{252}\times\sqrt{\frac{1}{n-1}\sum(r_i-\bar r)^2}
\]

Simple daily total returns from the total-return index; sample standard deviation with \(n-1\); 252 trading days. Minimum 750 daily observations, otherwise display "insufficient history." Publish window length and basis beside the number.

### 4.6 Maximum drawdown

\[
\text{MDD} = \min_t\left(\frac{\text{TRI}_t}{\max_{s\le t}\text{TRI}_s}-1\right)
\]

Computed on the total-return index. Report peak date, trough date, magnitude, and recovery date where recovery occurred. The window must be identical for every fund in the comparison.

### 4.7 Holdings overlap and concentration

Two distinct outputs, and the distinction is a licensing and coverage fact, not a design preference.

**Complete holdings overlap** — rendered only when every fund in the comparison has licensed complete holdings as of dates within a tolerance of each other:

\[
\text{overlap}_{A,B} = \sum_{i \in A \cap B}\min(w_{i,A},\, w_{i,B})
\]

**"Overlap among reported top holdings"** — the fallback label when coverage is partial. This is a different measure over a different universe and must never be presented under the complete-overlap label. Show the count of holdings covered on each side.

**Consequence for the demonstration set — CORRECTED BY ADDENDUM A §5.** The rule turns on whether complete holdings *exist* for every selected fund, not on how often each fund publishes them. Where they exist, complete overlap is computed at the **latest common available as-of date**, with each fund's own source date and the common comparison date both displayed. VOO's monthly fifteen-day-lag cadence therefore moves the comparison date backward; it does not force the partial label. Partial holdings are never renormalized to 100%. See Addendum A §5 for the full rule and the revised Gate G15 plus new Gate G18.

**Concentration** — top-ten weight, and the Herfindahl-Hirschman index over holding weights. Both require the as-of date and the coverage basis displayed. SMH at 26 holdings and SOXX at 30 will look extremely concentrated beside VOO at 506; that is a true fact about the funds and should be presented without editorial framing.

### 4.8 Outfox AI and data-centre stack exposure

This is **Outfox's own editorial classification**, not a licensed or regulatory taxonomy, and it must be labelled that way everywhere it appears.

Required properties:

- A published, versioned methodology page describing inclusion criteria, the evidence used, and known limitations.
- A **dated mapping file**: `(security_identifier, stack_category, effective_from, effective_to, rationale, evidence_url, reviewer, mapping_version)`.
- Point-in-time correctness: exposure as of a past date uses the mapping in force on that date. Never retroactively restate history by applying today's mapping to last year's holdings.
- Every rendered exposure figure carries the mapping version and the holdings as-of date.
- A visible statement that the classification is Outfox's editorial judgment, that reasonable people may classify differently, and that it is not a licensed industry standard.

The constituent list is a **product decision requiring sign-off** and is deliberately not fixed in this packet. What is specified here is the structure, the governance, and the disclosure — inventing the membership list inside a research document would be exactly the unaccountable editorial act the methodology page is meant to prevent.

**On the SEC's free classification system:** Standard Industrial Classification codes are public domain and available from EDGAR company records, but they are coarse, assigned at registrant level, and were not designed for thematic exposure. Use them **only** where they genuinely support the analysis — for example a broad sector sanity check — and **not** as a substitute for the editorial stack, and **not** as a stand-in for the Global Industry Classification Standard, which is licensed by S&P Dow Jones Indices and MSCI and must not be reproduced without a licence. Where Standard Industrial Classification is used, tag the row `classification_scheme = "SEC_SIC"` and say so on the page.

---

## 5. Source and licensing matrix

Legal facts are quoted and cited. Risk-management recommendations are labelled as recommendations. Where a conclusion is inference rather than settled law, it says so.

### 5.1 Free and reusable

| Source | What it gives | Legal basis |
|---|---|---|
| `company_tickers_mf.json` | CIK, series, class, ticker for all four funds | SEC-published, free to reuse |
| EDGAR filings (485BPOS, 497, N-CEN, N-PORT, N-CSR) | Expense ratios, fee tables, benchmark names, turnover, distribution policy, holdings, net assets, split notices | SEC-published, free to reuse |
| Risk/Return Summary data sets | Standardized returns split by `BasedonNAV` / `BasedonMarketPrice`, expense ratios | SEC-published, free to reuse — **but see §7 for severe structural limits** |

EDGAR operational constraints: declared User-Agent required; a documented fair-access limit of ten requests per second, which was hit and enforced during this research; `data.sec.gov` does not support cross-origin requests, so a server-side proxy is required.

### 5.2 Vendors — ETF-only display use case

| Vendor | ETF prices | **ETF NAV** | Distributions / splits | Expense ratio | Complete holdings | AUM | Lowest published price with display rights | Separate agreement? | Derived-data rights | Caching |
|---|---|---|---|---|---|---|---|---|---|
| **Twelve Data — Venture** | Yes | **Yes** (`nav`) | Yes | Yes (`expense_ratio_net`) | Composition | Yes (`net_assets`) | **$499/mo, "External display data access"** ([business pricing](https://twelvedata.com/pricing-business)) | Redistribution needs a separate agreement | Not fully specified | 30-day deletion on termination |
| **EODHD** | Yes | Yes | Yes | Yes | **Full holdings keyed by ticker** ([fundamentals](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds)) | Yes | **Unpriced Enterprise**; the $399/mo Internal Use tier "explicitly forbids display" ([commercial pricing](https://eodhd.com/commercial-pricing)) | Yes | n.a. | n.a. |
| **Intrinio** | Yes | **Yes — the only real daily NAV series found**: `nav_unadjusted`, `nav_split_adjusted`, `nav_split_dividend_adjusted` ([ETF historical NAV](https://docs.intrinio.com/documentation/web_api/get_etf_historical_nav_flows_v2)) | Yes | Yes | Yes | Yes | Unpriced Enterprise | Yes | n.a. | n.a. |
| **Tiingo** | Yes | **No — NAV fields are mutual-fund only** ([end-of-day docs](https://www.tiingo.com/documentation/end-of-day)) | Yes | No | No | No | $250/mo contact-sales, under 5 employees; $500/mo at 5+ | Yes, not self-serve | **Prohibited** — bars "publishing or otherwise making available to the public any analysis of the Service or Tiingo Data" ([ToS](https://app.tiingo.com/tos/)) | Delete everything on cancellation or downgrade |
| **ETF Global via Massive** | Yes | Yes, daily | n.a. | n.a. | n.a. | n.a. | $99/mo but **"Individual use only"** ([Massive](https://massive.com/partners/etf-global)) | — | — | — |
| **Polygon.io** | Yes | No | Yes | No | No | No | $2,499/mo | — | — | — |
| **Nasdaq Data Link** | Yes | Yes | Yes | Yes | n.a. | Yes | Not published | Yes | n.a. | n.a. |
| **Alpha Vantage / Finnhub** | Yes | n.a. | Yes | Partial | Partial | Partial | **No published display tier** | Yes | — | Finnhub: delete on termination |
| **Yahoo Finance** | — | — | — | — | — | — | **None — prohibited** | — | — | — |

### 5.3 Yahoo Finance

Yahoo remains **excluded from the production architecture**, and the research does not support carving out internal prototyping either.

The controlling clause bars creating "any database… that competes with or constitutes a material substitute for the Services" ([Yahoo Terms of Service](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html)). Automated collection is separately barred: users may not "access or collect data… using any automated means" ([same](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html)). Commercial reuse is barred outright ([same](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html)).

**Legal fact:** the creation prohibition is written against the act of *creating* the database. It contains no publication requirement.

**Inference, not settled law:** because the prohibition attaches to creation rather than to publication, the usual "internal prototyping is different from production redistribution" distinction does not clearly rescue internal use here. This is a reading of the clause, not a holding, and no case authority was located either way.

**Recommendation:** do not use Yahoo for prototyping or production. The distinction between internal and published use is real in general and should be preserved in the vendor-selection framework, but it does not appear to help under this particular wording. If a business reason to revisit this ever arises, it needs counsel, not a re-read.

### 5.4 Issuer data

All four issuers prohibit commercial republication. VanEck: "No information contained on this site may be reproduced, transmitted, displayed, distributed, published or otherwise used for commercial purposes without the prior consent of VanEck." BlackRock separately bars automated collection ("robot, spider, intelligent agent…") and commercial republication.

**Legal fact:** Rule 6c-11 compels exchange-traded funds to publish daily holdings, net asset value, market price, premium or discount, and median bid-ask spread free of charge ([17 CFR 270.6c-11(c)(1)](https://www.ecfr.gov/current/title-17/chapter-II/part-270/section-270.6c-11)).

**Legal fact:** a regulatory obligation to publish is not a grant of a licence to republish. The issuer terms above are the issuers' own position.

**Uncertainty, stated plainly:** whether an issuer's contractual restriction is enforceable against a party who never assented to the terms, for data the issuer is legally compelled to publish free of charge, is **not resolved by any source located in this research**. Do not treat either answer as settled. Tag all issuer-sourced data `permission_pending` and route the question to counsel.

**Recommendation:** for release one, prefer licensed vendor holdings or EDGAR N-PORT over issuer scraping, and pursue written permission in parallel.

---

## 6. Return-calculation and reconciliation rules

### 6.1 Why the v1 gate fails

V1 assumed a rolling Outfox return could be checked against a prospectus return because both cover one, five, or ten years. Direct inspection of the SEC 2026Q2 Risk/Return Summary file shows several independent reasons this does not hold.

**A rolling five-year return ending today and a filed five-year return ending at a past fiscal year end are different measurements of different periods.** They are not expected to match and a mismatch proves nothing.

Beyond that, verified in the file itself:

- The `class` column is **empty in all 537,808 rows**. Share-class identity is carried inside the `otherdims` string as `Class=Cxxxxxxxxx;`, present on 44.7% of rows. A pipeline keyed on the `class` column returns nothing and looks like a coverage gap rather than a parsing bug.
- The `series` column is populated on only **37%** of rows.
- **There is no period-length column.** VOO's ETF class carries three `AvgAnnlRtrPct` values per measure — 0.1784, 0.1438, 0.1478 for `BasedonNAV` — all with `ddate` 20251231 and all with `iprx = 0`. Which is the one-year, which the five, and which the ten is **not recoverable from the flat file**. It must come from the source XBRL instance or the filing.
- **Coverage is per-quarter and incomplete.** In 2026Q2, only VOO's class appears. QQQ, SMH, and SOXX have **zero rows** keyed to their class identifiers. Reconciliation coverage must be accumulated across many quarterly files and will still have holes.

And the reason share-class precision matters is measurable in the same file. The four classes of Vanguard 500 Index Fund report materially different calendar-year returns for 2018: Investor −4.52%, Admiral −4.43%, ETF −4.42%, Institutional Select −4.40%. A twelve-basis-point spread inside one portfolio is larger than any sane reconciliation tolerance. Matching on ticker or fund name instead of class identifier will produce confident, wrong results.

### 6.2 Valid reconciliation requires all seven to match

A comparison between an Outfox figure and a filed figure is meaningful **only** when every one of these is identical:

1. Exact fund **and share class** — matched on the SEC class identifier
2. Return definition — average annual total return versus cumulative versus calendar-year
3. Start date **and** end date
4. Basis — `BasedonNAV` versus `BasedonMarketPrice`
5. Distribution-reinvestment treatment
6. Fee treatment — including sales load assumptions and any waiver in force during the period
7. Standardized-performance methodology — pre-tax versus `AfterTaxesOnDistributions` versus `AfterTaxesOnDistributionsAndSales`

If any one is unknown, **no reconciliation is attempted and no pass is recorded.** "Not attempted" is a distinct state from "passed" and from "failed," and it must be visible in monitoring so that absent coverage never masquerades as validation.

### 6.3 Two separate gates

**Gate A — historical standardized-return reproduction.** Purpose: prove the total-return engine is correct.

- Scope: only fund-class-period combinations where all seven conditions are satisfied.
- Method: recompute the standardized average annual total return **at its original measurement dates** — the exact fiscal-year-end window the filing used — on the matching basis and tax treatment.
- Source of truth: the filed value, with the class identifier parsed from `otherdims` and the period length resolved from the source XBRL instance or filing, never guessed from value ordering.
- Tolerance: ±25 basis points, recorded with the tolerance used.
- Failure: quarantine the fund and raise a build failure. A failure here means the engine is wrong.
- Frequency: on every engine change and on every new quarterly Risk/Return Summary release.
- Coverage: expected to be partial. Publish the coverage rate; do not manufacture coverage.

**Gate B — current rolling-return validation.** Purpose: prove the daily data feed is sane.

- Scope: the live rolling one-, three-, and five-year figures the interface actually shows.
- Method: recompute from an **independently licensed second source** on the identical window and basis and compare.
- Source of truth: none. This is agreement between two independent computations, not validation against an authority. Label it that way.
- Tolerance: ±10 basis points for a one-year window, ±25 for three and five years, on the same trading-day calendar.
- Failure: suppress the affected figure and alert; do not fail the build, because a vendor outage is not an engine defect.
- Frequency: daily.

Gate B requires a second licensed source and therefore has a cost. That is a real budget line, not an optional extra — see §11.

---

## 7. Data model

Fixed-point decimal throughout; never floating point. Raw source strings retained where byte-level provenance matters. Holdings rows live in their own table.

**Core entities:** `fund` (identity and static attributes), `fund_price_daily` (per basis), `distribution`, `corporate_action`, `holding` (as-of dated), `stack_mapping` (dated editorial classification), `computed_series`, `reconciliation_result`.

**Mandatory on every row:**

`source_document_url` · `source_type` (`sec_filing` | `sec_dataset` | `licensed_vendor` | `issuer_site`) · `accession_number` where applicable · `as_of_date` · `retrieved_at` · `source_version` (monotonic per logical record) · `supersedes_id` (null on first) · `is_restated` / `restates_ref` · `license_tag` (`public_domain` | `licensed_display` | `internal_only` | `permission_pending`)

**Mandatory on every price and return row:** `return_basis` · `series_adjustment_convention`

**Mandatory on every holdings row:** `coverage_basis` (`complete` | `top_n`) · `classification_scheme` where classified

`license_tag` is checked at render time. Anything not `public_domain` or `licensed_display` cannot reach a page. A single global rate limiter is shared across all workers and machines, consistent with the existing pipeline specification.

---

## 8. Data-quality gates

| Gate | Test | Action on failure |
|---|---|---|
| G1 | Full provenance present on every value | Quarantine |
| G2 | `license_tag` permits public display | **Block render** |
| G3 | No price gap beyond one business day unmatched to an exchange holiday calendar | Quarantine window |
| G4 | No identical price on more than three consecutive business days | Flag |
| G5 | **Payload validation, not status validation** — parse and schema-check every downloaded file; reject an HTML body regardless of a 200 status and a `text/csv` content-type header | Reject and alert |
| G6 | No observation dated before share-class inception | Reject row |
| G7 | **CLARIFIED — Addendum A §6.2(a1)–(a3).** A day-over-day move beyond the threshold is an **anomaly requiring investigation**, never evidence of a split. It may be cleared only by an authoritative primary record or two independent sources agreeing on ratio and date. Deriving a ratio from the price gap is forbidden | Quarantine pending sourced evidence |
| ~~G8~~ | **WITHDRAWN — replaced by generic Gate G19 in Addendum A §6.** The ticker-specific formulation was unsafe: XLK and XLU also split 2-for-1 on 2025-12-04, inside the one-year window, and SSGA's NAV history file is unadjusted | — |
| G9 | `series_adjustment_convention` set; no computation mixes raw and adjusted series | Build failure |
| G10 | **Single `return_basis` across every value in a rendered comparison** | **Block comparison** |
| G11 | Gate A — historical standardized-return reproduction, all seven match conditions satisfied | Quarantine fund; build failure |
| G12 | Gate B — rolling return agrees with an independent licensed source | Suppress figure; alert |
| G13 | Distribution sum per fiscal year matches issuer-published distribution history | Quarantine year |
| G14 | Every fund in a comparison shares one start date and one trading-day calendar | Block comparison |
| G15 | **REVISED — see Addendum A §5.4.** Complete overlap computed at the latest common as-of date when every fund has `coverage_basis = complete`; block unless each fund's source date and the common comparison date are shown; reject snapshots that do not share one as-of date | Fall back to "overlap among reported top holdings" |
| G16 | Every holdings and exposure panel displays its own as-of date and, for stack exposure, its mapping version | Block panel |
| G17 | Expense ratio has an as-of date and a resolvable source document | Block value |
| G18 | **NEW — Addendum A §5.4.** Partial holdings weights must sum to their true covered fraction; renormalization to 1.0 forbidden | Build failure |
| G19 | **NEW — Addendum A §6.2.** Generic corporate-action gate: split adjustment on all price series; ±35% single-day **anomaly detection only** — a trip proves something is wrong, not that a split occurred, and no `corporate_action` row may ever be synthesised from a price gap; resolution requires an authoritative primary record or two independent sources; second-source agreement on every split and distribution; per-year distribution completeness; forward registration of announced actions | Quarantine fund and window |

G5 is new in v2 and comes from observed behaviour: the iShares endpoint that returns HTML under a CSV content-type. G17 exists because three different SOXX expense ratios are currently live on the issuer's own content network at undated URLs. G8 has been withdrawn and G15 revised; G18 and G19 are added by Addendum A.

---

## 9. Benchmark and index licensing

**Legal fact — what Outfox may do.** A fund's stated benchmark is disclosed in its own prospectus. Describing SMH as tracking the MVIS US Listed Semiconductor 25 Index, or VOO as tracking the S&P 500, is repeating a factual disclosure from a public filing.

**Legal fact — what requires a licence.** Reproducing or charting an index provider's proprietary index values is a separate act. MarketVector's terms forbid derived **charts** at §4.1(c) and permit it to impose licence fees **retrospectively** at §4.2(a). ICE permits website display of end-of-day index values only by a paying subscriber and only about its own funds. S&P Dow Jones Indices requires written consent even to link. MSCI prohibits reproduction and redistribution.

**Do not assume Outfox may reproduce or chart benchmark index values. Release one names benchmarks and does not plot them.**

**The investable-proxy rule.** VOO or SPY may be presented as an **investable comparison fund** — another exchange-traded fund the user could actually buy, shown on the same net-asset-value total-return basis as everything else. They must never be labelled as the S&P 500 Index itself. A fund that tracks an index is not that index: it has an expense ratio, tracking difference, and its own distribution schedule. Interface copy must say "Vanguard S&P 500 ETF (VOO)" and never "S&P 500."

MarketVector's retrospective-fee provision deserves particular attention because it means an inadvertent charting decision can generate a backdated bill. That is a risk-management observation, not a legal conclusion.

---

## 10. Compliance posture

**Legal facts.** FINRA Rule 2210 applies to members and associated persons ([FINRA Rule 0140](https://www.finra.org/rules-guidance/rulebooks/finra-rules/0140)); Outfox is neither. Rule 482 applies to advertisements for a fund "that is selling or proposing to sell its securities pursuant to a registration statement" ([17 CFR 230.482(a)](https://www.ecfr.gov/current/title-17/chapter-II/part-230/section-230.482)); Outfox is not selling. The Marketing Rule applies to registered or required-to-be-registered advisers. Rule 156 applies to "any person" ([17 CFR 230.156](https://www.ecfr.gov/current/title-17/chapter-II/part-230/section-230.156)) but is directed at sales literature used to offer or induce the sale of investment company securities. *Lowe v. SEC* sets the publisher's-exclusion test: publications must be "bona fide" and "general and regular," and not "distributed as an incident to personalized investment service" ([Lowe v. SEC](https://tile.loc.gov/storage-services/service/ll/usrep/usrep472/usrep472181/usrep472181.pdf)).

**Uncertainty.** Whether an interactive calculator remains impersonal under *Lowe* is **not resolved** by any authority located in this research. Whether Rule 482 or Rule 34b-1 reach an unaffiliated publisher is likewise unresolved. These are open questions, not settled law, and neither should be represented as decided.

**Recommendations, offered as risk management rather than legal requirement.**

Adopt the Rule 482(d)(5) layout voluntarily: any performance measure other than standardized returns should appear alongside one-, five-, and ten-year average annual total returns, in no greater prominence. **The growth-of-$1,000 chart should never appear alone.** Carry the Rule 482(b)(3) legend in close proximity rather than in a footnote. Carry Form N-1A's two statements for growth presentations — that past performance is not a good predictor of future performance, and that the presentation does not reflect the deduction of taxes ([Form N-1A](https://www.sec.gov/files/form-n-1a.pdf)).

Follow the Marketing Rule's interactive-analysis-tool structure for the methodology page: criteria, methodology, limitations, key assumptions, a statement that results vary with each use and over time, and a description of the universe considered and any selectivity applied.

To protect the publisher's exclusion: no personalization of results against an identity, no output phrased as a recommendation, **no composite winner and no ranking**, and no content timed to specific market activity.

---

## 11. Source stacks and costs

### 11.1 Week-one demonstration stack

| Layer | Source | Cost |
|---|---|---|
| Identity and join keys | SEC `company_tickers_mf.json` | Free |
| Fund attributes: expense ratio, benchmark name, turnover, distribution policy, structure | EDGAR 485BPOS / 497 / N-CEN | Free |
| Split notice (SOXX) | EDGAR Form 497 dated 2026-08-21 | Free |
| Daily price and net asset value history | **Twelve Data Venture trial** | Trial |
| Holdings | N-PORT for all four; issuer files only if written permission arrives | Free |
| Gate A reconciliation | Risk/Return Summary quarterly files, parsing `otherdims` for class and resolving period length from the filing | Free |
| Gate B | Deferred — single source in week one; the interface labels rolling figures as unvalidated | — |

Scope: the Starter 5 plus SOXX — six funds — two-to-ten selection, ten years of daily history, nightly batch, no intraday, persistent "demonstration data as of <date>" banner. Gates G1, G2, G5, G6, G9, G10, G14, G15, G16, G18, G19 mandatory; others may warn. Expense ratios come from Form 497K filings on EDGAR, not from a vendor — see Addendum A §8.5.

**Week one succeeds only if Gate A passes for VOO**, the one fund with confirmed dataset coverage. That single reconciliation is the proof the engine is right.

### 11.2 Production stack

| Layer | Source | Notes |
|---|---|---|
| Primary daily prices, distributions, splits | **Twelve Data Venture — from $149/mo** ([business pricing](https://twelvedata.com/pricing-business)) | **CORRECTED BY ADDENDUM A §8.** Venture starts at $149/mo with identical display rights at $149, $299 and $499. It does **not** include expense ratio, NAV, net assets or holdings — those require **Enterprise at $1,099/mo** — and Terms §2.2(e) may require a further Redistribution Rights Add-On for public display. Treat as unpriced pending written vendor confirmation |
| Expense ratio, net assets, turnover, distribution policy | **EDGAR Form 497K / 485BPOS / N-CEN** | Free, authoritative, carries an accession number. Keeps the most expensive line off the vendor requirement — see Addendum A §8.5 |
| Complete holdings | **EODHD Enterprise** (unpriced) or licensed issuer files | Richest holdings schema found; display tier requires negotiation |
| Independent second source for Gate B | **Intrinio** (unpriced Enterprise) — the only vendor found selling a genuine daily net asset value series | Required for Gate B; without it Gate B cannot run |
| Free authoritative layer | EDGAR and Risk/Return Summary | Permanent, not a fallback |
| Index values | Not licensed; not charted | §9 |

**Honest cost picture — SUPERSEDED BY ADDENDUM A §8.4.** The figure stated here, roughly $6,000 per year, was itself wrong. Venture starts at $149/month and grants identical display rights at $149, $299 and $499, but excludes expense ratio, net asset value, net assets and holdings; the tier that includes them is **Enterprise at $1,099/month, about $13,200 per year**. Terms §2.2(e) may require a further Redistribution Rights Add-On that is not publicly priced. Routing expense ratios, net assets and turnover to EDGAR removes most of the delta. Holdings and the Gate B second source remain unpriced enterprise negotiations. **Treat the vendor line as unpriced pending written vendor confirmation, and treat any single-vendor plan as incomplete.**

**The rented-history trap applies to every candidate.** Tiingo requires deletion "from every system… including production systems, local storage, logs, queues, archives, backups" on any cancellation *or downgrade* ([Tiingo ToS](https://app.tiingo.com/tos/)); Twelve Data imposes a 30-day deletion; Finnhub the same. Accumulated price history is rented, not owned. Two architectural consequences: keep the total-return engine independent of any vendor's adjustment convention so a swap is survivable, and treat Rule 6c-11 issuer disclosures — which must be published daily and free — as a forward-accumulating dataset that begins the day collection starts, subject to the unresolved republication question in §5.4.

---

## 12. Engineering acceptance criteria

Each is objectively testable. All must pass before the demonstration is shown.

**Identity and data**

1. All six funds resolve by SEC series **and** class identifier; a ticker-only lookup path does not exist in the codebase, and no CIK-level lookup is used for XLK or XLU (Addendum A §9 criterion 23).
2. VOO returns ETF-class net assets, not fund-level net assets, and the distinction is visible in the interface.
3. Every displayed value renders its source and as-of date.
4. A downloaded file whose body is HTML is rejected even when the status is 200 and the content-type is `text/csv` (G5). A regression test uses the observed iShares response.
5. **REPLACED by Addendum A §9 criterion 12.5R.** The corporate-action system is generic — no fund ticker appears in conditional logic anywhere. Synthetic runs across XLK's and XLU's 2025-12-04 2-for-1, SOXX's 2026-11-04 3-for-1, and XLK's and XLU's 1998-12-16 reverse splits at exact rational ratios all produce continuous total-return indices (G19).

**Return correctness**

6. Gate A reproduces VOO's filed standardized average annual total return on the `BasedonNAV` basis at the original measurement dates within 25 basis points, with the class identifier parsed from `otherdims` and the period length resolved from the filing rather than inferred from ordering.
7. Reconciliation is refused, and recorded as "not attempted," whenever any of the seven match conditions is unknown. "Not attempted" is distinguishable from "passed" in monitoring.
8. A comparison mixing `nav_total_return` and `market_price_total_return` is blocked, not warned (G10).
9. The expense ratio is not applied a second time on top of net asset value. Test: a zero-distribution synthetic series reproduces the input price series exactly.
10. A missing price is never forward-filled; the gap surfaces as a missing-data state.

**Interface**

11. Two to ten funds selectable; below two and above ten are both refused with a clear message.
12. Default amount is $1,000; quick amounts $100, $500, $1,000, $5,000, plus Custom.
13. One-, three-, and five-year periods offered only where valid history exists for **every** selected fund; otherwise the period is disabled with the reason shown.
14. VOO versus SMH starts at 2011-12-20 and the chart states the start date.
15. The chart carries a visible total-return basis label and the required past-performance and no-taxes statements.
16. The growth chart never renders without standardized returns of at least equal prominence.
17. Expense ratio and approximate current annual fund cost display together, with the cost labelled an approximation.
18. Volatility and maximum drawdown display window length, basis, and observation count.
19. **REPLACED by Addendum A §9 criterion 12.19R.** A comparison including VOO computes **complete** overlap at the latest common as-of date when complete holdings exist for every selected fund, displaying each fund's source date and the common comparison date; it falls back to the partial label only when complete holdings are genuinely unavailable for some selected fund (G15 revised, G18).
20. Stack exposure renders the mapping version, the holdings as-of date, and the editorial-classification disclosure.
21. No composite score, no winner, no ranking, no recommendation language anywhere in the interface — enforced by a copy review checklist in the release process.
22. Missing data renders as an explicit missing state with a reason. No zeros, no blanks, no silent omission.

---

## 13. Unresolved decisions

1. **Vendor selection and true budget.** Twelve Data Venture at $499/mo is the recommendation; holdings and the Gate B second source are unpriced. Someone must decide whether to run release one without Gate B.
2. **Whether to ship without complete holdings for VOO.** The alternatives are a partial-overlap label on the flagship comparison, licensing a complete-holdings source, or dropping VOO from overlap analysis.
3. **Whether issuer republication restrictions bind Outfox** for data issuers must publish free under Rule 6c-11. Unresolved; needs counsel.
4. **Whether an interactive calculator stays impersonal under *Lowe*.** Unresolved; needs counsel before launch.
5. **Whether Rule 482 and Rule 34b-1 reach an unaffiliated publisher.** Unresolved; voluntary compliance makes it less urgent, not moot.
6. **The AI and data-centre stack constituent list**, its inclusion criteria, and who signs off on changes.
7. **Whether to license a benchmark index for charting**, and if so which provider first. MarketVector's retrospective-fee provision argues for deciding deliberately rather than drifting into it.
8. **Whether market-price total return ships as a labelled secondary series** in release two, and whether premium and discount get their own panel.
9. **Fund cap.** Ten is specified; whether the interface remains legible at ten is a design question that should be tested rather than assumed.
10. **How to handle the SOXX benchmark splice** in any long-window benchmark label.

---

## 14. Verification note

Verified firsthand during this research, not taken from secondary reporting: the SEC class identifiers for all four funds, from `company_tickers_mf.json`; the structure of the 2026Q2 Risk/Return Summary file including the empty `class` column across all 537,808 rows, the 37% `series` population, the 44.7% `otherdims` class population, the absence of any period-length column, VOO's `BasedonNAV` and `BasedonMarketPrice` values and 0.03% expense ratio, the zero coverage for QQQ, SMH, and SOXX in that quarter, and the twelve-basis-point 2018 return spread across the four Vanguard 500 Index Fund share classes; Rule 6c-11(c)(1)'s daily disclosure requirements; Rule 482(a) scope and the (b)(3), (b)(5), and (d)(5) requirements; Form N-1A Item 26(b)(1) and Item 27A(d)(2); and SMH's 0.35% expense ratio and 2011-12-20 inception from VanEck's fund page.

Fund-level attributes for QQQ, SOXX, and the issuer access behaviours were established by dedicated primary-source research against issuer sites and EDGAR and are cited inline; they were not independently re-fetched a second time by the author of this packet. Where a value could not be confirmed from a fetched page it is marked `n.a.` rather than estimated. Legal conclusions are quoted from controlling sources; inferences and risk-management recommendations are labelled as such.
