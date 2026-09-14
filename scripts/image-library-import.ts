/**
 * Bulk importer for the shared image library.
 *
 *   node --experimental-strip-types scripts/image-library-import.ts --universe all
 *   node --experimental-strip-types scripts/image-library-import.ts --universe companies --limit 25 --dry-run
 *   node --experimental-strip-types scripts/image-library-import.ts --universe congress --only-disclosed
 *   node --experimental-strip-types scripts/image-library-import.ts --universe funds --refresh "sponsor rebrand"
 *
 * Resumable: every identity's last outcome is kept in data/image-library/
 * import-state.json, and a rerun skips anything already settled. Only
 * `failed` outcomes are retried automatically; a `--refresh <reason>` re-fetches
 * importer-resolved assets and records the reason. Manually reviewed assets
 * (the ten company marks and fourteen portraits that predate this library)
 * are never re-fetched by this script.
 *
 * Acceptance is a rule, not a judgement. A Commons file is accepted when its
 * machine-readable licence is public domain or CC0; a Simple Icons file when
 * the project records no per-icon licence (so the project's CC0 applies); a
 * portrait when the unitedstates/images mirror serves it. Everything else is
 * recorded as awaiting review with the candidate kept, never accepted on the
 * strength of looking right.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

import { COMPANY_MARKS } from "../src/lib/company-marks.ts";
import { HOME_FILER_IMAGES } from "../src/lib/home-filer-images.ts";
import { bioguideIdentity, cikIdentity, classIdentity, personNameVariants, sponsorIdentity, tickerSpellings } from "../src/lib/image-library/identity.ts";
import type { Alias, Asset, CatalogEntry, RightsNotes } from "../src/lib/image-library/types.ts";
import { allSectorFunds } from "../src/lib/sector-funds.ts";
import { STARTER_SYMBOLS } from "../src/lib/funds/compare.ts";
import { resolve } from "node:path";

import { ROOT, publicFileExists, readCatalog, readPublicFile, readState, upsert, writeCatalog, writePublicFile, writeState } from "./image-library/catalog-io.ts";
import { FetchRefused, fetchAllowed } from "./image-library/net.ts";
import {
  commonsFileInfo, downloadCommonsFile, downloadSimpleIcon, legislatorsCurrent, portraitUrl, secCompanyTickers, secFundClasses,
  secSubmissions, simpleIconsIndex, wikidataSp500, type CommonsFileInfo, type Legislator,
} from "./image-library/sources.ts";
import { InvalidImage, formatFromContentType, sha256, validateImage } from "./image-library/validate.ts";
import { normalizeIssuerName } from "../src/lib/security-master.ts";

// --- rename evidence from EDGAR ----------------------------------------------

const FORMER_NAMES_PATH = resolve(ROOT, "data/image-library/sec-former-names.json");
type FormerNameCache = Record<string, { name: string; formerNames: Array<{ name: string; from?: string; to?: string }>; fetchedAt: string }>;
function readFormerNames(): FormerNameCache { return existsSync(FORMER_NAMES_PATH) ? JSON.parse(readFileSync(FORMER_NAMES_PATH, "utf8")) as FormerNameCache : {}; }

/** Share of one name's significant tokens that appear in the other. */
function nameOverlap(a: string, b: string): number {
  const ta = new Set(normalizeIssuerName(a).split(" ").filter((x) => x.length >= 3));
  const tb = new Set(normalizeIssuerName(b).split(" ").filter((x) => x.length >= 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0; for (const x of ta) if (tb.has(x)) hit += 1;
  return hit / Math.min(ta.size, tb.size);
}

/**
 * Has this issuer been renamed since the source recorded it?
 *
 * Wikidata's label is what the logo was attached to. If that label matches a
 * former SEC name better than the current one, the mark is probably the old
 * brand — and a reviewer, not the importer, decides whether it still applies.
 */
function renamedSinceRecorded(wikidataLabel: string, current: string, former: Array<{ name: string }>): { renamed: boolean; formerName?: string } {
  const now = nameOverlap(wikidataLabel, current);
  let best: { name: string; score: number } | undefined;
  for (const f of former) { const score = nameOverlap(wikidataLabel, f.name); if (!best || score > best.score) best = { name: f.name, score }; }
  if (best && best.score >= 0.5 && best.score > now) return { renamed: true, formerName: best.name };
  return { renamed: false };
}

// --- arguments ---------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
const has = (name: string) => args.includes(name);
const UNIVERSE = flag("--universe") ?? "all";
const LIMIT = Number(flag("--limit") ?? Infinity);
const DRY = has("--dry-run");
const REFRESH = flag("--refresh");
const ONLY_DISCLOSED = has("--only-disclosed");
const TODAY = new Date().toISOString().slice(0, 10);
const NOW = () => new Date().toISOString();

const catalog = readCatalog();
const state = readState();
const log = (s: string) => console.log(s);

const WEBSITE_ONLY = "Website identification only. No sponsorship, endorsement, advertising use, or redistribution of image files through an API is established by the recorded basis.";

function settled(identity: string): boolean {
  const attempt = state.attempts[identity];
  if (!attempt) return false;
  if (attempt.outcome === "failed") return false;
  if (REFRESH && attempt.outcome === "resolved") return false;
  return true;
}
function record(identity: string, outcome: string, note?: string) {
  state.attempts[identity] = { at: NOW(), outcome, note };
}

function rights(basis: string, extra: Partial<RightsNotes> = {}): RightsNotes {
  return { websiteDisplay: "documented", apiRedistribution: "not_established", basis: `${basis} ${WEBSITE_ONLY}`, ...extra };
}

/** Store validated bytes once; identical content shares one file. */
function store(relativePath: string, bytes: Buffer, hash: string): string {
  const existing = state.hashes[hash];
  if (existing) return existing;
  if (DRY) return `/${relativePath}`;
  const path = writePublicFile(relativePath, bytes);
  state.hashes[hash] = path;
  return path;
}

// --- seed: assets reviewed before this library existed -----------------------

function seedExisting(): void {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, "docs/company-logo-manifest.json"), "utf8")) as Array<{
    ticker: string; file: string; source: string; evidence: string; reviewed: string; downloaded: string; license: string;
    restrictions: string; attributionRequired: string; sha256: string;
  }>;
  for (const m of manifest) {
    const mark = COMPANY_MARKS[m.ticker];
    if (!mark) continue;
    const identity = cikIdentity(mark.cik);
    const path = `/company-logos/${m.file}`;
    if (!publicFileExists(path)) { log(`seed: ${m.ticker} file missing at ${path}`); continue; }
    const bytes = readPublicFile(path);
    if (sha256(bytes) !== m.sha256) throw new Error(`Reviewed asset changed on disk: ${path}`);
    const previous = catalog.entries.find((e) => e.identity === identity);
    const asset: Asset = {
      role: "company_mark",
      file: { path, format: "svg", bytes: bytes.length, sha256: m.sha256 },
      source: { url: m.source, evidenceUrl: m.evidence, fetchedAt: m.downloaded, license: m.license, reviewedBy: "manual", reviewedOn: m.reviewed },
      rights: rights(
        m.license === "Apache License 2.0"
          ? "Apache-2.0 licensed by the rights holder; licence and copyright notice ship with the file."
          : `Commons records the file as ${m.license} (${m.restrictions}).`,
        { restrictions: m.restrictions, attributionRequired: m.attributionRequired === "true",
          ...(m.ticker === "NVDA" ? { licenseNoticePath: "/company-logos/LICENSE-NVIDIA.txt" } : {}) }
      ),
    };
    upsert(catalog, {
      identity, kind: "company", label: m.ticker, status: "resolved",
      aliases: previous?.aliases ?? [{ type: "ticker", value: m.ticker, status: "current", source: "src/lib/company-marks.ts" }],
      evidence: previous?.evidence ?? { source: "src/lib/company-marks.ts + docs/company-logo-manifest.json", checkedOn: m.reviewed, detail: `ticker ${m.ticker} ↔ CIK ${mark.cik}, individually reviewed` },
      asset, updatedAt: NOW(),
    });
    state.hashes[m.sha256] = path;
    record(identity, "resolved", "seeded from reviewed manifest");
  }

  const portraits = JSON.parse(readFileSync(resolve(ROOT, "docs/homepage-portrait-manifest.json"), "utf8")) as Array<{ bioguide: string; source: string; sha256: string; bytes: number; retrieved: string; rightsBasis: string }>;
  const filerKeysByBioguide = new Map<string, string[]>();
  for (const [key, id] of Object.entries(HOME_FILER_IMAGES)) filerKeysByBioguide.set(id, [...(filerKeysByBioguide.get(id) ?? []), key]);
  for (const p of portraits) {
    const identity = bioguideIdentity(p.bioguide);
    const path = `/portraits/${p.bioguide}.jpg`;
    if (!publicFileExists(path)) { log(`seed: portrait missing at ${path}`); continue; }
    const bytes = readPublicFile(path);
    if (sha256(bytes) !== p.sha256) throw new Error(`Reviewed portrait changed on disk: ${path}`);
    const validated = validateImage(bytes, "jpg");
    const previous = catalog.entries.find((e) => e.identity === identity);
    const filerAliases: Alias[] = (filerKeysByBioguide.get(p.bioguide) ?? []).map((key) => ({ type: "filer_key", value: key, status: "current", source: "src/lib/home-filer-images.ts (reviewed 2026-09-13)" }));
    upsert(catalog, {
      identity, kind: "person", label: p.bioguide, status: "resolved",
      aliases: mergeAliases(previous?.aliases ?? [], filerAliases),
      evidence: previous?.evidence ?? { source: "src/lib/home-filer-images.ts", checkedOn: "2026-09-13", detail: "name, chamber, state and district checked against legislators-current" },
      asset: {
        role: "portrait",
        file: { path, format: "jpg", bytes: bytes.length, sha256: p.sha256, width: validated.width, height: validated.height },
        source: { url: p.source, evidenceUrl: "https://github.com/unitedstates/images", fetchedAt: p.retrieved, license: "CC0 repository; GPO public-domain provenance stated", reviewedBy: "manual", reviewedOn: "2026-09-13" },
        rights: rights(p.rightsBasis + "."),
      },
      updatedAt: NOW(),
    });
    state.hashes[p.sha256] = path;
    record(identity, "resolved", "seeded from reviewed manifest");
  }
}

