import { isOrdinaryShareTrade } from "./classify.ts";
import { parseDate } from "./validate.ts";
import type { Form4Reconciliation } from "./reconcile.ts";
import type { Form4Filing, Form4Row } from "./types.ts";

export interface InsiderSecurityIdentity { cik: string; ticker: string }
export interface InsiderActivity {
  id: string;
  issuerCik: string;
  issuerName: string | null;
  ticker: string;
  securityTitle: string;
  /** A joint filing remains one source row, with all its reporting owners. */
  reportingOwners: Form4Filing["reportingOwners"];
  transactionDate: string;
  filedDate: string;
  classification: "reported_purchase" | "reported_sale";
  reportedShares: string;
  reportedPrice: Form4Row["pricePerShare"];
  priceQuality: Form4Row["priceQuality"];
  ownership: Form4Row["ownership"];
  natureOfOwnership: Form4Row["natureOfOwnership"];
  filingPlanIndicator: boolean | null;
  accessionNumber: string;
  sourceUrl: string;
  filingId: string;
  footnotes: Record<string, string>;
  warnings: string[];
  sourceDocumentSha256: string;
  sourceRemarks: string | null;
}

/** A source-specific view; never mixes awards, derivatives, or 13F changes into purchases. */
export function buildInsiderActivity(
  reconciled: Form4Reconciliation,
  identities: InsiderSecurityIdentity[],
  from: string,
  to: string,
): { records: InsiderActivity[]; excluded: Record<string, number> } {
  if (!reconciled.ready) throw new Error("Insider activity requires resolved amendments and document versions");
  if (parseDate(from).value !== from || parseDate(to).value !== to || from > to) {
    throw new Error("Invalid insider transaction-date window");
  }
  const records: InsiderActivity[] = [];
  const excluded: Record<string, number> = {};
  const exclude = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1; };
  const symbols = new Map<string, Set<string>>();
  for (const identity of identities) {
    if (!/^\d{1,10}$/.test(identity.cik)) continue;
    const ticker = identity.ticker.trim().toUpperCase();
    if (!ticker) continue;
    const ciks = symbols.get(ticker) ?? new Set<string>();
    ciks.add(identity.cik.padStart(10, "0"));
    symbols.set(ticker, ciks);
  }
  for (const { filing, row } of reconciled.activeRows) {
    if (row.rowKind !== "transaction" || !isOrdinaryShareTrade(row.table, row.classification)) {
      exclude("not_non_derivative_purchase_or_sale"); continue;
    }
    const expectedCode = row.classification === "reported_purchase" ? "P" : "S";
    const expectedDirection = expectedCode === "P" ? "A" : "D";
    if (row.transactionCodeRaw?.trim().toUpperCase() !== expectedCode ||
        row.acquiredDisposedRaw?.trim().toUpperCase() !== expectedDirection) {
      exclude("classification_conflict"); continue;
    }
    const date = row.transactionDate.value;
    const filed = filing.timestamps.filedDate.value;
    if (!date || !filed || parseDate(date).value !== date || parseDate(filed).value !== filed || date > filed) {
      exclude("missing_or_invalid_dates"); continue;
    }
    if (date < from || date > to) { exclude("outside_transaction_window"); continue; }
    const ticker = filing.issuer.tradingSymbol?.trim().toUpperCase() ?? "";
    const ciks = symbols.get(ticker);
    if (!ciks || ciks.size !== 1 || !ciks.has(filing.issuer.cik)) {
      exclude("unresolved_issuer_symbol"); continue;
    }
    if (!row.securityTitle.value?.trim() || !row.shares.value ||
        !/^\d+(?:\.\d+)?$/.test(row.shares.value) || !/[1-9]/.test(row.shares.value)) {
      exclude("missing_security_or_positive_shares"); continue;
    }
    if (!filing.reportingOwners.length || filing.reportingOwners.some(owner => !/^\d{10}$/.test(owner.cik))) {
      exclude("missing_owner_identity"); continue;
    }
    let source: URL;
    try { source = new URL(filing.documentUrl); } catch { exclude("invalid_source"); continue; }
    if (source.protocol !== "https:" || source.hostname !== "www.sec.gov" ||
        source.username || source.password || source.port ||
        !source.pathname.startsWith("/Archives/edgar/data/")) {
      exclude("invalid_source"); continue;
    }
    records.push({
      id: row.id, issuerCik: filing.issuer.cik, issuerName: filing.issuer.name,
      ticker, securityTitle: row.securityTitle.value, reportingOwners: filing.reportingOwners,
      transactionDate: date, filedDate: filed,
      classification: row.classification as InsiderActivity["classification"],
      reportedShares: row.shares.value, reportedPrice: row.pricePerShare, priceQuality: row.priceQuality,
      ownership: row.ownership, natureOfOwnership: row.natureOfOwnership,
      filingPlanIndicator: filing.aff10b5One, accessionNumber: filing.accessionNumber,
      sourceUrl: filing.documentUrl, filingId: filing.id, footnotes: filing.footnotes,
      warnings: [...filing.warnings, ...filing.chronologyWarnings, ...row.warnings],
      sourceDocumentSha256: filing.documentSha256, sourceRemarks: filing.remarks,
    });
  }
  // Chronological display, not a ranking by reporting-row count.
  records.sort((a, b) => b.filedDate.localeCompare(a.filedDate) ||
    b.transactionDate.localeCompare(a.transactionDate) || a.id.localeCompare(b.id));
  return { records, excluded };
}
