# ETF-Only Market-Data Vendor Licensing for a Commercial Public Display Site

**Research date:** 2026-09-05. **Use case:** a public, consumer-facing, commercial website that DISPLAYS ETF data and publishes derived analytics (total returns, volatility, drawdown, holdings overlap) computed from vendor data. This is "display / external redistribution" in market-data licensing language, and — critically — it is a **competing display product** relative to several of these vendors' own web properties. Mutual funds are out of scope.

**Grounding rule applied:** every value below comes from a page fetched in this session and is linked to the exact URL that states it. Anything not confirmed from a fetched page is marked **n.a.** License language is quoted verbatim.

---

## 0. Executive answer

| Question | Answer |
|---|---|
| Cheapest published price with real display rights | **Tiingo "EOD + IEX Redistribution / Display Redistribution" at [$250/month for startups, $500/month for enterprise](https://www.tiingo.com/products/end-of-day-stock-price-data)** — but this is prices only, no NAV, no holdings, no expense ratio, and it is **not self-serve** ("[Contact sales to get started](https://www.tiingo.com/products/end-of-day-stock-price-data)"). |
| Cheapest published display price that also carries ETF fund reference data | **Twelve Data Venture, [$499/month](https://twelvedata.com/pricing-business), described as "[External display data access](https://twelvedata.com/pricing-business)" and "[ideal for companies showcasing data on client-facing apps or websites](https://twelvedata.com/pricing-business)"**. |
| Only vendor confirmed to sell a true historical ETF NAV **time series** | **Intrinio**, `nav_unadjusted` / `nav_split_adjusted` / `nav_split_dividend_adjusted` in the [ETF Historical NAV Flows endpoint](https://docs.intrinio.com/documentation/web_api/get_etf_historical_nav_flows_v2). |
| The prior claim "Tiingo $250/month gives display/redistribution rights" | **Half true and dangerously incomplete.** The $250 number is real and published, but it is a sales-gated redistribution package for prices/IEX only, and Tiingo's Terms of Use separately prohibit using the service "[to build a similar or competitive website, application or service](https://app.tiingo.com/tos/)" and prohibit "[publishing or otherwise making available to the public any analysis of the Service or Tiingo Data](https://app.tiingo.com/tos/)" except through the narrow Derived Products carve-out. |

---

## 1. PRIORITY: Tiingo deep dive

### 1.1 Plan names and current published prices

Tiingo publishes two separate price ladders. The subscription ladder ([Product page pricing summary](https://www.tiingo.com/products/end-of-day-stock-price-data)):

| Plan | Entity | License | Price | Hourly req. | Daily req. | Monthly bandwidth |
|---|---|---|---:|---:|---:|---:|
| Free | Individual | **Internal Use Only** | [$0/month](https://www.tiingo.com/products/end-of-day-stock-price-data) | [50](https://www.tiingo.com/products/end-of-day-stock-price-data) | [1,000](https://www.tiingo.com/products/end-of-day-stock-price-data) | [1 GB](https://www.tiingo.com/products/end-of-day-stock-price-data) |
| Power | Individual | **Internal Use Only** | [$30/month](https://www.tiingo.com/products/end-of-day-stock-price-data) (also [$300/year](https://www.tiingo.com/about/pricing)) | [10,000](https://www.tiingo.com/products/end-of-day-stock-price-data) | [100,000](https://www.tiingo.com/products/end-of-day-stock-price-data) | [40 GB](https://www.tiingo.com/products/end-of-day-stock-price-data) |
| Commercial | Business | **Internal Use Only** | [$50/month](https://www.tiingo.com/products/end-of-day-stock-price-data) (also [$499/year](https://www.tiingo.com/about/pricing)) | [20,000](https://www.tiingo.com/products/end-of-day-stock-price-data) | [150,000](https://www.tiingo.com/products/end-of-day-stock-price-data) | [100 GB](https://www.tiingo.com/products/end-of-day-stock-price-data) |

The redistribution ladder, published on the same page under "**EOD + IEX Redistribution / Business / Display Redistribution**": [80,000 tickers, 1,200,000 requests, 1 TB bandwidth](https://www.tiingo.com/products/end-of-day-stock-price-data), **[$250/month for startups](https://www.tiingo.com/products/end-of-day-stock-price-data)**, **[$500/month for enterprise](https://www.tiingo.com/products/end-of-day-stock-price-data)**, "[Includes Both End-of-Day Prices and IEX](https://www.tiingo.com/products/end-of-day-stock-price-data)", "[Contact sales to get started](https://www.tiingo.com/products/end-of-day-stock-price-data)".

Tiingo's pricing page confirms the two ladders are distinct: "[It is simply $30/month (or $300/year) for individuals and $50/month (or $499/year) for internal commercial use… For redistribution use, our pricing is explicit and predictable on our Product pages](https://www.tiingo.com/about/pricing)."

**So: the $250/month figure is real, but it is NOT the $30 or $50 plan.** The public self-serve plans are all labelled "[Internal Use Only](https://www.tiingo.com/pricing)", and Tiingo defines that on the pricing page as: "**[Internal use means you may only use the data for your own personal use and you may not display or share the data with another person or organization](https://www.tiingo.com/pricing)**."

### 1.2 ETF end-of-day coverage and fields

Coverage: "[80,000+ tickers (US Equities, ETFs, Mutual Funds, and Chinese A-Shares)](https://www.tiingo.com/products/end-of-day-stock-price-data)" across [NYSE, NYSE Arca, NYSE American, NASDAQ, BATS/CBOE Equities, IEX, OTC, Mutual Funds, Shenzen, Shanghai](https://www.tiingo.com/products/end-of-day-stock-price-data). ETFs list on Arca/NASDAQ/Cboe, so ETF EOD is squarely in scope.

Fields, from the [End-of-Day API documentation](https://www.tiingo.com/documentation/end-of-day): `date`, `open`, `high`, `low`, `close`, `volume`, `adjOpen`, `adjHigh`, `adjLow`, `adjClose`, `adjVolume`, `divCash` ("[The dividend paid out on 'date'](https://www.tiingo.com/documentation/end-of-day)"), `splitFactor`. Adjustment methodology "[follows the standard method set forth by 'The Center for Research in Security Prices' (CRSP)… This methodology incorporates both split and dividend adjustments](https://www.tiingo.com/documentation/end-of-day)". Product page summarises: "[Open, High, Low, Close, Volume, Dividend, Splits - both Raw and Adjusted prices](https://www.tiingo.com/products/end-of-day-stock-price-data)".

So: **OHLCV, adjusted close, dividends and splits — yes, all present for ETFs.**

### 1.3 ETF NAV — stated plainly

**Tiingo does NOT provide ETF net asset value. It provides ETF market prices only.** The only NAV mention in the EOD docs is for mutual funds: "**[Mutual Fund NAVs are available after 12 AM EST. The fields "open", "high", "low", "close" will contain the NAV value for the given day.](https://www.tiingo.com/documentation/end-of-day)**" The product page repeats the split: "[Update Frequency: 5:30pm EST for Equities/ETFs & 12:00am EST for Mutual Fund NAVs](https://www.tiingo.com/products/end-of-day-stock-price-data)". There is no `nav` field in the ETF/equity field list, and no ETF NAV endpoint appears in the documentation fetched. **Marked: ETFs = market price only, no NAV, no premium/discount.**

### 1.4 The redistribution / public display clause, verbatim

From the [General API Documentation Overview](https://www.tiingo.com/documentation/general/overview):

> "For Basic and Power accounts, data is for internal and personal use only. You may not redistribute the data in any form.
>
> For Commercial accounts, data is licensed for internal commercial usage. You may not redistribute the data in any form.
>
> If you would like to redistribute the data for commercial or personal use, for example: a presentation, a proposal, a website or app, or any other usage case, please E-mail [address obfuscated on the fetched page — n.a.] and include the following:
>
> - The use case for the data.
> - A website link to your firm or academic affiliation.
> - Whether your company is a start-up (less than 5 employees) or enterprise (5 or more employees)."

And the general licence grant in the Terms of Use, section 1: "[Company grants you a limited license to reproduce portions of Company Properties for the sole purpose of using the Services for your personal or internal business purposes](https://app.tiingo.com/tos/)".

### 1.5 Does public display require a separate signed agreement beyond paying the list price?

**Yes in practice.** There is no checkout path to the redistribution tier: the product page says "[Contact sales to get started](https://www.tiingo.com/products/end-of-day-stock-price-data)" and the docs require emailing sales with the use case, the firm link, and the headcount band. The **"$250/month for startups"** price is explicitly conditioned on headcount: Tiingo defines a start-up as "[less than 5 employees](https://www.tiingo.com/documentation/general/overview)" and enterprise as "[5 or more employees](https://www.tiingo.com/documentation/general/overview)". Cross 5 employees and the price doubles to [$500/month](https://www.tiingo.com/products/end-of-day-stock-price-data).

The Terms also contemplate side agreements overriding the standard terms: "[Unless otherwise specified by Company in a separate license, your right to use any Company Properties is subject to the Terms](https://app.tiingo.com/tos/)", and Supplemental Terms "[shall control with respect to such Service](https://app.tiingo.com/tos/)" where inconsistent.

### 1.6 Derived-data rights — the terms are NOT silent, they are unusually detailed

Tiingo TOS **section 1.6(c) "Derived Products"** ([Terms of Use](https://app.tiingo.com/tos/)):

> "Data, results, content, or products created through the transformation, analysis, or processing of Tiingo Data are referred to as **'Derived Products.'** Unless applicable Supplemental Terms provide otherwise, you may create, retain, use, and distribute a Derived Product without separate written approval only if the Derived Product at all times satisfies both of the following requirements: (i) it is not, and cannot reasonably be used as, a substitute for access to, purchase of, or use of any Tiingo Data or Service; and (ii) it cannot reasonably be reverse engineered, reconstructed, decoded, disaggregated, matched, combined with other information, or otherwise used to identify, recover, or reproduce any underlying Tiingo Data. A Derived Product that fails either requirement is prohibited unless Company expressly approves it in writing."

Potentially permitted examples explicitly include the analytics this site wants:

> "aggregate or statistical results of a backtest, such as Sharpe or Sortino ratios, alpha, beta, maximum drawdown, win rate, or aggregate profit and loss;"
> "percentage returns, growth rates, or percentage changes, **provided that their scope, granularity, and presentation do not permit the underlying Tiingo Data to be reconstructed, including through the use of a starting value, ending value, benchmark value, or a sequence of outputs**;"
> "aggregated statistics calculated across multiple instruments or time periods, such as averages, medians, volatility measures, correlations, percentiles, or distributions;"

But the prohibited list directly targets a daily total-return series and any price chart:

> "resampled, aggregated, interpolated, normalized, rebased, indexed, currency-converted, unit-converted, or time-zone-shifted data when the output reproduces, closely tracks, or can be used to recover the underlying Tiingo Data;"
> "returns, differences, ratios, or other calculations supplied with an anchor, reference value, key, lookup table, or sufficiently complete sequence that permits reconstruction of underlying Tiingo Data;"
> "tables, files, feeds, APIs, databases, dashboards, charts, downloads, or query tools that display, deliver, or permit extraction of Tiingo Data or a substantially equivalent substitute;"

And Tiingo reserves the judgement call: "[Company may determine in its reasonable discretion whether a Derived Product satisfies this Section](https://app.tiingo.com/tos/)."

**Reading:** a headline "5-yr annualised return: 14.2%" or a volatility number is inside the permitted zone. A **daily total-return series charted from an inception anchor is a "sufficiently complete sequence"** and falls in the prohibited zone under the base terms. Under a paid **Display Redistribution** licence this should be re-permitted, but only because "[Unless applicable Supplemental Terms provide otherwise](https://app.tiingo.com/tos/)" — i.e. it depends on the sales-negotiated Supplemental Terms, not on the published price. **Get that in writing.**

### 1.7 Caching, storage, and deletion on termination

**Free/trial — no persistence at all** ([TOS 1.6(a)](https://app.tiingo.com/tos/)):
> "you may not write, save, archive, back up, or otherwise retain Tiingo Data in any persistent or durable storage. You may process Tiingo Data only transiently in volatile memory or in a temporary, non-persistent cache… This prohibition applies to all storage systems owned, leased, or controlled by you… including local devices, databases, object stores, file systems, logs, queues, archives, backups, and disaster-recovery systems."

**Paid — persistence only while you keep paying** ([TOS 1.6(b)](https://app.tiingo.com/tos/)):
> "Upon the expiration, cancellation, or termination of the Paid Plan, or a downgrade to a Starter Plan or Trial Plan, you must promptly and permanently delete all Tiingo Data from every system owned, leased, or controlled by you or operated on your behalf, including production systems, local storage, logs, queues, archives, backups, disaster-recovery systems, and systems used for legal, regulatory, or compliance retention. A different retention period applies only if Company expressly agrees to it in a separate written agreement."

One partial escape valve: "[Derived Products that satisfy this Section may be retained after your subscription ends; Tiingo Data may not.](https://app.tiingo.com/tos/)"

### 1.8 Attribution — exact wording

[Tiingo Terms of Use](https://app.tiingo.com/tos/):

> "In the event that Tiingo permits you to redistribute any data, any page, paper, presentation, app, website, obtained via the Tiingo API, you must include with any redistribution, the phrase **"Data sourced by Tiingo"** with a link to https://www.tiingo.com. Users may use a different form of attribution, but only upon the prior, written approval of Tiingo. Users may send requests for such customized attribution notices to [address obfuscated on the fetched page — n.a.]."

### 1.9 Rate limits and historical depth for ETFs

Rate limits are hourly/daily/bandwidth, not per-second: "[We do not rate limit to minute or second, so you are free to make your requests as you desire](https://www.tiingo.com/documentation/general/overview)". Ladder in §1.1; the Display Redistribution package raises this to [80,000 tickers / 1,200,000 requests / 1 TB](https://www.tiingo.com/products/end-of-day-stock-price-data).

History: "[60+ Years; Data going back from 1962](https://www.tiingo.com/products/end-of-day-stock-price-data)" (the same page also markets "[50+ years of history](https://www.tiingo.com/products/end-of-day-stock-price-data)"); the pricing page states "[30+ Years](https://www.tiingo.com/about/pricing)" of price history on both Starter and Power. Actual per-ETF depth is bounded by listing date and exposed via the `startDate` metadata field ("[The earliest date we have price data available for the asset](https://www.tiingo.com/documentation/end-of-day)").

### 1.10 Competing-product restriction — YES, and it is broad

[Tiingo TOS 1.4](https://app.tiingo.com/tos/), verbatim, the two clauses that matter most for this project:

> "(f) you shall not access Company Properties in order to build a similar or competitive website, application or service;"

> "(h) except for Derived Products expressly permitted by Section 1.6, you shall not access or use the Services or Tiingo Data for benchmarking or similar competitive analysis purposes, **for publishing or otherwise making available to the public any analysis of the Service or Tiingo Data**, or for the purpose of building a competitive product or service;"

Also relevant: "(a) you shall not license, sell, rent, lease, transfer, assign, reproduce, distribute, host or otherwise commercially exploit Company Properties"; "(g) except as expressly stated herein, no part of Company Properties may be copied, reproduced, distributed, republished, downloaded, displayed, posted or transmitted in any form or by any means" ([TOS](https://app.tiingo.com/tos/)).

This is material because Tiingo itself operates a consumer-facing screener and portfolio product — its pricing page sells "[Screener](https://www.tiingo.com/pricing)", "[Saved Screens Allowed](https://www.tiingo.com/pricing)", "[Saved Custom Metrics](https://www.tiingo.com/pricing)" and "[Saved Portfolios Allowed](https://www.tiingo.com/pricing)" with "[ETFs & Mutual Funds 60,502](https://www.tiingo.com/pricing)" covered. A public ETF analytics/comparison site is arguably "a similar or competitive website". **Any Tiingo deal must carve this out explicitly in the Supplemental Terms.**

### 1.11 ETF fundamentals from Tiingo

The API fundamentals product is not first-party and not priced publicly: "**[Fundamental data via the API is now available as an add-on in coordination with our third-party provider. Please contact [address obfuscated on the fetched page] for more information. We have individual and commercial tiers available.](https://www.tiingo.com/about/pricing)**" Price: **n.a.** ETF expense ratio / holdings / AUM availability through that add-on: **n.a.**

---

## 2. Master vendor comparison — ETF-only display use case

"Display price" = lowest **published** price whose page states commercial/external display or redistribution rights.

| Vendor | ETF EOD price | **ETF NAV** | Distributions | Splits | Expense ratio | Complete holdings | AUM / net assets | Metadata (inception / benchmark / CUSIP) | History depth | Latency | Lowest published price WITH display rights | Written approval / separate agreement? | Caching rights | Derived-data rights | Attribution | Rate limits |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Tiingo** | Yes — [OHLCV + adj](https://www.tiingo.com/documentation/end-of-day) | **NO** — [NAV only for mutual funds](https://www.tiingo.com/documentation/end-of-day) | Yes — [`divCash`](https://www.tiingo.com/documentation/end-of-day) | Yes — [`splitFactor`](https://www.tiingo.com/documentation/end-of-day) | n.a. (3rd-party [add-on](https://www.tiingo.com/about/pricing)) | **No** | n.a. | Partial — [name, exchange, description, startDate](https://www.tiingo.com/documentation/end-of-day); benchmark/CUSIP n.a. | [60+ yrs, from 1962](https://www.tiingo.com/products/end-of-day-stock-price-data) | [5:30pm EST, corrections to 8pm](https://www.tiingo.com/products/end-of-day-stock-price-data) | **[$250/mo startup; $500/mo enterprise](https://www.tiingo.com/products/end-of-day-stock-price-data)** | **Yes** — [contact sales](https://www.tiingo.com/products/end-of-day-stock-price-data); [email with use case + headcount](https://www.tiingo.com/documentation/general/overview) | Paid plans yes, but [delete everything on termination](https://app.tiingo.com/tos/) | Detailed [1.6(c) carve-out with prohibited list](https://app.tiingo.com/tos/) | **["Data sourced by Tiingo" + link](https://app.tiingo.com/tos/)** | [80k tickers / 1.2M req / 1 TB](https://www.tiingo.com/products/end-of-day-stock-price-data) on redistribution tier |
| **Twelve Data** | Yes — [EOD global equities and ETFs](https://twelvedata.com/pricing-business) | **Point value only** — [`nav` in ETF summary](https://twelvedata.com/docs); no historical NAV series stated | [`yield`](https://twelvedata.com/docs); dividends endpoint n.a. for ETFs | n.a. | Yes — [`expense_ratio_net`](https://twelvedata.com/docs) | Yes — [ETF composition: "sector exposure, holdings, and weighted exposure"](https://twelvedata.com/docs) | Yes — [`net_assets`](https://twelvedata.com/docs) | Yes — [`share_class_inception_date`, `fund_family`, `cusip`/`isin`/`figi` filters](https://twelvedata.com/docs) | n.a. | n.a. | **[$499/mo Venture — "External display data access"](https://twelvedata.com/pricing-business)**; [Enterprise $1,099/mo — "External distribution market data"](https://twelvedata.com/pricing-business) | **Yes** — "[Redistribute or provide external display of Data only if and as expressly authorized by a Redistribution Rights Add-On or separate written agreement with Twelve Data](https://twelvedata.com/terms)" | Must not "[Store or cache Data beyond permitted timeframes specified in the Documentation](https://twelvedata.com/terms)"; **delete all Data within 30 days** of termination, [certification if requested](https://twelvedata.com/terms) | Yes, bounded — "[Derived Data means data created by Customer from the Data, provided that such data cannot be reverse-engineered to arrive at the underlying Data](https://twelvedata.com/terms)"; customer retains rights | Wording n.a.; terms require "[compliance with attribution requirements](https://twelvedata.com/terms)" | Credit-based: Venture [2,584 API + 2,500 WS, no daily limits](https://twelvedata.com/pricing-business) |
| **EODHD** | Yes — [US ETFs "from earliest available"](https://eodhd.com/pricing) | **No ETF NAV field** in [ETF_Data schema](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds) | Yes — [Splits & Dividends](https://eodhd.com/pricing); [`Yield`, `Dividend_Paying_Frequency`](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds) | Yes — [Splits and Dividends](https://eodhd.com/pricing) | Yes — [`NetExpenseRatio`, `Ongoing_Charge`, `Max_Annual_Mgmt_Charge`](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds) | **Yes — full** "[`Holdings` — full holdings list keyed by ticker](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds)" plus [`Top_10_Holdings`, `Holdings_Count`](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds) | Yes — [`TotalAssets`](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds) | Yes — [`Inception_Date`, `Index_Name`, `ISIN`, `Domicile`](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds); CUSIP n.a. | [30+ years](https://eodhd.com/pricing); [10,000+ ETFs](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds) | EOD daily; [Live 15-min delayed](https://eodhd.com/pricing) | Retail plans are [Personal use](https://eodhd.com/pricing) only; commercial [Internal Use $399/mo](https://eodhd.com/commercial-pricing) **explicitly excludes display**; **[Enterprise $2,499/mo / $24,990/yr](https://eodhd.com/commercial-pricing)** is the display candidate but the page does **not** state display rights → **n.a., must be confirmed in the agreement** | **Yes** — "[In such a case, we recommend selecting the Custom plan. This will allow us to provide you with the necessary Agreement](https://eodhd.com/commercial-pricing)"; [Data Services Agreement](https://eodhd.com/commercial-pricing) is a plan feature | n.a. ([Data Download To The Corporate Server](https://eodhd.com/commercial-pricing) listed as a feature, no terms) | n.a. — terms only permit non-professionals to "[store, manipulate, and analyze the data for private, non-commercial purposes](https://eodhd.com/financial-apis/terms-conditions)" | n.a. | [1,000 req/min, 100,000/day](https://eodhd.com/commercial-pricing); [+100,000 / unlimited on higher tiers](https://eodhd.com/commercial-pricing) |
| **Polygon.io (now "Massive")** | Yes — [full SIP end-of-day](https://massive.com/stocks) | **No** (ETF NAV only via the ETF Global add-on, below) | Yes — [splits, dividends and IPOs back to 2008](https://massive.com/stocks) | Yes — [same](https://massive.com/stocks) | Via add-on only | Via add-on only | Via add-on only | n.a. | [Every tick since 2003; 23+ years](https://massive.com/stocks) | Real-time / EOD | **[Stocks Business $2,499/month](https://massive.com/stocks)** — "[Commercial and display rights](https://massive.com/stocks)"; individual plans [Basic free / Starter $29 / Developer $79 / Advanced $199](https://massive.com/stocks) are "[licensed for personal and non-professional use](https://massive.com/stocks)" | Not stated on the pricing page; Business plan required for "[brokerage, redistribution, customer-facing display, or 200+ users](https://massive.com/stocks)" | n.a. | n.a. | n.a. | [Free tier 5 req/min; every paid plan "unlimited API calls"](https://massive.com/stocks) |
| **Massive × ETF Global add-on** | — | **Yes — daily `nav`** in [fund-flows endpoint](https://massive.com/partners/etf-global) (`processed_date`, `effective_date`, `shares_outstanding`, `nav`, `fund_flow`) | n.a. | n.a. | n.a. | [Constituents](https://massive.com/blog/announcing-massive-etf-global-partnership-constituents-fund-flows-analytics-profiles-and-taxonomies-2/) | [`shares_outstanding`](https://massive.com/partners/etf-global) | n.a. | n.a. | Daily | [$99/month](https://massive.com/pricing) — but **"[Individual use only](https://massive.com/partners/etf-global)"**, so **not** a display licence | Display price n.a. | n.a. | n.a. | n.a. | n.a. |
| **Intrinio** | Yes — [real-time, delayed and historical equity pricing; 50+ years of dividend and split-adjusted stock price history](https://intrinio.com/pricing) | **YES — best in class.** [Historical NAV Flows](https://docs.intrinio.com/documentation/web_api/get_etf_historical_nav_flows_v2): `nav_unadjusted`, `nav_split_adjusted`, `nav_split_dividend_adjusted`, plus NAV returns 1d/1m/3m/YTD/1y/3y/5y/10y/since-inception | NAV series is dividend-adjusted; explicit ETF dividend endpoint n.a. | [`nav_split_adjusted`, `share_outstanding_split_adjusted`](https://docs.intrinio.com/documentation/web_api/get_etf_historical_nav_flows_v2) | Yes — [among 118 ETF metadata attributes](https://intrinio.com/etfs) | **Yes — "[Complete ETF holdings data with weightings, shares held, and sector breakdowns](https://intrinio.com/etfs)"** | Yes — [`total_net_assets`](https://docs.intrinio.com/documentation/web_api/get_etf_historical_nav_flows_v2) | Yes — [ticker, FIGI, RIC, ISIN, SEDOL, exchange MIC](https://docs.intrinio.com/documentation/web_api/get_etf_historical_nav_flows_v2); [fund classification, asset class, geographic focus](https://intrinio.com/etfs); CUSIP n.a. | n.a. for ETFs | n.a. | **[Startup Plan $999/qtr to start](https://account.intrinio.com/pricing/startup)** — "[Commercial Use and Display Rights](https://account.intrinio.com/pricing/startup)", phased **[$999 → $1,998 → $2,997/qtr](https://account.intrinio.com/pricing/startup)**. ETF feeds are labelled **[Enterprise](https://intrinio.com/etfs)**, price **n.a.** | **Yes** — "[A Startup Order Form must be generated and electronically signed](https://account.intrinio.com/pricing/startup)"; rights "[require an executed Order Form](https://about.intrinio.com/terms)" | n.a. | Restricted by default — no use "[to create, support, or operate a competing data product, data service, financial information offering](https://about.intrinio.com/terms)" absent an Order Form | n.a. | [2K API calls/min, 3 WebSocket connections](https://account.intrinio.com/pricing/startup) on Startup |
| **Nasdaq Data Link** | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | **None published** — "[Subscriptions are a la carte](https://docs.data.nasdaq.com/docs/getting-started)", "[No prices or subscription amounts are published](https://docs.data.nasdaq.com/docs/getting-started)"; docs site "[will be retired on August 31, 2026](https://docs.data.nasdaq.com/docs/getting-started)" | **Yes** — nasdaq.com licence is "[solely for your personal, non-commercial use](https://www.nasdaq.com/legal)"; you "[shall not share, transfer, disclose, copy, publish or create derivative works from the content… without Nasdaq's prior written approval](https://www.nasdaq.com/legal)" | Prohibited to "[store for subsequent use](https://www.nasdaq.com/legal)" without consent | **Prohibited by default** — no "[derivative works](https://www.nasdaq.com/legal)" without written approval | n.a. | n.a. |
| **Alpha Vantage** | n.a. (ETF fields not stated on fetched pages) | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | **None** — licence is "[for personal, non-commercial use, unless you and Alpha Vantage have agreed otherwise in writing](https://www.alphavantage.co/terms_of_service/)". Commercial use includes any plan "[to use or provide information… as part of any type of commercial activity that allows individuals or entities other than User to access information directly or indirectly](https://www.alphavantage.co/terms_of_service/)" | **Yes** — "[If you are interested in using the Alpha Vantage Platform for commercial purposes, please contact us at premium@alphavantage.co](https://www.alphavantage.co/terms_of_service/)" | n.a. | n.a. (terms silent) | n.a. | Free tier "[25 API requests per day](https://www.alphavantage.co/premium/)"; premium limits n.a. |
| **Finnhub** | ETFs and Indices listed; explicit ETF EOD n.a. | n.a. | [Dividends 30 years](https://finnhub.io/pricing) (not ETF-specific) | n.a. | n.a. | ["ETFs Holdings"](https://finnhub.io/pricing) listed; full-vs-top-10 n.a. | n.a. | ["ETFs Profile"](https://finnhub.io/pricing) listed; fields n.a. | [US market OHLC 30+ yrs](https://finnhub.io/pricing) | n.a. | **None** — both Free and [All-In-One $3,500/month billed annually](https://finnhub.io/pricing) are labelled "[Personal Use. Terms apply](https://finnhub.io/pricing)" | **Yes** — "[You hereby agree to not redistribute or share access to data or derived results from the data obtained from Finnhub with anyone or any 3rd party without written approval from Finnhub](https://finnhub.io/terms-of-service)"; "[Personal plan can't be used by any business even internally without a written approval](https://finnhub.io/terms-of-service)" | **"[All data must be deleted should your subscription to that data ends.](https://finnhub.io/terms-of-service)"** | **Explicitly restricted** — "derived results" are swept into the same written-approval requirement | n.a. | [Free 60 calls/min; All-In-One 900 market / 300 fundamental calls/min](https://finnhub.io/pricing); [30 API calls/second cap](https://finnhub.io/terms-of-service) |
| **Databento** | Equities datasets; ETF-specific fields not stated | **No** | n.a. | n.a. | n.a. | n.a. | n.a. | n.a. | [16+ years](https://databento.com/pricing) | Real-time / historical | **[Standard $199/month](https://databento.com/pricing)**, [Plus $1,750/mo](https://databento.com/pricing), [Unlimited $4,500/mo](https://databento.com/pricing) — "[Databento doesn't apply any redistribution restrictions. However, for each dataset, we have to pass through the licensing restrictions from the original publisher](https://databento.com/pricing)"; "[Most of our datasets can be redistributed internally or externally after 24 hours](https://databento.com/pricing)" | Self-service licence flow: "[Answer a short questionnaire to determine your actual monthly license fees and submit your license agreements. We pass through these license fees with no upcharge](https://databento.com/pricing)" — **exchange fees are extra and unpriced here** | n.a. | n.a. | n.a. | "[Unlimited downloads, streaming, and API calls](https://databento.com/pricing)" |
| **Marketstack** | Yes — [End-of-Day Data](https://marketstack.com/pricing) | **No** | Yes — [Splits & Dividends](https://marketstack.com/pricing) | Yes — [same](https://marketstack.com/pricing) | n.a. | ["ETF Holding"](https://marketstack.com/pricing) listed; full-vs-top-10 **n.a.** | n.a. | n.a. | [Basic 10 yrs; Professional/Business 15+ yrs](https://marketstack.com/pricing) | [Real-Time Updates on Professional+](https://marketstack.com/pricing) | **[$9.99/mo Basic](https://marketstack.com/pricing)** lists "[Commercial Use](https://marketstack.com/pricing)" — but the page never defines that scope and says nothing about display or redistribution → **treat as unconfirmed** | Not stated | Not stated | Not stated | Not stated | [Basic 10,000 req/mo; Professional 100,000; Business 500,000](https://marketstack.com/pricing) |
| **Tradefeeds** | ["ETF / Mutual Funds"](https://tradefeeds.com/pricing-subscription-plans/) listed; fields n.a. | n.a. | ["Dividends / Stock splits"](https://tradefeeds.com/pricing-subscription-plans/) | Same | n.a. | n.a. | n.a. | ["Company identification"](https://tradefeeds.com/pricing-subscription-plans/) | ["Historical data"](https://tradefeeds.com/pricing-subscription-plans/), depth n.a. | n.a. | **None** — [Basic $99, Starter $149, Standard $399, Business $899/mo](https://tradefeeds.com/pricing-subscription-plans/), but display is prohibited by default | **Yes** — "[Unless expressly permitted by Tradefeeds in prior and writing, the Licensee shall not… Copy, translate, modify, create a derivative work of, resell, lease, lend, convey, distribute, publicly display, or sublicense to any third party](https://tradefeeds.com/terms-and-conditions-on-data/)" | Prohibited to "[Scrape, build separate databases, or otherwise create permanent copies](https://tradefeeds.com/terms-and-conditions-on-data/)" | **Prohibited** — "create a derivative work of" is in the same banned list | Must not "[falsify or delete any author attributions](https://tradefeeds.com/terms-and-conditions-on-data/)" | [12–280 calls/min by plan](https://tradefeeds.com/pricing-subscription-plans/) |
| **Financial Modeling Prep** | [ETF Price Quotes](https://site.financialmodelingprep.com/developer/docs/pricing) | n.a. | n.a. | n.a. | n.a. | [ETF & Mutual Fund Holdings](https://site.financialmodelingprep.com/developer/docs/pricing); full-vs-top-10 n.a. | n.a. | [CUSIP listed as a general reference item](https://site.financialmodelingprep.com/developer/docs/pricing) | [Basic/Starter 5 yrs; Premium/Ultimate 30+ yrs](https://site.financialmodelingprep.com/developer/docs/pricing) | [EOD to real-time by plan](https://site.financialmodelingprep.com/developer/docs/pricing) | **None** — every plan shows "[Contact Us](https://site.financialmodelingprep.com/developer/docs/pricing)" instead of a price | **Yes** — "[Displaying or redistributing data sourced from FMP requires a specific Data Display and Licensing Agreement with FMP.](https://site.financialmodelingprep.com/developer/docs/pricing)" | n.a. | n.a. | n.a. | [250/day → 3,000/min by plan](https://site.financialmodelingprep.com/developer/docs/pricing); bandwidth [500MB–1TB+/30 days](https://site.financialmodelingprep.com/developer/docs/pricing) |

### 2.1 Vendors that publish an explicit commercial DISPLAY price — the short list

Only four candidates put a number next to display rights on a public page:

1. **Tiingo Display Redistribution — [$250/mo startup, $500/mo enterprise](https://www.tiingo.com/products/end-of-day-stock-price-data)** (prices + IEX only)
2. **Twelve Data Venture — [$499/mo, "External display data access"](https://twelvedata.com/pricing-business)** (prices + ETF metrics)
3. **Intrinio Startup — [$999/qtr rising to $2,997/qtr, "Commercial Use and Display Rights"](https://account.intrinio.com/pricing/startup)** (ETF feeds priced separately as [Enterprise](https://intrinio.com/etfs))
4. **Massive (Polygon) Stocks Business — [$2,499/mo, "Commercial and display rights"](https://massive.com/stocks)**

Everyone else is either explicitly internal/personal use, or gates display behind an unpriced agreement.

---

## 3. CRITICAL: where does ETF NAV history actually come from?

Market price history is commodity. **NAV per share history is not**, and most of the vendors above simply do not have it.

### 3.1 What the vendors actually sell

| Source | ETF NAV history? | Evidence |
|---|---|---|
| **Intrinio** | **Yes — a genuine daily NAV time series.** Fields `nav_unadjusted` ("Net asset value unadjusted for splits or dividends"), `nav_split_adjusted`, `nav_split_dividend_adjusted`, with `total_net_assets`, `share_outstanding_split_adjusted`, and NAV-based returns to since-inception, queryable by `start_date`/`end_date` | [ETF Historical NAV Flows endpoint](https://docs.intrinio.com/documentation/web_api/get_etf_historical_nav_flows_v2) |
| **ETF Global (via Massive)** | **Yes — daily `nav` alongside `shares_outstanding` and `fund_flow`,** with dated rows (`effective_date` 2025-01-29/30/31 examples) | [Massive × ETF Global](https://massive.com/partners/etf-global) — but priced at [$99/month](https://massive.com/pricing) as **"[Individual use only](https://massive.com/partners/etf-global)"** |
| **Twelve Data** | **Latest NAV only.** `nav` is a single scalar in the ETF summary object; no historical NAV series is documented | [Twelve Data docs](https://twelvedata.com/docs) |
| **Tiingo** | **No.** NAV is populated into OHLC for **mutual funds** only; ETFs get exchange prices | [Tiingo EOD docs](https://www.tiingo.com/documentation/end-of-day) |
| **EODHD** | **No NAV field in the ETF schema** — `ETF_Data` has ISIN, index name, yield, inception, expense ratio, `TotalAssets`, allocations and holdings, but no NAV | [EODHD ETF fundamentals](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds) |
| Marketstack, Databento, Finnhub, Alpha Vantage, Marketstack, Tradefeeds, FMP | **Not stated on any page fetched** | see table §2 |

### 3.2 The issuer / Rule 6c-11 route

SEC Rule 6c-11 makes every US ETF publish, **on its own public website, every business day**, exactly the data set that vendors mostly do not sell. From the SEC's [Exchange-Traded Funds: A Small Entity Compliance Guide](https://www.sec.gov/investment/exchange-traded-funds-small-entity-compliance-guide), the ETF must disclose:

- "[The portfolio holdings that will form the basis for each calculation of net asset value per share](https://www.sec.gov/investment/exchange-traded-funds-small-entity-compliance-guide)" as of "[the close of business on the prior business day](https://www.sec.gov/investment/exchange-traded-funds-small-entity-compliance-guide)", available "[each business day before the opening of regular trading on the primary listing exchange](https://www.sec.gov/investment/exchange-traded-funds-small-entity-compliance-guide)", with per-holding **ticker, CUSIP or other identifier, description, quantity, and percentage weight**;
- "[its current net asset value per share](https://www.sec.gov/investment/exchange-traded-funds-small-entity-compliance-guide)", "[its market price](https://www.sec.gov/investment/exchange-traded-funds-small-entity-compliance-guide)" and "[its premium or discount](https://www.sec.gov/investment/exchange-traded-funds-small-entity-compliance-guide)", each "[as of the end of the prior business day](https://www.sec.gov/investment/exchange-traded-funds-small-entity-compliance-guide)";
- **a table and a line graph** of premiums and discounts over "[the most recently completed calendar year; and the calendar quarters of the current year; or the life of the ETF, if shorter](https://www.sec.gov/investment/exchange-traded-funds-small-entity-compliance-guide)";
- a disclosure and factor discussion whenever the premium/discount "[was greater than 2% for more than seven consecutive trading days](https://www.sec.gov/investment/exchange-traded-funds-small-entity-compliance-guide)";
- "[median bid-ask spread over the most recent thirty calendar days](https://www.sec.gov/investment/exchange-traded-funds-small-entity-compliance-guide)".

That mandate is real and issuers do publish it — e.g. iShares files per-fund [Historical Premium/Discount forms](https://www.ishares.com/us/literature/forms/erus-historical-premium-discount.pdf) tabulating, per quarter, the number of trading days the "[ETF's closing price exceeded its NAV](https://www.ishares.com/us/literature/forms/erus-historical-premium-discount.pdf)", equalled NAV, or was below NAV, together with the methodology that NAV is "[calculated by the fund accountants… at the close of regular trading, normally 4:00 p.m. ET](https://www.ishares.com/us/literature/forms/erus-historical-premium-discount.pdf)".

**Practical conclusion.** Rule 6c-11 guarantees *current-day* NAV, market price, premium/discount and complete holdings at each issuer, plus a rolling ~1–2 year premium/discount record — but it does **not** guarantee a long, machine-readable, cross-issuer daily NAV **history** in a single place, and each issuer's own site terms govern reuse (the iShares document fetched states nothing about display, redistribution, caching or attribution: all **n.a.**). So:

- For **long NAV history across many ETFs**, Intrinio is the only vendor confirmed here to sell it, and the [ETF feeds are Enterprise-tier](https://intrinio.com/etfs) with **price n.a.**
- For a **daily-refreshed NAV / premium-discount / full-holdings layer at near-zero data cost**, harvesting each issuer's mandated 6c-11 page is the practical source — accepting per-issuer terms review, per-issuer format work, and the fact that you build history forward from your start date rather than buying it.
- The pragmatic hybrid: **buy price history from a display-licensed vendor, accumulate NAV forward from issuer 6c-11 disclosures**, and be explicit on the site that pre-launch NAV history is unavailable.

---

## 4. Yahoo Finance — settled vs inference

### 4.1 What the current terms say

[Yahoo Terms of Service](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html), verbatim:

> "*Use of Services.* You must follow any guidelines or policies associated with the Services… You may use the Services only as permitted by law. **Unless otherwise expressly stated, you may not access or reuse the Services, or any portion thereof, for any commercial purpose.**"

> "*Ownership and Reuse.* Using the Services does not give you ownership of any intellectual or other property rights or interests in the Services or the content you access… **Unless you have explicit written permission, you must not reproduce, modify, rent, lease, sell, trade, distribute, transmit, broadcast, publicly perform, create derivative works based on, or exploit for any commercial purposes, any portion or use of, or access to, the Services (including content, advertisements, APIs, and software).**"

> "*Member conduct.* You agree not to use the Services in any manner that violates these Terms… including to: … **use any material or content from, including without limitation any data, (a) to create any database, archive, mobile application, data feed, widget or any other aggregated data source that competes with or constitutes a material substitute for the Services, in whole or in part, offered on any of our Services or the services offered by our data providers, or (b) to provide any service that competes with or constitutes a material substitute for our Services or data offered by Yahoo or our data providers.**"

The developer terms are equally clear: you may not "[Use the Yahoo APIs in a product or service that competes with products or services offered by Yahoo, unless the API Documents specifically permit otherwise or Yahoo gives prior, express, written permission](https://legal.yahoo.com/us/en/yahoo/terms/product-atos/apiforydn/index.html)", nor "[Sell, lease, share, transfer, or sublicense the Yahoo APIs or access or access codes thereto or derive income from the use or provision of the Yahoo APIs, whether for direct commercial or monetary gain or otherwise](https://legal.yahoo.com/us/en/yahoo/terms/product-atos/apiforydn/index.html)".

The single narrow permission found is RSS-only and irrelevant to fund data: "[If you use an RSS feed provided by us… you are only permitted to display the content that is provided in the feed, without modification, and you must provide attribution to our source website and link to the full article… You may not incorporate advertising into any Yahoo RSS Feed](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html)".

**Settled:** nothing in Yahoo's current terms permits a commercial competing display, and derived analytics are squarely inside "create derivative works based on… or exploit for any commercial purposes". A public ETF analytics site is precisely "a database… or other aggregated data source that competes with or constitutes a material substitute for the Services". **Yahoo is unusable for this project. Full stop.**

### 4.2 Internal, unpublished prototyping — is it distinguishable?

Only partly, and the answer relies on inference, not on an explicit carve-out.

**Settled from the text:**
- The commercial-purpose bar attaches to *reuse of the Services*, not to publication: "[you may not access or reuse the Services, or any portion thereof, for any commercial purpose](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html)". Building a for-profit product's prototype is a commercial purpose even if nothing ships.
- The Member-conduct clause bars using data "**to create** any database, archive, mobile application, data feed, widget or any other aggregated data source that competes with… the Services" ([Yahoo ToS](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html)). The prohibited act is **creation**, not publication. An internal prototype database of Yahoo-sourced ETF data is the thing this sentence names.
- Yahoo's terms contain **no internal-use exception**: the developer terms page contains no clause expressly authorising or restricting "internal use" at all.

**Inference (my reading, not settled by the text):** a genuinely non-commercial, throwaway feasibility check — e.g. one analyst eyeballing a handful of quotes to size a schema, storing nothing — sits in a grey zone that the "personal, non-commercial" framing arguably tolerates, and is a practical enforcement non-event. But the moment you (a) persist a dataset, (b) do it inside a company building a competing product, or (c) use the outputs to validate a commercial design, the plain text of the Member-conduct clause is breached. **Recommendation: do not use Yahoo even for internal prototyping.** Every vendor above offers a free tier adequate for prototyping — though note Tiingo's free tier bans persistence entirely: "[you may not write, save, archive, back up, or otherwise retain Tiingo Data in any persistent or durable storage](https://app.tiingo.com/tos/)".

---

## 5. Recommendation

### 5.1 Recommended stack

**Primary: Twelve Data Venture — [$499/month](https://twelvedata.com/pricing-business) (annual [$414/mo, $4,990/yr](https://twelvedata.com/pricing-business)).** It is the only vendor whose *published* display-rights tier also carries the ETF reference layer this site needs in one subscription: [EOD global equities and ETFs](https://twelvedata.com/pricing-business), plus [`nav`, `expense_ratio_net`, `net_assets`, `share_class_inception_date`, `yield`, `turnover_rate`](https://twelvedata.com/docs) and [ETF composition with holdings and sector exposure](https://twelvedata.com/docs), addressable by [CUSIP/ISIN/FIGI](https://twelvedata.com/docs). Its derived-data clause is the friendliest found: "[Customer may create Derived Data that cannot be reverse-engineered to arrive at the underlying Data](https://twelvedata.com/terms)" and "[Customer retains rights to Derived Data](https://twelvedata.com/terms)".

**Secondary / fallback for depth: EODHD.** Its ETF schema is the richest confirmed at any price — **full** "[`Holdings` — full holdings list keyed by ticker](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds)", `NetExpenseRatio`, `TotalAssets`, `Inception_Date`, `Index_Name`, sector/region weights — with [30+ years](https://eodhd.com/pricing) of US ETF EOD "[from earliest available](https://eodhd.com/pricing)". But the display licence is unpriced: [Internal Use $399/mo explicitly forbids display](https://eodhd.com/commercial-pricing) and Enterprise at [$2,499/mo](https://eodhd.com/commercial-pricing) does not state display rights on the page. Get the Custom-plan agreement quoted before committing.

**NAV layer: build from issuer Rule 6c-11 pages**, forward from launch, per §3.2 — unless Intrinio's ETF Enterprise quote comes back reasonable, in which case [Intrinio's NAV Flows](https://docs.intrinio.com/documentation/web_api/get_etf_historical_nav_flows_v2) is the only turnkey historical NAV series identified.

**Reject:** Yahoo Finance (§4), Alpha Vantage ([personal, non-commercial](https://www.alphavantage.co/terms_of_service/)), Finnhub ([Personal Use even at $3,500/mo](https://finnhub.io/pricing)), Nasdaq Data Link ([personal, non-commercial; no published price](https://www.nasdaq.com/legal)), Tradefeeds ([public display banned absent prior written permission](https://tradefeeds.com/terms-and-conditions-on-data/)), Marketstack (undefined "[Commercial Use](https://marketstack.com/pricing)", no display language, no NAV). Databento is a tick/microstructure vendor, not a fund-data vendor — no ETF reference fields confirmed.

### 5.2 True cost

| Component | Annual cost |
|---|---:|
| Twelve Data Venture, annual billing | **[$4,990/yr](https://twelvedata.com/pricing-business)** |
| — or Tiingo Display Redistribution, prices only, <5 employees | [$3,000/yr](https://www.tiingo.com/products/end-of-day-stock-price-data) ([$6,000/yr](https://www.tiingo.com/products/end-of-day-stock-price-data) at 5+ employees) |
| — or Massive (Polygon) Stocks Business | [$29,988/yr](https://massive.com/stocks) |
| — or Intrinio Startup year 1 (display rights, ETF feeds extra) | [$5,994](https://account.intrinio.com/pricing/startup) year 1, [$11,988/yr](https://account.intrinio.com/pricing/startup) steady state |
| — or EODHD Enterprise (display rights unconfirmed) | [$24,990/yr](https://eodhd.com/commercial-pricing) |
| ETF NAV / holdings from issuer 6c-11 pages | $0 data cost + engineering |

**Realistic floor for a compliant ETF display site: ~$5,000/year**, not the ~$3,000 implied by the Tiingo $250 headline — because $250 buys prices and IEX only, and buys nothing at all if you have five employees.

### 5.3 The three biggest gotchas

1. **The "$250 Tiingo" claim is a price for a different product than the one you need.** It is a sales-gated redistribution package for [EOD prices + IEX](https://www.tiingo.com/products/end-of-day-stock-price-data) with **no NAV, no expense ratio, no holdings, no AUM**, and the price doubles to [$500/month](https://www.tiingo.com/products/end-of-day-stock-price-data) at five employees.

2. **Biggest gotcha overall — the competing-product clause plus mandatory deletion.** Tiingo's terms prohibit accessing the service "[in order to build a similar or competitive website, application or service](https://app.tiingo.com/tos/)" and prohibit "[publishing or otherwise making available to the public any analysis of the Service or Tiingo Data](https://app.tiingo.com/tos/)". Tiingo sells a consumer screener and portfolio tool, so this site is arguably that competitor. On top of it, [TOS 1.6(b)](https://app.tiingo.com/tos/) requires that on any cancellation, termination or downgrade you "**promptly and permanently delete all Tiingo Data from every system… including production systems, local storage, logs, queues, archives, backups, disaster-recovery systems**". Twelve Data ([delete within 30 days, certify if asked](https://twelvedata.com/terms)) and Finnhub ("[All data must be deleted should your subscription to that data ends](https://finnhub.io/terms-of-service)") carry the same trap. **Your published price history is rented, not owned — plan a fallback dataset before you launch a site whose value proposition is long history.**

3. **A daily total-return series is at the edge of every derived-data clause.** Tiingo explicitly prohibits derived outputs supplied "[with an anchor, reference value, key, lookup table, or sufficiently complete sequence that permits reconstruction of underlying Tiingo Data](https://app.tiingo.com/tos/)" and prohibits "[charts… that display, deliver, or permit extraction of Tiingo Data](https://app.tiingo.com/tos/)" — a growth-of-$10,000 chart is close to that line. Twelve Data uses the reverse-engineering test too ("[cannot be reverse-engineered to arrive at the underlying Data](https://twelvedata.com/terms)"). A display licence is meant to permit this, but **it must be spelled out in the Order Form / Supplemental Terms — the published price alone does not settle it.**

### 5.4 Contract checklist before signing anything

1. Written confirmation that a **public, ad- or subscription-supported ETF comparison/analytics site** is in scope, with the competing-product clause expressly waived.
2. Written confirmation that **daily total-return, volatility, drawdown and holdings-overlap series** may be displayed and charted.
3. A **post-termination wind-down** right (e.g. 90 days, or a perpetual right to retain data already displayed) instead of blanket immediate deletion.
4. The exact **attribution string** and its placement — for Tiingo that is "[Data sourced by Tiingo](https://app.tiingo.com/tos/)" with a link to https://www.tiingo.com.
5. Confirmation of what is **not** in the feed: ETF NAV, premium/discount, and complete holdings must be sourced separately for most of these vendors.
