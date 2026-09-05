/**
 * Ownership XML → Form 4 records.
 *
 * The fixture set spans five declared schema versions (X0305 through X0609), so
 * nothing here assumes a single document shape. Fields are read by name and
 * treated as optional unless the contract requires them; a version we cannot
 * read is refused as unsupported rather than parsed optimistically.
 *
 * Every row keeps its source ordinal within its table. That ordinal is part of
 * row identity, so re-parsing the same bytes reproduces the same ids even when
 * the interpretation of a field changes.
 */

import { createHash } from "node:crypto";

import { classifyPriceQuality, classifyRow } from "./classify.ts";
import {
  child,
  children,
  childText,
  parseXml,
  valueAndFootnotes,
  XmlError,
  type XmlNode,
} from "./xml.ts";
import {
  normalizeCik,
  parseBoolean,
  parseDate,
  parseDecimal,
  parseText,
  unresolvedFootnoteIds,
} from "./validate.ts";
import {
  FORM4_PARSER_VERSION,
  FORM4_SCHEMA_VERSION,
  type Form4Filing,
  type Form4Row,
  type Form4Table,
  type Form4RowKind,
  type OwnershipForm,
  type ReportingOwner,
  type UnsupportedDocument,
} from "./types.ts";

export interface ParseInput {
  xml: string;
  accessionNumber: string;
  documentUrl: string;
  indexUrl: string;
  documentName: string;
  importRunId: string;
  firstObservedAt: string;
  lastObservedAt?: string;
  observationMode?: "live" | "backfill";
  rawArtifactPath?: string | null;
  /** Regulator-reported filing date, from the index rather than the document. */
  filedDate?: string | null;
  acceptedAt?: string | null;
  acceptedAtSource?: string | null;
}

export type ParseResult =
  | { ok: true; filing: Form4Filing }
  | { ok: false; unsupported: UnsupportedDocument };

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Schema versions the parser has fixtures for. */
const KNOWN_SCHEMA_VERSIONS = new Set(["X0305", "X0306", "X0407", "X0508", "X0609"]);

const SUPPORTED_TYPES = new Set(["4", "4/A"]);

