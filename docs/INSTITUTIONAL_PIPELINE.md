# Institutional holdings: gated implementation checkpoint

The `/institutions` route and homepage link stay unavailable until a reviewed artifact is promoted. The first real-source replay covers three archived Berkshire Hathaway filings; broader corpus and independent release review are still required. No paid API is required.

## Meaning and scope

Form 13F reports quarter-end positions, not execution dates, purchases, sales, current holdings, or an ETF's own constituent portfolio. Manager CIK, source issuer name, class, CUSIP, optional FIGI, option side, discretion, other managers, voting authority, reported value and quantity units are retained. No ticker is inferred from a name or CUSIP.

The parser checks complete-submission accession and filing date, XML manager CIK, quarter end, entry counts, and value totals. Filing dates before January 3, 2023 use thousands of dollars; later filings use dollars. Raw values remain available and each filing requires a separate units review because an issuer may have filed an incorrect value. Quantity calculations use decimal strings and integer arithmetic.

All amendments (including new-holdings amendments), multiple originals, conflicting evidence, confidential omissions and combined reports are conservatively held. Parsed 13F-NT notices are separate source records with their named other reporting managers; their quarter families are held for collection of those managers, never interpreted as empty holdings. Unparsed or failed filings block that manager. This version does not resolve amendment families; it never silently treats an amended original as final.

A holdings report may legitimately include other managers. Its declared included-manager count must match its numbered identity list; every row qualifier must resolve uniquely to that list. The original ordinal, name, CIK and 13F file number are retained. Stable comparison identities use normalized 13F file numbers (or a source CIK when no file number exists), never the filing-local ordinal or name alone. Rows expose reporting-manager and shared-discretion context; they are not independent purchases by every named manager, and duplicate reporting across different reporting managers must not be summed blindly. Unknown manager identities/qualifiers remain blocked.

The official `028-` and `28-` 13F file-number prefixes normalize to the same identity while their original text remains preserved. State Street's archived X0202 originals omit `isAmendment`. This variant is accepted only with the official thirteenffiler namespace, X0202 schema marker, matching original-form SEC submission header and XML form, and no amendment metadata. The derived flag is explicitly labeled `original_form_omitted_flag`; missing flags on amendments or unsupported variants remain errors.

The position-change helper compares consecutive quarter ends for one reporting manager, preserving security/class/option/discretion and resolved included-manager boundaries. Optional FIGI enrichment does not define identity. Differences are **reported quantity differences**, not trades, and may reflect splits or other reporting changes. This helper is not yet displayed on the page.

### Verified local Berkshire replay

Run `institutions_341b46e8-2c03-4f10-889b-01b7c509422f` retains original SEC inventory and submission hashes. The replay parses accession `0001193125-26-054580` (2025-12-31, 110 rows), `0001193125-26-226661` (2026-03-31, 90 rows), and `0001193125-26-352200` (2026-06-30, 89 rows): 289 rows, three eligible filings, zero family holds or parse failures. The latest pair yields 93 attributed positions: 86 reported in both quarters (7 quantity increases, 9 decreases, 70 unchanged), 3 newly reported, 4 no longer reported. These counts are manager/security attribution groups, not trade counts. The public artifact remains unapproved.

The archived-corpus regression runs when this local evidence directory exists and explicitly skips if it is absent (raw runs are not committed). Always-on synthetic regressions separately cover ordinal renumbering, optional FIGI, malformed manager lists, unresolved qualifiers and distinct stable manager identities.

## Collect a bounded official corpus

Run from the repository root, replacing the manager and window with a reviewed collection plan:

```sh
SEC_USER_AGENT='Outfox Markets hello@outfoxmarkets.com' node --experimental-strip-types scripts/import-institutions.ts --cik MANAGER_CIK --from YYYY-MM-DD --to YYYY-MM-DD --max-filings 10
```

The collector uses SEC submissions JSON and complete filing text, follows relevant historical submissions shards, identifies requests with `hello@outfoxmarkets.com`, spaces requests at least 550 ms apart, refuses redirects, bounds response size/time, and refuses to truncate when the filing limit is exceeded. It does not retry or bypass a denial. Backfill uses explicit per-manager filing-date windows; a window is not a claim of all-market or full-history coverage. Later amendments outside the collected window cannot be discovered without a subsequent refresh.

Each uniquely named `data/institution-runs/institutions_UUID` folder contains content-addressed raw bytes and a write-once manifest. Normalized output is never evidence. Review replays hashes and the archived SEC inventory, verifies historical-shard completeness, and reconciles duplicate filings across runs. Incomplete runs stop candidate preparation; keep them as evidence and deliberately move them outside the active run directory before retrying preparation. Individual filing failures remain visible and block affected managers.

### First real-source validation: Berkshire Hathaway

```sh
SEC_USER_AGENT='Outfox Markets hello@outfoxmarkets.com' node --experimental-strip-types scripts/import-institutions.ts --cik 0001067983 --from 2026-01-01 --to 2026-09-15 --max-filings 30
node --experimental-strip-types scripts/validate-institutions.ts --run institutions_UUID
```

Use the returned run ID. The read-only validator reports every accession, period, row count, hash, hold and failure, then compares the latest two reported periods only if both are eligible and consecutive. It does not presume that those quarters exist or fall back to an older pair when a newer quarter is held. The expected pair for this collection cutoff is March 31 and June 30, 2026; the source must establish that. The collector stops fetching after its first failed filing request, records remaining accessions as unattempted failures, and exits nonzero. No automatic retry or production change occurs.

## Review and local promotion

