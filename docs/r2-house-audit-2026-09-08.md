# R2 House integrity and coverage audit — September 8, 2026

**Audit complete. Release recommendation: HOLD the new buying rankings until the partial-row parser defect is repaired and a supervised candidate archive is reviewed.** R1's interface is ready for review, not published. Completing this audit does not mean the underlying data is complete or that all repairs have been implemented.

## Joe's question: why did the counts look so small?

They were understated by coverage limitations, including a newly confirmed parsing defect—not simply a quiet period. The 997 archived records comprise 388 purchases, 589 sales, and 20 exchanges across multiple transaction years. The archive is House-only, not House plus Senate. The year-to-date ranking previously discussed is not a defensible Congress-wide leaderboard.

### Confirmed blocking defect: missing rows inside nonempty filings

The parser splits on explicit spouse/joint/dependent ownership markers and reads only the first supported symbol inside each resulting block. A blank ownership column is legitimate, but it can leave many transaction rows inside one block. Because one row still parses, zero-row and total-yield checks do not detect the loss.

I examined all 375 locally cached PDFs used by the last import. Their current parser output reproduces exactly 997 rows. An independent symbol-accounting pass finds **1,515 supported-symbol mentions unaccounted for across 101 filings**. This is a diagnostic count, **not a certified count of 1,515 additional trades**: repeated references, asset context and row boundaries require validation before promotion.

The original [Cleo Fields filing](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20034894.pdf) proves actual loss: three separately printed NVIDIA purchases, all June 26, each $1,001–$15,000, under three different subholdings. The archive has one. The original PDF was re-downloaded, its hash matches the cached file, and its transaction table was visually reviewed. Three transactions still represent **one filer**, not three buyers.

The diagnostic's largest cases include Julia Letlow's 26-page filing 20030977 (197 symbol mentions; one parsed row) and Gilbert Cisneros's filing 20033983 (143 mentions; one parsed row). Those counts were measured from extracted text, not individually hand-certified transactions.

## Coverage reconciliation

| Check | Result | Meaning |
|---|---:|---|
| Fresh official annual index, PTR entries | 379 | Only periodic transaction reports; other disclosure types are not stock-trade rows. |
| Last import's accounted filings | 375 | 225 productive plus 150 zero-row filings. All remain in the current index. |
| Newly indexed/uncollected reports | 4 | Cisneros 20035190, Khanna 9116328, Taylor 20035392, Wied 9116326. Index filing dates are not proof of when a file became downloadable. |
| Scanned/empty-extraction reports in last run | 43 | 340 PDF pages; unresolved content, not automatically 43 missing-trade reports. |
| Khanna subset of scans | 7 reports / 261 pages | A material blind spot. No inferred trade count or automated OCR promotion. |
| Other zero-row categories | 56 no ticker; 51 no supported transaction | Inventory reproduced; not a hand-audit of every exclusion. |
| Archive record IDs / reconciliation keys | No duplicates | Does not establish completeness or rule out all semantic duplicates. |
| Source URL vs stored document ID | No mismatches | All 997 link suffixes agree with their stored filing IDs. |
| Raw filer-name strings / current counting identities | 75 / 74 | McGuire's two variants are one identity; names are not an authoritative person registry. |

Source index: [official House 2026 disclosure index](https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2026FD.xml). Captured September 8; frozen input and per-PDF audit output accompany this report under `docs/audits/r2-2026-09-08/`.

**Scans require discrimination.** The visually reviewed [Rogers report](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/9116311.pdf) says “Nothing to report for July 2026”; its printed example transaction must never become a real trade. In contrast, an inspected attachment page in [Khanna's scanned report](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/9116267.pdf) contains actual transaction entries, including instruments that cannot simply be mapped to an ordinary stock purchase. OCR output alone is not a validated archive.

## Identity and chronology review

**McGuire alias confirmed.** Fresh originals 20035367, 20034521 and 20033956 identify the VA05 member under the two archived name variants; the latest PDF also prints a suffix omitted from index-derived names. Matching district, filer name and repeated account context support the narrow alias. The scan of archived names found no other district with multiple raw name variants, but this does not prove every actor or ownership attribution is resolved. Generic middle-name stripping remains prohibited.

**Both chronology anomalies originate in the PDFs.**

- [Steve Cohen / SONY](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20033889.pdf): transaction printed December 26, 2026, notification January 21, and signature February 9. Do not guess a corrected year.
- [Christian Menefee / PINS](https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20034099.pdf): transaction printed June 11, 2026, but index/signature June 1. Do not silently change the filing or transaction date.

The current discovery calculations exclude both, and the archive UI shows a chronology warning. The import assessment now additionally emits `transaction_after_filing` while retaining the source values. This new warning has not been applied to the public archive.

## Source checks and limits

Nineteen original PDFs were freshly downloaded. Seventeen had cached counterparts; **all seventeen were byte-identical**. The other two were new reports absent from the last-run cache. This authenticates the checked sample—not all 375 cached PDFs against today's server bytes. All 375 cache files received a structural extraction/count audit and a SHA-256 in the evidence output; they were not all hand-read.

Targeted original-text review included the AAPL/NVDA purchase reports used in the earlier counts, the three McGuire reports, both chronology anomalies, and representative zero-row reports. Page images were inspected for the key missing-row example, chronology evidence, and contrasting scanned cases. Separate text extraction was used to check names, dates and amounts without relying on the application's row parser.

Two additional interpretation limits remain: archived owner fields are empty by a previously deferred migration, and a reported stock purchase may be an option exercise (the Pelosi NVIDIA source explains one). Do not describe this data as exclusively personal, discretionary, open-market purchases. PDF footnotes and ownership should be retained in the future evidence contract.

## Safeguards implemented in the review branch

1. An independent conservation check counts supported symbol mentions separately from the parser's own block counter.
2. Unaccounted mentions block the import even when that filing produced some valid rows. Aggregate evidence appears in run counts/reports; the importer prints affected document IDs.
3. Chronology inconsistencies receive an explicit source-preserving warning.
4. Regression tests reproduce the blank-owner multi-row failure and verify the blocking gate. They do **not** pretend that row recovery has been implemented.

The stricter gate would reject the present partial parse. It is intentionally fail-closed and remains local, unmerged and undeployed. No scheduled or supervised production import was dispatched during this audit.

## Required next repair, in order

1. Replace ownership-marker-only row segmentation with transaction/table-boundary parsing; handle blank ownership, repeated identical rows, wrapped cells and footnotes without merging separate accounts.
2. Reconcile all supported-symbol candidates into accepted rows or explicit reviewed exclusions. Validate representative long filings, not just small fixtures. Preserve prior IDs/revisions and avoid positional reassignment.
3. Run an isolated candidate import and compare every old record, recovered rows, totals, actor counts and evidence links. Do not overwrite the live archive while auditing.
4. Review and recover scanned reports as a separate OCR/manual lane, excluding example rows and explicit no-transaction filings; record remaining gaps.
5. Recalculate the homepage/layer rankings, then review the refreshed candidate and deployment together.

This is the publication dependency revealed by R2. It is not solved by changing colors, buying a market-price license, or simply refreshing the same parser.

## Verification receipt

R2 tests: 496 total, 494 passed, 2 existing cache-dependent integration tests skipped; zero failures. Lint and TypeScript passed. Final production and preview builds passed their isolation checks: 54 browser/public assets clear of fixture markers and five render artifacts checked per environment. The final preview artifacts were rechecked after the build completed. The archive remains byte-identical to the September 5 baseline. Full source recovery, OCR, and public release remain outstanding.