function mergeAliases(existing: Alias[], incoming: Alias[]): Alias[] {
  const key = (a: Alias) => `${a.type}|${a.value}|${a.chamber ?? ""}|${a.state ?? ""}|${a.district ?? ""}`;
  const seen = new Map(existing.map((a) => [key(a), a]));
  for (const a of incoming) if (!seen.has(key(a))) seen.set(key(a), a);
  return [...seen.values()];
}

// --- companies ---------------------------------------------------------------

function acceptableCommons(info: CommonsFileInfo): { ok: true } | { ok: false; why: string } {
  if (info.missing) return { ok: false, why: "file not found on Commons" };
  const license = info.licenseShortName ?? "";
  const pd = license === "Public domain" && info.copyrighted === "False";
  const cc0 = /^CC0/i.test(license);
  if (!pd && !cc0) return { ok: false, why: `licence "${license || "unstated"}" is not among the documented acceptable bases` };
  if (!info.mime || !/^image\/(svg\+xml|png|jpeg)$/.test(info.mime)) return { ok: false, why: `unsupported type ${info.mime ?? "unknown"}` };
  return { ok: true };
}

async function importCompanies(): Promise<void> {
  log("companies: loading SEC master and Wikidata membership…");
  const sec = await secCompanyTickers();
  const members = await wikidataSp500();
  const asOf = TODAY;
  const withCik = members.filter((m) => m.ciks.length === 1);
  const noCik = members.filter((m) => m.ciks.length === 0);
  const multiCik = members.filter((m) => m.ciks.length > 1);
  const tickerCount = withCik.reduce((n, m) => n + (sec.get(m.ciks[0])?.tickers.length ?? 0), 0);
  catalog.universes.companies = {
    source: "Wikidata: items with P361 (part of) = Q242345 (S&P 500), joined to SEC company_tickers.json by P5531 (CIK)",
    asOf, identities: withCik.length, tickers: tickerCount,
    note: `${members.length} Wikidata items; ${withCik.length} carry exactly one CIK; ${noCik.length} carry none and ${multiCik.length} carry several, so they cannot be keyed and are listed in the coverage report. Membership as Wikidata records it — which includes some former constituents — not the index provider's official list.`,
  };
  writeUniverse("companies", { asOf, members });

  const simple = await simpleIconsIndex();
  const formerNames = readFormerNames();
  const toFetch = withCik.map((m) => m.ciks[0]).filter((cik) => !formerNames[cik] || REFRESH);
  if (toFetch.length) log(`companies: fetching EDGAR former names for ${toFetch.length} issuers…`);
  for (const cik of toFetch) {
    try { const rec = await secSubmissions(cik); formerNames[cik] = { name: rec.name, formerNames: rec.formerNames, fetchedAt: rec.fetchedAt }; }
    catch (error) { log(`  ? former names for ${cik}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  if (!DRY) { mkdirSync(resolve(ROOT, "data/image-library"), { recursive: true }); writeFileSync(FORMER_NAMES_PATH, `${JSON.stringify(formerNames, null, 1)}\n`); }
  let processed = 0;
  const pending: Array<{ item: typeof members[number]; identity: string; entry: CatalogEntry; file?: string; simpleSlug?: string }> = [];

  for (const item of withCik) {
    if (processed >= LIMIT) break;
    const cik = item.ciks[0];
    const identity = cikIdentity(cik);
    const issuer = sec.get(cik);
    const previous = catalog.entries.find((e) => e.identity === identity);
    // Wikidata's own ticker qualifiers are the cross-check on its CIK link. A
    // symbol Wikidata records that the SEC master no longer lists is a rename
    // (kept as a retired alias); no overlap at all means the link is stale or
    // wrong, and the mark is held for review rather than shown.
    const secSpellings = new Set((issuer?.tickers ?? []).flatMap(tickerSpellings));
    const wdTickers = item.tickers.filter((t) => /^[A-Z0-9.\-]{1,8}$/.test(t));
    const wdOverlap = wdTickers.length === 0 || wdTickers.some((t) => tickerSpellings(t).some((sp) => secSpellings.has(sp)));
    const retired = wdTickers.filter((t) => !tickerSpellings(t).some((sp) => secSpellings.has(sp)));
    // Retired aliases are recomputed from today's sources, never accumulated.
    const kept = (previous?.aliases ?? []).filter((a) => !(a.type === "ticker" && a.status === "retired"));
    const aliases = mergeAliases(kept, [
      ...(issuer?.tickers ?? []).map((t): Alias => ({ type: "ticker", value: t, status: "current", source: "SEC company_tickers.json" })),
      ...(issuer ? retired.map((t): Alias => ({ type: "ticker", value: t, status: "retired", source: `Wikidata P249 on a NYSE/Nasdaq listing of ${item.qid}; not in the SEC master, treated as a former symbol` })) : []),
      ...(issuer ? [{ type: "name" as const, value: issuer.title, source: "SEC company_tickers.json" }] : []),
      { type: "wikidata", value: item.qid, source: "Wikidata" },
    ]);
    const base: CatalogEntry = {
      identity, kind: "company", label: issuer?.tickers[0] ?? item.label, status: "missing", aliases,
      evidence: { source: "SEC company_tickers.json ↔ Wikidata P5531", checkedOn: asOf, detail: issuer ? `CIK ${cik} = ${issuer.title}; tickers ${issuer.tickers.join(", ")}` : `CIK ${cik} not present in SEC master` },
      updatedAt: NOW(),
    };
    // Reviewed assets are kept as they are; only their aliases are refreshed.
    if (previous?.asset?.source.reviewedBy === "manual") { upsert(catalog, { ...previous, aliases, updatedAt: NOW() }); continue; }
    // Checked on the item's label and on the logo file's own name: Wikidata
    // often updates the label after a rename while the attached file keeps
    // the former brand's name, and that file is the thing we would show.
    const logoName = (item.logos[0] ?? "").replace(/\.(svg|png|jpe?g)$/i, "").replace(/[_\-]+/g, " ");
    const byLabel = issuer && formerNames[cik] ? renamedSinceRecorded(item.label, formerNames[cik].name, formerNames[cik].formerNames) : { renamed: false };
    const byLogo = issuer && formerNames[cik] && logoName ? renamedSinceRecorded(logoName, formerNames[cik].name, formerNames[cik].formerNames) : { renamed: false };
    const rename = byLabel.renamed ? { ...byLabel, via: "item label" } : byLogo.renamed ? { ...byLogo, via: "logo file name" } : { renamed: false as const, via: "" };
    if (issuer && (!wdOverlap || rename.renamed)) {
      // Identity link failed the cross-check. Never serve; demote anything the
      // importer accepted earlier and drop its file if nothing else uses it.
      if (previous?.asset && previous.asset.source.reviewedBy === "importer") {
        const path = previous.asset.file.path;
        const full = resolve(ROOT, "public", path.slice(1));
        if (!DRY && !catalog.entries.some((e) => e.identity !== identity && e.asset?.file.path === path) && existsSync(full)) unlinkSync(full);
        for (const [h, p] of Object.entries(state.hashes)) if (p === path) delete state.hashes[h];
      }
      const reason = rename.renamed
        ? `EDGAR records "${rename.formerName}" as a former name of CIK ${cik}, now "${formerNames[cik].name}"; Wikidata's ${rename.via} (${rename.via === "item label" ? item.label : item.logos[0]}) still carries the former name, so the logo may be the old brand. A reviewer must confirm the mark is current before it is shown.`
        : `Wikidata lists ticker(s) ${wdTickers.join(", ")} for this item but the SEC master lists ${issuer.tickers.join(", ")} for CIK ${cik} (${issuer.title}). The CIK link may be stale after a rename, or wrong; a reviewer must confirm before any mark is shown.`;
      upsert(catalog, { ...base, aliases, status: "awaiting_review", reason, candidate: item.logos[0] ? { url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(item.logos[0])}`, note: "logo Wikidata attaches to the item" } : undefined });
      record(identity, "awaiting_review", rename.renamed ? "renamed since source recorded" : "wikidata/sec ticker disagreement"); processed += 1; continue;
    }
    if (settled(identity) && previous) { upsert(catalog, { ...previous, aliases, updatedAt: NOW() }); continue; }
    processed += 1;
    if (!issuer) { upsert(catalog, { ...base, status: "awaiting_review", reason: "Wikidata's CIK has no ticker in the SEC master (former constituent, delisted, or a predecessor registrant); identity unverified." }); record(identity, "awaiting_review"); continue; }
    if (item.logos.length > 1) {
      upsert(catalog, { ...base, status: "ambiguous", reason: `Wikidata lists ${item.logos.length} logo files: ${item.logos.join(" | ")}. A reviewer must pick one.` });
      record(identity, "ambiguous"); continue;
    }
    if (item.logos.length === 1) { pending.push({ item, identity, entry: base, file: item.logos[0] }); continue; }
    if (item.simpleIcons.length === 1) { pending.push({ item, identity, entry: base, simpleSlug: item.simpleIcons[0] }); continue; }
    upsert(catalog, { ...base, status: "missing", reason: "No logo file on Wikidata (P154) and no Simple Icons link (P8972) for this issuer." });
    record(identity, "missing");
  }

  const infos = await commonsFileInfo(pending.filter((p) => p.file).map((p) => p.file as string));
  for (const p of pending) {
    try {
      if (p.file) {
        const info = infos.get(p.file);
        if (!info) throw new Error("no imageinfo returned");
        const verdict = acceptableCommons(info);
        if (!verdict.ok) {
          upsert(catalog, { ...p.entry, status: info.missing ? "missing" : "awaiting_review", reason: `Commons ${p.file}: ${verdict.why}.`,
            candidate: { url: info.url ?? "", evidenceUrl: info.descriptionUrl, license: info.licenseShortName, note: verdict.why } });
          record(p.identity, info.missing ? "missing" : "awaiting_review"); continue;
        }
        const { bytes, contentType } = await downloadCommonsFile(info.url as string);
        const format = formatFromContentType(contentType, info.url as string);
        if (!format) throw new InvalidImage(`unknown format ${contentType}`);
        const v = validateImage(bytes, format);
        const path = store(`company-logos/${p.identity.replace("sec:cik:", "cik")}.${format}`, v.bytes, v.sha256);
        upsert(catalog, { ...p.entry, status: "resolved", reason: undefined, asset: {
          role: "company_mark",
          file: { path, format, bytes: v.bytes.length, sha256: v.sha256, width: v.width, height: v.height },
          source: { url: info.url as string, evidenceUrl: info.descriptionUrl, fetchedAt: NOW(), license: info.licenseShortName as string,
            licenseEvidence: { License: info.licenseTemplate ?? "", Copyrighted: info.copyrighted ?? "", Restrictions: info.restrictions ?? "", AttributionRequired: info.attributionRequired ?? "", Credit: info.credit ?? "", Artist: info.artist ?? "" },
            reviewedBy: "importer", reviewedOn: TODAY },
          rights: rights(`Commons records the file as ${info.licenseShortName}${info.restrictions ? ` (${info.restrictions})` : ""}; accepted by the importer's documented rule, not individually reviewed.`, { restrictions: info.restrictions, attributionRequired: info.attributionRequired === "true" }),
        } });
        record(p.identity, "resolved", v.removed.length ? `sanitised: ${v.removed.join(", ")}` : undefined);
        log(`  ✓ ${p.entry.label.padEnd(6)} ${p.file}`);
      } else if (p.simpleSlug) {
        const rec = simple.get(p.simpleSlug);
        if (!rec) { upsert(catalog, { ...p.entry, status: "missing", reason: `Simple Icons slug ${p.simpleSlug} (from Wikidata) is not in the project's data.` }); record(p.identity, "missing"); continue; }
        if (rec.license) {
          upsert(catalog, { ...p.entry, status: "awaiting_review", reason: `Simple Icons records a per-icon licence (${rec.license.type}); project CC0 does not apply.`,
            candidate: { url: `https://cdn.simpleicons.org/${rec.slug}`, license: rec.license.type, evidenceUrl: rec.license.url, note: "per-icon licence" } });
          record(p.identity, "awaiting_review"); continue;
        }
        const { bytes } = await downloadSimpleIcon(rec.slug);
        const v = validateImage(bytes, "svg");
        const path = store(`company-logos/${p.identity.replace("sec:cik:", "cik")}.svg`, v.bytes, v.sha256);
        upsert(catalog, { ...p.entry, status: "resolved", reason: undefined, asset: {
          role: "company_mark",
          file: { path, format: "svg", bytes: v.bytes.length, sha256: v.sha256, width: v.width, height: v.height },
          source: { url: `https://cdn.simpleicons.org/${rec.slug}`, evidenceUrl: "https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md", fetchedAt: NOW(), license: "CC0 (Simple Icons project licence; no per-icon licence recorded)", reviewedBy: "importer", reviewedOn: TODAY },
          rights: rights("Simple Icons project is CC0 and records no per-icon licence for this mark; the project's disclaimer notes brand guidelines still apply. Accepted by the importer's documented rule."),
        } });
        record(p.identity, "resolved");
        log(`  ✓ ${p.entry.label.padEnd(6)} simple-icons/${rec.slug}`);
      }
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      const status = error instanceof InvalidImage || error instanceof FetchRefused ? "awaiting_review" : "failed";
      upsert(catalog, { ...p.entry, status, reason: `${p.file ?? p.simpleSlug}: ${why}` });
      record(p.identity, status, why);
      log(`  ✗ ${p.entry.label.padEnd(6)} ${why}`);
    }
  }
  state.runs.push({ startedAt: NOW(), universe: "companies", processed, note: DRY ? "dry run" : undefined });
}

