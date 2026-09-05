# SEC Form 4 pipeline

Outfox's own collection and parsing of SEC ownership documents (Forms 4 and
4/A). This document covers the parser and the manual importer. There is no
public UI, no schedule, and no production dataset in this stage.

## What exists

| Path | Role |
|---|---|
| `src/lib/form4/xml.ts` | Safe XML reader — refuses doctypes, entity declarations, oversized and deeply nested input |
| `src/lib/form4/types.ts` | Record contract |
| `src/lib/form4/validate.ts` | Runtime value rules — dates, decimals, booleans, identifiers |
| `src/lib/form4/classify.ts` | Transaction-code classification |
| `src/lib/form4/parse.ts` | Ownership XML → records |
| `src/lib/form4/enumerate.ts` | Official SEC index enumeration |
| `src/lib/form4/merge.ts` | Append-only candidate merging |
| `scripts/import-form4.ts` | Manual importer, dry-run by default |
| `tests/fixtures/form4/` | 35 real filings with manifest, URLs and hashes |

## The rules that shape everything

**Unknown is not zero, false, or an invented date.** Every field the source may
omit is nullable and carries a reason: `not_present_in_source`,
`footnote_instead_of_value`, or `unparseable`. A gift reporting a price of
exactly `0` keeps that zero; a transaction whose price lives in a footnote
carries `null` and the footnote id. Collapsing either into the other is how a
`$0` sale reaches a total.

**Raw beside normalized.** Every parsed value keeps the source text next to it,
so a corrected reading can always be checked against the document.

**No floating-point money.** Shares and prices are normalized decimal strings.
Share counts routinely exceed exact float representation.

**Acquired is not bought; disposed is not sold.** A gift disposes shares at zero;
an award acquires them without a purchase. `classify.ts` is a separate module
precisely so this conversion has nowhere to hide.

## Classification

| Code | Classification | Note |
|---|---|---|
| `P` / `S` | reported purchase / sale | May be private or with the issuer — not necessarily open-market |
| `A` | award | Rule 16b-3(d) acquisition |
| `M` `C` `X` `O` | exercise or conversion | |
| `F` | withholding or exercise cost | Not a sale |
| `D` | disposition to issuer | |
| `E` `H` | expiration or cancellation | Not withholding |
| `G` gift · `W` inheritance · `Z` voting trust | as named | |
| `L` `I` `J` `U` | other reported | Requires the filer's explanation |
| `K` `V` | **modifiers** | Never a transaction event of their own |
| anything else | `unknown_code` | Preserved and flagged, never guessed |

Only non-derivative `P` and `S` are eligible for an ordinary purchase or sale
screen. A derivative `P` buys an option, not shares, and must never be totalled
with common stock.

Nothing here asserts sentiment, conviction, legality, or that a transaction was
discretionary. The code says what kind of event was reported and no more.

## Identity

A row's id is `{accession}::{documentSha256}::{table}::{rowKind}::{ordinal}`,
tied to the archived bytes it came from. Re-parsing identical bytes reproduces
identical ids even when the interpretation of a field changes, so a parser
correction produces a revised interpretation rather than an extra transaction.

Accession is the filing-level deduplication key: the same filing appears in the
index once per associated CIK. Identical-looking rows inside one document stay
distinct, because two holdings of the same security are two disclosures.

Multiple reporting owners never multiply a row. A filing with ten owners and one
sale is one sale.

## Amendments

A 4/A has its own accession and its own immutable rows. Original submission
date, issuer, owners and period are candidate evidence, not identity, so the
link status starts at `unresolved` and stays there. **This stage performs no
automatic supersession.** Multiple price-band rows on one date make broad
matching unsafe, and an amendment can itself correct the fields you would match
on. Confirmed links require a reviewed mapping.

## Timestamps

Kept separate because they answer different questions:

- `periodOfReport` — from the document
- `filedDate` — as reported by the regulator
- `acceptedAt` — nullable, with a named source
- `publiclyAvailableAt` — **never fabricated**; the dissemination time is not in
  the document, so it is null
- `firstObservedAt` / `lastObservedAt` — our fetch, immutable on first write
- `observationMode` — `live` or `backfill`, so a backfill can never be mistaken
  for a historical publication time

No freshness class is derived from source type, and no late-filing badge is
computed.

## Enumeration

Selection comes from the **official SEC daily form index**, one per date in the
window:

```
https://www.sec.gov/Archives/edgar/daily-index/{YYYY}/QTR{n}/form.{YYYYMMDD}.idx
```

