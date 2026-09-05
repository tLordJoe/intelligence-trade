# Twelve Data — Written Licensing Confirmation Request

**Status:** DRAFT — prepared, not sent. Awaiting owner approval.
**Date prepared:** 2026-09-05
**Recommended channel:** `support@twelvedata.com` and the sales contact form at https://twelvedata.com/pricing-business (request routing to licensing/legal, not tier-one support)
**Requested response format:** a written reply, on Twelve Data letterhead or from a company email address, that either (a) confirms each numbered item, or (b) states the plan, add-on, or executed agreement required to obtain it, with price.

---

## Cover note

Subject: **Written licensing confirmation request — public display and derived analytics for an ETF comparison tool**

To the Twelve Data licensing team,

Outfox Markets operates https://outfoxmarkets.com, a commercial, advertising-supported financial-intelligence website. We are evaluating Twelve Data for an exchange-traded fund comparison tool and we need written confirmation of scope before we subscribe. We are not asking for a general assurance that the plan permits "commercial use." We are asking for item-by-item confirmation, because your published Terms and your pricing page appear to say different things and we would rather resolve that in writing than discover it later.

Two specific conflicts prompt this request.

**First.** Your business pricing page lists "External display data access" as an included feature of the Venture plan at all three configurations ([business pricing](https://twelvedata.com/pricing-business)). Your Terms §2.2(e), however, state that external display is permitted "only if and as expressly authorized by a Redistribution Rights Add-On or separate written agreement" ([Terms of Service](https://twelvedata.com/terms)), and §14.5 makes the Terms operative. We cannot tell from the public documents whether the Venture plan constitutes that express authorisation, or whether a separate add-on is still required. Please state which.

**Second.** Neither "External display" nor "External distribution" is defined anywhere we can find. Our visitors are anonymous members of the public who do not hold accounts and are therefore not "Authorized Users" as your Terms define that term. Serving them a chart may fall under your definition of Redistribution — "publication … of Data to third parties." Please tell us plainly whether serving data to anonymous public website visitors is external display, redistribution, or both.

Our intended use is described exactly below. Please confirm or correct each item.

---

## Intended use, stated precisely

A visitor arriving at outfoxmarkets.com without logging in selects between two and ten exchange-traded funds — for example VOO, QQQ, XLK, SMH, XLU and SOXX — enters a dollar amount, and selects a period of one, three, or five years. The page then displays: a growth chart of that dollar amount over the period; total return for each fund; annualised volatility; maximum drawdown; each fund's expense ratio and approximate annual cost; the percentage overlap between the funds' holdings; and an indication of which of the selected funds produced the highest total return over that period. Every figure carries its source and as-of date. Data is refreshed in a nightly batch and stored so pages render without a live API call per visitor. The site carries advertising and sponsorship. We may later place some tools behind free or paid accounts.

---

## The ten confirmations we need

Please answer each with **yes**, **no**, or **only with X**, where X names the plan, add-on, or agreement.

**1. Public display to anonymous visitors.** May Outfox display historical exchange-traded fund prices and calculated growth charts derived from Twelve Data on publicly accessible webpages to anonymous visitors who are not logged in and are not Authorized Users? If yes, on which plan, and does that require a Redistribution Rights Add-On under Terms §2.2(e)?

**2. Caching and storage.** May Outfox store Twelve Data price, distribution, and split data in its own database and serve pages from that store rather than calling the API per page view? Terms §2.3(g) prohibits caching "beyond permitted timeframes specified in the Documentation," but we have been unable to locate any such timeframe in the Documentation. **Please state the permitted retention period explicitly, or confirm that none applies.**

**3. Derived analytics published publicly.** May Outfox compute and publicly display total return, annualised volatility, maximum drawdown, and side-by-side fund comparisons derived from Twelve Data? Please confirm that publishing derived analysis is permitted, since your Terms do not appear to contain a clause prohibiting it.

**4. Comparison and identifying the highest performer.** May Outfox compare multiple funds in one view and state which fund produced the highest total return over a visitor-selected period? We are asking specifically because ranking one instrument above another is a stronger claim than displaying each separately, and we want it covered explicitly.

**5. Interactive visitor-entered amounts.** May a visitor enter their own dollar amount and receive an interactive calculation of hypothetical growth of that amount, computed from Twelve Data price history?

**6. Holdings overlap.** May Outfox display or calculate the percentage overlap between two or more funds' holdings using Twelve Data holdings data? If holdings are not licensable for this purpose at any tier, please say so directly, and confirm whether Outfox may instead source holdings elsewhere and display them alongside Twelve Data prices without breaching Terms §2.3(k) on combining Data.

**7. Commercial, advertising-supported operation.** May Outfox operate this feature on a commercial website funded by advertising and sponsorship? Please confirm there is no restriction based on company headcount, revenue, page views, or traffic on the relevant plan.

**8. Later gating behind accounts.** May Outfox later place some of these tools behind free registered accounts, and later behind paid subscriptions, without a further licence change? If a further licence is required at either step, please identify which.

**9. Survival of derived results on termination.** Terms §16.2 states that "All Data must be deleted within 30 days" and that "Certification of deletion required if requested." Please confirm whether **calculated results** — a computed total return figure, a volatility number, a drawdown percentage, a stored chart image — must also be deleted, or whether Outfox may retain derived outputs after the relationship ends. This determines whether ten years of accumulated analysis is owned or rented, and it materially affects our decision.

**10. Competitive-product restriction.** Terms §2.3(d) prohibits using the Platform "to build competitive products or services," with no definition and no carve-out, and §2.3(k) prohibits combining Data to create competing products. Please confirm in writing that a consumer-facing fund comparison and education website, which does not sell market data, does not offer an API, and does not resell your feed, is **not** a competitive product under §2.3(d). If Outfox later offers a data-download or API product to its own users, please state whether that would breach §2.3(d), and what would be required.

---

## Commercial and contractual questions

**11. Exact plan.** Which named plan and configuration covers everything confirmed above? Please quote the monthly and annual price.

**12. Add-ons.** Is a Redistribution Rights Add-On required? What does it cost, and is it available self-serve or only by executed agreement?

**13. ETF reference data.** Your documentation states that `/etfs/world/*` endpoints — covering `expense_ratio_net`, `nav`, `net_assets`, `share_class_inception_date` and `top_holdings` — are "available on the Ultra plan (individual) and the Enterprise plan (business) and above" ([ETF all-data docs](https://twelvedata.com/docs/llms/etfs/etf-all-data.md)). Please confirm that Venture at any configuration does **not** include these, and that Enterprise at $1,099/month is the entry point. Please also confirm your support statement that datasets are not sold separately.

**14. Exchange fees.** Your support material states that "No additional exchange fees are required to access the default feed" and that end-of-day data "does not require additional licensing" ([end-of-day pricing](https://support.twelvedata.com/en/articles/12682324-end-of-day-eod-pricing-market-data)), yet Terms §3.1(c) reserves the right to pass through "exchange fees or professional subscriber rates." Please confirm whether any exchange fee, professional-subscriber fee, or non-display fee would apply to the use described above, and **provide the fee schedule** if one exists.

**15. Professional-subscriber status.** Would Outfox, or its anonymous visitors, be classified as professional subscribers under any exchange agreement you hold?

**16. Written agreement.** Is an executed written agreement required for this use, or do the online Terms suffice? If an agreement is required, please send the form of agreement for our review.

**17. Attribution.** Your guidelines require "Data provided by Twelve Data" as a dofollow link, clearly visible near the displayed data, in each relevant section ([attribution guidelines](https://support.twelvedata.com/en/articles/12647398-attribution-guidelines-for-using-twelve-data)). Please confirm the exact required wording and placement for a comparison table and a chart, and confirm whether one site-wide attribution satisfies the requirement or whether each panel needs its own.

**18. Dividend adjustment.** Your `adjust` parameter accepts `all` and `dividends`, but support states that "All prices are adjusted to … splits" and directs dividend adjustment to be handled client-side ([are the prices adjusted](https://support.twelvedata.com/en/articles/5179064-are-the-prices-adjusted)). Please confirm precisely which adjustments Twelve Data applies server-side, for exchange-traded funds specifically, and name the field.

**19. Missing documents.** We could not locate a Data Processing Agreement, a standalone service-level agreement, or an exchange-fee schedule; `/legal` and `/previous-terms` both return 404. Please provide these, or confirm they do not exist.

**20. Service level.** Your Terms §15 states 99.9% availability while marketing material advertises 99.95%. Please confirm which applies.

---

## What we are not asking

We are not asking whether "commercial use is allowed." We are not asking you to interpret our business model. We are asking for confirmation of specific, enumerated rights so that we can either subscribe with confidence or rule Twelve Data out and evaluate alternatives. A reply that says the Venture plan "permits external display" without addressing items 1, 2, 9 and 10 will not let us proceed.

We would rather receive a clear "no" on any item than an ambiguous yes.

Thank you,

[Signatory name]
Outfox Markets
https://outfoxmarkets.com

---

## Internal note — how to read the reply

Treat any item as **unconfirmed** unless the reply addresses it specifically. In particular:

- If the reply confirms item 1 but not item 2, the caching architecture is still unlicensed and the nightly-batch design cannot ship.
- If the reply confirms item 1 but not item 9, ten years of accumulated derived history is rented and the site must be able to rebuild from a different source.
- If the reply declines to confirm item 10 in writing, treat §2.3(d) as a live risk regardless of how unlikely enforcement seems. A bare, undefined competitive-product clause is the single hardest term in the contract.
- A reply from tier-one support quoting the pricing page back is not a licensing confirmation. Escalate.
