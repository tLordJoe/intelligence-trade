import type { parseSenateReport } from "./parse.ts";
import { reconcileSenateReports, type SenateAmendmentReview } from "./reconcile.ts";
import { resolveTicker, issuerNameMatchesTicker, normalizeIssuerName, type SecurityMaster } from "../security-master.ts";
import type { SenateReportReference } from "./source.ts";

export type SenateFiling = ReturnType<typeof parseSenateReport>;
export interface SenatePerson {
  bioguide: string;
  names: string[];
  terms: { start: string; end: string; state: string; party: string }[];
}
export interface CongressionalRosterPerson {
  id: { bioguide: string };
  name: { first: string; middle?: string; last: string; official_full?: string; nickname?: string };
  terms: { type: string; start: string; end: string; state: string; party: string }[];
}
/** Security classification is reviewed against exact source bytes, not inferred from "Stock". */
export interface SenateSecurityReview {
  rowId: string;
  documentSha256: string;
  cik: string;
  kind: "company_stock" | "fund" | "other";
  reviewedBy: string;
  reviewedAt: string;
  evidenceNote: string;
  evidenceUrl: string;
}
export function senatePeopleFromRoster(source: CongressionalRosterPerson[]): SenatePerson[] {
  if (!Array.isArray(source) || !source.length) throw new Error("Empty or invalid congressional identity source");
  return source.filter(person => person.terms.some(term => term.type === "sen")).map(person => ({
    bioguide: person.id.bioguide,
    names: [...new Set([`${person.name.first} ${person.name.last}`, person.name.official_full,
      person.name.middle ? `${person.name.first} ${person.name.middle} ${person.name.last}` : undefined,
      person.name.middle ? `${person.name.first} ${person.name.middle[0]} ${person.name.last}` : undefined,
      person.name.middle && person.name.official_full?.endsWith(` ${person.name.last}`) ? `${person.name.official_full.slice(0, -person.name.last.length).trim()} ${person.name.middle[0]} ${person.name.last}` : undefined,
      person.name.nickname ? `${person.name.nickname} ${person.name.last}` : undefined].filter((name): name is string => !!name))],
    terms: person.terms.filter(term => term.type === "sen").map(({ start, end, state, party }) => ({ start, end, state, party })),
  }));
}
const nameKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
function strongIssuerNameMatch(filed: string, registered: string): boolean {
  const a = normalizeIssuerName(filed), b = normalizeIssuerName(registered);
  if (!a || !b) return false;
  const flatA = a.replaceAll(" ", ""), flatB = b.replaceAll(" ", "");
  if (Math.min(flatA.length, flatB.length) >= 3 && (flatA.includes(flatB) || flatB.includes(flatA))) return true;
  const at = new Set(a.split(" ").filter(token => token.length > 2)), bt = new Set(b.split(" ").filter(token => token.length > 2));
  const overlap = [...at].filter(token => bt.has(token)).length;
  return overlap >= 2 && overlap >= Math.ceil(Math.min(at.size, bt.size) * 0.75);
}

/** Exact full-name aliases and term evidence; no last-name-only identity guesses. */
export function resolveSenatePerson(filing: SenateFiling, people: readonly SenatePerson[]) {
  const names = new Set([nameKey(`${filing.reference.firstName} ${filing.reference.lastName}`)]);
  // The official source supplies both the formal filer name and the Senate-office
  // name in the same index/report. Use the latter only when the original header
  // corroborates that exact office label; never manufacture nickname expansions.
  const office = /^(.+?),\s*(.+?)\s*\(Senator\)$/.exec(filing.reference.office);
  const officeSurname = (value: string) => nameKey(value.replace(/,?\s+(?:Jr\.?|Sr\.?|II|III|IV)$/i, ""));
  if (office && officeSurname(office[1]) === officeSurname(filing.reference.lastName) &&
      nameKey(filing.filer).includes(nameKey(`${office[1]}, ${office[2]}`))) names.add(nameKey(`${office[2]} ${office[1]}`));
  const matches = people.flatMap(person => {
    if (!/^[A-Z]\d{6}$/.test(person.bioguide) || !person.names.some(alias => names.has(nameKey(alias)))) return [];
    const terms = person.terms.filter(term => term.start <= filing.filedDate && filing.filedDate < term.end && /^[A-Z]{2}$/.test(term.state));
    return terms.map(term => ({ bioguide: person.bioguide, name: `${filing.reference.firstName} ${filing.reference.lastName}`, ...term }));
  });
  const unique = [...new Map(matches.map(match => [JSON.stringify(match), match])).values()];
  return unique.length === 1 ? unique[0] : null;
}