// --- funds -------------------------------------------------------------------

/** Registrant CIK → the sponsor whose mark the fund borrows. Documented in the image-sourcing memo. */
const SPONSORS: Record<string, { identity: string; label: string; commonsFile?: string; wikidata: string; note: string }> = {
  "0001064641": { identity: cikIdentity(93751), label: "State Street", commonsFile: "State-street-logo-final.svg", wikidata: "Q2037125", note: "Select Sector SPDR Trust; sponsor mark is State Street Corporation's" },
  "0000052848": { identity: sponsorIdentity("the-vanguard-group"), label: "Vanguard", commonsFile: "Vanguard.svg", wikidata: "Q849363", note: "Vanguard World Fund; The Vanguard Group has no SEC issuer CIK" },
  "0000036405": { identity: sponsorIdentity("the-vanguard-group"), label: "Vanguard", commonsFile: "Vanguard.svg", wikidata: "Q849363", note: "Vanguard Index Funds" },
  "0000734383": { identity: sponsorIdentity("the-vanguard-group"), label: "Vanguard", commonsFile: "Vanguard.svg", wikidata: "Q849363", note: "Vanguard Specialized Funds" },
  "0001067839": { identity: cikIdentity(914208), label: "Invesco", wikidata: "Q522617", note: "Invesco QQQ Trust; no documented public-domain mark for Invesco" },
  "0001100663": { identity: cikIdentity(1364742), label: "BlackRock", commonsFile: "BlackRock_wordmark.svg", wikidata: "Q219635", note: "iShares Trust; sponsor mark is BlackRock's wordmark" },
  "0001137360": { identity: sponsorIdentity("vaneck"), label: "VanEck", wikidata: "", note: "VanEck ETF Trust; no documented mark" },
};

