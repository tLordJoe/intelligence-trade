/** Local archive storage; never writes the public feed. Single writer uses the importer lock. */
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { readCandidate, readCandidateObject, type CandidateArchive } from "./merge.ts";

const CHUNK_SIZE = 250;
const CHUNK_BYTES = 4 * 1024 * 1024;
type Manifest = {
  schemaVersion: 2;
  updatedAt: string;
  runIds: string[];
  filingCount: number;
  chunks: { sha256: string; count: number }[];
};
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const chunkPath = (path: string, sha: string) => join(`${path}.chunks`, `${sha}.json`);

function manifest(value: unknown): Manifest {
  const m = value as Manifest;
  if (!m || m.schemaVersion !== 2 || typeof m.updatedAt !== "string" ||
      !Array.isArray(m.runIds) || m.runIds.some(id => typeof id !== "string") ||
      !Number.isSafeInteger(m.filingCount) || m.filingCount < 0 || !Array.isArray(m.chunks) ||
      m.chunks.some(c => !c || !/^[a-f0-9]{64}$/.test(c.sha256) || !Number.isSafeInteger(c.count) || c.count < 1 || c.count > CHUNK_SIZE) ||
      m.chunks.reduce((sum, c) => sum + c.count, 0) !== m.filingCount) {
    throw new Error("Invalid candidate chunk manifest; refusing to continue");
  }
  if (new Set(m.chunks.map(c => c.sha256)).size !== m.chunks.length) throw new Error("Invalid candidate duplicate chunk");
  return m;
}

const key = (f: CandidateArchive["filings"][number]) => `${f.accessionNumber}::${f.documentSha256}`;
function validateRows(rows: unknown): asserts rows is CandidateArchive["filings"] {
  if (!Array.isArray(rows) || rows.some(f => !f || typeof f !== "object" ||
      typeof f.accessionNumber !== "string" || !f.accessionNumber ||
      typeof f.documentSha256 !== "string" || !f.documentSha256 ||
      !Array.isArray(f.rows) || !f.timestamps || typeof f.timestamps.firstObservedAt !== "string")) {
    throw new Error("Invalid candidate filing contents");
  }
  if (new Set(rows.map(key)).size !== rows.length) throw new Error("Duplicate candidate filing version");
}
function readChunk(path: string, chunk: Manifest["chunks"][number]) {
  const bytes = readFileSync(chunkPath(path, chunk.sha256));
  if (hash(bytes) !== chunk.sha256) throw new Error("Candidate chunk hash mismatch");
  const rows: unknown = JSON.parse(bytes.toString("utf8"));
  validateRows(rows);
  if (rows.length !== chunk.count) throw new Error("Candidate chunk count mismatch");
  return rows;
}

/** Supports legacy archives, so migration happens on the next successful write. */
export function readCandidateFile(path: string): CandidateArchive {
  if (!existsSync(path)) return readCandidate(null);
  const raw = readFileSync(path, "utf8");
  return readSnapshot(path, raw);
}

function readSnapshot(path: string, raw: string): CandidateArchive {
  const parsed = JSON.parse(raw);
  if (parsed?.schemaVersion !== 2) {
    const legacy = readCandidateObject(parsed);
    validateRows(legacy.filings);
    return legacy;
  }
  const m = manifest(parsed);
  const filings: CandidateArchive["filings"] = [];
  for (const chunk of m.chunks) {
    const rows = readChunk(path, chunk);
    for (const filing of rows) filings.push(filing);
  }
  validateRows(filings);
  filings.sort((a, b) => a.accessionNumber.localeCompare(b.accessionNumber) || a.documentSha256.localeCompare(b.documentSha256));
  return { schemaVersion: 1, updatedAt: m.updatedAt, runIds: m.runIds, filings };
}

/** The backfill can check its checkpoint without parsing all historical filings. */
export function readCandidateRunIds(path: string): string[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  return parsed?.schemaVersion === 2 ? manifest(parsed).runIds : readCandidateObject(parsed).runIds;
}

function atomicWrite(path: string, bytes: string) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const fd = openSync(temporary, "wx");
    try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temporary, path);
    const directory = openSync(dirname(path), "r");
    try { fsyncSync(directory); } finally { closeSync(directory); }
  } finally {
    rmSync(temporary, { force: true });
  }
}

/** Each legacy generation gets its own verified, atomically installed copy. */
function preserveLegacyFile(path: string, expectedHash: string) {
  const backup = `${path}.legacy-backup-${expectedHash}`;
  if (existsSync(backup)) {
    if (hash(readFileSync(backup)) !== expectedHash) throw new Error("Legacy backup hash mismatch; refusing conversion");
    return;
  }
  const temporary = `${backup}.${randomUUID()}.tmp`;
  try {
    copyFileSync(path, temporary, constants.COPYFILE_EXCL);
    const fd = openSync(temporary, "r");
    try { fsyncSync(fd); } finally { closeSync(fd); }
    if (hash(readFileSync(temporary)) !== expectedHash) throw new Error("Legacy backup copy mismatch; refusing conversion");
    renameSync(temporary, backup);
    const directory = openSync(dirname(path), "r");
    try { fsyncSync(directory); } finally { closeSync(directory); }
  } finally {
    rmSync(temporary, { force: true });
  }
}

/** Chunks are immutable; only replace the manifest after every chunk write succeeds.
 * Old chunks are retained so readers holding an earlier manifest remain valid.
 * This bounds serialization size, but merging still requires memory for all filings.
 */
