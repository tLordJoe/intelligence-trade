# Institutional holdings: gated implementation checkpoint

The `/institutions` route and homepage link stay unavailable until a reviewed artifact is promoted. This checkpoint has **synthetic parser/reconciliation tests only**. It has not been validated against a real SEC filing corpus and must not be activated yet. No paid API is required.

## Meaning and scope

Form 13F reports quarter-end positions, not execution dates, purchases, sales, current holdings, or an ETF's own constituent portfolio. Manager CIK, source issuer name, class, CUSIP, optional FIGI, option side, discretion, other managers, voting authority, reported value and quantity units are retained. No ticker is inferred from a name or CUSIP.

The parser checks complete-submission accession and filing date, XML manager CIK, quarter end, entry counts, and value totals. Filing dates before January 3, 2023 use thousands of dollars; later filings use dollars. Raw values remain available and each filing requires a separate units review because an issuer may have filed an incorrect value. Quantity calculations use decimal strings and integer arithmetic.

All amendments (including new-holdings amendments), multiple originals, conflicting evidence, confidential omissions, combined reports, and shared-manager reports are conservatively held. Unsupported notices or failed filings block that manager. This version does not resolve amendment families; it never silently treats an amended original as final.

The position-change helper compares consecutive quarter ends for one manager, preserving security/class/option/discretion boundaries. Differences are **reported quantity differences**, not trades, and may reflect splits or other reporting changes. This helper is not yet displayed on the page.

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
