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

Records are keyed `{docId}#{rowIndex}` — the House Clerk's own document id plus
the ordinal of the symbol-bearing block within that filing.

A content-derived key (politician, ticker, type, date, amount) was considered
and rejected: two legitimate same-day purchases of the same size in different
accounts would collapse into one record.

`rowIndex` counts every symbol-bearing block, including ones that yield no
usable transaction, so an id stays attached to the same row even if parsing
rules change later.

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
| No amount range found | warning |

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
| More than 15% quarantined | warning |
| Accepted count below 90% of previous run | warning |
| Accepted count below 90% of rolling baseline | warning |
| Records missing filing URL | warning |
| Duplicate ids collapsed | warning |

The archive-shrink gate is the one that would have stopped the August incident
on its first day.

## Running it

```bash
# Dry run — parses and reports, writes nothing
node --experimental-strip-types scripts/import-house.ts --limit 40 --dry-run

# Normal import
node --experimental-strip-types scripts/import-house.ts --limit 150
```

Every run writes a readable report to `data/last-import-report.txt` covering
what was fetched, accepted, warned, quarantined, and whether production moved.

Quarantined records are written to `data/congress-quarantine.json`. They are
never served, and never silently discarded.

## Known limitations

- **Party coverage.** Party comes from `data/house-party-map.json`, a lookup of
  48 members. Unresolved filers are recorded as `null` and warned, never
  guessed. 148 of 945 records currently lack a party.
- **Security master coverage.** As above — incomplete, especially for foreign
  ADRs. Treated as advisory.
- **House only.** Senate disclosures are not ingested. The framework is designed
  to accept a second source, but no Senate collector exists yet.
- **Scheduled refresh is disabled.** `.github/workflows/refresh-congress.yml`
  was removed during containment and has not been restored. Re-enabling it is a
  deliberate decision to be made after this pipeline has been reviewed.

## Adding a source

The gates, merge and schema are source-agnostic. A new collector needs to:

1. produce `DisclosureRecord` objects with `raw` and `provenance` populated;
2. use a stable source-derived identity (`filingRowId` or an equivalent);
3. pass records through `assessRecord`, then `mergeRecords`, then `assessRun`;
4. add regression fixtures for whatever that source gets wrong.

Do not add a source until the one before it passes cleanly.
