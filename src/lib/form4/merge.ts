/**
 * Append-only merge into the candidate archive.
 *
 * The defect this prevents: promotion previously wrote the run's own selection
 * over the candidate file. A bounded run — one issuer, one week — would have
 * replaced an archive built from a wider window with just its own slice, and
 * the loss would have been silent because the file was simply smaller.
 *
 * Merging can add a filing and can add a new *document version* of one it has
 * seen. It has no path that removes a filing, and any historical loss it cannot
 * explain is reported so a gate can block on it.
 *
 * Document versions matter here. A filing is identified by accession; the bytes
 * at that accession can be revised. Both versions are retained, distinguished
 * by document hash, so a source revision never silently overwrites what we
 * already archived.
 */

import type { Form4Filing } from "./types.ts";

export interface CandidateArchive {
  schemaVersion: number;
  updatedAt: string;
  /** Runs that have contributed, newest last. */
  runIds: string[];
  filings: Form4Filing[];
}

export interface MergeResult {
  archive: CandidateArchive;
  addedFilings: number;
  addedDocumentVersions: number;
  refreshedFilings: number;
  /** Accessions present before and absent after. Must always be empty. */
  lostAccessions: string[];
  /** Accessions whose bytes at the source changed since we archived them. */
  sourceRevisedAccessions: string[];
  /** Accessions in the prior archive that this run's window did not cover. */
  untouchedAccessions: string[];
}

export const EMPTY_CANDIDATE: CandidateArchive = {
  schemaVersion: 1,
  updatedAt: "",
  runIds: [],
  filings: [],
};

/** A filing is one accession; a document version is one set of bytes for it. */
const versionKey = (filing: Form4Filing) =>
  `${filing.accessionNumber}::${filing.documentSha256}`;

/**
 * Merge this run's filings into the existing candidate archive.
 *
 * Nothing outside the run's selection is touched: prior filings are carried
 * forward untouched and counted, so a bounded run leaves a wide archive intact.
 */
export function mergeCandidate(
  prior: CandidateArchive,
  incoming: Form4Filing[],
  runId: string,
  now: string
): MergeResult {
  const byVersion = new Map<string, Form4Filing>();
  const priorAccessions = new Set<string>();

  for (const filing of prior.filings) {
    byVersion.set(versionKey(filing), filing);
    priorAccessions.add(filing.accessionNumber);
  }

  const priorHashesByAccession = new Map<string, Set<string>>();
  for (const filing of prior.filings) {
    const set = priorHashesByAccession.get(filing.accessionNumber) ?? new Set<string>();
    set.add(filing.documentSha256);
    priorHashesByAccession.set(filing.accessionNumber, set);
  }

  let addedFilings = 0;
  let addedDocumentVersions = 0;
  let refreshedFilings = 0;
  const sourceRevisedAccessions: string[] = [];
  const touched = new Set<string>();

  for (const filing of incoming) {
    touched.add(filing.accessionNumber);
    const key = versionKey(filing);
    const existing = byVersion.get(key);

    if (existing) {
      // Same accession, same bytes. Refresh observation only; first sighting
      // and the archived interpretation are not rewritten by a later run.
      byVersion.set(key, {
        ...filing,
        timestamps: {
          ...filing.timestamps,
          firstObservedAt: existing.timestamps.firstObservedAt,
          lastObservedAt: now,
        },
      });
      refreshedFilings += 1;
      continue;
    }

    const knownHashes = priorHashesByAccession.get(filing.accessionNumber);
    if (knownHashes && knownHashes.size > 0) {
      // The accession is known but these bytes are new: the source document was
      // revised. Both versions are kept; neither replaces the other.
      addedDocumentVersions += 1;
      sourceRevisedAccessions.push(filing.accessionNumber);
    } else {
      addedFilings += 1;
    }
    byVersion.set(key, filing);
  }

  const filings = [...byVersion.values()].sort((a, b) => {
    const byAccession = a.accessionNumber.localeCompare(b.accessionNumber);
    return byAccession !== 0 ? byAccession : a.documentSha256.localeCompare(b.documentSha256);
  });

  const afterAccessions = new Set(filings.map((f) => f.accessionNumber));
  const lostAccessions = [...priorAccessions].filter((a) => !afterAccessions.has(a));
  const untouchedAccessions = [...priorAccessions].filter((a) => !touched.has(a));

  return {
    archive: {
      schemaVersion: prior.schemaVersion || 1,
      updatedAt: now,
      runIds: [...prior.runIds, runId],
      filings,
    },
    addedFilings,
    addedDocumentVersions,
    refreshedFilings,
    lostAccessions,
    sourceRevisedAccessions: [...new Set(sourceRevisedAccessions)],
    untouchedAccessions,
  };
}

/** Read a candidate archive, tolerating absence but not corruption. */
export function readCandidate(raw: string | null): CandidateArchive {
  if (raw === null) return { ...EMPTY_CANDIDATE };
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.filings)) {
    // Refusing is the point: silently starting from empty would turn a corrupt
    // file into a total archive loss on the next promotion.
    throw new Error("candidate archive is present but not readable; refusing to overwrite it");
  }
  return {
    schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : 1,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    runIds: Array.isArray(parsed.runIds) ? parsed.runIds : [],
    filings: parsed.filings,
  };
}
