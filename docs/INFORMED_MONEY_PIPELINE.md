# Outfox informed-money pipeline specification

Status: implementation specification  
Last reviewed: September 2, 2026

## Purpose

Build one evidence system that can compare transactions and reported holdings
from public officials, corporate insiders, and influential investment managers
without erasing the important differences among those sources.

The pipeline must support this reader experience:

1. What happened?
2. Who or which filing entity reported it?
3. When did the underlying activity occur, and when did it become public?
4. How strong, current, and independently corroborated is the evidence?
5. Where do informed-money groups agree or disagree?
6. What can the evidence not establish?

## Source adapters

Each source owns its parser and source-specific fields. Adapters emit records
through a shared validated envelope; they do not write directly to public pages.

### House PTR

- Source: Clerk of the U.S. House of Representatives
- Existing implementation: `scripts/import-house.ts`
- Value: disclosed transactions by covered House filers
- Important limitation: delayed records with broad amount ranges

### SEC ownership reports

- Source: SEC EDGAR Forms 3, 4, 5 ownership XML
- Initial public scope: Form 4
- Value: relatively timely activity by officers, directors, and greater-than-10%
  beneficial owners
- Important limitation: awards, exercises, gifts, tax withholding, and other
  transactions are not equivalent to discretionary open-market activity

### SEC Form 13F

- Source: SEC EDGAR Form 13F-HR information-table XML and amendments
- Initial public scope: a published cohort of 10–15 influential filing managers
- Value: reported quarter-end institutional holdings and cross-manager patterns
- Important limitation: delayed holdings snapshots, not exact or current trades

### Senate PTR

- Source: Secretary of the Senate eFD system
- Status: held until source-use legal review and separate collector validation
- Important limitation: separate source, terms, session flow, and review process

## Shared record envelope

Every accepted record must carry:

```text
identity
  source type
  source record identity
  immutable content hash
  reconciliation key

provenance
  official source URL
  accession/document/filing id
  source publication or filing timestamp
  first seen, last seen, import run id, schema version

actors
  filing entity id and name
  associated person name when applicable
  role and relationship

security
  issuer CIK and name
  raw identifier and normalized ticker when resolvable
  security title and derivative status

activity
  source-specific activity class
  transaction/as-of date
  filed date
  disclosure lag
  direction
  shares, price, exact value, or disclosed range as applicable

interpretation boundaries
  machine classification
  warnings
  quarantine reasons
  amendment/supersession/revision history
```

Raw source values are immutable. Normalized values and editorial classifications
live in separate fields and retain their method/version.

## Form 4 classification contract

Public aggregations must never treat every acquisition as buying or every
disposition as selling.

| Class | Typical codes | Default public treatment |
|---|---|---|
| Open-market/private purchase | P | Eligible for purchase screens |
| Open-market/private sale | S | Eligible for sale screens |
| Company award | A | Compensation/award, separate |
| Option exercise or conversion | M, C | Exercise/conversion, separate |
| Tax or exercise-price disposition | F | Tax/exercise, separate |
| Gift | G | Gift, separate |
| Other or footnote-dependent | J and combined codes | Review required |
| Derivative activity | Table II records | Separate derivative context |

Voluntary, 10b5-1, direct/indirect ownership, and footnote indicators remain
visible attributes rather than being discarded during classification.

## Form 13F change contract

A pair of consecutive, amendment-resolved quarter-end snapshots can emit:

- newly reported;
- increased;
- reduced;
- exited; or
- unchanged.

Public copy uses the filing entity and quarter-end date. It must not infer an
exact transaction date, transaction price, manager intent, or continued current
ownership from a 13F alone.

The first cohort requires a checked mapping of brand, associated public figure,
legal filing manager, CIK, and relevant amendment history. Famous names are
context; the SEC filing entity is the actor in calculated statements.

## Gates

The House pipeline's last-known-good and per-run evidence architecture is the
minimum standard for every source.

### Blocking record gates

- Missing or non-official source URL
- Missing source filing identity
- Invalid or impossible dates
- Irreconcilable issuer/security identity conflict
- Structurally invalid source record
- Form 4 transaction missing the fields required for its claimed class
- 13F row that cannot be tied to a filing and reporting period

### Warning/review states

- Unknown ticker with an otherwise valid source security
- Issuer naming variation
- Footnote-dependent Form 4 transaction
- Amendment awaiting reconciliation
- Indirect ownership with unclear relationship text
- Unusually large calculated value requiring source recheck

### Blocking run gates

- Source returned no expected filings
- Download or parse completion below the reviewed threshold
- Material yield collapse against a comparable prior run
- Accepted archive would shrink without an explicit supersession trail
- Duplicate stable identities or reconciliation collisions
- Amendment logic produces overlapping active versions
- Every record is rejected or an implausible share is quarantined

A failed run writes evidence and leaves production unchanged.

## Derived signals

Signals are reproducible calculations with method versions, not prose generated
by a model.

Initial signals:

- multiple distinct corporate insiders making eligible purchases;
- largest eligible purchases and sales by source and period;
- newly reported or materially increased manager holdings;
- cross-manager company and Outfox-theme overlap;
- House / insider / manager directional agreement;
- explicit disagreement among those groups;
- disclosure lag and post-disclosure price context.

Convergence is displayed as lanes of evidence before any composite score. Each
lane retains its source date and freshness. Missing data is not neutral evidence.

## Editorial and publication workflow

```text
ingest → validate → preserve evidence → calculate candidates
       → human source review → draft → claim-level review
       → approve → website + email + X distribution
```

AI may organize verified facts, suggest questions, and draft explanations. It
may not create missing values, infer trades from 13F snapshots, or publish
without a claim-level evidence review.

Every published claim carries or resolves to:

- the source record;
- the calculation method and as-of date;
- fact versus interpretation labeling;
- limitations and counterpoint;
- author/reviewer and correction path.

## Search and AI discoverability release gate

Public explanatory and report pages must have:

- stable, descriptive URLs and canonical metadata;
- readable server-rendered text;
- descriptive titles and summaries;
- primary citations and original Outfox analysis;
- published/reviewed/updated dates and honest authorship;
- visible limitations and corrections path;
- internal links among definitions, actors, companies, filings, and reports;
- valid structured page data where appropriate;
- sitemap inclusion and deliberate crawler rules;
- an updated AI-readable site guide;
- no mass-generated thin pages.

Crawler access creates eligibility, not guaranteed ranking or citation.

## Implementation sequence

1. Ship the Academy foundation and first five source-backed guides.
2. Extract the shared envelope, gate interfaces, and evidence conventions from
   the proven House implementation without destabilizing it.
3. Build the Form 4 adapter, fixtures, gates, archive, and activity page.
4. Select and verify the initial manager cohort and build the 13F adapter.
5. Build source-specific profiles and change views.
6. Build the multi-lane convergence view.
7. Produce Outfox Report No. 1 from approved evidence.
8. Add email delivery and measured X distribution.
9. Build ETF scorecards only after the underlying theme and holdings inputs are
   sourced, licensed where necessary, and methodologically documented.

## Definition of done for the next release

The Form 4 release is complete only when:

- at least 25 representative filings reconcile to SEC originals;
- open-market, compensation, exercise, gift, tax, other, and derivative cases
  have permanent fixtures;
- amendments revise/supersede rather than silently duplicate;
- a simulated failed run proves production remains byte-identical;
- every public record links to its official SEC source;
- Academy explanations are linked at the point of jargon;
- tests, lint, build, independent review, deployment, and live verification pass.
