# R1 verification receipt — September 8, 2026

Status: ready for review, not published. R1 implementation and bounded verification are complete; R2 source-data audit follows under Joe's explicit authorization.

## Delivered

- New activity card beneath Explore's existing company details, using the real House archive, not fabricated purchases or the twelve-row feed sample.
- All mapped layer companies participate. Separate distinct buying/selling filers and transaction counts; year-to-date and last-30-day transaction windows; expandable original filing evidence and archive links.
- Explicit House-only coverage, archive freshness, options/identity exclusions, and incomplete-coverage empty state.
- Scoped filer alias regression correction and hydration-safe theme control; Apple placeholder retained without changing the two-selection minimum.

## Verified in the running browser

- Software selection changes the card; this-year and last-30-day counts differ correctly. Show-all exposes eight software stocks, including sales-only rows.
- Keyboard focus previews another layer, leaving focus returns to the pinned layer, and Enter/click pins a selection. Mouse-enter wiring was inspected in source; no separate automated pointer-hover claim is made.
- Keyboard Enter opens and closes native evidence disclosures. GOOGL's 15 source rows expose the reported names, transaction and filing dates; its archive link targets the same ticker.
- Raw Materials / last 30 days displays the explicit incomplete-coverage empty state.
- Desktop and 375px mobile activity layouts visually inspected in light/dark themes. No horizontal page overflow on mobile Explore, Home or Compare.
- Theme persists across reload and Home/Explore/Compare/Congress navigation. No browser errors recorded in the test tab.
- SOXX and an unverified DRAM ticker remain selected with unavailable explanations while five other demo funds retain five-year results. Reload retains those selections, five years and a custom $500 amount.
- House archive exposes all 997 records; NVDA search returns 15 archived disclosures, distinct from the narrower activity-card calculation.

## Automated gates

- 492 tests: 490 passed, zero failed, two existing cache-dependent House end-to-end tests skipped (cache absent in this isolated checkout).
- Lint and TypeScript passed.
- Final production and preview webpack builds passed.
- Each build scanned 54 browser/public assets: none of the 15 fixture markers present.
- Five HTML/RSC artifacts passed in each environment: production refuses Compare; preview receives generated series only behind the server gate.

## Limits retained

Compare remains a clearly labeled demonstration, not real historical returns. Current quotes and news were unavailable in this local session; existing components displayed honest unavailable states. The quote/news integrations were not changed or certified by R1. No production deployment, paid source purchase, data refresh, or public Form 4 activation occurred. R2 must audit source omissions and the counting inputs before claiming broad coverage.
