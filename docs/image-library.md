# Shared image library

One catalog for company marks, ETF sponsor marks and congressional portraits,
keyed by durable identity. Pages ask the library for an image by identity and
receive either a path to an approved local file or a fallback with a reason.

## What is a key, and what is an alias

| Kind | Identity key | Aliases (lookup only) |
|---|---|---|
| Company | `sec:cik:0001045810` | every SEC ticker for the issuer, the SEC title, the Wikidata item |
| ETF | `sec:class:C000017601` (a ticker names a share class) | the ticker, the series id, the registrant CIK |
| Sponsor | `sec:cik:…` when the sponsor is an SEC issuer, else `sponsor:the-vanguard-group` | name, Wikidata item |
| Person | `bioguide:P000197` | name variants scoped to chamber + state + district; reviewed filer keys |

A ticker resolves only when exactly one identity currently claims it. A name
resolves only with its seat. When a CIK, class id or Bioguide id is supplied
it is authoritative, and a ticker or name that disagrees with it produces a
`mismatch` fallback rather than either side's image.

## Using it from a page

Resolution is server-side. `src/lib/image-library/index.ts` imports the full
catalog (provenance included) and must never be imported by a client
component; a test enforces that. Resolve in the page or in a server-side
builder and pass the path down.

```ts
import { resolveCompanyMark, resolveFundMark, resolvePortrait, srcOrNull } from "@/lib/image-library";

const mark = resolveCompanyMark({ ticker: "NVDA", cik: "0001045810" });
// { status: "resolved", src: "/company-logos/nvda.svg", role: "company_mark", … }
// or { status: "fallback", reason: "missing" | "ambiguous" | "mismatch" | "unknown" | "not_resolved", label }

const fund = resolveFundMark({ ticker: "XLK", classId: "C000017601" });
// role is "sponsor_mark" when the fund borrows its sponsor's mark — caption it as such.

const portrait = resolvePortrait({ name: record.politician, chamber: "House", state: "CA", district: "CA11" });
```

`<CompanyMark ticker={…} src={…} />` renders the mark or the ticker tile. The
homepage builders (`buildHomeWindow`) already attach `mark` to companies and
purchases and `portrait` to filers, so `HomeTradingTable` and
`HomeSectorExplorer` need no lookups of their own. A new disclosure record
whose filer name and seat match a catalogued member resolves automatically;
nothing per-page is edited.

## Populating and refreshing

```bash
# everything, resumable; reruns skip settled identities and retry failures
node --experimental-strip-types scripts/image-library-import.ts --universe all

# one universe, capped, no writes
node --experimental-strip-types scripts/image-library-import.ts --universe companies --limit 25 --dry-run

# only members who appear in the disclosure archive
node --experimental-strip-types scripts/image-library-import.ts --universe congress --only-disclosed

# re-fetch importer-resolved assets with a stated reason (manual ones are never re-fetched)
node --experimental-strip-types scripts/image-library-import.ts --universe funds --refresh "sponsor rebrand"

# coverage report → docs/image-library-coverage.md and data/image-library/coverage.json
node --experimental-strip-types scripts/image-library-report.ts
```

Nothing is scheduled. Run these by hand and commit the catalog, the assets,
`data/image-library/*` and the report together, so the review sees what
changed and why.

## What acceptance means

The importer accepts a file only by a documented rule: a Commons file whose
machine-readable licence is public domain or CC0; a Simple Icons file with no
per-icon licence (the project's CC0 applies); a portrait served by the
unitedstates/images mirror for a Bioguide id from the legislators dataset.
Anything else — another licence, several candidate files, a Wikidata CIK the
SEC master does not know — is recorded as `awaiting_review`, `ambiguous` or
`missing` with the candidate kept, and is never displayed.

Every asset records its source URL, evidence page, fetch time, SHA-256, the
licence fields that justified acceptance, and two separate rights notes:
website display (`documented`) and API redistribution (`not_established`).
No source in this library grants the second, and the catalog cannot express a
grant that was not recorded.

## Files

- `src/lib/image-library/catalog.json` — the catalog; generated, committed
- `src/lib/image-library/{types,identity,index}.ts` — shapes, key rules, lookup
- `scripts/image-library-import.ts` and `scripts/image-library/*` — importer
- `scripts/image-library-report.ts` — coverage
- `public/company-logos/`, `public/portraits/` — approved files (reviewed ones untouched, new ones keyed by identity)
- `data/image-library/` — universes as fetched, import state, coverage JSON
