/**
 * Coverage report for the shared image library.
 *
 *   node --experimental-strip-types scripts/image-library-report.ts
 *
 * Writes docs/image-library-coverage.md and data/image-library/coverage.json.
 * Every identity that is not resolved is listed by name with its reason: the
 * report exists so a reviewer can see what is missing, not so a number can be
 * quoted. Issuer coverage and ticker coverage are counted separately, because
 * one issuer with three tickers is one logo and three symbols.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Catalog, CatalogEntry } from "../src/lib/image-library/types.ts";
import { isCompanyEntry } from "../src/lib/image-library/identity.ts";

const ROOT = resolve(import.meta.dirname, "..");
const catalog = JSON.parse(readFileSync(resolve(ROOT, "src/lib/image-library/catalog.json"), "utf8")) as Catalog;

const STATUSES = ["resolved", "missing", "ambiguous", "failed", "awaiting_review"] as const;

function tally(entries: CatalogEntry[]) {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<(typeof STATUSES)[number], number>;
  for (const e of entries) out[e.status] += 1;
  return out;
}

const companies = catalog.entries.filter(isCompanyEntry);
const funds = catalog.entries.filter((e) => e.kind === "fund");
const sponsorIds = new Set(funds.map(e => e.sponsorIdentity).filter(Boolean));
const sponsors = catalog.entries.filter((e) => e.kind === "sponsor" || sponsorIds.has(e.identity));
const people = catalog.entries.filter((e) => e.kind === "person");

const tickersOf = (e: CatalogEntry) => e.aliases.filter((a) => a.type === "ticker" && a.status !== "retired").map((a) => a.value);
const companyTickers = [...new Set(companies.flatMap(tickersOf))];
const resolvedTickers = [...new Set(companies.filter((e) => e.status === "resolved").flatMap(tickersOf))];

let universeMembers: Array<{ qid: string; label: string; ciks: string[] }> = [];
try { universeMembers = (JSON.parse(readFileSync(resolve(ROOT, "data/image-library/universe-companies.json"), "utf8")) as { members: typeof universeMembers }).members; } catch { /* no universe file yet */ }
const unkeyed = universeMembers.filter((m) => m.ciks.length !== 1);
const uniqueIssuerCount = new Set(universeMembers.filter(m => m.ciks.length === 1).map(m => m.ciks[0])).size;
const universes = structuredClone(catalog.universes);
if (universes.companies && uniqueIssuerCount) {
  universes.companies.identities = uniqueIssuerCount;
  universes.companies.tickers = companyTickers.length;
  universes.companies.note = `${universeMembers.length} source items; ${uniqueIssuerCount} distinct CIKs. Company coverage includes sponsors with current SEC ticker evidence; sponsor-only identities are not assumed to be currently traded companies. Membership is as Wikidata records it, including former constituents, not the index provider's official list.`;
}

const report = {
  generatedAt: new Date().toISOString(),
  catalogGeneratedAt: catalog.generatedAt,
  universes,
  companies: { ...tally(companies), issuersInUniverse: uniqueIssuerCount || companies.length, issuersResolved: companies.filter((e) => e.status === "resolved").length,
    tickersInUniverse: companyTickers.length, tickersResolved: resolvedTickers.length, manuallyReviewed: companies.filter((e) => e.asset?.source.reviewedBy === "manual").length,
    unkeyedWikidataItems: unkeyed.map((m) => ({ qid: m.qid, label: m.label, ciks: m.ciks })) },
  funds: { ...tally(funds), viaSponsorMark: funds.filter((e) => e.status === "resolved" && !e.asset && e.sponsorIdentity).length, ownLogo: funds.filter((e) => e.asset).length },
  sponsors: tally(sponsors),
  congress: { ...tally(people), manuallyReviewed: people.filter((e) => e.asset?.source.reviewedBy === "manual").length },
  unresolved: catalog.entries.filter((e) => e.status !== "resolved").map((e) => ({ identity: e.identity, kind: e.kind, label: e.label, status: e.status, reason: e.reason ?? "", candidate: e.candidate?.evidenceUrl ?? e.candidate?.url ?? "" })),
};

