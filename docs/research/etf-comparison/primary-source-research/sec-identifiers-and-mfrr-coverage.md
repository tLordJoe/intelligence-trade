# SEC Identifiers and Risk/Return Summary Dataset Coverage — Firsthand Verification

**Date:** 2026-09-05 · All findings below were produced by directly downloading and parsing the SEC files named. Nothing here is secondary reporting.

## 1. Authoritative fund identifiers

Source: `https://www.sec.gov/files/company_tickers_mf.json` — 28,500 rows, fields `cik, seriesId, classId, symbol`.

| Ticker | CIK | Series ID | Class ID |
|---|---|---|---|
| VOO | 36405 | S000002839 | C000092055 |
| QQQ | 1067839 | S000101292 | C000271435 |
| SMH | 1137360 | S000034411 | C000105869 |
| SOXX | 1100663 | S000004354 | C000012084 |

This is the free, authoritative mapping and prevents share-class and series confusion. Refresh weekly. **Tickers must never be used as join keys.**

## 2. Mutual Fund Prospectus Risk/Return Summary data sets

- Index page: [SEC Risk/Return Summary data sets](https://www.sec.gov/data-research/sec-markets-data/mutual-fund-prospectus-riskreturn-summary-data-sets)
- File URL pattern (note the unusual `risk/return` path split): `https://www.sec.gov/files/dera/data/mutual-fund-prospectus-risk/return-summary-data-sets/2026q2_rr1.zip`
- Quarters available from 2023q3 onward. The 2026q2 archive is 81.6 MB.
- `num.tsv` columns: `adsh, tag, version, ddate, uom, series, class, measure, document, otherdims, iprx, value, footnote, footlen, dimn, dcml`
- Parsing requires `csv.field_size_limit(10**9)`.

### 2.1 Structural defects found

**The dedicated `class` column is empty in every row — 0 of 537,808.** Share-class identity is instead embedded in the `otherdims` string as `Class=C000092055;`, present on 240,376 rows (44.7%). **Any pipeline keyed on the `class` column silently returns nothing and looks like missing coverage rather than a parsing bug.** Parsing `otherdims` is mandatory.

**The `series` column is populated on only 37.0% of rows** (198,905).

**There is no period-length column.** VOO's ETF class carries three `AvgAnnlRtrPct` values per measure, all with `ddate = 20251231`, all with `iprx = 0`, all `dimn = 3`, all from accession `0000036405-26-000181`. Which value is the one-year, five-year, and ten-year figure is **not recoverable from the flat file**. It must be resolved from the source XBRL instance or the filing itself. Inferring it from value ordering is unsafe.

### 2.2 Coverage for the demonstration set — 2026Q2

| Fund | Class ID | Rows in 2026q2 |
|---|---|---|
| VOO | C000092055 | 33 |
| QQQ | C000271435 | **0** |
| SMH | C000105869 | **0** |
| SOXX | C000012084 | **0** |

All four CIKs do appear in `sub.tsv` — VOO accession `0000036405-26-000181` (485BPOS, VANGUARD INDEX FUNDS); QQQ `0001104659-26-052905` (497, INVESCO QQQ TRUST, SERIES 1); ISHARES TRUST 14 submissions; VANECK ETF TRUST 7 submissions including `0001137360-26-000365`. But the return rows are not tagged to the target classes. The VanEck filing rows carry series `S000020425`, a different series, with an empty class field.

**Conclusion: dataset coverage is per-quarter and incomplete. Reconciliation coverage must be accumulated across many quarterly files and will still have holes. A universal reconciliation gate keyed to this dataset is not supportable.**

### 2.3 VOO ETF class — verified values

Accession `0000036405-26-000181`, `document = ETFProspectus`, `otherdims = Class=C000092055;`, period ending 2025-12-31:

| Tag | Measure | Values |
|---|---|---|
| `AvgAnnlRtrPct` | `BasedonNAV` | 0.1784, 0.1438, 0.1478 |
| `AvgAnnlRtrPct` | `BasedonMarketPrice` | 0.1782, 0.1438, 0.1478 |
| `AvgAnnlRtrPct` | `AfterTaxesOnDistributions` | 0.1750, 0.1399, 0.1432 |
| `AvgAnnlRtrPct` | `AfterTaxesOnDistributionsAndSales` | 0.1077, 0.1148, 0.1234 |
| `ExpensesOverAssets` | — | 0.0003 |

Calendar-year `AnnlRtrPct` for the ETF class: 2018 −0.0442, 2019 0.3146, 2020 0.1835, 2021 0.2866, 2022 −0.1815, 2023 0.2625, 2024 0.2498, 2025 0.1784.

**The `measure` field is how the SEC itself distinguishes net asset value from market price.** This confirms the two-return-concept design in the implementation packet is a regulatory reality, not an Outfox invention, and it is the field to match on in a reconciliation.

### 2.4 Share-class confusion is materially large

The four classes of Vanguard 500 Index Fund report different calendar-year returns for 2018, and their expense ratios differ:

| Class ID | Class | 2018 return | Expense ratio |
|---|---|---|---|
| C000007773 | Investor | −0.0452 | 0.0014 |
| C000007774 | Admiral | −0.0443 | 0.0004 |
| C000092055 | ETF (VOO) | −0.0442 | 0.0003 |
| C000170274 | Institutional Select | −0.0440 | 0.0001 |

A **twelve-basis-point spread inside a single portfolio** is wider than any sane reconciliation tolerance. Matching on ticker or fund name instead of class identifier produces confident, wrong results.

## 3. Operational notes

- EDGAR requires a declared descriptive User-Agent and gzip; the documented fair-access limit is ten requests per second. **HTTP 429 was returned and enforced during this research when concurrent workers ran.** Serialize all SEC access behind one global rate limiter.
- `data.sec.gov` does not support cross-origin requests; a server-side proxy is required.