async function importFunds(): Promise<void> {
  log("funds: loading SEC fund classes…");
  const classes = await secFundClasses();
  const directory = [...new Set([...allSectorFunds().map((f) => f.ticker), ...STARTER_SYMBOLS, "SOXX"])];
  catalog.universes.funds = {
    source: "src/lib/sector-funds.ts directory + src/lib/funds identities, joined to SEC company_tickers_mf.json for CIK, series and class",
    asOf: TODAY, identities: directory.length,
    note: "Share classes, not funds: a ticker names one class. Marks are the sponsor's unless a fund has its own documented logo, which none in this directory does.",
  };
  writeUniverse("funds", { asOf: TODAY, tickers: directory });

  // Sponsor marks first, from the documented Commons files.
  const sponsorFiles = [...new Set(Object.values(SPONSORS).map((s) => s.commonsFile).filter(Boolean))] as string[];
  const infos = await commonsFileInfo(sponsorFiles);
  for (const sponsor of Object.values(SPONSORS)) {
    if (catalog.entries.some((e) => e.identity === sponsor.identity && (settled(sponsor.identity) || e.asset?.source.reviewedBy === "manual"))) continue;
    const base: CatalogEntry = {
      identity: sponsor.identity, kind: "sponsor", label: sponsor.label, status: "missing",
      aliases: [{ type: "name", value: sponsor.label, source: "image-sourcing memo" }, ...(sponsor.wikidata ? [{ type: "wikidata" as const, value: sponsor.wikidata, source: "Wikidata" }] : [])],
      evidence: { source: "image-sourcing memo (Wikidata sponsor items; Commons file pages)", checkedOn: TODAY, detail: sponsor.note }, updatedAt: NOW(),
    };
    if (!sponsor.commonsFile) { upsert(catalog, { ...base, reason: "No documented public-domain mark for this sponsor. Not fetched from search results." }); record(sponsor.identity, "missing"); continue; }
    const info = infos.get(sponsor.commonsFile);
    const verdict = info ? acceptableCommons(info) : { ok: false as const, why: "no imageinfo" };
    if (!info || !verdict.ok) { upsert(catalog, { ...base, status: "awaiting_review", reason: `Commons ${sponsor.commonsFile}: ${verdict.ok ? "" : verdict.why}` }); record(sponsor.identity, "awaiting_review"); continue; }
    try {
      const { bytes, contentType } = await downloadCommonsFile(info.url as string);
      const v = validateImage(bytes, formatFromContentType(contentType, info.url as string) ?? "svg");
      const path = store(`company-logos/${sponsor.identity.replace(/[:]/g, "-")}.${v.format}`, v.bytes, v.sha256);
      upsert(catalog, { ...base, status: "resolved", asset: {
        role: "sponsor_mark",
        file: { path, format: v.format, bytes: v.bytes.length, sha256: v.sha256, width: v.width, height: v.height },
        source: { url: info.url as string, evidenceUrl: info.descriptionUrl, fetchedAt: NOW(), license: info.licenseShortName as string,
          licenseEvidence: { License: info.licenseTemplate ?? "", Copyrighted: info.copyrighted ?? "", Restrictions: info.restrictions ?? "" }, reviewedBy: "importer", reviewedOn: TODAY },
        rights: rights(`Commons records the file as ${info.licenseShortName}${info.restrictions ? ` (${info.restrictions})` : ""}. This is the sponsor's corporate mark, not a fund logo; shown beside the fund only as sponsor identification.`, { restrictions: info.restrictions }),
      } });
      record(sponsor.identity, "resolved"); log(`  ✓ sponsor ${sponsor.label}`);
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      upsert(catalog, { ...base, status: "failed", reason: why }); record(sponsor.identity, "failed", why); log(`  ✗ sponsor ${sponsor.label}: ${why}`);
    }
  }

  for (const ticker of directory) {
    const cls = classes.get(ticker);
    if (!cls) { log(`  ? ${ticker} not in SEC fund master`); continue; }
    const identity = classIdentity(cls.classId);
    const sponsor = SPONSORS[cls.cik];
    const sponsorEntry = sponsor ? catalog.entries.find((e) => e.identity === sponsor.identity) : undefined;
    const previous = catalog.entries.find((e) => e.identity === identity);
    upsert(catalog, {
      identity, kind: "fund", label: ticker,
      status: sponsorEntry?.status === "resolved" ? "resolved" : "missing",
      aliases: mergeAliases(previous?.aliases ?? [], [
        { type: "ticker", value: ticker, status: "current", source: "SEC company_tickers_mf.json" },
        { type: "series", value: cls.seriesId, source: "SEC company_tickers_mf.json" },
        { type: "cik", value: cls.cik, source: "SEC company_tickers_mf.json" },
      ]),
      evidence: { source: "SEC company_tickers_mf.json", checkedOn: TODAY, detail: `ticker ${ticker} = class ${cls.classId} of series ${cls.seriesId}, registrant CIK ${cls.cik}` },
      sponsorIdentity: sponsor?.identity,
      reason: sponsorEntry?.status === "resolved" ? "Served with the sponsor's mark; the fund has no own documented logo." : sponsor ? `Sponsor ${sponsor.label} has no resolved mark (${sponsorEntry?.status ?? "not catalogued"}).` : `Registrant CIK ${cls.cik} has no sponsor mapping.`,
      updatedAt: NOW(),
    });
    record(identity, sponsorEntry?.status === "resolved" ? "resolved" : "missing");
  }
  state.runs.push({ startedAt: NOW(), universe: "funds", processed: directory.length, note: DRY ? "dry run" : undefined });
}

