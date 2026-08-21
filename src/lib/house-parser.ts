/**
 * Text extraction for House Periodic Transaction Reports.
 *
 * Split out of `scripts/import-house.ts` so the parsing rules can be exercised
 * directly by fixtures rather than only through a full import.
 *
 * Three defects motivated the split.
 *
 * A transaction row is laid out across a single table row in the PDF, but the
 * extracted text carries page furniture — a `-- 2 of 3 --` footer and a
 * repeated column header — wherever a row straddles a page boundary. The old
 * parser collapsed whitespace and then read the 30 characters following the
 * symbol to find the transaction type. When furniture landed in that window the
 * type was never found and the row was dropped in silence. One confirmed loss:
 * Tempus AI (TEM) in filing 20033725.
 *
 * The same furniture split amount ranges, so `$50,001 -` and `$100,000` were
 * never joined.
 *
 * And the amount pattern only recognised ranges. Filers may disclose an exact
 * figure instead — `$2,722.50` in filing 20034999, `$15.00` in 20033725 — which
 * the old parser recorded as the absent string `""`, and the importer then
 * stored as `amountLow: 0, amountHigh: 0`.
 *
 * Amounts are therefore returned as an explicit status plus nullable bounds. A
 * missing amount is never zero.
 */

import type { TransactionType } from "./congress-schema.ts";

/**
 * How much is known about a row's amount.
 *
 * `disclosed_range` and `disclosed_exact` carry numeric bounds. The rest carry
 * `null` bounds and must be excluded from every aggregate.
 */
export type AmountStatus =
  | "disclosed_range"
  | "disclosed_exact"
  | "not_disclosed"
  | "not_applicable"
  | "parse_failed";

export interface ParsedAmount {
  /** Verbatim text as disclosed, or `""` when nothing was disclosed. */
  text: string;
  /** Lower bound in dollars, or `null` when no amount is known. */
  low: number | null;
  /** Upper bound in dollars, or `null` when no amount is known. */
  high: number | null;
  status: AmountStatus;
}

export interface ParsedRow {
  rowIndex: number;
  tickerText: string;
  issuerName: string;
  typeText: string;
  type: TransactionType;
  amount: ParsedAmount;
  transactionDateText: string;
  ownerText: string;
  isOptions: boolean;
  /**
   * True when the row was reassembled from a wrapped layout, where the issuer
   * name broke across a line or page so the symbol printed after the
   * transaction cells. Surfaced as a warning rather than trusted silently.
   */
  wrappedLayout: boolean;
}

/** Why a symbol-bearing block produced no transaction row. */
export type SkipReason =
  | "no_transaction_type"
  | "unsupported_asset_type";

export interface SkippedBlock {
  rowIndex: number;
  tickerText: string;
  reason: SkipReason;
  /** Bounded excerpt, so a skipped row can be judged without the PDF. */
  excerpt: string;
}

export interface FilingParseResult {
  rows: ParsedRow[];
  /** Symbol blocks that matched a ticker but yielded no usable row. */
  skipped: SkippedBlock[];
  /** Characters of text the extractor produced. Zero means extraction failed. */
  textLength: number;
  /** Symbol-bearing blocks seen, whether or not they produced a row. */
  symbolBlocks: number;
}

/**
 * Page furniture repeated on every page of a PTR.
 *
 * Removed before rows are split so a row straddling a page break reads as one
 * continuous row.
 */
/**
 * The column header is replaced by this word rather than deleted.
 *
 * `cleanIssuerName` bounds a name by the last record marker before it, and for
 * the first row of a filing the only marker available is the column header.
 * Deleting it outright made the filer's name and address bleed into the issuer
 * name. Collapsing it to `Amount` keeps that anchor while removing the `$200?`
 * that would otherwise be read as a dollar figure.
 */
const HEADER_SENTINEL = " Amount ";