/** Duplicate collection is not duplicate activity. A changed document is a hold. */
export function deduplicateSenateFilings(filings: readonly SenateFiling[]) {
  const byId = new Map<string, SenateFiling>();
  const conflicts = new Set<string>();
  let repeatedReports = 0;
  for (const filing of filings) {
    const old = byId.get(filing.reference.id);
    if (old) {
      if (old.documentSha256 !== filing.documentSha256 || JSON.stringify(old.reference) !== JSON.stringify(filing.reference)) conflicts.add(filing.reference.id);
      else repeatedReports++;
    } else byId.set(filing.reference.id, filing);
  }
  return { filings: [...byId.values()], conflicts: [...conflicts], repeatedReports };
}

/** Prepare review rows, never publication approval. Reconciliation fails closed. */
export function buildSenateCandidate(filings: readonly SenateFiling[], people: readonly SenatePerson[], master: SecurityMaster,
  amendments: readonly SenateAmendmentReview[] = [], securityReviews: readonly SenateSecurityReview[] = [], externalHolds: readonly SenateReportReference[] = []) {
  const unique = deduplicateSenateFilings(filings);
  // An unresolved old amendment blocks its report family, not unrelated current disclosures.
  // All originals sharing a filer/report-date family are held together when ambiguous.
  const families = new Map<string, SenateFiling[]>();
  const familyKey = (filing: SenateFiling) => {
    const date = /\bfor\s+(\d{2}\/\d{2}\/\d{4})\b/i.exec(filing.title)?.[1];
    const identity = resolveSenatePerson(filing, people)?.bioguide ?? `${nameKey(filing.reference.firstName)}:${nameKey(filing.reference.lastName)}`;
    return `${identity}:${date ?? "unknown-date"}`;
  };
  for (const filing of unique.filings) { const key = familyKey(filing); families.set(key, [...(families.get(key) ?? []), filing]); }
  const active = new Set<string>();
  const blockers = unique.conflicts.map(id => `changed_report_version:${id}`);
  for (const family of families.values()) {
    const ids = new Set(family.map(filing => filing.reference.id));
    const reconciled = reconcileSenateReports(family, amendments.filter(review => ids.has(review.originalId) || ids.has(review.amendmentId)));
    blockers.push(...reconciled.blockers);
    const missingFamilyDate = familyKey(family[0]).endsWith(":unknown-date");
    if (missingFamilyDate) blockers.push(`report_family_date_unknown:${family[0].reference.id}`);
    const relatedHold = externalHolds.some(reference => {
      const sameFiler = nameKey(reference.firstName) === nameKey(family[0].reference.firstName) && nameKey(reference.lastName) === nameKey(family[0].reference.lastName);
      const date = /\bfor\s+(\d{2}\/\d{2}\/\d{4})\b/i.exec(reference.reportTitle)?.[1];
      return sameFiler && (!date || familyKey(family[0]).endsWith(`:${date}`));
    });
    // A formal-name mismatch on an amendment is not evidence it belongs to somebody
    // else. Conservatively hold same-surname/date originals until the alias is reviewed.
    const unresolvedAliasAmendment = unique.filings.some(filing => filing.amendment && !resolveSenatePerson(filing, people) &&
      nameKey(filing.reference.lastName) === nameKey(family[0].reference.lastName) &&
      familyKey(filing).split(":").at(-1) === familyKey(family[0]).split(":").at(-1));
    if (unresolvedAliasAmendment) blockers.push(`amendment_filer_alias_unresolved:${family[0].reference.id}`);
    if (relatedHold) blockers.push(`unparsed_report_in_family:${family[0].reference.id}`);
    if (reconciled.ready && !missingFamilyDate && !relatedHold && !unresolvedAliasAmendment && !unique.conflicts.some(id => ids.has(id))) {
      for (const filing of reconciled.activeFilings) active.add(filing.reference.id);
    }
  }
  const rows = unique.filings.flatMap(filing => {
    const person = resolveSenatePerson(filing, people);
    return filing.rows.map(row => {
      const lookup = resolveTicker(row.raw.tickerText, master);
      const identityMatches = lookup.resolution !== "unknown" && !!lookup.title && strongIssuerNameMatch(row.assetName, lookup.title) &&
        issuerNameMatchesTicker(row.assetName, lookup, master).matches;
      const reviews = securityReviews.filter(review => review.rowId === row.id);
      const decision = reviews.length === 1 ? reviews[0] : null;
      const classified = decision && decision.documentSha256 === filing.documentSha256 && identityMatches &&
        decision.cik === lookup.cik && ["company_stock", "fund", "other"].includes(decision.kind) &&
        decision.reviewedBy.trim() && decision.evidenceNote.trim() && Number.isFinite(Date.parse(decision.reviewedAt)) &&
        /^https:\/\/[^\s]+$/.test(decision.evidenceUrl) ? decision.kind : null;
      const holds = [...row.issues];
      if (!person) holds.push("filer_identity_unresolved");
      if (!row.listedSecurityCandidate || !["Buy", "Sell"].includes(row.direction ?? "")) holds.push("not_supported_listed_purchase_or_sale");
      if (!identityMatches) holds.push("security_identity_unresolved_or_conflicting");
      // SEC ticker existence does not establish stock versus ETF/mutual fund.
      if (row.listedSecurityCandidate && !classified) holds.push("security_type_review_required");
      if (!active.has(filing.reference.id)) holds.push("report_reconciliation_required");
      return { ...row, reportId: filing.reference.id, sourceUrl: filing.reference.url,
        documentSha256: filing.documentSha256, filer: `${filing.reference.firstName} ${filing.reference.lastName}`,
        chamber: "Senate" as const, bioguide: person?.bioguide ?? null, state: person?.state ?? null,
        party: person?.party ?? null, filedDate: filing.filedDate, receivedDate: filing.reference.receivedDate,
        amendment: filing.amendment, securityKind: classified, securityMatch: identityMatches ? lookup : null, holds: [...new Set(holds)] };
    });
  });
  const holdCounts: Record<string, number> = {};
  for (const row of rows) for (const hold of row.holds) holdCounts[hold] = (holdCounts[hold] ?? 0) + 1;
  return { schemaVersion: 1, filings: unique.filings, rows, blockers, repeatedReports: unique.repeatedReports,
    identityLinkedRows: rows.filter(row => row.bioguide).length, securityLinkedRows: rows.filter(row => row.securityMatch).length,
    // General disclosure display does not assert stock/fund classification. Such rows cannot
    // enter stock-only sector rankings until their security type has been separately reviewed.
    disclosureRows: rows.filter(row => row.holds.every(hold => hold === "security_type_review_required")),
    activeReportCount: active.size,
    // These can be handed to a reviewed stock/fund read model; never changes the live archive.
    activityRows: rows.filter(row => row.holds.length === 0 && ["company_stock", "fund"].includes(row.securityKind ?? "")),
    holdCounts, publicationApproved: false as const };
}

