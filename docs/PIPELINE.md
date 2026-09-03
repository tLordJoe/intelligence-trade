# Disclosure data pipeline

How congressional disclosure data gets from an official filing into the site,
and what stops bad data reaching production.

## Why this exists

Between 12 and 20 August 2026 the previous importer produced incorrect data on
eight consecutive days while reporting success every time. It:

- read a rolling window of the 40 most recent filings and **overwrote** the
  archive, so the published set fell from 225 records to 182 as older filings
  aged out of the window;
- matched symbols with `([A-Z]{1,5})`, which cannot match share classes such as
  `BRK.B` — the most likely reason a Berkshire Hathaway holding ended up tagged
  `CARR`;
- truncated issuer names at 60 characters;
- derived record ids from a running count of accepted rows, so skipping one row
  shifted every id after it.

Nothing failed, because nothing was asserted. Exit code 0 meant "no exception
was thrown", not "the data is correct".

## Flow

```
House Clerk XML index
        |
    fetch filings (PDF)
        |
    parse transaction rows
        |
    record gates ......... valid | warning | quarantined
        |
    append-only merge .... never removes a record
        |
    run gates ............ pass -> write, fail -> keep last known good
        |
    import report
        |
    production
```

## Stable identity

Records are keyed `{docId}::{contentHash}::{occurrence}`.

Two earlier designs were tried and rejected:

- **A content fingerprint** (politician, ticker, type, date, amount) collapses
  two legitimate same-day purchases of the same size in different accounts into
  a single record.
- **A positional ordinal** (`{docId}#{n}`, counting symbol-bearing blocks) breaks
  under parser improvement. The moment the parser recognizes a row it previously
  skipped, every ordinal after it shifts and every later transaction in that
  filing changes identity — records appear to vanish and be replaced.

Content addressing avoids both. The hash covers the row's own canonical content
within its document, so recognizing a new *earlier* row leaves every other row's
identity untouched.

Because the content hash includes fields a parser can correct — issuer name and
ticker text — a correction does move the hash. Each row therefore also carries a
**reconciliation key** built from the transaction's economic core alone: type,
amount, transaction date and owner, with its own occurrence counter. When the
merge cannot find a record by id, it looks up the reconciliation key, so a
corrected row is recognized as a revision of the record it supersedes rather
than arriving as a duplicate. Two different securities bought on the same day
for the same amount get different occurrence numbers and stay separate.

A correction to the amount or transaction date itself would move both keys and
appear as a new record. That is an accepted limit: those fields are the
transaction, not our reading of it. The occurrence counter distinguishes genuinely duplicated
identical transactions (`::0`, `::1`). Whitespace and case are normalized before
hashing, so cosmetic parser changes do not alter identity.

There is a regression test asserting exactly this: adding a newly recognized
earlier row must not change the ids of the rows after it.

### Matching order

Matching runs in two passes, and the order matters. The reconciliation key ends
in an occurrence counted across rows that share an economic core, and the core
excludes the ticker — so in one real filing five different securities shared a
core. Recovering a previously dropped row shifted every later occurrence by one,
and a single-pass merge then handed the recovered row the *next* record's key:
IDEXX's values landed on PTC's record and the genuine PTC row was discarded as a
duplicate.

Exact identity is never ambiguous, so all `id` matches resolve first and mark
their record claimed. Only then do the positional fallbacks run, and only
against records nothing has claimed.

### The reconciliation key follows the correction

The key is a *matching* index, not public identity. It answers one question —
"which stored record does this incoming row supersede?" — so when a correction
moves a row's economic core, the stored record's key has to move with it.

Keeping the old key breaks the **next** import rather than the current one. A
record whose amount was recovered would carry a new key on every later run,
while the stored record stayed indexed under the old one and no longer
qualified for the amountless fallback (it now has an amount). Nothing matched,
and the transaction was added again: exactly one permanent phantom duplicate per
corrected record, appearing on the second import, past both the archive-shrink
gate (the archive grows) and the duplicate-id gate (the ids genuinely differ).

