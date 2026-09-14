# Homepage portrait sources — September 13, 2026

The exact filer-key-to-Bioguide mappings in `home-filer-images.ts` were checked against name, House chamber, state and district in the current [Congress legislators dataset](https://github.com/unitedstates/congress-legislators/blob/main/legislators-current.yaml). No seat-only or fuzzy name match is permitted. A mismatch remains an initials tile. In particular the archive's McCormick district differs from the current dataset, so that identity is not automatically mapped.

Images are downloaded independently from [unitedstates/images](https://github.com/unitedstates/images), never from Quiver. Its README states that portraits come from GPO and relays GPO's assurance of public-domain status; the [repository license](https://github.com/unitedstates/images/blob/gh-pages/LICENSE) is CC0. This is a documented source basis, not proof that the repository owns every third-party right. No sponsorship, personal endorsement, advertising reuse, or API image redistribution is authorized by this file.

Local JPEGs have source URLs, download dates and SHA-256 hashes in `homepage-portrait-manifest.json`. Images are static same-origin assets; there is no vendor account, hotlink, automatic provider request on page load, or paid service. Missing files render initials. The content remains identifiable without images. Profile functionality is separate from asset identity matching.

## Company marks — September 13 update

Ten individually reviewed company marks now have source URLs, file-page metadata,
download timestamps and SHA-256 hashes in `company-logo-manifest.json`. They are
matched against both ticker and issuer CIK in `company-marks.ts`; missing or
conflicting identity remains a ticker tile. No vendor, account, hotlink, recurring
provider call, Quiver asset or API-image field is introduced.

Microsoft uses Commons' PD-shape basis; Meta, AMD, Amazon, Accenture, AEP, Fifth
Third and UnitedHealth Group use PD-textlogo. Apple uses the U.S. PD-no-notice
basis, with the file page's non-U.S. copyright caveat retained. NVIDIA's current
green-and-black logo is Apache-2.0, **not** public domain: its source license and
copyright notice ship alongside the unchanged asset in `public/company-logos`.
No mandatory refresh or attribution requirement is imposed by the PD copyright
tags; the NVIDIA license/notice are retained. Review assets when issuer identity
or branding changes, not through a paid provider.

All ten have trademark restrictions. The documented copyright basis does not
settle trademark or worldwide display rights. Use is limited to small marks
identifying companies in independent editorial disclosure coverage, never
endorsement, merchandise, paid placements, or the product API. The visible
asset notice is available through the table's methodology details.

UNH deliberately uses the parent UnitedHealth Group wordmark, not the different
UnitedHealthcare subsidiary shield in the sample screenshot. FITB uses the
Fifth Third operating-bank brand associated with the Fifth Third issuer.
Broadcom and Applied Materials remain ticker tiles pending reviewed sources;
do not fetch arbitrary search results to fill those gaps.
