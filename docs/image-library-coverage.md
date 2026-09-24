# Image library coverage — 2026-09-24

Counts are of identities, not of files or tickers. "Resolved" means an approved file is on disk for website display; it does not establish any right to redistribute files through an API. Every unresolved identity is listed at the end with its reason.

- **funds** universe: 26 identities, as of 2026-09-14. Source: src/lib/sector-funds.ts directory + src/lib/funds identities, joined to SEC company_tickers_mf.json for CIK, series and class. Share classes, not funds: a ticker names one class. Marks are the sponsor's unless a fund has its own documented logo, which none in this directory does.
- **companies** universe: 510 identities (671 tickers), as of 2026-09-14. Source: Wikidata: items with P361 (part of) = Q242345 (S&P 500), joined to SEC company_tickers.json by P5531 (CIK). 527 source items; 510 distinct CIKs. Company coverage includes sponsors with current SEC ticker evidence; sponsor-only identities are not assumed to be currently traded companies. Membership is as Wikidata records it, including former constituents, not the index provider's official list.
- **congress** universe: 539 identities, as of 2026-09-14. Source: unitedstates/congress-legislators legislators-current.json (CC0); portraits from unitedstates/images 225x275 (CC0 repository, GPO provenance stated). 439 House and 100 Senate members serving as of the dataset. Portraits are only ever fetched by Bioguide id.

| Kind | Resolved | Missing | Ambiguous | Failed | Awaiting review |
|---|---:|---:|---:|---:|---:|
| Companies (issuers) | 349 | 70 | 6 | 0 | 85 |
| ETF share classes | 24 | 2 | 0 | 0 | 0 |
| Sponsors | 3 | 2 | 0 | 0 | 0 |
| Congress (people) | 524 | 15 | 0 | 0 | 0 |

Company and sponsor roles can overlap; do not sum those rows as distinct identities. The source universe can also contain former issuers without current ticker evidence.

## Companies: issuer coverage versus ticker coverage

- Issuers resolved: 349 of 510 (68.4%), of which 11 were individually reviewed before this library.
- Tickers resolved: 525 of 671 (78.2%). Ticker coverage exceeds issuer coverage wherever one issuer lists several symbols.
- 15 Wikidata S&P 500 items could not be keyed to one SEC issuer and are outside the catalog: AOL (Q27585, no CIK); Autodesk (Q628051, no CIK); Bethlehem Steel (Q27432, no CIK); CBS Corporation (Q950380, no CIK); Celgene (Q842947, no CIK); EQT (Q5323987, no CIK); Globe Life (Q5570993, no CIK); Kohl's (Q967265, no CIK); Norfolk Southern Railway (Q1321054, no CIK); NYSE Euronext Liffe (Q13683, no CIK); Rapid Credit Boosters (Q124129040, no CIK); Staples Inc. (Q785943, no CIK); United Technologies Corporation (Q1045758, no CIK); West Pharmaceutical Services (United States) (Q30338243, no CIK); Wyndham Worldwide (Q303341, no CIK).

## ETFs

- 24 share classes display their sponsor's mark; 0 have a fund-specific logo. A sponsor mark identifies the sponsor, not the fund.

## Unresolved identities