const PAGE_FURNITURE: [RegExp, string][] = [
  // Footer: "-- 2 of 3 --"
  [/--\s*\d+\s+of\s+\d+\s*--/g, " "],
  // Repeated column header, in the two shapes the extractor emits.
  [
    /ID\s+Owner\s+Asset\s+Transaction\s+Type\s+Date\s+Notification\s+Date\s+Amount\s+Cap\.?\s*Gains\s*>\s*\$200\?/gi,
    HEADER_SENTINEL,
  ],
  [
    /Transaction\s+Type\s+Date\s+Notification\s+Date\s+Amount\s+Cap\.?\s*Gains\s*>\s*\$200\?/gi,
    HEADER_SENTINEL,
  ],
  // Clerk address block printed at the top of each page.
  [
    /Clerk of the House of Representatives\s*•?[^\n]*?Washington,\s*DC\s*20515/gi,
    " ",
  ],
  // Asset-type footnote printed at the foot of the last page.
  [
    /\*\s*For the complete list of asset type abbreviations[^]*?asset-type-codes\.aspx\./gi,
    " ",
  ],
];

/**
 * Strip repeated page furniture from extracted filing text.
 *
 * Exported for fixtures: the joining behaviour is the whole point of the fix,
 * so it is asserted directly rather than inferred from row counts.
 */
export function stripPageFurniture(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PAGE_FURNITURE) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

const RECORD_BOUNDARY =
  /\[[A-Z]{2}\]|\d{2}\/\d{2}\/\d{4}|\$[\d,]+(?:\.\d{2})?\s*-\s*\$[\d,]+(?:\.\d{2})?|F\s*S\s*:|S\s*O\s*:|D\s*:/g;

/**
 * Isolate the issuer name from the text preceding a symbol.
 *
 * The name is bounded by structure rather than by length — everything up to the
 * last record-boundary marker belongs to an earlier row and is discarded.
 */