export function writeCandidateFile(path: string, archive: CandidateArchive): void {
  validateRows(archive.filings);
  mkdirSync(dirname(path), { recursive: true });
  const previousRaw = existsSync(path) ? readFileSync(path, "utf8") : null;
  const previous = previousRaw ? JSON.parse(previousRaw) : null;
  const priorManifest = previous?.schemaVersion === 2 ? manifest(previous) : null;
  mkdirSync(`${path}.chunks`, { recursive: true });
  const m: Manifest = { schemaVersion: 2, updatedAt: archive.updatedAt, runIds: archive.runIds,
    filingCount: archive.filings.length, chunks: [] };
  let batch: string[] = [], batchBytes = 3;
  const flush = () => {
    if (!batch.length) return;
    const bytes = `[${batch.join(",")}]\n`;
    const sha256 = hash(bytes), destination = chunkPath(path, sha256);
    if (existsSync(destination)) {
      if (hash(readFileSync(destination)) !== sha256) throw new Error("Existing candidate chunk is corrupt");
    } else atomicWrite(destination, bytes);
    m.chunks.push({ sha256, count: batch.length });
    batch = []; batchBytes = 3;
  };
  const append = (filing: CandidateArchive["filings"][number]) => {
    const serialized = JSON.stringify(filing), size = Buffer.byteLength(serialized);
    if (size + 3 > CHUNK_BYTES) throw new Error("Single candidate filing exceeds chunk byte limit");
    if (batch.length === CHUNK_SIZE || batchBytes + size + 1 > CHUNK_BYTES) flush();
    batch.push(serialized); batchBytes += size + 1;
  };
  // Preserve existing chunk membership by filing identity. Insertions elsewhere
  // in accession sort order no longer shift every subsequent chunk.
  const remaining = new Map(archive.filings.map(f => [key(f), f]));
  const seen = new Set<string>();
  for (const chunk of priorManifest?.chunks ?? []) {
    for (const old of readChunk(path, chunk)) {
      if (seen.has(key(old))) throw new Error("Duplicate candidate filing version");
      seen.add(key(old));
      const current = remaining.get(key(old));
      if (!current) throw new Error("Refusing candidate history loss");
      append(current);
      remaining.delete(key(old));
    }
    flush();
  }
  for (const filing of remaining.values()) append(filing);
  flush();
  if (previousRaw !== null) {
    if (!priorManifest) {
      // Preserve the legacy bytes without another huge serialization.
      preserveLegacyFile(path, hash(previousRaw));
    } else atomicWrite(`${path}.previous`, previousRaw);
  }
  atomicWrite(path, `${JSON.stringify(m, null, 2)}\n`);
}

/** Offline maintenance: callers must stop readers as well as the importer.
 * The importer lock excludes writers; it is not a read lease.
 */
export function maintainCandidate(path: string, action: "inspect" | "quarantine" | "recover", options: { force?: boolean } = {}) {
  const lockDirectory = join(dirname(path), "form4-runs");
  mkdirSync(lockDirectory, { recursive: true });
  const lock = join(lockDirectory, ".import.lock");
  writeFileSync(lock, "offline candidate maintenance\n", { flag: "wx" });
  try {
    if (action === "recover") {
      if (existsSync(path) && !options.force) {
        let healthy = true;
        try { readCandidateFile(path); } catch { healthy = false; }
        if (healthy) throw new Error("Current candidate is healthy; rollback requires --force");
      }
      const raw = readFileSync(`${path}.previous`, "utf8");
      manifest(JSON.parse(raw));
      const verified = readSnapshot(path, raw);
      // Preserve the damaged/current checkpoint before restoring a prior one.
      if (existsSync(path)) atomicWrite(`${path}.recovery-${randomUUID()}`, readFileSync(path, "utf8"));
      atomicWrite(path, raw);
      return { action, filings: verified.filings.length, runIds: verified.runIds, moved: 0 };
    }
    const retained = new Set<string>();
    const recoveryPrefix = `${basename(path)}.recovery-`;
    const recoveryFiles = readdirSync(dirname(path)).filter(name => name.startsWith(recoveryPrefix)).map(name => join(dirname(path), name));
    let filings = 0, runCount = 0, recoveryManifests = 0;
    for (const checkpoint of [path, `${path}.previous`, ...recoveryFiles]) {
      if (!existsSync(checkpoint)) {
        if (checkpoint === path) throw new Error("Candidate must exist for maintenance");
        continue;
      }
      const raw = readFileSync(checkpoint, "utf8");
      let m: Manifest;
      try { m = manifest(JSON.parse(raw)); } catch (error) {
        // A recovery evidence file may hold the damaged manifest itself.
        if (recoveryFiles.includes(checkpoint)) continue;
        throw error;
      }
      readSnapshot(path, raw); // Verify retained generations before moving anything.
      if (checkpoint === path) { filings = m.filingCount; runCount = m.runIds.length; }
      if (recoveryFiles.includes(checkpoint)) recoveryManifests++;
      for (const c of m.chunks) retained.add(c.sha256 + ".json");
    }
    const unused = readdirSync(`${path}.chunks`).filter(name => /^[a-f0-9]{64}\.json$/.test(name) && !retained.has(name));
    let quarantine: string | null = null;
    if (action === "quarantine" && unused.length) {
      quarantine = `${path}.quarantine-${randomUUID()}`;
      mkdirSync(quarantine);
      for (const name of unused) renameSync(join(`${path}.chunks`, name), join(quarantine, name));
    }
    return { action, filings, runCount, recoveryManifests, unreferenced: unused.length, moved: quarantine ? unused.length : 0, quarantine };
  } finally {
    rmSync(lock, { force: true });
  }
}