| Identity | Kind | Label | Status | Reason | Candidate |
|---|---|---|---|---|---|
| bioguide:A000383 | person | Alan Armstrong | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:B001321 | person | Tom Barrett | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:B001323 | person | Nicholas J. Begich III | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:B001324 | person | Wesley Bell | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:B001328 | person | Everton Blair Jr. | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:F000485 | person | Clay Fuller | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:G000606 | person | Adelita S. Grijalva | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:G000607 | person | James Gallagher | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:G000608 | person | Darline Graham | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:H001104 | person | Jon Husted | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:M001245 | person | Christian D. Menefee | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:M001246 | person | Analilia Mejia | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:V000139 | person | Matt Van Epps | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:W000831 | person | James R. Walkinshaw | missing | No portrait published for this member at unitedstates/images. |  |
| bioguide:W000832 | person | Aisha Wahab | missing | No portrait published for this member at unitedstates/images. |  |
| sec:cik:0000004447 | company | Hess Corporation | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000004977 | company | AFL | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000005513 | company | UNM | awaiting_review | EDGAR records "UNUMPROVIDENT CORP" as a former name of CIK 0000005513, now "Unum Group"; Wikidata's logo file name (UnumProvident logo.svg) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:UnumProvident%20logo.svg) |
| sec:cik:0000006201 | company | AAL | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000006769 | company | APA Corporation | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000008670 | company | ADP | ambiguous | Wikidata lists 2 logo files: Automatic-Data-Processing-Logo.svg / Automatic Data Processing (logo).svg. A reviewer must pick one. |  |
| sec:cik:0000008818 | company | AVY | awaiting_review | Avery Dennison logo red.svg: SVG exceeds 262144 bytes |  |
| sec:cik:0000011544 | company | WRB | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000014693 | company | BF-B | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000016918 | company | STZ | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000020286 | company | CINF | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000023217 | company | CAG | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000024545 | company | TAP | awaiting_review | EDGAR records "MOLSON COORS BREWING CO" as a former name of CIK 0000024545, now "MOLSON COORS BEVERAGE CO"; Wikidata's item label (Molson Coors Brewing Company) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:Molson%20Coors%20Beverage%20Company%20logo.svg) |
| sec:cik:0000028412 | company | Comerica | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000029534 | company | DG | ambiguous | Wikidata lists 2 logo files: Dollar General logo.svg / Logo DG Pinch Yellow.png. A reviewer must pick one. |  |
| sec:cik:0000031791 | company | RVTY | awaiting_review | EDGAR records "PERKINELMER INC" as a former name of CIK 0000031791, now "REVVITY, INC."; Wikidata's item label (PerkinElmer) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:Logo%20PerkinElmer.svg) |
| sec:cik:0000032604 | company | EMR | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000034088 | company | ExxonMobil | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000038777 | company | BEN | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000047217 | company | HPQ | awaiting_review | EDGAR records "HEWLETT PACKARD CO" as a former name of CIK 0000047217, now "HP INC"; Wikidata's item label (Hewlett-Packard) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:HP%20logo%202025.svg) |
| sec:cik:0000051644 | company | Interpublic Group of Companies | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000052988 | company | J | awaiting_review | EDGAR records "JACOBS ENGINEERING GROUP INC /DE/" as a former name of CIK 0000052988, now "JACOBS SOLUTIONS INC."; Wikidata's item label (Jacobs Engineering Group) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:Jacobs%20Engineering%20Group%202019%20logo.svg) |
| sec:cik:0000054480 | company | Kansas City Southern | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000055067 | company | Kellanova | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000058492 | company | Leggett & Platt | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000059558 | company | LNC | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000062709 | company | MRSH | awaiting_review | Wikidata lists ticker(s) MMC for this item but the SEC master lists MRSH for CIK 0000062709 (MARSH & MCLENNAN COMPANIES, INC.). The CIK link may be stale after a rename, or wrong; a reviewer must confirm before any mark is shown. | [review](https://commons.wikimedia.org/wiki/File:MarshMcLennan%20h%20rgb%20c.svg) |
| sec:cik:0000065984 | company | ETR | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000072207 | company | Noble Energy | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000073124 | company | NTRS | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000075677 | company | PKG | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000078239 | company | PVH | awaiting_review | EDGAR records "PHILLIPS VAN HEUSEN CORP /DE/" as a former name of CIK 0000078239, now "PVH CORP. /DE/"; Wikidata's logo file name (Phillips-Van Heusen logo.svg) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:Phillips-Van%20Heusen%20logo.svg) |
| sec:cik:0000079282 | company | BRO | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000084129 | company | Rite Aid | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000086312 | company | TRV | awaiting_review | Commons Trav umb 5inch.jpg: licence "CC BY-SA 3.0" is not among the documented acceptable bases. | [review](https://commons.wikimedia.org/wiki/File:Trav_umb_5inch.jpg) |
| sec:cik:0000098246 | company | Tiffany & Co. | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000100517 | company | UAL | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000100885 | company | UNP | awaiting_review | Union pacific railroad logo.svg: SVG declares entities |  |
| sec:cik:0000101778 | company | Marathon Oil | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000104169 | company | WMT | ambiguous | Wikidata lists 2 logo files: Walmart logo (2025).svg / Walmart wordmark (2008).svg. A reviewer must pick one. |  |
| sec:cik:0000109198 | company | TJX | ambiguous | Wikidata lists 2 logo files: TJX Logo.svg / TJXLogo.svg. A reviewer must pick one. |  |
| sec:cik:0000109380 | company | ZION | awaiting_review | EDGAR records "ZIONS BANCORPORATION /UT/" as a former name of CIK 0000109380, now "ZIONS BANCORPORATION, NATIONAL ASSOCIATION /UT/"; Wikidata's logo file name (Zions Bancorporation logo.svg) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:Zions%20Bancorporation%20logo.svg) |
| sec:cik:0000203527 | company | Varian Medical Systems | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000313927 | company | CHD | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000318154 | company | AMGN | awaiting_review | Amgen.svg: Not an SVG document |  |
| sec:cik:0000354190 | company | AJG | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000701985 | company | BBWI | awaiting_review | EDGAR records "L Brands, Inc." as a former name of CIK 0000701985, now "Bath & Body Works, Inc."; Wikidata's logo file name (L Brands logo 2019.png) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:L%20Brands%20logo%202019.png) |
| sec:cik:0000712515 | company | Electronic Arts | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000718877 | company | Activision Blizzard | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000728535 | company | JBHT | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000740260 | company | VTR | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000743316 | company | Maxim Integrated | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000765880 | company | DOC | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000783280 | company | Duke Realty | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000783325 | company | WEC | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000789570 | company | MGM | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000804753 | company | Cerner | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000811156 | company | CMS | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000813828 | company | Paramount Global | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000815094 | company | AbioMed | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000822416 | company | PHM | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000827052 | company | EIX | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000832101 | company | IEX | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000858470 | company | Coterra Energy | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000859737 | company | Hologic | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000860730 | company | HCA | awaiting_review | EDGAR records "HCA Holdings, Inc." as a former name of CIK 0000860730, now "HCA Healthcare, Inc."; Wikidata's logo file name (2019 HCA logo.svg) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:2019%20HCA%20logo.svg) |
| sec:cik:0000860731 | company | TYL | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000861878 | company | Stericycle | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000865436 | company | Whole Foods Market | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000865752 | company | MNST | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000874766 | company | HIG | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000875045 | company | BIIB | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000877212 | company | ZBRA | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000877890 | company | Citrix Systems | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000878927 | company | ODFL | awaiting_review | Commons Old Dominion Freight Line (2).jpg: licence "CC BY 2.0" is not among the documented acceptable bases. | [review](https://commons.wikimedia.org/wiki/File:Old_Dominion_Freight_Line_(2).jpg) |
| sec:cik:0000882095 | company | GILD | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000891024 | company | Patterson Companies | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000899866 | company | Alexion Pharmaceuticals | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000900075 | company | CPRT | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000906107 | company | VMRK | awaiting_review | EDGAR records "EQUITY RESIDENTIAL" as a former name of CIK 0000906107, now "VIVMARK RESIDENTIAL"; Wikidata's logo file name (Equity Residential logo.svg) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:Equity%20Residential%20logo.svg) |
| sec:cik:0000906163 | company | NVR | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000908255 | company | BWA | awaiting_review | BorgWarner Logo Dark Blue (1).svg: SVG declares entities |  |
| sec:cik:0000912595 | company | MAA | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000914208 | sponsor | Invesco | missing | No documented public-domain mark for this sponsor. Not fetched from search results. |  |
| sec:cik:0000915912 | company | AvalonBay | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0000916076 | company | MLM | awaiting_review | Commons MLMcompanylogo.gif: licence "Copyrighted free use" is not among the documented acceptable bases. | [review](https://commons.wikimedia.org/wiki/File:MLMcompanylogo.gif) |
| sec:cik:0000920148 | company | LH | awaiting_review | Commons Labcorp Logo updated 12-2020.svg: licence "CC BY-SA 4.0" is not among the documented acceptable bases. | [review](https://commons.wikimedia.org/wiki/File:Labcorp_Logo_updated_12-2020.svg) |
| sec:cik:0000920522 | company | ESS | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000927653 | company | MCK | awaiting_review | Commons Mck logo pos col rgb.svg: licence "CC BY-SA 4.0" is not among the documented acceptable bases. | [review](https://commons.wikimedia.org/wiki/File:Mck_logo_pos_col_rgb.svg) |
| sec:cik:0000936340 | company | DTE | awaiting_review | EDGAR records "DTE HOLDINGS INC" as a former name of CIK 0000936340, now "DTE ENERGY CO"; Wikidata's logo file name (DTE Logo Blue.svg) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:DTE%20Logo%20Blue.svg) |
| sec:cik:0000940944 | company | DRI | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000943452 | company | WAB | awaiting_review | EDGAR records "WABTEC CORP" as a former name of CIK 0000943452, now "WESTINGHOUSE AIR BRAKE TECHNOLOGIES CORP"; Wikidata's item label (Wabtec) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:Wabtec%20logo.svg) |
| sec:cik:0000945841 | company | POOL | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0000947484 | company | ACGL | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001000228 | company | HSIC | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001000697 | company | WAT | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001001082 | company | Dish | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001011006 | company | Altaba | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001012100 | company | Sealed Air | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001013462 | company | Q295774 | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001020569 | company | IRM | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001021860 | company | NOV | awaiting_review | EDGAR records "NATIONAL OILWELL VARCO INC" as a former name of CIK 0001021860, now "NOV Inc."; Wikidata's item label (National Oilwell Varco) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:National-Oilwell-Varco-Logo.svg) |
| sec:cik:0001022079 | company | DGX | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001035443 | company | ARE | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001037540 | company | BXP | awaiting_review | EDGAR records "BOSTON PROPERTIES INC" as a former name of CIK 0001037540, now "BXP, Inc."; Wikidata's item label (Boston Properties) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:Bxp%20boston%20logo.png) |
| sec:cik:0001038357 | company | Pioneer Natural Resources | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001039684 | company | OKE | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001040971 | company | SLG | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001043604 | company | Juniper Networks | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001045309 | company | W. R. Grace and Company | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001048695 | company | FFIV | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001050915 | company | PWR | awaiting_review | Commons QScolorjpg.jpg: licence "CC BY-SA 3.0" is not among the documented acceptable bases. | [review](https://commons.wikimedia.org/wiki/File:QScolorjpg.jpg) |
| sec:cik:0001058090 | company | CMG | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001058290 | company | CTSH | awaiting_review | Commons Cognizant Technology Solutions - Kolkata 2011-08-29 4824.JPG: licence "CC BY 3.0" is not among the documented acceptable bases. | [review](https://commons.wikimedia.org/wiki/File:Cognizant_Technology_Solutions_-_Kolkata_2011-08-29_4824.JPG) |
| sec:cik:0001087423 | company | Red Hat | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001093557 | company | DXCM | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001095073 | company | EG | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001111711 | company | NI | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001121788 | company | GRMN | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001132979 | company | First Republic Bank | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001136869 | company | ZBH | awaiting_review | EDGAR records "ZIMMER HOLDINGS INC" as a former name of CIK 0001136869, now "ZIMMER BIOMET HOLDINGS, INC."; Wikidata's logo file name (Zimmer Holdings logo.svg) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:Zimmer%20Holdings%20logo.svg) |
| sec:cik:0001137774 | company | PRU | awaiting_review | Commons Logo-prudential-do-brasil.png: licence "CC BY-SA 3.0" is not among the documented acceptable bases. | [review](https://commons.wikimedia.org/wiki/File:Logo-prudential-do-brasil.png) |
| sec:cik:0001140536 | company | WTW | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001144519 | company | Bunge Limited | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001163165 | company | COP | awaiting_review | ConocoPhillips Logo.svg: SVG declares entities |  |
| sec:cik:0001164727 | company | NEM | ambiguous | Wikidata lists 2 logo files: Newmont-logo.png / Newmont-Mining-Logo.svg. A reviewer must pick one. |  |
| sec:cik:0001175454 | company | CPAY | awaiting_review | EDGAR records "FLEETCOR TECHNOLOGIES INC" as a former name of CIK 0001175454, now "CORPAY, INC."; Wikidata's logo file name (The logo of Fleetcor.png) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:The%20logo%20of%20Fleetcor.png) |
| sec:cik:0001260221 | company | TDG | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001267238 | company | AIZ | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001278021 | company | MKTX | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001289490 | company | EXR | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001297996 | company | DLR | awaiting_review | Commons Digital Realty TM Brandmark RGB Black.svg: licence "CC BY-SA 4.0" is not among the documented acceptable bases. | [review](https://commons.wikimedia.org/wiki/File:Digital_Realty_TM_Brandmark_RGB_Black.svg) |
| sec:cik:0001300514 | company | LVS | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001316835 | company | BLDR | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001335258 | company | LYV | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001339947 | company | Viacom | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001359841 | company | Hanesbrands | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001374310 | company | CBOE | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001378946 | company | People's United Financial | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001383312 | company | BR | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001393612 | company | Discover Financial | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001442145 | company | VRSK | awaiting_review | Commons Verisk Analytics Logo.svg: licence "CC BY-SA 4.0" is not among the documented acceptable bases. | [review](https://commons.wikimedia.org/wiki/File:Verisk_Analytics_Logo.svg) |
| sec:cik:0001466258 | company | TT | awaiting_review | EDGAR records "Ingersoll-Rand plc" as a former name of CIK 0001466258, now "Trane Technologies plc"; Wikidata's item label (Ingersoll Rand) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:Ingersoll%20Rand%20logo.svg) |
| sec:cik:0001492633 | company | Nielsen Company | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001506307 | company | KMI | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001519751 | company | FBIN | awaiting_review | EDGAR records "Fortune Brands Home & Security, Inc." as a former name of CIK 0001519751, now "Fortune Brands Innovations, Inc."; Wikidata's item label (Fortune Brands Home & Security) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. |  |
| sec:cik:0001539838 | company | FANG | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001571949 | company | ICE | awaiting_review | EDGAR records "IntercontinentalExchange Group, Inc." as a former name of CIK 0001571949, now "Intercontinental Exchange, Inc."; Wikidata's logo file name (Logo of the IntercontinentalExchange.svg) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown. | [review](https://commons.wikimedia.org/wiki/File:Logo%20of%20the%20IntercontinentalExchange.svg) |
| sec:cik:0001579241 | company | ALLE | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001596783 | company | Catalent Pharma Solutions | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001598014 | company | IHS Markit | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001601046 | company | KEYS | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001618921 | company | Walgreens Boots Alliance | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001623613 | company | Mylan | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001633917 | company | PYPL | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001707925 | company | LIN | awaiting_review | Linde plc logo.png: Raster exceeds 524288 bytes |  |
| sec:cik:0001732845 | company | WRKCo, Inc. | awaiting_review | Wikidata CIK is not in the SEC master; identity unverified. |  |
| sec:cik:0001739940 | company | CI | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001748790 | company | AMCR | ambiguous | Wikidata lists 2 logo files: Amcor-Logo.svg / Amcor logo.svg. A reviewer must pick one. |  |
| sec:cik:0001751788 | company | DOW | missing | No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer. |  |
| sec:cik:0001915657 | company | DINO | awaiting_review | Wikidata lists ticker(s) HFC for this item but the SEC master lists DINO for CIK 0001915657 (HF Sinclair Corp). The CIK link may be stale after a rename, or wrong; a reviewer must confirm before any mark is shown. |  |
| sec:class:C000105869 | fund | SMH | missing | Sponsor VanEck has no resolved mark (missing). |  |
| sec:class:C000271435 | fund | QQQ | missing | Sponsor Invesco has no resolved mark (missing). |  |
| sponsor:vaneck | sponsor | VanEck | missing | No documented public-domain mark for this sponsor. Not fetched from search results. |  |
