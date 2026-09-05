#!/usr/bin/env node --experimental-strip-types
/**
 * Manual, bounded Form 4 importer.
 *
 * Three modes, dry-run by default. Nothing here writes a public dataset, and
 * nothing here runs on a schedule: promotion to the candidate file is the only
 * write, it happens only after every gate passes, and it is replaced
 * atomically.
 *
 *   --mode fixtures    parse the committed fixtures offline. No network.
 *   --mode dry-run     fetch a bounded window, parse, gate, write evidence only.
 *   --mode candidate   as dry-run, and promote to the candidate file on success.
 *
 * Usage:
 *   node --experimental-strip-types scripts/import-form4.ts --mode fixtures
 *   node --experimental-strip-types scripts/import-form4.ts --mode dry-run \
 *     --from 2026-08-28 --to 2026-09-03 --issuers NVDA,MSFT
 *
 * Requires SEC_USER_AGENT for any networked mode: a real monitored contact, as
 * the SEC access policy requires. There is no default and no invented address.
 */

import {
  existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";

import { parseForm4 } from "../src/lib/form4/parse.ts";
import type { Form4Filing, UnsupportedDocument } from "../src/lib/form4/types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = join(ROOT, "tests", "fixtures", "form4");
const RUNS_DIR = join(ROOT, "data", "form4-runs");
const CANDIDATE_PATH = join(ROOT, "data", "form4-candidate.json");
const LOCK_PATH = join(RUNS_DIR, ".import.lock");

// SEC fair-access: conservative global ceiling, well under the published limit.
const MIN_REQUEST_INTERVAL_MS = 220;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

const argv = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] ?? null) : null;
};
const has = (name: string) => argv.includes(`--${name}`);

const MODE = (flag("mode") ?? "dry-run") as "fixtures" | "dry-run" | "candidate";
/**
 * Where documents come from, kept separate from whether the run may promote.
 *
 * Defaults to the fixtures for `--mode fixtures` and to EDGAR otherwise, so the
 * common cases need no flag. Stating it explicitly lets a candidate run be
 * exercised end to end offline, which is how promotion and refusal-to-promote
 * are tested without touching the network.
 */
const SOURCE = (flag("source") ?? (MODE === "fixtures" ? "fixtures" : "edgar")) as
  | "fixtures"
  | "edgar";
