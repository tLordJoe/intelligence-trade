# Homepage refresh — release candidate

## Approved direction

Grok-inspired company-to-filer rows; original navy/green headline; warm cream page and subtly lighter header; separate source/date controls below “What they’re trading”; latest purchases followed by the full sector explorer. The AI teaser is now a miniature of the existing flat Explore stack, sharing its labels, ordering, gradients and width calculation.

## First-release scope

- Real existing House archive only. “All available” currently means House coverage; Senate, corporate insiders, and funds/institutions are explicitly disabled and marked coming soon.
- Transaction-date YTD, 30-day and 90-day windows. Distinct purchasing filers, purchase records and sale records remain separate. Existing quarantine, official-source, duplicate and identity checks remain in force.
- Exact scoped filer links lead to reusable disclosure profiles with paginated records and original evidence. This is not the complete planned performance/holdings profile.
- Fourteen locally hosted portraits have exact identity matches and a source/hash manifest. Unmapped names use initials. No Quiver assets were used.
- Company marks remain ticker tiles wherever reuse is unresolved. No logo vendors, accounts, purchases or API redistribution were introduced.
- Eleven sectors use a dated, attributed S&P 500 index-weight snapshot, with an explicitly disclosed minimum bar width for readability. Sector examples are editorial discovery lists, not a complete constituent database. Buying counts are real YTD House counts among those examples.
- Existing font/wordmark retained. A thinner custom wordmark remains a separate brand decision; no substitute was silently adopted.
- Eleven dedicated sector pages, reached from the selected homepage sector, offer editorial companies, real House activity, two issuer-verified ETF examples, and source links. No quantitative ETF ranking or holdings comparison is represented as working.
- “Explore the market by sector” explicitly distinguishes index weights from buying. The homepage panel stays explicitly YTD House-only, independent of table controls.

## Verification

- 516 automated tests passed, including exact filer-route decoding and malformed-input coverage.
- Full repository ESLint passed. Next production build and TypeScript passed.
- Browser: 30/90/YTD controls update the window; actual portrait opens matching profile; pagination moves to page two.
- Browser: mobile menu opens/closes, dark mode switches, and tapping Energy updates the sector panel.
- Desktop at 1440px and mobile at 390px have no horizontal document overflow. No browser errors or warnings in the checked page.
- A browser-only profile routing bug was found and fixed: this runtime retains URL escapes in dynamic parameters, so the page now decodes exactly once before exact identity matching.

## Remaining staged work

Company-mark clearance and additional portraits; connected Senate, insider and institutional feeds; stock performance measured under an explicit methodology; broader profile sections; final thinner wordmark; complete sector security master and ETF holdings joins. None are represented as completed or live in this release.

Deployment status must be verified separately; this document alone is not evidence of publication.

## Publication gate

The earlier commit-and-push attempt was rejected before execution pending explicit owner approval. On 13 September, after the destination and uploaded materials were presented again, the owner approved the plan to finish and test locally, then publish the checked release. Unrelated OCR work and import-run duplicate files remain excluded. Publication and production verification must be recorded from actual results, not assumed from this approval.
