# Senate collector — initial implementation

Status: local collection, normalization and partial-disclosure release preparation;
public route implemented but not approved or deployed.

The owner explicitly authorized accepting the official eFD disclosure-use agreement
in the September 14, 2026 conversation. The browser acceptance was completed and
verified by access to Find Reports. This records access authorization only; it does
not assert a legal conclusion about website publication or API redistribution.

## Run

```bash
node --experimental-strip-types scripts/import-senate.ts \
  --from 2026-09-01 --to 2026-09-13 --acknowledge-source-use
```

Use the acknowledgment flag only when authorized. The collector identifies Outfox
using its monitored business contact, hello@outfoxmarkets.com. No paid provider is
used. Search-session cookies stay in memory and never enter source artifacts.
The access notice is hash-pinned to the text reviewed at authorization; if that
text changes, the client stops before posting acceptance.

## Implemented

- Official eFD access/session flow and Senator-only periodic-transaction searches.
- Explicit filing/received-date windows, 100-row pagination, stable-count checks,
  duplicate detection and a pagination cap. No presumed rolling coverage.
- Local append-only run directories under ignored `data/senate-runs/`. Each run
  preserves index responses, report references, original HTML, content hashes,
  parsed rows and a summary including failures. Failed responses are not empty data.
- Exact electronic-report column checks and declared versus parsed row-count checks.
- Raw asset, ticker, transaction type, owner, amount and comment kept separately
  from normalized dates, directions and amount bounds. Source row identities are
  content-derived; duplicate-content occurrences remain separate.
- Distinct source received date, document filed date/time text and transaction date.
  No timezone is inferred for the displayed source filing time.
- Separate scan enumeration, official-media-only download and page-count checks.
  Scans remain awaiting extraction/review and prevent an all-reports-parsed claim.
- Amendment detection based on report titles, not boilerplate mentioning amendments.
  `reconcileSenateReports` requires an explicit hash-bound, reviewed complete-report
  replacement ledger and blocks unresolved or conflicting amendments. Actual
  amendments remain unresolved; no raw row count is presented as unique trading.
- No production archive writes, public API, schedule or automatic tab activation.

## Important classification boundary

The source labels some ETF and mutual-fund transactions as `Stock`. The parser's
`listedSecurityCandidate` is therefore only an intermediate selection, not a
verified company-stock classification. Security-master and fund-identity matching
must occur before stock-only aggregation. Missing symbols and non-public assets
remain archived, not guessed or silently removed.

## Initial real-source evidence

- September 1–13: five reports enumerated, five parsed, 22 source transaction rows.
- August 1–31: 27 reports enumerated, 25 electronic reports parsed, 306 source rows;
  two paper reports (13 archived scanned pages) need extraction; 13 electronic
  reports are amendments.
- The September source uses `Child` for a covered owner; this label is preserved.
- July 1–31: 12 reports enumerated; replay with the current parser accepts all 11
  electronic reports and 753 source rows. One five-page paper report is archived.
  The parser preserves on-the-hour filing times such as `12 PM` without adding
  source precision that was not displayed.
- June 1–30: 12 reports enumerated, 11 electronic reports parsed, 120 source rows;
  one seven-page paper report is archived, and one electronic report is an amendment.
- May 1–31: 17 reports enumerated, 16 electronic reports parsed, 81 source rows;
  one five-page paper report is archived, and three electronic reports are amendments.
- April 1–30: 10 reports enumerated, nine electronic reports parsed, 29 source rows;
  one six-page paper report is archived. No electronic amendments were found in this batch.
- All 36 April–August scan pages have local OCR text and word-position evidence, still
  explicitly unreviewed. OCR does not automatically become transaction records.
- Across these six received-date windows: 83 reports enumerated, 77 electronic
  reports parsed, and 1,311 source rows before amendment reconciliation. Six paper
  reports remain extraction/review work; 17 electronic amendments remain unresolved.
- None of these batches is a published Senate feed. These counts include amendment rows
  and must not be used as an activity leaderboard.

The implementation checkpoint passed all 575 repository tests and the production
build. This verifies code checks, not Senate publication readiness.

## Remaining release gates

1. Extract and verify paper/scanned reports, with page and row completeness evidence.
2. Resolve amendments against their originals with an explicit reviewed ledger;
   some August amendments refer to reports from previous years.
3. Match filer identities/roles and security identities without guessing.
4. Add a versioned candidate archive and reviewed promotion retaining last-known-good
   data; do not change the existing House archive during Senate validation.
5. Backfill earlier filing windows in batches with explicit coverage gaps.
6. Integrate the source into website/API read models and test accurate labels and
   filters, then review and publish the bounded coverage. Scheduling is separate.