Only exact form types `4` and `4/A` are taken — prefix matching would sweep in
unrelated forms. Columns are split on runs of two or more spaces, because a
company name contains single ones.

**An unavailable index is not an empty day.** A missing index returns 403, not
404, and a weekend, a holiday and a publication lag all look alike from outside.
Each date is recorded as `available`, `unavailable` or `malformed`, and a window
containing anything but `available` is marked incomplete and **blocks
promotion** with `enumeration_incomplete:{dates}`. A day whose index was
retrieved and held no Form 4s is complete with zero filings — a different fact,
recorded differently.

Issuer filtering is applied **after** enumeration. Narrowing first would make a
missing issuer indistinguishable from a missing index.

Accession is the deduplication key: EDGAR lists one filing once per associated
CIK.

## Candidate promotion is append-only

Promotion **merges** into whatever the candidate already holds. It never writes
the run's selection over the file.

This matters because the runs are bounded. A one-issuer, one-week run that
overwrote the candidate would replace an archive built from a far wider window
with its own slice, and the loss would be invisible — the file would simply be
smaller.

Merging can add a filing, and can add a new *document version* of a filing it
has seen. It has no path that removes one. If the bytes at an accession change,
both versions are retained and distinguished by document hash; a source revision
never silently overwrites what was archived. `firstObservedAt` is set once and
carried forward.

Any accession present before and absent after blocks the write. A corrupt
candidate file is refused rather than treated as empty — starting from empty
would turn one bad file into a total archive loss on the next promotion.

## Running it

Offline, against the committed fixtures — no network, no credentials:

```bash
node --experimental-strip-types scripts/import-form4.ts --mode fixtures
```

A bounded networked window. `SEC_USER_AGENT` must be a **real monitored
contact**; there is no default and the run refuses without one:

```bash
SEC_USER_AGENT="Outfox Markets (contact: YOUR_ADDRESS)" \
  node --experimental-strip-types scripts/import-form4.ts \
  --mode dry-run --from 2026-08-28 --to 2026-09-03 --issuers NVDA,MSFT
```

`--issuers` is optional. Without it the window is enumerated in full, which for
a single day is roughly two thousand Form 4s.

`--mode candidate` additionally promotes to `data/form4-candidate.json` when
every gate passes. `--source fixtures` selects the offline corpus in any mode,
which is how promotion is exercised without the network. `--simulate-gate-failure`
deterministically refuses promotion after evidence is written.

Requests are capped at roughly 4.5/second globally with bounded retries and
backoff. Only `www.sec.gov` archive paths are followed.

## Gates

Promotion requires every selected document to be accounted for as parsed,
unsupported, or failed — and requires zero failures, zero quarantined rows, zero
quarantined filings, no row-identity collision and no duplicate accession.

A run that fails **before** reaching its gates — an unreachable index, a
timeout, an invalid window — still writes `summary.json`, `errors.json` and
`report.txt` recording why, and leaves the previous candidate byte-identical.

A failed run writes its evidence and changes nothing. Each run writes its own
directory under `data/form4-runs/{runId}` containing the selection manifest,
summary, report, quarantine, unsupported list, errors, and the raw source bytes
addressed by hash. A single-writer lock refuses concurrent imports.

`data/form4-runs/` and `data/form4-candidate.json` are gitignored: run output is
local evidence, not repository history.

## Coverage claims

The importer enumerates per issuer over an explicit window and records exactly
what was selected. **This is not market-wide Form 4 coverage** and the run
summary says so in `coverageNote`. Nothing downstream may describe a sampled,
issuer-filtered window as complete.

## Known limits at this stage

- No computed transaction value. Deriving one needs decimal arithmetic and a
  documented basis, and must never be called cash paid.
- No amendment resolution, by design (above).
- Quarterly full-index enumeration is exposed as a URL builder but the importer
  uses daily indexes only; a multi-quarter backfill would want the quarterly
  file instead of hundreds of daily fetches.
- No exercise-leg pairing. Legs stay separate source rows; linking them is a
  later derived feature that requires evidence.
- Ticker resolution is unresolved for every filing. The issuer's filed symbol is
  preserved but never promoted to a resolved ticker.
- Five schema versions have fixture coverage (X0305, X0306, X0407, X0508,
  X0609). Anything else is refused as `unsupported_schema_version` rather than
  parsed optimistically.
- Forms 3 and 5 share this schema and are explicitly refused, so they cannot
  enter a selection advertised as 4/4A only.