On merge the record therefore adopts the incoming key, and the move is written
to the revision log as `provenance.reconciliationKey` so the change is visible
in the archive. `id`, `raw` and `provenance.firstSeen` are still never touched.

This also repairs keys that went stale for a second reason. Because the key's
occurrence counter is scoped to rows sharing an economic core, recovering a
previously dropped row shifts the occurrence of every later row in that core —
eight records across filings 20033737, 20034159 and 20034487 were holding keys
the parser no longer produces. They match by `id`, so nothing was visibly wrong,
but each was a latent duplicate waiting for its content to change.

## Corrections are applied and logged

Seeing a record again is not a no-op. A parser improvement changes how a row is
*interpreted* — a name parsed more completely, a ticker resolved correctly, a
warning cleared — and those corrections have to reach readers.

On re-parse, normalized fields are compared. Where they differ, the new values
are applied and the change is appended to the record's `revisions` log with the
run id and a field-level before/after. `raw`, `provenance.firstSeen` and identity
are never touched. A correction is therefore always visible rather than silent,
and always checkable against the source text.

## Raw values are never overwritten

Every record carries a `raw` object holding exactly what the filing said —
issuer name, ticker text, amount text, type, owner, and both dates as written.
Normalization only ever writes to separate fields. A correction can therefore
always be checked against the source text.

`provenance` records the filing URL, document id, row index, first-seen and
last-seen timestamps, the import run id, and the schema version. `firstSeen` is
set once and never changes; re-parsing a filing cannot rewrite history.

## Gates

### Record gates

Quarantine is reserved for **positive evidence of error** — something that would
put a false statement in front of a reader:

| Condition | Outcome |
|---|---|
| Issuer name contains a *different* registered symbol (`issuer_ticker_conflict`) | quarantined |
| Missing or non-official filing URL | quarantined |
| Missing document id | quarantined |
| Unparseable transaction or filing date | quarantined |
| Missing politician | quarantined |
| Unresolvable ticker (`unknown_ticker`) | warning |
| Issuer name fails to match the registered name (`issuer_ticker_mismatch`) | warning |
| Ticker matched only after punctuation normalization (`ticker_aliased`) | warning |
| Issuer name appears truncated | warning |
| Party could not be resolved (`unknown_party`) | warning |
| Amount present but unreadable (`amount_parse_failed`) | warning |
| Filer disclosed no amount (`amount_not_disclosed`) | warning |
| Amount marked not applicable (`amount_not_applicable`) | warning |

Two of these deserve explanation, because the first full backfill proved the
stricter version wrong:

- **Unknown tickers warn rather than quarantine.** The SEC's `company_tickers`
  feed is demonstrably incomplete — it omits listed issuers including `BK`,
  `EXAS`, `HOLX`, `CTRA`, `GTLS` and `OTCM`, and carries few foreign ADRs.
  Absence from the master is evidence of a gap in the master, not proof the
  symbol is wrong.
- **Name mismatch warns; only a name/ticker *conflict* quarantines.** Issuer
  names drift. GE now files as "GE Aerospace" while the master still reads
  "GENERAL ELECTRIC CO", and filers disagree with registrants about word breaks
  ("Exxon Mobil" against "ExxonMobil"). Quarantining on a failed name match
  rejected `XOM`, `MCD`, `SIRI` and `GE` in testing.

### Run gates

A failing run gate aborts the import. The previous known-good archive stays
live and nothing is written.

| Condition | Outcome |
|---|---|
| Archive would shrink | **fail** |
| Source returned no filings | **fail** |
| No filings parsed / no records parsed | **fail** |
| Every record rejected | **fail** |
| More than 50% quarantined | **fail** |
| Fewer than 90% of selected filings downloaded | **fail** |
| Fewer than 90% of downloaded filings parsed | **fail** |
| A previously productive filing now yields zero rows | **fail** |
| A zero-row filing holds a supported security (`unexplained_zero_row_filings`) | **fail** |
| Yield per filing below 85% of previous run or baseline | **fail** (override available) |
| More than 15% quarantined | warning |
| Yield per filing below 95% of previous run or baseline | warning |
| Records missing filing URL | warning |
| Duplicate ids collapsed | warning |
| Scanned filings whose text could not be extracted | warning |
| Amounts present but unreadable | warning |

