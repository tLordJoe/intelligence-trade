# House refresh: release preparation

September 8, 2026. **Not published.** This follows the frozen-corpus repair;
it does not replace or rewrite the earlier audit receipts.

## Results from the current source

| Measure | Verified result |
|---|---:|
| Official annual index reports selected/downloaded | 379 / 379 |
| Previous live archive | 997 transactions |
| Refreshed isolated candidate | 2,591 transactions |
| Added versus live archive | 1,594 |
| Added versus frozen repair candidate | 75 |
| Original IDs/raw evidence preserved | 997 / 997 |
| Unaccounted supported symbols / unresolved rows | 0 / 0 |
| Quarantined rows | 0 |
| Independent PDF economic-field matches | 2,591 / 2,591 |
| Final tests against refreshed archive | 508 passed; 0 skipped; 0 failed |
| Remaining empty-extraction scanned reports | 45 |

The source pass and isolated import passed their gates without overrides or
simulation. The published site's health endpoint was read separately and still
reported **997** records. No remote branch, pull request, merge, deployment, or
production import was changed during this preparation.

## Four reports newly covered by the source pass

| Document | Filer | Result |
|---|---|---|
| 20035190 | Gilbert Cisneros | 66 supported transaction rows; independent field match |
| 20035392 | David J. Taylor | 9 supported transaction rows; independent field match |
| 9116328 | Rohit Khanna | Scanned; no rows imported |
| 9116326 | Tony Wied | Scanned; no rows imported |

The annual index provides filing metadata. Neither a recent index entry nor
a successful PDF download establishes that the transaction occurred today.

## Scanned reports: still open

The queue increased from 43 to 45 with the two new scanned reports. A local
Apple Vision OCR attempt failed on the first test page, including a CPU-only
retry; it produced no trusted transaction data. No paid OCR service was used.

Visual review of Wied's first page establishes that this is not an empty report:
it contains actual entries as well as a printed example row. That example must
not be imported. Page-one observations alone are not a completed filing audit,
security match, or authorization to insert those rows.

An OCR/manual-review lane must retain source hashes, page/row locations,
ownership marks, checked amount bands and reviewed security identities, reject
printed examples, and separately identify “nothing to report” forms. Until
then, the public product must clearly describe readable House records rather
than complete government coverage.

## Release check caught and fixed

The archive pagination test expected a hard-coded 997 rows. It now checks the
actual archive size and exact record-ID conservation across every page. This
preserves the safety assertion without treating future additions as a failure.
All 508 tests passed against the refreshed archive, including the two tests
that previously skipped when source cache files were absent. Lint passed.
The production webpack build also passed against the refreshed archive.

## Evidence locations

- Local dry-run report and source inventory:
  `data/import-runs/run_2026-09-08T18-57-01-298Z_7896f8e2/`.
- Independent refreshed check: `scripts/.probe/r2a/fresh-independent.json`.
- Isolated refreshed archive: `scripts/.probe/r2a/refreshed-archive.json`.
- The ignored archive is an isolated release candidate, not the live file.
- [Frozen repair receipt](r2a-house-recovery-2026-09-08.md).

Remaining release decision: publish the corrected readable-House experience
with the scanned-coverage limit explicit, or hold publication until that
separate recovery lane is complete. Publication must use reviewed code and
fresh run evidence, followed by verification of deployed counts and routes.