// --- congress ----------------------------------------------------------------

function disclosedFilers(): Set<string> {
  const live = JSON.parse(readFileSync(resolve(ROOT, "src/lib/congress-live.json"), "utf8")) as { trades: Array<{ chamber: string; state: string; district: string; politician: string }> };
  return new Set(live.trades.map((t) => `${t.chamber}|${t.state}|${t.district}`));
}

async function importCongress(): Promise<void> {
  log("congress: loading legislators-current…");
  const legislators = await legislatorsCurrent();
  const asOf = TODAY;
  catalog.universes.congress = {
    source: "unitedstates/congress-legislators legislators-current.json (CC0); portraits from unitedstates/images 225x275 (CC0 repository, GPO provenance stated)",
    asOf, identities: legislators.length,
    note: `${legislators.filter((l) => l.terms.at(-1)?.type === "rep").length} House and ${legislators.filter((l) => l.terms.at(-1)?.type === "sen").length} Senate members serving as of the dataset. Portraits are only ever fetched by Bioguide id.`,
  };
  writeUniverse("congress", { asOf, bioguides: legislators.map((l) => l.id.bioguide) });
  const disclosed = ONLY_DISCLOSED ? disclosedFilers() : null;

  let processed = 0;
  for (const l of legislators) {
    if (processed >= LIMIT) break;
    const term = l.terms.at(-1) as Legislator["terms"][number];
    const chamber = term.type === "rep" ? "House" : "Senate";
    const district = term.type === "rep" ? `${term.state}${String(term.district ?? 0).padStart(2, "0")}` : null;
    if (disclosed && !disclosed.has(`${chamber}|${term.state}|${district ?? ""}`)) continue;
    const identity = bioguideIdentity(l.id.bioguide);
    const previous = catalog.entries.find((e) => e.identity === identity);
    const aliases = mergeAliases(previous?.aliases ?? [], [
      ...personNameVariants({ first: l.name.first, middle: l.name.middle, last: l.name.last, official: l.name.official_full, nickname: l.name.nickname })
        .map((v): Alias => ({ type: "person_name", value: v, chamber, state: term.state, district, source: "legislators-current.json" })),
      ...(l.id.wikidata ? [{ type: "wikidata" as const, value: l.id.wikidata, source: "legislators-current.json" }] : []),
    ]);
    const label = l.name.official_full ?? `${l.name.first} ${l.name.last}`;
    const base: CatalogEntry = {
      identity, kind: "person", label, status: "missing", aliases,
      evidence: { source: "legislators-current.json", checkedOn: asOf, detail: `${chamber} ${term.state}${district ? ` ${district}` : ""}, ${term.party}; term ${term.start}–${term.end}` },
      updatedAt: NOW(),
    };
    if (previous?.asset?.source.reviewedBy === "manual") { upsert(catalog, { ...previous, label, aliases, evidence: base.evidence, updatedAt: NOW() }); continue; }
    if (settled(identity) && previous) { upsert(catalog, { ...previous, label, aliases, evidence: base.evidence, updatedAt: NOW() }); continue; }
    processed += 1;
    try {
      const url = portraitUrl(l.id.bioguide);
      const { bytes, contentType } = await fetchAllowed(url, { accept: "image/jpeg" });
      const format = formatFromContentType(contentType, url);
      if (format !== "jpg") throw new InvalidImage(`unexpected type ${contentType}`);
      const v = validateImage(bytes, "jpg");
      const path = store(`portraits/${l.id.bioguide}.jpg`, v.bytes, v.sha256);
      upsert(catalog, { ...base, status: "resolved", asset: {
        role: "portrait",
        file: { path, format: "jpg", bytes: v.bytes.length, sha256: v.sha256, width: v.width, height: v.height },
        source: { url, evidenceUrl: "https://github.com/unitedstates/images", fetchedAt: NOW(), license: "CC0 repository; GPO public-domain provenance stated by the project", reviewedBy: "importer", reviewedOn: TODAY },
        rights: rights("GPO public-domain provenance stated by unitedstates/images; repository CC0; not a warranty of third-party rights."),
      } });
      record(identity, "resolved");
    } catch (error) {
      const status = (error as { status?: number }).status === 404 ? "missing" : error instanceof InvalidImage ? "awaiting_review" : "failed";
      const why = (error as { status?: number }).status === 404 ? "No portrait published for this member at unitedstates/images." : error instanceof Error ? error.message : String(error);
      upsert(catalog, { ...base, status, reason: why }); record(identity, status, why);
      if (status !== "missing") log(`  ✗ ${l.id.bioguide} ${label}: ${why}`);
    }
    if (processed % 50 === 0) { log(`  … ${processed} portraits processed`); if (!DRY) { writeCatalog(catalog); writeState(state); } }
  }
  state.runs.push({ startedAt: NOW(), universe: "congress", processed, note: DRY ? "dry run" : ONLY_DISCLOSED ? "only disclosed filers" : undefined });
}