mkdirSync(resolve(ROOT, "data/image-library"), { recursive: true });
writeFileSync(resolve(ROOT, "data/image-library/coverage.json"), `${JSON.stringify(report, null, 1)}\n`);

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "n/a");
type Tally = Record<(typeof STATUSES)[number], number>;
const row = (label: string, t: Tally) => `| ${label} | ${t.resolved} | ${t.missing} | ${t.ambiguous} | ${t.failed} | ${t.awaiting_review} |`;
const lines: string[] = [];
lines.push(`# Image library coverage — ${report.generatedAt.slice(0, 10)}`, "");
lines.push("Counts are of identities, not of files or tickers. \"Resolved\" means an approved file is on disk for website display; it does not establish any right to redistribute files through an API. Every unresolved identity is listed at the end with its reason.", "");
for (const [name, u] of Object.entries(report.universes)) lines.push(`- **${name}** universe: ${u.identities} identities${u.tickers ? ` (${u.tickers} tickers)` : ""}, as of ${u.asOf}. Source: ${u.source}.${u.note ? ` ${u.note}` : ""}`);
lines.push("", "| Kind | Resolved | Missing | Ambiguous | Failed | Awaiting review |", "|---|---:|---:|---:|---:|---:|");
lines.push(row("Companies (issuers)", report.companies), row("ETF share classes", report.funds), row("Sponsors", report.sponsors), row("Congress (people)", report.congress));
lines.push("", "Company and sponsor roles can overlap; do not sum those rows as distinct identities. The source universe can also contain former issuers without current ticker evidence.");
lines.push("", "## Companies: issuer coverage versus ticker coverage", "");
lines.push(`- Issuers resolved: ${report.companies.issuersResolved} of ${report.companies.issuersInUniverse} (${pct(report.companies.issuersResolved, report.companies.issuersInUniverse)}), of which ${report.companies.manuallyReviewed} were individually reviewed before this library.`);
lines.push(`- Tickers resolved: ${report.companies.tickersResolved} of ${report.companies.tickersInUniverse} (${pct(report.companies.tickersResolved, report.companies.tickersInUniverse)}). Ticker coverage exceeds issuer coverage wherever one issuer lists several symbols.`);
if (unkeyed.length) lines.push(`- ${unkeyed.length} Wikidata S&P 500 items could not be keyed to one SEC issuer and are outside the catalog: ${unkeyed.map((m) => `${m.label} (${m.qid}${m.ciks.length ? `, CIKs ${m.ciks.join("/")}` : ", no CIK"})`).join("; ")}.`);
lines.push("", "## ETFs", "", `- ${report.funds.viaSponsorMark} share classes display their sponsor's mark; ${report.funds.ownLogo} have a fund-specific logo. A sponsor mark identifies the sponsor, not the fund.`);
lines.push("", "## Unresolved identities", "", "| Identity | Kind | Label | Status | Reason | Candidate |", "|---|---|---|---|---|---|");
for (const u of report.unresolved) lines.push(`| ${u.identity} | ${u.kind} | ${u.label.replace(/\|/g, "/")} | ${u.status} | ${u.reason.replace(/\|/g, "/")} | ${u.candidate ? `[review](${u.candidate})` : ""} |`);
writeFileSync(resolve(ROOT, "docs/image-library-coverage.md"), `${lines.join("\n")}\n`);

console.log(`companies ${JSON.stringify(tally(companies))} issuers ${report.companies.issuersResolved}/${report.companies.issuersInUniverse} tickers ${report.companies.tickersResolved}/${report.companies.tickersInUniverse}`);
console.log(`funds     ${JSON.stringify(tally(funds))} sponsors ${JSON.stringify(tally(sponsors))}`);
console.log(`congress  ${JSON.stringify(tally(people))}`);
console.log(`unresolved listed: ${report.unresolved.length} → docs/image-library-coverage.md`);
