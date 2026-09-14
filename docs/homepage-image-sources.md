# Homepage portrait sources — September 13, 2026

The exact filer-key-to-Bioguide mappings in `home-filer-images.ts` were checked against name, House chamber, state and district in the current [Congress legislators dataset](https://github.com/unitedstates/congress-legislators/blob/main/legislators-current.yaml). No seat-only or fuzzy name match is permitted. A mismatch remains an initials tile. In particular the archive's McCormick district differs from the current dataset, so that identity is not automatically mapped.

Images are downloaded independently from [unitedstates/images](https://github.com/unitedstates/images), never from Quiver. Its README states that portraits come from GPO and relays GPO's assurance of public-domain status; the [repository license](https://github.com/unitedstates/images/blob/gh-pages/LICENSE) is CC0. This is a documented source basis, not proof that the repository owns every third-party right. No sponsorship, personal endorsement, advertising reuse, or API image redistribution is authorized by this file.

Local JPEGs have source URLs, download dates and SHA-256 hashes in `homepage-portrait-manifest.json`. Images are static same-origin assets; there is no vendor account, hotlink, automatic provider request on page load, or paid service. Missing files render initials. The content remains identifiable without images. Profile functionality is separate from asset identity matching.

Company marks are not yet approved in this release candidate. Ticker tiles remain until specific source and rights evidence is recorded. They must not silently become invented corporate logos.