export function cleanIssuerName(value: string): string {
  let text = value.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ");

  let lastEnd = 0;
  RECORD_BOUNDARY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RECORD_BOUNDARY.exec(text)) !== null) {
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd > 0) text = text.slice(lastEnd);

  return text
    .replace(/^.*(?:Cap\.?\s*Gains\s*>\s*\$200\?|Filing ID #\d+|Amount\b)\s*/i, "")
    .replace(/^.*(?:transaction|notification)\s*date\s*/i, "")
    .replace(SENTENCE_TAIL_RE, "")
    .replace(/^\d+\s+/, "")
    .replace(/^(?:SP|JT|DC)\s+/, "")
    .replace(/^[\s\-–—,.]+/, "")
    .trim();
}

/**
 * Full stops that do not end a sentence.
 *
 * Two kinds. A single letter is an initial — "A.O. Smith", "C.H. Robinson",
 * "U.S. Bancorp" — and a corporate suffix is an abbreviation. Without both,
 * "ServiceNow, Inc. Common Stock" is cut to "Common Stock" and "C.H. Robinson
 * Worldwide" to "Robinson Worldwide".
 */
const NAME_ABBREVIATIONS = [
  "[A-Za-z]",
  "Inc|inc|INC",
  "Corp|corp|CORP",
  "Ltd|ltd|LTD",
  "Co|co|Cos|Cp",
  "LLC|llc|LLP|llp",
  "LP|lp",
  "PLC|plc|Plc",
  "NV|nv|SA|AG|GmbH",
  "Cl|Ser|No|Jr|Sr|St|Mt|Dept|Est",
  // Name fragments that carry a full stop: "Warner Bros. Discovery".
  "Bros|Mfg|Intl|Natl|Assn|Pharm|Labs|Sys|Tech|Fin|Grp|Hldgs",
].join("|");

/**
 * Everything up to the last sentence break preceding the name.
 *
 * A filer's free-text description sits directly before the next row's issuer
 * name once whitespace is collapsed, so a name could inherit a whole sentence
 * of prose — filing 20034563 produced "of non-tradable contingent value right
 * (CVR) to be paid in 2026-27. Hologic, Inc. - Common Stock".
 */
const SENTENCE_TAIL_RE = new RegExp(
  `^.*(?<!\\b(?:${NAME_ABBREVIATIONS}))\\.\\s+(?=[A-Z])`,
  "s"
);

const RANGE_RE = /\$([\d,]+(?:\.\d{2})?)\s*-\s*\$([\d,]+(?:\.\d{2})?)/;
const EXACT_RE = /\$([\d,]+(?:\.\d{2})?)(?!\s*-)/;
/**
 * A range whose closing bound is separated from it by intervening text.
 *
 * The wrapped-layout signature: `$50,001 -` ends one printed line and
 * `$100,000` resumes after the issuer name's remainder and the symbol.
 */
const SPLIT_RANGE_RE =
  /\$([\d,]+(?:\.\d{2})?)\s*-\s*(?!\$)[^$]{1,120}?\$([\d,]+(?:\.\d{2})?)/;
/** A range whose closing bound never arrived at all. */
const DANGLING_RANGE_RE = /\$[\d,]+(?:\.\d{2})?\s*-\s*(?!\$)/;
const NOT_APPLICABLE_RE = /\bN\s*\/\s*A\b/i;

const money = (raw: string): number => Number(raw.replace(/,/g, ""));

/**
 * Interpret the amount cell of one row.
 *
 * The distinction the callers depend on: `parse_failed` means an amount is
 * present in the source and we could not read it, while `not_disclosed` means
 * the filer disclosed none. Conflating the two is what produced `$0`.
 */
export function parseAmount(block: string): ParsedAmount {
  // The header's "Cap. Gains > $200?" is furniture, not an amount. It is
  // normally stripped upstream; guarded here so `parseAmount` is safe alone.
  const text = block.replace(/Cap\.?\s*Gains\s*>\s*\$200\?/gi, " ");

  const range = text.match(RANGE_RE);
  if (range) {
    return {
      text: `$${range[1]} - $${range[2]}`,
      low: money(range[1]),
      high: money(range[2]),
      status: "disclosed_range",
    };
  }

  // A range interrupted by a line or page break. Rejoined only when the two
  // bounds are consistent, so unrelated dollar figures are never fused.
  const split = text.match(SPLIT_RANGE_RE);
  if (split) {
    const low = money(split[1]);
    const high = money(split[2]);
    if (high > low) {
      return {
        text: `$${split[1]} - $${split[2]}`,
        low,
        high,
        status: "disclosed_range",
      };
    }
  }

  if (DANGLING_RANGE_RE.test(text)) {
    return { text: "", low: null, high: null, status: "parse_failed" };
  }

  const exact = text.match(EXACT_RE);
  if (exact) {
    const value = money(exact[1]);
    return {
      text: `$${exact[1]}`,
      low: value,
      high: value,
      status: "disclosed_exact",
    };
  }

  if (NOT_APPLICABLE_RE.test(text)) {
    return { text: "", low: null, high: null, status: "not_applicable" };
  }

  return { text: "", low: null, high: null, status: "not_disclosed" };
}

/** The window after a symbol in which the transaction type is expected. */
const TYPE_WINDOW = 30;

function detectType(after: string): TransactionType | null {
  if (/^\s*P\b/.test(after)) return "Buy";
  if (/^\s*S\s*\(partial\)/.test(after) || /^\s*S\b/.test(after)) return "Sell";
  if (/^\s*E\b/.test(after)) return "Exchange";
  return null;
}

const TYPE_LETTER: Record<string, TransactionType> = {
  P: "Buy",
  S: "Sell",
  E: "Exchange",
};

/**
 * A transaction type immediately followed by a transaction date.
 *
 * Used only to rescue a wrapped row. Requiring the adjacent date is what makes
 * a bare `P`, `S` or `E` safe to read as a type — those letters appear
 * constantly inside issuer names, but never directly before a date.
 */
const TYPE_BEFORE_SYMBOL_RE =
  /(?:^|\s)(P|S\s*\(partial\)|S|E)\s+(\d{2}\/\d{2}\/\d{4})/g;

interface WrappedMatch {
  type: TransactionType;
  typeText: string;
  transactionDateText: string;
  /** Index in the block where the transaction cells begin. */
  cellStart: number;
  /** Index in the block where the type token ends. */
  cellTypeEnd: number;
}

/**
 * Find the transaction cells that print *before* a symbol in a wrapped row.
 *
 * Returns the last such match preceding the symbol: when a block carries more
 * than one date the transaction date is the one nearest its own row.
 */
function findTypeBeforeSymbol(
  before: string
): WrappedMatch | null {
  let found: WrappedMatch | null = null;
  TYPE_BEFORE_SYMBOL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TYPE_BEFORE_SYMBOL_RE.exec(before)) !== null) {
    const letter = m[1].trim().charAt(0).toUpperCase();
    const type = TYPE_LETTER[letter];
    if (!type) continue;
    const tokenStart = m.index + m[0].indexOf(m[1]);
    found = {
      type,
      typeText: m[1].trim(),
      transactionDateText: m[2],
      cellStart: tokenStart,
      cellTypeEnd: tokenStart + m[1].length,
    };
  }
  return found;
}

