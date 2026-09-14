/** Explicit issuer matches; evidence in docs/company-logo-manifest.json.
 * Website identification only, not API assets or endorsements.
 */
export const COMPANY_MARKS: Record<string, { cik: string; file: string }> = {
  MSFT: { cik: "0000789019", file: "msft.svg" },
  META: { cik: "0001326801", file: "meta.svg" },
  AAPL: { cik: "0000320193", file: "aapl.svg" },
  AMD: { cik: "0000002488", file: "amd.svg" },
  AMZN: { cik: "0001018724", file: "amzn.svg" },
  NVDA: { cik: "0001045810", file: "nvda.svg" },
  ACN: { cik: "0001467373", file: "acn.svg" },
  AEP: { cik: "0000004904", file: "aep.svg" },
  FITB: { cik: "0000035527", file: "fitb.svg" },
  UNH: { cik: "0000731766", file: "unh.svg" },
};
export function companyMark(ticker: string, cik?: string) {
  const mark = COMPANY_MARKS[ticker];
  return mark && cik && /^\d{1,10}$/.test(cik) && cik.padStart(10, "0") === mark.cik
    ? `/company-logos/${mark.file}` : null;
}
