import { readFileSync, existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { readCandidate } from "./merge.ts";
import { reconcileForm4ByIssuer, type Form4CorrectionReview, type Form4DocumentSelection } from "./reconcile.ts";
import { buildInsiderActivity, type InsiderSecurityIdentity } from "./activity.ts";
import { parseForm4 } from "./parse.ts";
import { dailyIndexUrl, datesInRange, filterByIssuerCik, parseFormIndex, summarizeEnumeration, unavailableIndex } from "./enumerate.ts";
import { insiderUniverseHash, readInsiderUniverse } from "./universe.ts";
import { EvidenceSnapshotCache } from "./evidence-cache.ts";

/** Local review only. Validates archived evidence before producing display data. */
export function loadInsiderCandidateReview(root: string) {
  const archive = readCandidate(readFileSync(resolve(root, "data/form4-candidate.json"), "utf8"));
  const master = JSON.parse(readFileSync(resolve(root, "data/security-master.json"), "utf8"));
  const universeSnapshots = new EvidenceSnapshotCache<{ sha256: string; ciks: string[]; size: number }>();
  const expectedSnapshots = new EvidenceSnapshotCache<ReturnType<typeof filterByIssuerCik>>();
  const universeCiks = new Set<string>();
  const runs = archive.runIds.map(runId => {
    if (!/^form4_[A-Za-z0-9_-]+$/.test(runId)) throw new Error("Invalid candidate run identity");
    const directory = resolve(root, "data/form4-runs", runId);
    const summary = JSON.parse(readFileSync(resolve(directory, "summary.json"), "utf8"));
    if (summary.runId !== runId || summary.source !== "edgar" || summary.passed !== true ||
        summary.promoted !== true || !summary.enumeration?.complete || summary.gateFailures?.length !== 0) {
      throw new Error("Candidate contains fixture data or a run without passing source gates");
    }
    const from = summary.selection.from as string, to = summary.selection.to as string;
    const universePath = resolve(directory, "universe.json");
    const universeBytes = existsSync(universePath) ? readFileSync(universePath) : null;
    const universe = universeBytes ? universeSnapshots.read([{ context: "SEC issuer universe", bytes: universeBytes }], () => {
      const parsed = readInsiderUniverse(JSON.parse(universeBytes.toString("utf8")));
      const ciks = [...new Set(parsed.entries.map(entry => entry.cik))];
      return { sha256: insiderUniverseHash(parsed), ciks, size: ciks.length };
    }) : null;
    const ciks = universe ? universe.ciks : (summary.selection.issuers as string[]).map(ticker => master.entries[ticker]?.cik);
    if (ciks.some(cik => !cik)) throw new Error("Unresolved collection issuer");
    if (universe) for (const cik of ciks) universeCiks.add(cik);
    const indexSources = datesInRange(from, to).map(date => {
      const path = resolve(directory, "indexes", `form.${date}.idx`);
      return { date, context: dailyIndexUrl(date), bytes: existsSync(path) ? readFileSync(path) : null };
    });
    const expected = expectedSnapshots.read([
      { context: JSON.stringify(ciks), bytes: null }, ...indexSources,
    ], () => {
      const indexes = indexSources.map(({ date, bytes }) => bytes
        ? parseFormIndex(bytes.toString("utf8"), dailyIndexUrl(date), date)
        : unavailableIndex(dailyIndexUrl(date), date, "Missing archived index"));
      const replay = summarizeEnumeration(indexes);
      if (!replay.summary.complete) throw new Error("Incomplete archived SEC index window");
      return filterByIssuerCik(replay.entries, ciks).sort((a, b) => a.accessionNumber.localeCompare(b.accessionNumber));
    });
    const selectionPath = resolve(directory, "selection.json");
    const selection = existsSync(selectionPath) ? JSON.parse(readFileSync(selectionPath, "utf8")) : null;
    const universeSha256 = universe?.sha256 ?? null;
    if (selection && (JSON.stringify(selection.allAccessions) !== JSON.stringify(expected.map(entry => entry.accessionNumber)) || selection.universeSha256 !== universeSha256)) throw new Error("SEC selection replay mismatch");
    const manifest = JSON.parse(readFileSync(resolve(directory, "manifest.json"), "utf8")) as { accessionNumber: string; sha256: string; documentUrl: string; documentName: string }[];
    if (manifest.length !== summary.counts.selected || new Set(manifest.map(item => item.accessionNumber)).size !== manifest.length ||
        (selection && JSON.stringify(manifest.map(item => item.accessionNumber)) !== JSON.stringify(selection.batchAccessions))) throw new Error("SEC batch manifest mismatch");
    return { runId, directory, from, to, universeSha256, universeSize: universe?.size ?? 0,
      expected, manifest: new Map(manifest.map(item => [item.accessionNumber, item])), issuers: summary.selection.issuers as string[], selected: summary.counts.selected as number };
  });
  if (!runs.length || !archive.filings.length) throw new Error("No SEC candidate data available");
  const byRun = new Map(runs.map(run => [run.runId, run]));
  // Each shared snapshot needs one lookup map, not one map per batch/run.
  type Expected = (typeof runs)[number]["expected"];
  const bySnapshot = new Map<Expected, Map<string, Expected[number]>>();
  for (const run of runs) {
    if (!bySnapshot.has(run.expected)) bySnapshot.set(run.expected, new Map(run.expected.map(entry => [entry.accessionNumber, entry])));
  }
  const filings = archive.filings;
  for (let index = 0; index < filings.length; index++) {
    const filing = filings[index];
    const run = byRun.get(filing.importRunId);
    if (!run || !filing.rawArtifactPath) throw new Error("Filing lacks its import evidence");
    const rawPath = resolve(run.directory, filing.rawArtifactPath);
    if (!rawPath.startsWith(`${run.directory}${sep}raw${sep}`)) throw new Error("Invalid raw evidence path");
    const bytes = readFileSync(rawPath);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== filing.documentSha256) throw new Error("Archived SEC bytes do not match the candidate");
    const entry = bySnapshot.get(run.expected)!.get(filing.accessionNumber);
    const item = run.manifest.get(filing.accessionNumber);
    if (!entry || !item || item.sha256 !== hash || item.documentUrl !== `${entry.archiveDir}/${item.documentName}` || filing.documentUrl !== item.documentUrl || filing.indexUrl !== entry.indexHeaderUrl) throw new Error("SEC source linkage mismatch");
    const parsed = parseForm4({ xml: bytes.toString("utf8"), accessionNumber: entry.accessionNumber, documentUrl: item.documentUrl,
      indexUrl: entry.indexHeaderUrl, documentName: item.documentName, importRunId: run.runId, rawArtifactPath: filing.rawArtifactPath,
      filedDate: entry.filedDate, firstObservedAt: filing.timestamps.firstObservedAt, lastObservedAt: filing.timestamps.lastObservedAt,
      observationMode: filing.timestamps.observationMode });
    if (!parsed.ok || parsed.filing.id !== filing.id || parsed.filing.documentType !== entry.formType) throw new Error("SEC reparse mismatch");
    // Replace the serialized candidate representation after source validation,
    // rather than retaining a second full-year collection of normalized rows.
    filings[index] = parsed.filing;
  }
  const collectedAccessions = new Set(filings.map(filing => filing.accessionNumber));
  const identities = Object.values(master.entries) as InsiderSecurityIdentity[];
  const from = runs.map(run => run.from).sort()[0];
  const to = runs.map(run => run.to).sort().at(-1)!;
  const ledger = <T>(name: string): T[] => existsSync(resolve(root, "data", name)) ? JSON.parse(readFileSync(resolve(root, "data", name), "utf8")) : [];
  const reconciled = reconcileForm4ByIssuer(filings, ledger<Form4CorrectionReview>("form4-correction-reviews.json"), ledger<Form4DocumentSelection>("form4-document-selections.json"));
  // The preview is evidence review, not an inference that no future amendment exists.
  const activity = buildInsiderActivity(reconciled.eligible, identities, "1900-01-01", to);
  if (reconciled.heldRows) activity.excluded.unresolved_issuer_reconciliation = reconciled.heldRows;
  return {
    updatedAt: archive.updatedAt, filingCount: filings.length,
    sourceRowCount: filings.reduce((sum, filing) => sum + filing.rows.length, 0),
    from, to, runs: runs.map(run => ({ runId: run.runId, from: run.from, to: run.to, issuers: run.issuers, selected: run.selected })),
    issuers: [...new Set(runs.flatMap(run => run.issuers))].sort(),
    universeCiks: [...universeCiks],
    coverage: runs.map(run => ({ from: run.from, to: run.to, universeSha256: run.universeSha256, universeSize: run.universeSize,
      expectedFilings: run.expected.length, missingAccessions: run.expected.filter(entry => !collectedAccessions.has(entry.accessionNumber)).map(entry => entry.accessionNumber) })),
    blockers: reconciled.blockers, heldIssuers: reconciled.heldIssuers, records: activity.records, excluded: activity.excluded,
    publicationApproved: false as const,
  };
}
