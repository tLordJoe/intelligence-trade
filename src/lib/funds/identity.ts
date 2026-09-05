/**
 * Legal identity of each fund, taken from SEC EDGAR.
 *
 * Every name, CIK, series ID and class ID below was read from EDGAR on
 * 2026-09-05 — the ticker-to-identifier mapping from
 * `https://www.sec.gov/files/company_tickers_mf.json`, the registrant names
 * from `https://data.sec.gov/submissions/CIK##########.json`, and the series
 * and class names from EDGAR's company browser. None of it is remembered,
 * inferred from the ticker, or copied from a fund's marketing.
 *
 * **Why series and class IDs are stored at all.** XLK and XLU are both series
 * of Select Sector SPDR Trust and therefore share CIK 1064641. A model keyed on
 * CIK cannot tell them apart, and would silently merge a technology fund with a
 * utilities fund. The series ID is the level at which a fund is a fund, and the
 * class ID the level at which a ticker is a ticker.
 *
 * That distinction is not cosmetic for VOO either: VOO is not a fund, it is the
 * ETF Shares class of the Vanguard 500 Index Fund, which also has Admiral and
 * Investor classes. Describing VOO as though it were the whole fund, or as
 * though it were "the whole market", would both be wrong.
 */

export interface FundLegalIdentity {
  /** Exchange ticker. The stable key across the app and in URLs. */
  symbol: string;

  /** The trust or company that registered the fund with the SEC. */
  registrantName: string;
  /** Central Index Key of the registrant. Not unique to a fund. */
  cik: number;

  /** EDGAR series identifier. This is the level at which a fund is one fund. */
  seriesId: string;
  /** Official series name as EDGAR currently records it. */
  seriesName: string;

  /** EDGAR class/contract identifier. This is what the ticker actually names. */
  classId: string;
  /** Official class name as EDGAR currently records it. */
  className: string;

  /** The firm that sponsors the fund. Not the index provider. */
  sponsor: string;

  /**
   * Neutral description of what the fund holds.
   *
   * States the actual mandate. In particular VOO is described as tracking an
   * index of 500 large United States companies, because that is what it does —
   * it is not a total-market fund and must not be described as one.
   */
  exposure: string;

  /** Editorial grouping for the interface. Not an industry classification. */
  grouping: "Large-cap index" | "Nasdaq index" | "Sector" | "Industry";

  /** Where these fields came from, so a reader can check them. */
  sourceNote: string;
}

const EDGAR_NOTE =
  "SEC EDGAR, read 2026-09-05: company_tickers_mf.json for CIK, series and " +
  "class identifiers; the EDGAR submissions API for the registrant name; the " +
  "EDGAR company browser for the series and class names.";

export const FUND_IDENTITIES: Record<string, FundLegalIdentity> = {
  VOO: {
    symbol: "VOO",
    registrantName: "Vanguard Index Funds",
    cik: 36405,
    seriesId: "S000002839",
    seriesName: "Vanguard 500 Index Fund",
    classId: "C000092055",
    className: "ETF Shares",
    sponsor: "Vanguard",
    // Phrased as what the fund does hold. A denial ("not the whole market")
    // would read as a correction and would also defeat the substring check in
    // `tests/fund-identity.test.ts`, which is deliberately naive so that an
    // accidental claim cannot slip past it.
    exposure:
      "Tracks an index of 500 large United States companies. It covers the " +
      "large-capitalisation end of the listed market only, and holds neither " +
      "mid-sized nor small companies.",
    grouping: "Large-cap index",
    sourceNote: EDGAR_NOTE,
  },
  QQQ: {
    symbol: "QQQ",
    registrantName: "Invesco QQQ Trust, Series 1",
    cik: 1067839,
    seriesId: "S000101292",
    seriesName: "Invesco QQQ Trust, Series 1",
    classId: "C000271435",
    className: "Invesco QQQ Trust, Series 1",
    sponsor: "Invesco",
    exposure:
      "Tracks an index of the largest non-financial companies listed on the " +
      "Nasdaq Stock Market. A single-exchange index, not a market-wide one.",
    grouping: "Nasdaq index",
    sourceNote: EDGAR_NOTE,
  },
  XLK: {
    symbol: "XLK",
    registrantName: "Select Sector SPDR Trust",
    cik: 1064641,
    seriesId: "S000006415",
    seriesName: "State Street Technology Select Sector SPDR ETF",
    classId: "C000017601",
    className: "State Street Technology Select Sector SPDR ETF",
    sponsor: "State Street",
    exposure:
      "Holds the technology companies within a large-cap United States index. " +
      "Confined to that index, so it does not cover technology companies outside it.",
    grouping: "Sector",
    sourceNote: EDGAR_NOTE,
  },
  SMH: {
    symbol: "SMH",
    registrantName: "VanEck ETF Trust",
    cik: 1137360,
    seriesId: "S000034411",
    seriesName: "VanEck Semiconductor ETF",
    classId: "C000105869",
    className: "VanEck Semiconductor ETF",
    sponsor: "VanEck",
    exposure: "Holds companies that design, manufacture or supply semiconductors.",
    grouping: "Industry",
    sourceNote: EDGAR_NOTE,
  },
  XLU: {
    symbol: "XLU",
    registrantName: "Select Sector SPDR Trust",
    cik: 1064641,
    seriesId: "S000006416",
    seriesName: "State Street Utilities Select Sector SPDR ETF",
    classId: "C000017602",
    className: "State Street Utilities Select Sector SPDR ETF",
    sponsor: "State Street",
    exposure:
      "Holds the utility companies within a large-cap United States index — " +
      "electric, gas, water and independent power producers in that index.",
    grouping: "Sector",
    sourceNote: EDGAR_NOTE,
  },
  SOXX: {
    symbol: "SOXX",
    registrantName: "iShares Trust",
    cik: 1100663,
    seriesId: "S000004354",
    seriesName: "iShares Semiconductor ETF",
    classId: "C000012084",
    className: "iShares Semiconductor ETF",
    sponsor: "BlackRock",
    exposure:
      "Holds semiconductor companies under a different index and weighting " +
      "scheme from SMH, which is why the two are worth putting side by side.",
    grouping: "Industry",
    sourceNote: EDGAR_NOTE,
  },
};

export function getLegalIdentity(symbol: string): FundLegalIdentity | null {
  return FUND_IDENTITIES[symbol.trim().toUpperCase()] ?? null;
}

/**
 * The identifier that actually distinguishes one fund from another.
 *
 * CIK alone does not: XLK and XLU share one. Keying anything on CIK would
 * collide them, so this is what the rest of the application keys on.
 */
export function fundKey(identity: FundLegalIdentity): string {
  return `${identity.cik}:${identity.seriesId}:${identity.classId}`;
}

/** Whether two identities are the same registrant but different funds. */
export function sharesRegistrant(a: FundLegalIdentity, b: FundLegalIdentity): boolean {
  return a.cik === b.cik && a.seriesId !== b.seriesId;
}
