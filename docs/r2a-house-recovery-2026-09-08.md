# R2 House transaction recovery

Updated September 8, 2026. **Local candidate only; not published.**

## Where we are

- **R1:** preview implementation and verification finished; ready for review, not published.
- **R2:** the House coverage audit found missing transaction rows. The repair below addresses that finding (tracked as R2a in the roadmap).
- **R2a repair:** ready for review. Independent source reconciliation, final regression tests and both builds passed. No active worker remains after this completed handoff.

## Verified recovery

| Measure | Result |
|---|---:|
| Existing archived transactions | 997 |
| Rebuilt candidate transactions | 2,516 |
| Additional recovered transactions | 1,519 |
| Existing record IDs preserved | 997 of 997 |
| Existing immutable raw records changed | 0 |
| Original cached PDF documents cross-checked | 375 |
| Economic-field rows matched by independent PDF extraction | 2,516 |
| Differences in that independent comparison | 0 |
| Second replay: additional / revised records | 0 / 0 |

These are transaction counts, **not distinct people**. They include supported rows in the frozen House corpus, not all Congress, all assets, or only this year's purchases.

## What was repaired

The parser previously retained only the first supported transaction in some blank-owner blocks. It now separates rows at filing-status boundaries, handles lowercase issuer names and page-wrapped asset tags, and refuses ambiguous boundaries instead of borrowing neighboring cells.

A second PDF extraction method found four additional page-boundary cases beyond the initial diagnostic. All four are now recovered and included in the 1,519 total. Original PDF regression fixtures cover long reports, repeated stocks, and these page boundaries.

Record matching now reserves unique security-and-economic-field matches before positional matching. This prevents a newly recovered neighboring stock from taking an existing stock's identity.

One source-reviewed IBIT purchase had inherited the preceding asset's amount. The normalized amount is corrected to $100,001–$250,000, while preserving the existing record ID, original raw evidence, and revision trail. That correction is pinned to the source PDF's exact hash and expected row.

The independent comparison uses a separate PDF extraction library and compares each document's transaction multiset: security, direction, transaction date, amount bounds, and option classification. It does not establish every issuer name, beneficial owner, or scanned-image transaction.

## What remains outside this repair

- The 43 scanned filings still need OCR and source review.
- Four newly indexed reports outside the frozen cache still need collection.
- Unsupported or ticker-free assets are not made visible by this repair.
- Source chronology anomalies remain explicit; dates are not guessed.
- Senate, executive, judicial, and institutional-manager feeds are separate work.
- The offline candidate is validation evidence, not a ready-to-copy production archive. A reviewed supervised import must regenerate publication metadata and pass the complete release checks.

No production archive, deployment, paid service, or schedule was changed.

## Reproduction and retained evidence

Final verification: **508 tests, 506 passed, 2 existing cache-dependent skips,
zero failures**. Lint and TypeScript passed. Production and preview webpack
builds passed; each scanned 54 browser/public assets with no demonstration
fixture markers and verified five comparison render artifacts. This is local
verification, not a new remote CI or deployment claim.

The machine-readable receipt is [saved with the audit evidence](audits/r2a-2026-09-08/receipt.json).
All source PDFs are hash-checked against the original R2 manifest. The local
security master used for validation is also identified by hash in the receipt.
The full candidate and independent result are retained in ignored
`scripts/.probe/r2a/`; they are not committed application data.

From the project root, with the two frozen input locations supplied:

```sh
node --experimental-strip-types scripts/replay-house-recovery.ts PDF_CACHE SECURITY_MASTER > candidate.json
python3 scripts/check-house-recovery-pdfs.py candidate.json PDF_CACHE
npm test
```

The Python cross-check requires `pdfplumber`. The replay refuses changed source
PDFs, changes to the archived baseline, unresolved supported rows, lost original
IDs, raw-evidence mutations, or a second replay that changes the result.

## Related records

- [Build roadmap and execution ledger](OUTFOX_BUILD_ROADMAP.md)
- [Original R2 audit](r2-house-audit-2026-09-08.md)