Tests use expressly synthetic unit data; actual source evidence remains in local
run artifacts. Passing unit tests does not substitute for these release gates.

## Partial disclosure integration — September 15 checkpoint

**Publication gate updated by the owner:** collect and validate January 1, 2026
through the present date before publishing Senate data. The April–September
candidate described below is a development checkpoint, not an authorized interim
release. Promotion now enforces continuous received-date windows from January 1
through the promotion date; the public reader also rejects coverage ending before
September 15. The source's reporting lag remains explicit. YTD/30/90-day controls
filter transaction dates separately, and the homepage passes its selected period
into the Senate view.

The candidate loader verifies every archived HTML filename hash and reparses the
original bytes instead of trusting saved normalized rows. Repeated imports are
deduplicated by report identity and exact bytes; changed bytes/reference metadata
are held rather than overwritten. Across the collected windows this removes 25
repeat August downloads without collapsing legitimately repeated transaction rows.

Identity linkage uses the existing congress-legislators JSON source, its saved
SHA-256, exact full-name aliases and active Senate terms. The derived roster is
checked against the raw snapshot on every load. Where the source's official office
label names the senator differently, the original document header must independently
corroborate that exact office identity before linkage. It currently links 1,523
source rows; five rows for two unresolved formal names remain unlinked. No
last-name-only match or nickname guess is used. Issuer linkage additionally checks
SEC ticker/CIK and strong name agreement; 735 rows pass that check. This does not
classify a security as a company stock versus a fund.

Amendment reconciliation is scoped to filer/report-date families. A held amendment,
unparsed related report, changed document or unknown family date excludes that
family, not unrelated reports. The worklist identifies 17 amendments, including
14 whose originals remain outside collected windows. None has been silently
resolved, and neither an amendment nor its potentially superseded original is
released before reconciliation.

After the January–March backfill and September 14–15 refresh, the archived windows
continuously cover **January 1–September 15, 2026**. There are 114 unique electronic
reports containing 1,528 raw rows, plus nine paper reports. All 52 archived scan
pages have OCR review evidence, but no OCR transactions have been promoted.

These checks prepare **550 source-reported purchase/sale rows across 15 filers**
for an explicitly partial *listed-security disclosure* view. The YTD transaction-
date filter selects **505** of those rows as of September 15; filings can report
older transactions. These rows do not enter stock-only rankings. The remaining
978 parsed source rows and nine paper reports are outside this view. Completion
of the search date windows is not a claim that every report or asset has cleared
review, nor a claim of all Senate trades or current holdings. The public payload
remains pending approval; continuous date coverage alone does not promote it.

Material row comments survive in the public payload and visible row details.
Other notes in the same filing are available separately, explicitly not assigned
to every transaction. This retains advisor-directed trading context rather than
implying a senator personally selected every reported investment.

```bash
node --experimental-strip-types scripts/build-senate-candidate.ts
```

This writes ignored review artifacts and a pending public candidate; it never
changes the live archive. `ENABLE_LOCAL_SENATE_REVIEW=1` in development exposes
`/senate-review` with search, pagination, source links, row holds and the amendment
worklist. It is inaccessible in hosted environments or production.

`/senate` is implemented as a separate partial-disclosure page with breadcrumbs,
source links, account owners, reported amount ranges, separate transaction/filing
dates and explicit omissions. It returns not-found until a reviewed payload is
promoted. The homepage Senate tab remains unchanged; no public release has been
approved or deployed by this checkpoint. The homepage Senate control and sitemap
activate only when an approved payload exists. Its link explicitly says partial
coverage and opens the Senate disclosure view separately; House stock counts,
date windows and sector rankings are unchanged.

After source/coverage review, the explicit local promotion command is:

```bash
node --experimental-strip-types scripts/promote-senate.ts \
  --reviewed-by "REVIEWER" --acknowledge-partial-coverage
```

Promotion replays current raw evidence, requires the prepared candidate to match,
validates all public records, binds the approval to the entire payload hash, and
atomically replaces only `src/lib/senate-live.json`. It does not push or deploy.
The last-known-good live payload remains intact if any validation fails. Source
collection, partial publication and API redistribution are separate decisions.

Additional hash-bound ledgers (`data/senate-amendment-reviews.json` and
`data/senate-security-reviews.json`) support reviewed amendment replacement and
stock/fund classification. They start absent/empty, not implicitly approved.

## Offline review

```bash
node --experimental-strip-types scripts/review-senate-run.ts SENATE_RUN_ID
```

This verifies the original bytes against their saved hashes and reparses them. It
can recover a previously unsupported electronic layout without another download;
the original run summary stays unchanged. `scripts/ocr-senate-review.mjs` accepts
an archived run and an installed local OCR module/language cache. It verifies page
hashes, writes text and word-position evidence, and promotes zero transactions.