Two of these deserve explanation.

**Completeness is measured as yield per filing, not as an absolute count.** The
import window is a scheduling decision — a backfill covers the whole annual
index (359 filings, 945 records), a routine run covers a slice. Comparing totals
across different window sizes would fail every routine run after a backfill: 150
filings yields roughly 395 records, far below 85% of 945. Comparing the rate
makes the check independent of window size while still catching a genuine
collapse.

**Completeness blocks rather than warns.** Append-only storage protects records
already held, but it cannot notice that a run *failed to collect* disclosures it
should have collected — that run looks identical to a healthy one, because
nothing was lost. A material shortfall is therefore treated as a broken run. A
reviewed override exists (`--allow-completeness-drop`) for the case where the
source genuinely published less; it converts the failure into a warning that is
recorded in the import report, so an override is never invisible.

**Filing completion is tracked separately from record counts.** Selected,
downloaded, parsed, failed and zero-row filings are counted independently, so a
run that quietly fetched one filing out of 150 fails on the ratio even if the
few records it did collect look healthy.

The archive-shrink gate is the one that would have stopped the August incident
on its first day.

## Running it

```bash
# Normal import — processes the full annual index by default
node --experimental-strip-types scripts/import-house.ts

# Dry run — parses and reports, writes nothing
node --experimental-strip-types scripts/import-house.ts --dry-run

# Narrower window (append-only, so this never removes anything)
node --experimental-strip-types scripts/import-house.ts --limit 150

# Reviewed override for a genuine drop in source volume
node --experimental-strip-types scripts/import-house.ts --allow-completeness-drop
```

The default is the whole index. The old importer's 40-filing window is what let
history age out of the archive; with append-only storage a full pass is safe,
and PDFs are cached locally so repeat runs only fetch what is new.

Every run writes a readable report to `data/last-import-report.txt` covering
what was fetched, accepted, warned, quarantined, and whether production moved.

It also writes a complete, immutable evidence set under
`data/import-runs/{runId}/` — `report.txt`, `summary.json`, `quarantine.json`
and, when relevant, `unseen-ids.json` — plus an entry in
`data/import-runs/index.json`, newest first.

**These are written whatever the outcome, before any production write.** The
first version of this pipeline wrote quarantine inside the success branch, so a
run that failed its gates discarded the very records explaining the failure, and
a single fixed report path meant the next run overwrote the last one's evidence.
A failed run now leaves the archive and the live review queue untouched while
retaining everything needed to diagnose it.

The live queue in `data/congress-quarantine.json` is only advanced by a run that
passed its gates; a failed run's quarantine stays in its own run directory, so
records produced by a run we do not trust never enter the review queue.

Quarantined records are written to `data/congress-quarantine.json` as
history-preserving entries — each carries its own `firstSeen`, `lastSeen`, the
list of runs in which it was quarantined, and a `resolution` state. The file
accumulates across runs rather than being overwritten, so a recurring problem
reads as recurring. Quarantined records are never served, and never silently
discarded.

## Amounts

An amount is stored as an explicit status plus **nullable** bounds. A missing
amount is never zero.

| `amountStatus` | `amountLow` / `amountHigh` | Meaning |
|---|---|---|
| `disclosed_range` | numbers | A bracketed range, as filed. |
| `disclosed_exact` | numbers | An exact figure, as filed. Filers do this. |
| `not_disclosed` | `null` | The filing discloses no amount. |
| `not_applicable` | `null` | The filing marks the amount not applicable. |
| `parse_failed` | `null` | An amount is present and we could not read it. |

`parse_failed` and `not_disclosed` are deliberately distinct: one is our defect,
the other is the filer's disclosure. Conflating them is how a defect stays
invisible.

All arithmetic goes through `src/lib/amounts.ts`. Every aggregate returns
`{ value, included, excluded }` — a total that cannot say how many records it
omitted is hiding the same problem somewhere else — and `value` is `null`, never
`0`, when nothing had an amount. Records without amounts sort last in **both**
directions and never match an amount filter, because unknown is not small.

