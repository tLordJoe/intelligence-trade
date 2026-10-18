# ETF Comparison Tool — Research and Specification

Documentation only. Nothing in this directory is executed, imported, or built. No
application code, generated data, workflow, or production surface is affected by
anything here.

## Read these two, in this order

| File | Role |
|---|---|
| [`implementation-packet-v2.md`](./implementation-packet-v2.md) | The base specification. Replaces an earlier v1 spec in full. |
| [`addendum-a.md`](./addendum-a.md) | **Controlling** for sections 2.2, 4.7, 8, 11 and 12 of the packet. Where the two documents conflict, Addendum A wins for those sections. |

Reading the packet alone will give you the wrong demonstration set, the wrong
holdings-overlap rule, a withdrawn gate, and materially wrong vendor costs.

## What Addendum A changes

- **Demonstration set** is the Starter 5 — VOO, QQQ, XLK, SMH, XLU. SOXX stays a
  first-class fund in the dataset as the semiconductor category comparison against
  SMH, but does not occupy a Starter 5 slot.
- **Holdings overlap** is computed at the latest *common* as-of date across the
  selected funds, showing each fund's own source date alongside the common
  comparison date. Partial holdings are never renormalised to 100%.
- **Gate G8 is withdrawn.** It was ticker-specific to a single SOXX split. It is
  replaced by generic Gate G19, because XLK and XLU also split 2-for-1 on
  2025-12-04 and the issuer's own downloadable price history is unadjusted.
- **A ±35% single-day move is an anomaly requiring investigation, not evidence of
  a split.** No corporate-action record may ever be synthesised from the size of a
  price gap. See §6.2(a1)–(a3).
- **Vendor costs are corrected.** See `vendor-licensing/`.

## Supporting research

### `primary-source-research/`

Fund-by-fund extraction from SEC EDGAR filings and issuer disclosures. Every value
carries a source URL and, where applicable, an accession number.

| File | Covers |
|---|---|
| `voo-qqq-primary-source-profile.md` | VOO, QQQ |
| `xlk-xlu-primary-source-profile.md` | XLK, XLU |
| `smh-soxx-primary-source-profile.md` | SMH, SOXX |
| `sec-identifiers-and-mfrr-coverage.md` | SEC series/class identifiers and Risk/Return Summary dataset coverage |
| `holdings-republication-rights-audit.md` | **Read before building any holdings feature.** Republication and derived-use rights for every candidate holdings source, including all five issuers and four index providers |

### `vendor-licensing/`

| File | Covers |
|---|---|
| `vendor-licensing-survey.md` | Cross-vendor survey of market-data licensing terms |
| `twelve-data-venture-verification.md` | Clause-level verification of the Twelve Data Venture plan against an enumerated rights checklist |
| `alternative-vendors-rights-verification.md` | Clause-level verification of EODHD, Financial Modeling Prep, Polygon.io/Massive, Intrinio and Nasdaq Data Link against the same rights checklist |
| `twelve-data-outreach-draft.md` | **Unsent draft.** Written licensing confirmation request. Not to be sent without owner approval. |

## Two things that will bite an implementer

**Identifiers, not tickers.** Funds resolve by SEC series and class identifier.
**XLK and XLU share CIK 1064641** — they are separate series of one registrant, so
a CIK-level lookup is a defect, not a shortcut. Sibling tickers XLKI and XLUI share
the same issuer data files and will cross-contaminate a naive parse.

**Licensing is unresolved, and it gates the feature, not just the vendor choice.**
Several rights required for a public, anonymous, advertising-supported comparison
tool are not granted by any publicly documented plan and are marked
"written vendor confirmation required." Do not build against an assumption that a
pricing-page phrase grants a contractual right.

**Holdings must come from SEC EDGAR, not from issuer websites.** All five issuers
of the six funds expressly prohibit republication and commercial or derived use of
their holdings files, even though several of those files download to an anonymous
script with no barrier. EDGAR Form NPORT-P is the only holdings source carrying an
affirmative written republication permission from its publisher. It is quarterly,
not daily, and the product copy must say so. Details and the full clause-by-clause
evidence are in `primary-source-research/holdings-republication-rights-audit.md`.

## Status

Research and specification only. No implementation authority is conferred by these
documents. Cost figures are corrected as of 2026-09-05 and are not quotes.