/** Actionable worklist. Similarity is review assistance, never an amendment approval. */
export function senateAmendmentWorklist(filings: readonly SenateFiling[]) {
  const date = (filing: SenateFiling) => /\bfor\s+(\d{2}\/\d{2}\/\d{4})\b/i.exec(filing.title)?.[1] ?? null;
  const family = (filing: SenateFiling) => `${nameKey(filing.reference.firstName)}:${nameKey(filing.reference.lastName)}:${date(filing)}`;
  return filings.filter(filing => filing.amendment).map(amendment => {
    const originals = filings.filter(filing => !filing.amendment && date(filing) && family(filing) === family(amendment) && filing.reference.id !== amendment.reference.id);
    return { amendmentId: amendment.reference.id, filer: `${amendment.reference.firstName} ${amendment.reference.lastName}`,
      reportDate: date(amendment), amendmentSource: amendment.reference.url, amendmentSha256: amendment.documentSha256,
      reason: originals.length === 0 ? "original_not_in_collected_windows" : originals.length > 1 ? "multiple_possible_originals" : "complete_replacement_review_required",
      candidates: originals.map(original => {
        const oldHashes = original.rows.map(row => row.contentHash), newHashes = amendment.rows.map(row => row.contentHash);
        // Multiset counts preserve legitimately repeated identical rows.
        const remaining = [...oldHashes]; let unchanged = 0;
        for (const hash of newHashes) { const i = remaining.indexOf(hash); if (i >= 0) { remaining.splice(i, 1); unchanged++; } }
        return { originalId: original.reference.id, originalSource: original.reference.url, originalSha256: original.documentSha256,
          unchangedRows: unchanged, removedOrChangedRows: oldHashes.length - unchanged, addedOrChangedRows: newHashes.length - unchanged };
      }) };
  });
}