The UI labels them "Not disclosed", "Not applicable" or "Amount unreadable". A
blank cell reads as zero, so a blank cell is a bug.

## Filings that produce no rows

Roughly 40% of filings yield no transaction rows, and that number alone hid a
real defect: twelve transactions were being dropped by the parser. Every empty
filing is therefore classified, and the classification is written to
`zero-row-filings.json` in the run's evidence directory — on every run,
including runs with no empty filings, so a missing file always means "no
evidence produced" rather than "nothing to report".

| Classification | Handling |
|---|---|
| `no_ticker_present` | Normal. A PTR body with no ticker at all. |
| `no_supported_security_transaction` | Normal. Names the unsupported asset codes (e.g. `CT` for cryptocurrency). |
| `empty_text_extraction` | **Warns.** Scanned paper filings; the contents are genuinely unread. |
| `unsupported_layout` | **Warns.** A document we do not recognise. |
| `parser_suspicious` | **Blocks.** A security we *do* support produced no row. |

`parser_suspicious` is the signature of silent row loss, so it fails the run
rather than warning. A filing that was empty before is never assumed healthy on
that basis alone: the separate `previously_productive_filings_now_empty` gate
covers regression, and classification covers the rest.

## Known limitations

- **Row owner is read from the filing, not the row.** `ownerText` is taken from
  the first four characters of the document, so every row in a filing shares one
  owner (in practice, empty). It is wrong, and it is pinned by a test rather
  than fixed, because `ownerText` feeds both the content hash and the
  reconciliation key: correcting it re-identifies every stored record and needs
  its own migration.
- **Party coverage.** Party comes from `data/house-party-map.json`, a lookup of
  48 members. Unresolved filers are recorded as `null` and warned, never
  guessed. 148 of 945 records currently lack a party.

  Consumers must never count these as Democratic or Republican. `party-stats.ts`
  buckets strictly into D / R / unknown, exposes an `unknown` filter so those
  filings stay reachable, and returns a disclosure sentence that any partisan
  summary is expected to display. Tests cover the legacy `"?"` substitution the
  API performs, plus null, undefined and empty values.
- **Security master coverage.** As above — incomplete, especially for foreign
  ADRs. Treated as advisory.
- **House only.** Senate disclosures are not ingested. The framework is designed
  to accept a second source, but no Senate collector exists yet.
- **Scheduled refresh is disabled.** The daily workflow was removed during
  containment. Its replacement,
  `.github/workflows/supervised-house-refresh.yml`, is **manual only** — it has
  a `workflow_dispatch` trigger and deliberately no `schedule:` block. It offers
  three modes: `dry-run` (parse and validate, write nothing), `import` (full
  import, commit only on a clean pass) and `simulate-failure`, which passes
  `--simulate-gate-failure` to inject a named gate failure after assessment.
  That injection is deterministic — it does not depend on the source happening
  to fail — and is refused outright in `import` mode. Because it forces
  `passed: false`, it travels the same path that already prevents production
  writes: it can only cause a refusal to publish, never a bad publish.

  The run pointer `data/import-runs/latest-run-id.txt` is gitignored and cleared
  before each run. A pointer inherited from checkout could otherwise let a run
  that crashed early attach a *previous* run's evidence to itself. Evidence is
  resolved only from the importer's own output or from a pointer written during
  that execution; if neither exists, the run reports no evidence and uploads
  only its log rather than substituting an earlier run. Evidence is uploaded under
  `if: always()` with 90-day retention, and the commit step is reachable only
  when the importer exited zero. A schedule will be added only after one
  complete supervised run has been reviewed.

## Adding a source

The gates, merge and schema are source-agnostic. A new collector needs to:

1. produce `DisclosureRecord` objects with `raw` and `provenance` populated;
2. use a stable source-derived identity (`filingRowId` or an equivalent);
3. pass records through `assessRecord`, then `mergeRecords`, then `assessRun`;
4. add regression fixtures for whatever that source gets wrong.

Do not add a source until the one before it passes cleanly.