/**
 * Rebuild the issuer name of a wrapped row from its two printed fragments.
 *
 * The name breaks around the transaction cells: the head precedes the type, and
 * the tail resumes just before the symbol.
 */
function joinWrappedName(
  before: string,
  wrapped: WrappedMatch
): string {
  const head = cleanIssuerName(before.slice(0, wrapped.cellStart));
  let tail = before.slice(wrapped.cellTypeEnd);
  // Drop the transaction cells and any page furniture that survived, including
  // the header sentinel, which lands mid-name when a row spans a page break.
  tail = tail
    .replace(/\d{2}\/\d{2}\/\d{4}/g, " ")
    .replace(/\$[\d,]+(?:\.\d{2})?\s*-?/g, " ")
    .replace(/Filing ID #\d+/gi, " ")
    .replace(/\bAmount\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const joined = `${head} ${tail}`.replace(/\s+/g, " ").trim();
  return joined;
}

/**
 * Extract transaction rows from one filing's text.
 *
 * `rowIndex` counts every symbol-bearing block, including ones that yield no
 * usable transaction, so an id stays attached to the same row even if parsing
 * rules change later.
 */
export function parseFilingRows(rawText: string): FilingParseResult {
  const rows: ParsedRow[] = [];
  const skipped: SkippedBlock[] = [];

  const clean = stripPageFurniture(rawText).replace(/\s+/g, " ");
  const blocks = clean.split(/\b(?:SP|JT|DC)\s+(?=[A-Z])/);
  // Widened from [A-Z]{1,5} so share classes such as BRK.B are matched.
  const tickerRe = /\(([A-Z][A-Z0-9.\-]{0,6})\)\s*\[(ST|OP|CS|ET)\]/;

  let symbolBlockOrdinal = -1;

  for (const block of blocks) {
    const m = block.match(tickerRe);
    if (!m || m.index === undefined) continue;

    symbolBlockOrdinal += 1;

    const tickerText = m[1];
    const assetType = m[2];
    const symbolEnd = m.index + m[0].length;
    const after = block.slice(symbolEnd, symbolEnd + TYPE_WINDOW);

    const before = block.slice(0, m.index);

    // Owner is read from the head of the *filing*, not the row.
    //
    // This is wrong, and deliberately left wrong here. The block split consumes
    // the `SP`/`JT`/`DC` marker as its delimiter, so a per-row owner is not
    // available without changing how blocks are cut — and `ownerText` feeds
    // both the content hash and the reconciliation key. Populating it would
    // give every affected record a new identity, so the entire archive would
    // re-add rather than reconcile. It needs its own migration; see the PR
    // notes. Every stored record currently has an empty owner, and keeping
    // that stable is what makes this change safe to ship.
    const ownerM = clean.slice(0, 4).match(/^(SP|JT|DC)/);

    let type = detectType(after);
    let wrappedLayout = false;
    let typeText: string;
    let transactionDateText: string;
    let issuerName: string;

    if (type) {
      typeText = after.trim().slice(0, 12);
      const dateM = block.slice(m.index).match(/(\d{2}\/\d{2}\/\d{4})/);
      transactionDateText = dateM ? dateM[1] : "";
      // Issuer name is everything preceding the symbol, kept whole.
      issuerName = cleanIssuerName(before);
    } else {
      // The symbol printed after its transaction cells because the issuer name
      // wrapped. Twelve such rows were dropped outright by the previous parser.
      const wrapped = findTypeBeforeSymbol(before);
      if (!wrapped) {
        skipped.push({
          rowIndex: symbolBlockOrdinal,
          tickerText,
          reason: "no_transaction_type",
          excerpt: block.slice(Math.max(0, m.index - 60), symbolEnd + 120).trim(),
        });
        continue;
      }
      type = wrapped.type;
      typeText = wrapped.typeText;
      transactionDateText = wrapped.transactionDateText;
      issuerName = joinWrappedName(before, wrapped);
      wrappedLayout = true;
    }

    const amount = parseAmount(block);

    rows.push({
      rowIndex: symbolBlockOrdinal,
      tickerText,
      issuerName,
      typeText,
      type,
      amount,
      transactionDateText,
      ownerText: ownerM ? ownerM[1] : "",
      isOptions: assetType === "OP",
      wrappedLayout,
    });
  }

  return {
    rows,
    skipped,
    textLength: rawText.length,
    symbolBlocks: symbolBlockOrdinal + 1,
  };
}

// --- zero-row classification -------------------------------------------------

/**
 * Why a filing produced no transaction rows.
 *
 * A filing legitimately yields nothing when it discloses only assets without a
 * public ticker. The remaining categories are all reasons to look closer, and
 * are surfaced rather than assumed healthy.
 */
export type ZeroRowClassification =
  | "no_ticker_present"
  | "no_supported_security_transaction"
  | "empty_text_extraction"
  | "unsupported_layout"
  | "parser_suspicious";

export interface ZeroRowFinding {
  docId: string;
  filingUrl: string;
  filer: string;
  filedDate: string;
  classification: ZeroRowClassification;
  textLength: number;
  symbolBlocks: number;
  skipped: SkippedBlock[];
  /** True when this filing has previously produced rows. */
  previouslyProductive: boolean;
}

/** Text that indicates a real PTR body was extracted. */
const PTR_BODY_MARKERS =
  /Periodic Transaction Report|Transaction\s+Type|Filing ID #\d+|Asset\b/i;

/** Any symbol carrying an asset-type tag, whether or not the type is supported. */
const ANY_SYMBOL_RE = /\(([A-Z][A-Z0-9.\-]{0,6})\)\s*\[([A-Z]{2})\]/g;

/** Asset types this parser turns into transactions. */
const SUPPORTED_ASSET_TYPES = new Set(["ST", "OP", "CS", "ET"]);

export interface ZeroRowDetail {
  classification: ZeroRowClassification;
  /** Asset-type codes seen but not supported, e.g. `CT` for cryptocurrency. */
  unsupportedAssetTypes: string[];
}

/**
 * Classify a filing that produced no rows.
 *
 * Deliberately conservative. `parser_suspicious` is reserved for the case that
 * cannot be explained — a symbol of a supported asset type that nevertheless
 * produced no row. That is the signature of silent data loss, so it is the one
 * classification wired to a blocking gate rather than a warning.
 */
export function classifyZeroRow(
  rawText: string,
  parse: FilingParseResult
): ZeroRowDetail {
  const none: string[] = [];
  const trimmed = rawText.replace(/[\s ]+/g, " ").trim();

  // Scanned filings extract as nothing but page footers.
  const withoutFurniture = stripPageFurniture(trimmed)
    .replace(/\bAmount\b/g, " ")
    .trim();
  if (withoutFurniture.length < 200) {
    return { classification: "empty_text_extraction", unsupportedAssetTypes: none };
  }

  if (!PTR_BODY_MARKERS.test(rawText)) {
    return { classification: "unsupported_layout", unsupportedAssetTypes: none };
  }

  // A supported symbol that produced no row is unexplained, and blocking.
  if (parse.skipped.length > 0) {
    return { classification: "parser_suspicious", unsupportedAssetTypes: none };
  }

  const codes = new Set<string>();
  ANY_SYMBOL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  const collapsed = stripPageFurniture(rawText).replace(/\s+/g, " ");
  while ((m = ANY_SYMBOL_RE.exec(collapsed)) !== null) {
    if (SUPPORTED_ASSET_TYPES.has(m[2])) {
      // A supported asset type is present yet no row came out of it.
      return { classification: "parser_suspicious", unsupportedAssetTypes: none };
    }
    codes.add(m[2]);
  }

  if (codes.size > 0) {
    return {
      classification: "no_supported_security_transaction",
      unsupportedAssetTypes: [...codes].sort(),
    };
  }

  if (!/\([A-Z]/.test(rawText)) {
    return { classification: "no_ticker_present", unsupportedAssetTypes: none };
  }

  return {
    classification: "no_supported_security_transaction",
    unsupportedAssetTypes: none,
  };
}
