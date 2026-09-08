# House recovery source fixtures

Original public Clerk PDFs, copied byte-for-byte from the frozen cache audited
on September 8, 2026. Tests validate the hashes before extracting text. These are
test evidence, not public application assets or a replacement for live records.

Source prefix: `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/`
Append the document ID and `.pdf` below. SHA-256 values are pinned in
`tests/house-recovery.test.ts` and the R2 per-document audit evidence.

| Document | Case | Expected supported rows |
|---|---|---:|
| 20034894 | Cleo Fields: three printed NVDA purchases, three subholdings, one filer | 3 |
| 20030977 | Julia Letlow: long blank-owner report, repeated symbols and earlier years | 197 |
| 20033983 | Gilbert Cisneros: long blank-owner report, unsupported assets interleaved, FNV tag split across pages | 144 |
| 20034201 | Mark Alford: multiline descriptions, per-share prices, repeated SPYB rows | 7 |
| 20034346 | Sheri Biggs: lowercase iShares issuer after unsupported Apollo entries | 1 |
| 20034351 | Rick Larsen: same-day stocks sharing economic fields; name cleanup must not swap NEE to CARR | 10 |
| 20034932 | HUBB transaction with its asset tag separated by a page boundary | 19 |
| 20034585 | IFNNY transaction with its asset tag separated by a page boundary | 26 |
| 20035326 | VLTO sale with its asset tag separated by a page boundary | 28 |

The counts are supported-symbol rows, not all assets, distinct buyers, or proof
of open-market discretion. Exact field assertions supplement the counts. The
separate pdfplumber cross-check validates economic fields without calling the
application's parser; sample page-image review establishes the key cases.

## Reviewed IBIT correction

Source 20034346, page 1, visually reviewed September 8:

- The one IBIT transaction is a purchase dated March 4, 2026, for
  **$100,001-$250,000**. The preceding unsupported Apollo entries each disclose
  $1,001-$15,000. The old parser borrowed that neighboring amount.
- Preserve existing ID `20034346::64e178ecd1db53c5::0`, original raw values and
  first-seen metadata. Update normalized amount fields with a revision entry.
- The narrowly scoped identity link requires SHA-256
  `29b16843a82ef1f91b5578f02640ab2841dba2ccf76771886312bca272464319`, the expected
  original row, and exactly one matching corrected IBIT row. Any discrepancy
  stops the operation; there is no generic known-amount overwrite heuristic.

Scanned filings, ticker-free assets, ownership migration, and new reports are
separate work. These fixtures do not claim to close those coverage gaps.