const FROM = flag("from");
const TO = flag("to");
const ISSUERS = (flag("issuers") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
/** Deterministically refuses promotion after evidence is written. */
const SIMULATE_GATE_FAILURE = has("simulate-gate-failure");

interface RunCounts {
  selected: number;
  downloaded: number;
  fromCache: number;
  parsed: number;
  unsupported: number;
  quarantinedFilings: number;
  failed: number;
  rows: number;
  quarantinedRows: number;
}

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// --- polite, bounded fetching ------------------------------------------------

let lastRequestAt = 0;
async function politeFetch(url: string, userAgent: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const wait = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": userAgent, "Accept-Encoding": "gzip, deflate" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      await new Promise((r) => setTimeout(r, 500 * attempt));
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt === MAX_RETRIES) throw new Error(`${res.status} after ${attempt} attempts: ${url}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);

    const length = Number(res.headers.get("content-length") ?? "0");
    if (length > MAX_RESPONSE_BYTES) throw new Error(`response too large (${length}) ${url}`);
    const text = await res.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
      throw new Error(`response too large after read: ${url}`);
    }
    return text;
  }
  throw new Error(`unreachable retry exit for ${url}`);
}

/** Only SEC archive hosts and paths are followed. */
function assertSecUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error(`refusing non-https url ${url}`);
  if (parsed.hostname !== "www.sec.gov") throw new Error(`refusing non-SEC host ${parsed.hostname}`);
  if (!parsed.pathname.startsWith("/Archives/") && !parsed.pathname.startsWith("/cgi-bin/browse-edgar")) {
    throw new Error(`refusing unexpected SEC path ${parsed.pathname}`);
  }
}

// --- single writer -----------------------------------------------------------

function acquireLock(runId: string): void {
  mkdirSync(RUNS_DIR, { recursive: true });
  if (existsSync(LOCK_PATH)) {
    const held = readFileSync(LOCK_PATH, "utf8").trim();
    throw new Error(
      `another import holds the lock (${held}). Remove ${LOCK_PATH} only if that run is not running.`
    );
  }
  writeFileSync(LOCK_PATH, `${runId} ${new Date().toISOString()}\n`, { flag: "wx" });
}
function releaseLock(): void {
  rmSync(LOCK_PATH, { force: true });
}

// --- modes -------------------------------------------------------------------

interface SelectedDocument {
  accessionNumber: string;
  documentUrl: string;
  indexUrl: string;
  documentName: string;
  filedDate: string | null;
  xml: string;
}

/** Offline mode: the committed fixture corpus. */
function selectFromFixtures(): SelectedDocument[] {
  const manifest = JSON.parse(readFileSync(join(FIXTURE_DIR, "manifest.json"), "utf8"));
  return manifest.filings.map((f: Record<string, string>) => ({
    accessionNumber: f.accession,
    documentUrl: f.documentUrl,
    indexUrl: f.indexUrl,
    documentName: f.documentName,
    filedDate: null,
    xml: readFileSync(join(FIXTURE_DIR, "documents", f.file), "utf8"),
  }));
}

/**
 * Networked selection over a closed historical window.
 *
 * Enumerates per issuer rather than claiming market-wide coverage: the run
 * summary records exactly what was asked for, so nothing downstream can read a
 * sampled window as complete.
 */
async function selectFromEdgar(userAgent: string): Promise<SelectedDocument[]> {
  if (!FROM || !TO) throw new Error("--from and --to are required for a networked run");
  if (ISSUERS.length === 0) throw new Error("--issuers is required; market-wide runs are out of scope");

  const cikBySymbol = JSON.parse(readFileSync(join(ROOT, "data", "security-master.json"), "utf8"));
  const selected: SelectedDocument[] = [];
  const seenAccessions = new Set<string>();

  for (const symbol of ISSUERS) {
    const cik = cikBySymbol?.entries?.[symbol]?.cik;
    if (!cik) {
      console.error(`  no CIK for ${symbol} in the security master; skipping`);
      continue;
    }
    for (const type of ["4", "4%2FA"]) {
      const indexUrl =
        `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}` +
        `&type=${type}&dateb=&owner=include&count=40&datea=${FROM}&dateb=${TO}&output=atom`;
      assertSecUrl(indexUrl);
      const atom = await politeFetch(indexUrl, userAgent);

      for (const m of atom.matchAll(/<filing-href>([^<]+)<\/filing-href>/g)) {
        const href = m[1];
        const accession = (href.match(/(\d{10}-\d{2}-\d{6})-index/) ?? [])[1];
        if (!accession || seenAccessions.has(accession)) continue;
        seenAccessions.add(accession);

        const dir = href.replace(/\/[^/]+-index\.htm.*$/, "");
        assertSecUrl(`${dir}/index.json`);
        const listing = JSON.parse(await politeFetch(`${dir}/index.json`, userAgent));

        for (const item of listing.directory.item as { name: string }[]) {
          if (!item.name.toLowerCase().endsWith(".xml")) continue;
          const documentUrl = `${dir}/${item.name}`;
          assertSecUrl(documentUrl);
          const xml = await politeFetch(documentUrl, userAgent);
          // Chosen by content, not by filename or by being the first .xml.
          if (!/<ownershipDocument/.test(xml)) continue;
          selected.push({
            accessionNumber: accession, documentUrl, indexUrl: href,
            documentName: item.name, filedDate: null, xml,
          });
          break;
        }
      }
    }
  }
  return selected;
}

// --- main --------------------------------------------------------------------

async function main(): Promise<void> {
  const runId = `form4_${new Date().toISOString().replace(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}`;
  const startedAt = new Date().toISOString();
  const runDir = join(RUNS_DIR, runId);

  if (!["fixtures", "dry-run", "candidate"].includes(MODE)) {
    throw new Error(`unknown --mode ${MODE}`);
  }

  let userAgent = "";
  if (SOURCE === "edgar") {
    userAgent = process.env.SEC_USER_AGENT ?? "";
    if (!userAgent.trim()) {
      throw new Error(
        "SEC_USER_AGENT is required for a networked run. Set it to a real monitored contact, " +
          'e.g. SEC_USER_AGENT="Outfox Markets (contact: someone@yourdomain.com)".'
      );
    }
  }

  acquireLock(runId);
  try {
    mkdirSync(join(runDir, "raw"), { recursive: true });

    const selected =
      SOURCE === "fixtures" ? selectFromFixtures() : await selectFromEdgar(userAgent);

    const counts: RunCounts = {
      selected: selected.length, downloaded: 0, fromCache: SOURCE === "fixtures" ? selected.length : 0,
      parsed: 0, unsupported: 0, quarantinedFilings: 0, failed: 0, rows: 0, quarantinedRows: 0,
    };
    const filings: Form4Filing[] = [];
    const unsupported: UnsupportedDocument[] = [];
    const failures: { accessionNumber: string; error: string }[] = [];
    const manifest: Record<string, string>[] = [];

    for (const doc of selected) {
      if (SOURCE === "edgar") counts.downloaded += 1;
      const hash = sha256(doc.xml);
      // Raw bytes archived by hash so any parse can be re-checked against them.
      writeFileSync(join(runDir, "raw", `${doc.accessionNumber}_${hash.slice(0, 12)}.xml`), doc.xml);
      manifest.push({
        accessionNumber: doc.accessionNumber, documentUrl: doc.documentUrl,
        documentName: doc.documentName, sha256: hash, bytes: String(Buffer.byteLength(doc.xml, "utf8")),
        retrievedAt: new Date().toISOString(),
      });

      try {
        const result = parseForm4({
          xml: doc.xml, accessionNumber: doc.accessionNumber, documentUrl: doc.documentUrl,
          indexUrl: doc.indexUrl, documentName: doc.documentName, importRunId: runId,
          firstObservedAt: startedAt, observationMode: SOURCE === "fixtures" ? "backfill" : "live",
          rawArtifactPath: `raw/${doc.accessionNumber}_${hash.slice(0, 12)}.xml`,
          filedDate: doc.filedDate,
        });
        if (result.ok) {
          counts.parsed += 1;
          counts.rows += result.filing.rows.length;
          counts.quarantinedRows += result.filing.rows.filter((r) => r.validation === "quarantined").length;
          if (result.filing.validation === "quarantined") counts.quarantinedFilings += 1;
          filings.push(result.filing);
        } else {
          counts.unsupported += 1;
          unsupported.push(result.unsupported);
        }
      } catch (error) {
        counts.failed += 1;
        failures.push({ accessionNumber: doc.accessionNumber, error: (error as Error).message });
      }
    }

    // --- gates -------------------------------------------------------------
    const gateFailures: string[] = [];
    const accountedFor = counts.parsed + counts.unsupported + counts.failed;
    if (accountedFor !== counts.selected) {
      gateFailures.push(`unaccounted_documents:${counts.selected - accountedFor}`);
    }
    if (counts.failed > 0) gateFailures.push(`download_or_parse_failures:${counts.failed}`);
    if (counts.quarantinedRows > 0) gateFailures.push(`quarantined_rows:${counts.quarantinedRows}`);
    if (counts.quarantinedFilings > 0) gateFailures.push(`quarantined_filings:${counts.quarantinedFilings}`);
    if (counts.selected > 0 && counts.parsed === 0) gateFailures.push("no_filings_parsed");

    const rowIds = filings.flatMap((f) => f.rows.map((r) => r.id));
    if (new Set(rowIds).size !== rowIds.length) gateFailures.push("row_identity_collision");
    const accessions = filings.map((f) => f.accessionNumber);
    if (new Set(accessions).size !== accessions.length) gateFailures.push("duplicate_accession");

    if (SIMULATE_GATE_FAILURE) gateFailures.push("simulated_gate_failure");

    const passed = gateFailures.length === 0;
    const finishedAt = new Date().toISOString();

    const summary = {
      runId, mode: MODE, source: SOURCE, startedAt, finishedAt, passed, gateFailures,
      selection: { from: FROM, to: TO, issuers: ISSUERS, source: SOURCE === "fixtures" ? "committed fixtures" : "EDGAR" },
      coverageNote:
        "Issuer-filtered window. This is not market-wide Form 4 coverage and must not be described as such.",
      counts,
      promoted: false as boolean,
    };

    writeFileSync(join(runDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(join(runDir, "unsupported.json"), `${JSON.stringify(unsupported, null, 2)}\n`);
    writeFileSync(
      join(runDir, "quarantine.json"),
      `${JSON.stringify(filings.flatMap((f) => f.rows.filter((r) => r.validation === "quarantined")), null, 2)}\n`
    );
    writeFileSync(join(runDir, "errors.json"), `${JSON.stringify(failures, null, 2)}\n`);

    // --- promotion ---------------------------------------------------------
    if (passed && MODE === "candidate") {
      const tmp = `${CANDIDATE_PATH}.${runId}.tmp`;
      writeFileSync(tmp, `${JSON.stringify({ schemaVersion: 1, runId, generatedAt: finishedAt, filings }, null, 2)}\n`);
      renameSync(tmp, CANDIDATE_PATH); // atomic replace
      summary.promoted = true;
    }

    writeFileSync(join(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    const report = [
      "================================================================",
      "OUTFOX FORM 4 IMPORT",
      "================================================================",
      `  run id            ${runId}`,
      `  mode              ${MODE}`,
      `  source            ${SOURCE}`,
      `  selection         ${SOURCE === "fixtures" ? "committed fixtures" : `${FROM}..${TO} issuers=${ISSUERS.join(",")}`}`,
      "",
      "SOURCE",
      `  documents selected  ${counts.selected}`,
      `  downloaded          ${counts.downloaded}`,
      `  from cache/fixtures ${counts.fromCache}`,
      "",
      "PARSE",
      `  parsed              ${counts.parsed}`,
      `  unsupported         ${counts.unsupported}`,
      `  failed              ${counts.failed}`,
      `  rows                ${counts.rows}`,
      `  quarantined rows    ${counts.quarantinedRows}`,
      "",
      "GATES",
      `  result              ${passed ? "PASS" : "FAIL"}`,
      ...gateFailures.map((f) => `  failure             ${f}`),
      "",
      "OUTCOME",
      `  candidate updated   ${summary.promoted ? "yes" : "no"}`,
      "================================================================",
    ].join("\n");
    writeFileSync(join(runDir, "report.txt"), `${report}\n`);
    console.log(report);
    console.log(`\nEvidence: ${runDir}`);

    if (!passed) process.exitCode = 1;
  } finally {
    releaseLock();
  }
}

main().catch((error) => {
  console.error(`form4 import failed: ${(error as Error).message}`);
  releaseLock();
  process.exitCode = 1;
});