function writeUniverse(name: string, data: unknown): void {
  if (DRY) return;
  mkdirSync(resolve(ROOT, "data/image-library"), { recursive: true });
  writeFileSync(resolve(ROOT, `data/image-library/universe-${name}.json`), `${JSON.stringify(data, null, 1)}\n`);
}

// --- main --------------------------------------------------------------------

seedExisting();
if (UNIVERSE === "funds" || UNIVERSE === "all") await importFunds();
if (UNIVERSE === "companies" || UNIVERSE === "all") await importCompanies();
if (UNIVERSE === "congress" || UNIVERSE === "all") await importCongress();
if (REFRESH) state.runs.push({ startedAt: NOW(), universe: UNIVERSE, processed: 0, note: `refresh: ${REFRESH}` });

if (DRY) {
  log(`dry run: ${catalog.entries.length} entries would be catalogued; nothing written.`);
} else {
  writeCatalog(catalog);
  writeState(state);
  const counts: Record<string, number> = {};
  for (const e of catalog.entries) counts[`${e.kind}:${e.status}`] = (counts[`${e.kind}:${e.status}`] ?? 0) + 1;
  log(`catalog written: ${catalog.entries.length} entries`);
  for (const [k, n] of Object.entries(counts).sort()) log(`  ${k.padEnd(28)} ${n}`);
  if (!existsSync(resolve(ROOT, "public/company-logos/NOTICE.txt"))) log("note: public/company-logos/NOTICE.txt is referenced by the homepage; keep it.");
}