export function parseForm4(input: ParseInput): ParseResult {
  const documentSha256 = sha256(input.xml);

  const unsupported = (
    reason: UnsupportedDocument["reason"],
    detail: string,
    declaredType: string | null = null
  ): ParseResult => ({
    ok: false,
    unsupported: {
      accessionNumber: input.accessionNumber,
      documentUrl: input.documentUrl,
      documentSha256,
      declaredType,
      reason,
      detail,
    },
  });

  let root: XmlNode;
  try {
    root = parseXml(input.xml);
  } catch (error) {
    if (error instanceof XmlError) {
      return unsupported("xml_refused", `${error.code}: ${error.message}`);
    }
    throw error;
  }

  if (root.name !== "ownershipDocument") {
    return unsupported("not_an_ownership_document", `root element is <${root.name}>`);
  }

  const declaredType = childText(root, "documentType");
  if (!declaredType || !SUPPORTED_TYPES.has(declaredType)) {
    // Forms 3 and 5 share this schema. Recognising them explicitly is what
    // stops a 3 or 5 being counted inside a selection advertised as 4/4A.
    return unsupported(
      "unsupported_form_type",
      `documentType ${declaredType ?? "(absent)"} is outside 4 / 4A`,
      declaredType
    );
  }

  const sourceSchemaVersion = childText(root, "schemaVersion");
  if (sourceSchemaVersion && !KNOWN_SCHEMA_VERSIONS.has(sourceSchemaVersion)) {
    return unsupported(
      "unsupported_schema_version",
      `schemaVersion ${sourceSchemaVersion} has no fixture coverage`,
      declaredType
    );
  }

  const filingId = `${input.accessionNumber}::${documentSha256}`;
  const warnings: string[] = [];

  // --- footnotes -----------------------------------------------------------
  const footnotes: Record<string, string> = {};
  for (const note of children(child(root, "footnotes"), "footnote")) {
    const id = note.attrs.id;
    if (id) footnotes[id] = note.text.trim();
  }

  // --- issuer --------------------------------------------------------------
  const issuerNode = child(root, "issuer");
  const issuerCik = normalizeCik(childText(issuerNode, "issuerCik"));
  if (!issuerCik) warnings.push("issuer_cik_missing");

  // --- reporting owners ----------------------------------------------------
  const reportingOwners: ReportingOwner[] = [];
  for (const owner of children(root, "reportingOwner")) {
    const idNode = child(owner, "reportingOwnerId");
    const rel = child(owner, "reportingOwnerRelationship");
    reportingOwners.push({
      cik: normalizeCik(childText(idNode, "rptOwnerCik")) ?? "",
      name: childText(idNode, "rptOwnerName"),
      isDirector: parseBoolean(childText(rel, "isDirector")),
      isOfficer: parseBoolean(childText(rel, "isOfficer")),
      isTenPercentOwner: parseBoolean(childText(rel, "isTenPercentOwner")),
      isOther: parseBoolean(childText(rel, "isOther")),
      officerTitle: childText(rel, "officerTitle"),
      otherText: childText(rel, "otherText"),
    });
  }
  if (reportingOwners.length === 0) warnings.push("no_reporting_owner");

  // --- rows ----------------------------------------------------------------
  const rows: Form4Row[] = [];
  const readTable = (tableName: string, table: Form4Table) => {
    const tableNode = child(root, tableName);
    if (!tableNode) return;
    const prefix = table === "nonDerivative" ? "nonDerivative" : "derivative";
    let ordinal = 0;
    // Ordinals count both kinds in document order within the table, so a row's
    // position is stable regardless of how transactions and holdings interleave.
    for (const node of tableNode.children) {
      const isTransaction = node.name === `${prefix}Transaction`;
      const isHolding = node.name === `${prefix}Holding`;
      if (!isTransaction && !isHolding) continue;
      rows.push(
        readRow(node, {
          table,
          rowKind: isTransaction ? "transaction" : "holding",
          ordinal: ordinal++,
          filingId,
          accessionNumber: input.accessionNumber,
          documentSha256,
          footnotes,
        })
      );
    }
  };
  readTable("nonDerivativeTable", "nonDerivative");
  readTable("derivativeTable", "derivative");

  const quarantinedRows = rows.filter((r) => r.validation === "quarantined").length;
  const validation: Form4Filing["validation"] =
    !issuerCik || reportingOwners.length === 0
      ? "quarantined"
      : quarantinedRows > 0 || warnings.length > 0
        ? "warning"
        : "valid";

  const aff10b5OneRaw = childText(root, "aff10b5One");

  // `dateOfOriginalSubmission` is metadata the filer typed. It is preserved and
  // its problems are surfaced, but it is never used for identity, amendment
  // linking, ordering or replacement — a value that cannot be right would
  // otherwise become a link to the wrong filing.
  const periodOfReport = parseDate(childText(root, "periodOfReport"));
  const originalSubmission = parseDate(childText(root, "dateOfOriginalSubmission"));
  const chronologyWarnings: string[] = [];

  if (originalSubmission.reason === "unparseable") {
    chronologyWarnings.push("original_submission_date_unparseable");
  }
  if (originalSubmission.value && periodOfReport.value) {
    if (originalSubmission.value < periodOfReport.value) {
      // The original was reportedly filed before the period it reports on.
      chronologyWarnings.push(
        `original_submission_before_period:${originalSubmission.value}<${periodOfReport.value}`
      );
    }
  }
  if (originalSubmission.value && input.filedDate) {
    const filed = parseDate(input.filedDate);
    if (filed.value && originalSubmission.value > filed.value) {
      // An amendment cannot amend something filed after it.
      chronologyWarnings.push(
        `original_submission_after_this_filing:${originalSubmission.value}>${filed.value}`
      );
    }
  }
  if (originalSubmission.value && originalSubmission.value > input.firstObservedAt.slice(0, 10)) {
    chronologyWarnings.push(`original_submission_in_the_future:${originalSubmission.value}`);
  }
  if (declaredType === "4/A" && !originalSubmission.value) {
    chronologyWarnings.push("amendment_without_original_submission_date");
  }

  const filing: Form4Filing = {
    id: filingId,
    source: "sec-form4",
    accessionNumber: input.accessionNumber,
    documentType: declaredType as "4" | "4/A",
    sourceSchemaVersion,
    indexUrl: input.indexUrl,
    documentUrl: input.documentUrl,
    documentName: input.documentName,
    documentSha256,
    rawArtifactPath: input.rawArtifactPath ?? null,
    issuer: {
      cik: issuerCik ?? "",
      name: childText(issuerNode, "issuerName"),
      tradingSymbol: childText(issuerNode, "issuerTradingSymbol"),
      // Left unresolved here. Promoting the filer's symbol to a resolved ticker
      // would assert a mapping this module has not performed.
      resolvedTicker: null,
      tickerResolution: "unresolved",
      tickerResolutionSource: null,
    },
    reportingOwners,
    periodOfReport,
    dateOfOriginalSubmission: originalSubmission,
    timestamps: {
      filedDate: parseDate(input.filedDate ?? null),
      acceptedAt: parseText(input.acceptedAt ?? null),
      acceptedAtSource: input.acceptedAtSource ?? null,
      // Never derived. EDGAR's dissemination time is not in the document.
      publiclyAvailableAt: { value: null, raw: null, reason: "not_present_in_source", footnoteIds: [] },
      firstObservedAt: input.firstObservedAt,
      lastObservedAt: input.lastObservedAt ?? input.firstObservedAt,
      observationMode: input.observationMode ?? "backfill",
    },
    aff10b5OneRaw,
    aff10b5One: parseBoolean(aff10b5OneRaw),
    notSubjectToSection16: parseBoolean(childText(root, "notSubjectToSection16")),
    footnotes,
    remarks: childText(root, "remarks"),
    chronologyWarnings,
    rows,
    amendment:
      declaredType === "4/A"
        ? {
            status: "unresolved",
            originalAccession: null,
            method: null,
            evidence: [],
            candidateAccessions: [],
          }
        : null,
    parserVersion: FORM4_PARSER_VERSION,
    schemaVersion: FORM4_SCHEMA_VERSION,
    importRunId: input.importRunId,
    warnings,
    validation,
  };

  return { ok: true, filing };
}