```sh
node --experimental-strip-types scripts/review-institutions.ts
```

Inspect `data/institution-candidate.json`, all holds/failures, and each original filing. In `data/institution-filing-reviews.json`, record one entry per eligible accession:

```json
[
  {
    "accession": "REPLACE_WITH_OFFICIAL_ACCESSION",
    "sourceSha256": "REPLACE_WITH_ARCHIVED_SOURCE_HASH",
    "reviewedBy": "REVIEWER",
    "reviewedAt": "ISO_REVIEW_TIMESTAMP",
    "evidenceNote": "Explain identity, quarter, totals and unit checks against the original filing.",
    "unitsVerified": true
  }
]
```

Do not populate a review ledger from synthetic fixtures or mark unperformed checks complete. When the real corpus is verified:

```sh
node --experimental-strip-types scripts/review-institutions.ts --promote --reviewed-by REVIEWER --acknowledge-partial-coverage
```

Promotion replays official evidence again, requires the prepared payload to match, checks each source-bound review, rejects held/empty payloads, and atomically writes `src/lib/institutions-live.json` locally. It neither commits nor deploys. The runtime verifies the approved hash; the homepage and sitemap enable the route only with a valid approved artifact.

## Before any public activation

- Validate real modern and legacy filings, both amendment types, notices, confidential and combination reports, varied namespaces, options and principal units.
- Review manager coverage, collection cutoff and amendment exclusions; refresh through the release date to reduce stale-original risk.
- Independently replay the candidate and source-bound ledger. No synthetic records may enter a release.
- Test the enabled route in desktop and mobile browsers with reviewed real data. This checkpoint only guarantees the pending/disabled state.
- Wider manager discovery, automated incremental scheduling, amendment adjudication, security-to-ticker mapping, and displayed quarter comparisons remain future work.

## Resumable first cohort

`data/institution-manager-universe.json` explicitly names 13 candidates: Berkshire Hathaway, Vanguard, State Street, FMR, JPMorgan Chase, Goldman Sachs, Morgan Stanley, Citadel Advisors, Renaissance Technologies, Two Sigma Investments, Bridgewater Associates, Coatue and Tiger Global. This deliberately mixes reporting-manager contexts; it is not a statistical sample, a ranking or universal institutional coverage. Except for the existing Berkshire replay, entries are candidate identity assertions pending exact SEC-name corroboration. A parent financial group is not assumed to hold every affiliated fund's portfolio, and no ETF issuer page is substituted for a reporting manager.

```sh
SEC_USER_AGENT='Outfox Markets hello@outfoxmarkets.com' node --experimental-strip-types scripts/collect-institution-cohort.ts --id first-cohort-2026-q2 --from 2026-01-01 --to 2026-09-15 --previous-period 2026-03-31 --current-period 2026-06-30 --max-filings 40 --max-managers 3
SEC_USER_AGENT='Outfox Markets hello@outfoxmarkets.com' node --experimental-strip-types scripts/collect-institution-cohort.ts --id first-cohort-2026-q2 --resume --max-managers 3
```

Repeat the resume command until the cohort report has no pending entries, inspecting failures between attempts. `--max-managers` bounds new attempts per invocation. Transport failures stop the invocation, rather than hammering subsequent SEC endpoints. Failed or interrupted attempts can be resumed; held identity/amendment results remain held unless `--retry-held` is explicitly requested. Never use retries to evade a denial. After addressing the cause, a retry preserves prior attempts and creates fresh raw evidence. A crash leaves an exact `.lock` file: verify its recorded process is no longer active before removing that single stale lock.

The immutable plan snapshot/hash pins manager identities, filing window and target quarters. Resume uses that saved plan, not later edits to the universe file. To change coverage or refresh the cutoff, create a new cohort ID. Every already-ready entry is replayed before it can be skipped; neither stale JSON nor an existing success label substitutes for source validation. The report under `data/institution-cohorts/` preserves per-manager accessions, dates, identities, source hashes, row counts, amendment holds, parser/transport failures and comparison counts. A manager is `ready_for_review` only when its official submissions name and filing names match the declared identity and both latest source quarters match the requested consecutive pair. This is preparation, not approval. No collector command changes the public artifact.

Global candidate preparation currently scans the raw run directory and intentionally refuses incomplete runs. Cohort reports do not bypass that gate: preserve failed run evidence outside the active raw-run set before a later explicit release review. Broad real-source validation, coverage acceptance and source-bound reviews are still needed before publication; a 13-manager declaration alone is not coverage.

After parser fixes, refresh existing evidence without network or recollection:

```sh
node --experimental-strip-types scripts/collect-institution-cohort.ts --id first-cohort-2026-q2 --resume --replay-only
```

The first three manager replays now yield two ready-for-review managers (Berkshire and State Street), one held (Vanguard), zero parser failures and ten uncollected candidates. State Street's accessions `0000093751-26-000100`, `0000093751-26-000315`, `0000093751-26-000507` contain 4,288, 4,269 and 4,177 rows respectively. Its latest pair has 4,991 attributed positions: 3,455 in both quarters, 722 newly reported and 814 no longer reported. Attribution changes may change these groups without an executed trade.

Vanguard accession `0000102909-26-000031` is a **combination report** for December 31, 2025 with 17,686 parsed rows and remains held. Accessions `0000102909-26-002707` and `0000102909-26-002714` are **notices** for March 31 and June 30, 2026; each identifies ten other reporting managers. They are successfully parsed as notices, but are not a comparable holdings pair. Their referrals are preserved for separate, reviewed manager collection—not silently followed or attributed to the parent group.