interface RowContext {
  table: Form4Table;
  rowKind: Form4RowKind;
  ordinal: number;
  filingId: string;
  accessionNumber: string;
  documentSha256: string;
  footnotes: Record<string, string>;
}

function readRow(node: XmlNode, ctx: RowContext): Form4Row {
  const coding = child(node, "transactionCoding");
  const amounts = child(node, "transactionAmounts");
  const post = child(node, "postTransactionAmounts");
  const nature = child(node, "ownershipNature");
  const underlying = child(node, "underlyingSecurity");

  const field = (parent: XmlNode | undefined, name: string) => valueAndFootnotes(parent, name);

  const securityTitle = field(node, "securityTitle");
  const transactionDate = field(node, "transactionDate");
  const deemedExecutionDate = field(node, "deemedExecutionDate");
  const shares = field(amounts, "transactionShares");
  const price = field(amounts, "transactionPricePerShare");
  const acquiredDisposed = field(amounts, "transactionAcquiredDisposedCode");
  const owned = field(post, "sharesOwnedFollowingTransaction");
  const directIndirect = field(nature, "directOrIndirectOwnership");
  const natureOfOwnership = field(nature, "natureOfOwnership");
  const conversionPrice = field(node, "conversionOrExercisePrice");
  const exerciseDate = field(node, "exerciseDate");
  const expirationDate = field(node, "expirationDate");
  const underlyingTitle = field(underlying, "underlyingSecurityTitle");
  const underlyingShares = field(underlying, "underlyingSecurityShares");

  const transactionCodeRaw = childText(coding, "transactionCode");
  const { classification, warnings: classWarnings } = classifyRow(ctx.rowKind, transactionCodeRaw);
  const warnings = [...classWarnings];

  const ownershipRaw = directIndirect.value?.trim().toUpperCase() ?? null;
  const ownership: OwnershipForm =
    ownershipRaw === "D" ? "direct" : ownershipRaw === "I" ? "indirect" : "unknown";
  if (ownership === "unknown" && ctx.rowKind === "transaction") {
    warnings.push("ownership_form_unknown");
  }

  const parsedShares = parseDecimal(shares.value, shares.footnoteIds);
  const parsedPrice = parseDecimal(price.value, price.footnoteIds);
  const parsedDate = parseDate(transactionDate.value, transactionDate.footnoteIds);

  // A present-but-unreadable numeric is a defect; an absent one is a fact.
  if (parsedShares.reason === "unparseable") warnings.push("shares_unparseable");
  if (parsedPrice.reason === "unparseable") warnings.push("price_unparseable");
  if (parsedDate.reason === "unparseable") warnings.push("transaction_date_unparseable");
  if (ctx.rowKind === "transaction" && parsedDate.value === null && parsedDate.reason !== "unparseable") {
    warnings.push("transaction_date_missing");
  }

  const referenced = [
    ...securityTitle.footnoteIds, ...transactionDate.footnoteIds, ...shares.footnoteIds,
    ...price.footnoteIds, ...owned.footnoteIds, ...natureOfOwnership.footnoteIds,
    ...conversionPrice.footnoteIds, ...exerciseDate.footnoteIds, ...expirationDate.footnoteIds,
    ...underlyingTitle.footnoteIds, ...underlyingShares.footnoteIds, ...acquiredDisposed.footnoteIds,
    ...children(coding, "footnoteId").map((f) => f.attrs.id).filter(Boolean),
  ];
  const unresolved = unresolvedFootnoteIds(referenced, ctx.footnotes);
  for (const id of unresolved) warnings.push(`unresolved_footnote:${id}`);

  const priceQuality = classifyPriceQuality(parsedPrice.value, price.footnoteIds, ctx.footnotes);
  if (priceQuality === "weighted_average") warnings.push("price_is_weighted_average");
  if (priceQuality === "unspecified" && parsedPrice.value !== null) {
    warnings.push("price_qualified_by_unrecognized_footnote");
  }

  const quarantine =
    parsedShares.reason === "unparseable" ||
    parsedPrice.reason === "unparseable" ||
    parsedDate.reason === "unparseable" ||
    unresolved.length > 0;

  return {
    id: `${ctx.accessionNumber}::${ctx.documentSha256}::${ctx.table}::${ctx.rowKind}::${ctx.ordinal}`,
    filingId: ctx.filingId,
    accessionNumber: ctx.accessionNumber,
    documentSha256: ctx.documentSha256,
    table: ctx.table,
    rowKind: ctx.rowKind,
    sourceOrdinal: ctx.ordinal,
    securityTitle: parseText(securityTitle.value, securityTitle.footnoteIds),
    underlyingSecurityTitle: parseText(underlyingTitle.value, underlyingTitle.footnoteIds),
    underlyingShares: parseDecimal(underlyingShares.value, underlyingShares.footnoteIds),
    conversionOrExercisePrice: parseDecimal(conversionPrice.value, conversionPrice.footnoteIds),
    exerciseDate: parseDate(exerciseDate.value, exerciseDate.footnoteIds),
    expirationDate: parseDate(expirationDate.value, expirationDate.footnoteIds),
    transactionDate: parsedDate,
    deemedExecutionDate: parseDate(deemedExecutionDate.value, deemedExecutionDate.footnoteIds),
    transactionCodeRaw,
    acquiredDisposedRaw: acquiredDisposed.value,
    equitySwapInvolved: parseBoolean(childText(coding, "equitySwapInvolved")),
    transactionTimeliness: childText(coding, "transactionTimeliness"),
    shares: parsedShares,
    pricePerShare: parsedPrice,
    priceQuality: classifyPriceQuality(parsedPrice.value, price.footnoteIds, ctx.footnotes),
    sharesOwnedFollowingTransaction: parseDecimal(owned.value, owned.footnoteIds),
    ownership,
    natureOfOwnership: parseText(natureOfOwnership.value, natureOfOwnership.footnoteIds),
    classification,
    warnings,
    validation: quarantine ? "quarantined" : warnings.length > 0 ? "warning" : "valid",
    parserVersion: FORM4_PARSER_VERSION,
  };
}
