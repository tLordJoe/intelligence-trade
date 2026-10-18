import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { maintainCandidate, readCandidateFile, readCandidateRunIds, writeCandidateFile } from "../src/lib/form4/candidate-storage.ts";
import type { CandidateArchive } from "../src/lib/form4/merge.ts";

// Storage-only synthetic objects; parsing and eligibility are separately tested.
const archive = (count: number): CandidateArchive => ({ schemaVersion: 1, updatedAt: "2026-09-28",
  runIds: ["form4_test"], filings: Array.from({ length: count }, (_, n) => ({ accessionNumber: String(n).padStart(8, "0"),
    documentSha256: String(n), rows: [], timestamps: { firstObservedAt: "original" } })) as unknown as CandidateArchive["filings"] });
function isolated(body: (path: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "outfox-form4-storage-"));
  try { body(join(dir, "candidate.json")); } finally { rmSync(dir, { recursive: true, force: true }); }
}
test("absent and legacy archives remain readable", () => isolated(path => {
  assert.deepEqual(readCandidateFile(path).filings, []);
  assert.deepEqual(readCandidateRunIds(path), []);
  const input = archive(2);
  writeCandidateFile(path, input);
  assert.deepEqual(readCandidateFile(path), input);
  assert.equal(JSON.parse(readFileSync(path, "utf8")).schemaVersion, 2);
}));
test("large archives round-trip through bounded chunks and a small run checkpoint", () => isolated(path => {
  const input = archive(601);
  writeCandidateFile(path, input);
  const m = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(m.schemaVersion, 2);
  assert.deepEqual(m.chunks.map((c: { count: number }) => c.count), [250, 250, 101]);
  assert.ok(readFileSync(path).length < 2000);
  assert.deepEqual(readCandidateFile(path), input);
  assert.deepEqual(readCandidateRunIds(path), input.runIds);
  const originalChunks = readdirSync(`${path}.chunks`);
  input.filings.push(archive(602).filings[601]);
  input.runIds.push("form4_next");
  writeCandidateFile(path, input);
  assert.deepEqual(readCandidateFile(path), input);
  for (const old of originalChunks) assert.ok(readdirSync(`${path}.chunks`).includes(old));
}));
test("legacy history survives conversion on a successful write", () => isolated(path => {
  const input = archive(501);
  writeFileSync(path, JSON.stringify(input));
  const prior = readCandidateFile(path);
  writeCandidateFile(path, prior);
  assert.deepEqual(readCandidateFile(path), input);
}));
test("legacy conversion replaces a partial old backup with a verified content-named copy", () => isolated(path => {
  const input = archive(501), raw = JSON.stringify(input);
  writeFileSync(path, raw);
  writeFileSync(`${path}.legacy-backup`, raw.slice(0, 1000));
  writeCandidateFile(path, input);
  const sha = createHash("sha256").update(raw).digest("hex");
  assert.equal(readFileSync(`${path}.legacy-backup-${sha}`, "utf8"), raw);
  assert.deepEqual(readCandidateFile(path), input);
  assert.ok(readdirSync(join(path, "..")).every(name => !name.endsWith(".tmp")));
}));
test("separate legacy generations retain separate backups and a corrupt named backup blocks conversion", () => isolated(path => {
  const first = archive(5), second = archive(10);
  const rawFirst = JSON.stringify(first), rawSecond = JSON.stringify(second);
  const sha = (raw: string) => createHash("sha256").update(raw).digest("hex");
  writeFileSync(path, rawFirst);
  writeCandidateFile(path, first);
  writeFileSync(path, rawSecond);
  const secondBackup = `${path}.legacy-backup-${sha(rawSecond)}`;
  writeFileSync(secondBackup, rawSecond.slice(0, 100));
  assert.throws(() => writeCandidateFile(path, second), /Legacy backup hash mismatch/);
  assert.equal(readFileSync(path, "utf8"), rawSecond);
  rmSync(secondBackup);
  writeCandidateFile(path, second);
  assert.equal(readFileSync(`${path}.legacy-backup-${sha(rawFirst)}`, "utf8"), rawFirst);
  assert.equal(readFileSync(secondBackup, "utf8"), rawSecond);
  assert.deepEqual(readCandidateFile(path), second);
}));
test("tampering and missing chunks fail closed", () => isolated(path => {
  writeCandidateFile(path, archive(501));
  const m = JSON.parse(readFileSync(path, "utf8"));
  const first = join(`${path}.chunks`, `${m.chunks[0].sha256}.json`);
  writeFileSync(first, "[]");
  assert.throws(() => readCandidateFile(path), /hash mismatch/);
  rmSync(first);
  assert.throws(() => readCandidateFile(path), /ENOENT/);
  m.chunks[0].sha256 = "../../outside";
  writeFileSync(path, JSON.stringify(m));
  assert.throws(() => readCandidateFile(path), /Invalid candidate/);
}));
test("a failed later chunk leaves the previous archive readable", () => isolated(path => {
  const good = archive(501);
  writeCandidateFile(path, good);
  const before = readFileSync(path, "utf8");
  const bad = archive(601);
  Object.assign(bad.filings[0], { changed: true });
  const chunksBefore = readdirSync(`${path}.chunks`).length;
  Object.assign(bad.filings[600], { cannotSerialize: BigInt(1) });
  assert.throws(() => writeCandidateFile(path, bad), /BigInt/);
  assert.equal(readFileSync(path, "utf8"), before);
  assert.deepEqual(readCandidateFile(path), good);
  assert.ok(readdirSync(`${path}.chunks`).length > chunksBefore, "failure happened after a new chunk was written");
  assert.ok(readdirSync(`${path}.chunks`).every(name => !name.endsWith(".tmp")));
}));

test("interleaved insertions reuse every historical chunk", () => isolated(path => {
  const before = archive(10000);
  writeCandidateFile(path, before);
  const ids = JSON.parse(readFileSync(path, "utf8")).chunks.map((c: {sha256: string}) => c.sha256);
  for (let n = 0; n < 50; n++) before.filings.push({ ...before.filings[n * 100], accessionNumber: before.filings[n * 100].accessionNumber + "a" });
  before.filings.sort((a, b) => a.accessionNumber.localeCompare(b.accessionNumber));
  writeCandidateFile(path, before);
  const after = JSON.parse(readFileSync(path, "utf8"));
  assert.deepEqual(after.chunks.slice(0, ids.length).map((c: {sha256: string}) => c.sha256), ids);
  assert.equal(readdirSync(`${path}.chunks`).length, ids.length + 1);
  assert.deepEqual(readCandidateFile(path), before);
  assert.equal(JSON.parse(readFileSync(`${path}.previous`, "utf8")).filingCount, 10000);
}));

test("duplicate chunks and correctly hashed non-filings are refused", () => isolated(path => {
  writeCandidateFile(path, archive(251));
  const m = JSON.parse(readFileSync(path, "utf8"));
  m.chunks.push(m.chunks[0]); m.filingCount += m.chunks[0].count;
  writeFileSync(path, JSON.stringify(m));
  assert.throws(() => readCandidateFile(path), /duplicate chunk/);
  const bytes = "[1,2]";
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(join(`${path}.chunks`, sha256 + ".json"), bytes);
  writeFileSync(path, JSON.stringify({ ...m, chunks: [{sha256, count: 2}], filingCount: 2 }));
  assert.throws(() => readCandidateFile(path), /filing contents/);
}));

test("250 and 251 filings use the same bounded storage; oversized singleton refuses", () => isolated(path => {
  for (const n of [250, 251]) {
    const input = archive(n);
    for (const f of input.filings) Object.assign(f, { padding: "a".repeat(25000) });
    writeCandidateFile(path, input);
    assert.deepEqual(readCandidateFile(path), input);
    for (const f of readdirSync(`${path}.chunks`)) assert.ok(readFileSync(join(`${path}.chunks`, f)).length <= 4 * 1024 * 1024);
  }
  const prior = readFileSync(path, "utf8");
  const oversized = archive(251);
  Object.assign(oversized.filings[0], { padding: "a".repeat(4 * 1024 * 1024) });
  assert.throws(() => writeCandidateFile(path, oversized), /byte limit/);
  assert.equal(readFileSync(path, "utf8"), prior);
}));

test("migration round-trips and refuses a held source lock", () => isolated(path => {
  const input = archive(251);
  writeFileSync(path, JSON.stringify(input));
  const script = join(import.meta.dirname, "../scripts/migrate-form4-candidate.ts");
  execFileSync(process.execPath, ["--experimental-strip-types", script, path, path + ".copy"]);
  assert.deepEqual(readCandidateFile(path + ".copy"), input);
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), input);
  const lock = join(path, "../form4-runs/.import.lock");
  writeFileSync(lock, "held");
  assert.throws(() => execFileSync(process.execPath, ["--experimental-strip-types", script, path, path + ".blocked"], {stdio: "pipe"}));
  assert.equal(readFileSync(lock, "utf8"), "held");
}));
test("large records split by bytes, not only by filing count", () => isolated(path => {
  const input = archive(251);
  for (const f of input.filings) Object.assign(f, { padding: "a".repeat(25000) });
  writeCandidateFile(path, input);
  for (const name of readdirSync(`${path}.chunks`)) assert.ok(readFileSync(join(`${path}.chunks`, name)).length <= 4 * 1024 * 1024);
  assert.deepEqual(readCandidateFile(path), input);
}));

test("maintenance preserves two generations, quarantines older chunks and recovers a truncated manifest", () => isolated(path => {
  const input = archive(251);
  writeCandidateFile(path, input);
  const first = readFileSync(path, "utf8");
  Object.assign(input.filings[0], { revision: 1 });
  writeCandidateFile(path, input);
  const second = structuredClone(input);
  Object.assign(input.filings[0], { revision: 2 });
  writeCandidateFile(path, input);
  const before = readdirSync(`${path}.chunks`).length;
  const inspection = maintainCandidate(path, "inspect");
  assert.equal(inspection.unreferenced, 1);
  assert.equal(readdirSync(`${path}.chunks`).length, before);
  const cleanup = maintainCandidate(path, "quarantine");
  assert.equal(cleanup.moved, 1);
  assert.equal(readdirSync(cleanup.quarantine!).length, 1);
  assert.deepEqual(readCandidateFile(path), input);
  writeFileSync(path, "{truncated");
  assert.throws(() => readCandidateFile(path));
  const recovered = maintainCandidate(path, "recover");
  assert.equal(recovered.filings, second.filings.length);
  assert.deepEqual(readCandidateFile(path), second);
  assert.ok(readdirSync(join(path, "..")).some(f => f.includes(".recovery-")));
  assert.notEqual(readFileSync(path, "utf8"), first);
}));

test("maintenance refuses corruption before moving chunks and respects an existing lock", () => isolated(path => {
  writeCandidateFile(path, archive(251));
  writeCandidateFile(path, archive(252));
  const before = readdirSync(`${path}.chunks`);
  writeFileSync(`${path}.previous`, "{bad");
  assert.throws(() => maintainCandidate(path, "quarantine"));
  assert.deepEqual(readdirSync(`${path}.chunks`), before);
  assert.throws(() => maintainCandidate(path, "recover"));
  assert.equal(readCandidateFile(path).filings.length, 252);
  const lock = join(path, "../form4-runs/.import.lock");
  writeFileSync(lock, "other writer");
  assert.throws(() => maintainCandidate(path, "inspect"), /EEXIST/);
  assert.equal(readFileSync(lock, "utf8"), "other writer");
}));

test("recover refuses a healthy checkpoint unless forced, and quarantine preserves saved recovery generations", () => isolated(path => {
  writeCandidateFile(path, archive(5));
  writeCandidateFile(path, archive(10));
  const before = readFileSync(path, "utf8");
  assert.throws(() => maintainCandidate(path, "recover"), /healthy.*--force/);
  assert.equal(readFileSync(path, "utf8"), before);
  const script = join(import.meta.dirname, "../scripts/maintain-form4-candidate.ts");
  assert.throws(() => execFileSync(process.execPath, ["--experimental-strip-types", script, "recover", path, "--readers-stopped"], {stdio: "pipe"}));
  execFileSync(process.execPath, ["--experimental-strip-types", script, "recover", path, "--readers-stopped", "--force"]);
  assert.equal(readCandidateFile(path).filings.length, 5);
  const recovery = readdirSync(join(path, "..")).find(name => name.startsWith("candidate.json.recovery-"))!;
  const saved = readFileSync(join(path, "..", recovery), "utf8");
  const inspection = maintainCandidate(path, "inspect");
  assert.equal(inspection.filings, 5);
  assert.equal(inspection.recoveryManifests, 1);
  assert.equal(maintainCandidate(path, "quarantine").moved, 0);
  // A saved checkpoint resolves chunks using the original archive basename.
  writeFileSync(path, saved);
  assert.equal(readCandidateFile(path).filings.length, 10);
}));

test("quarantine ignores damaged recovery evidence but refuses missing chunks of a valid saved manifest", () => isolated(path => {
  writeCandidateFile(path, archive(5));
  writeCandidateFile(path, archive(10));
  const saved = JSON.parse(readFileSync(path, "utf8"));
  writeFileSync(`${path}.recovery-damaged`, "{truncated");
  assert.equal(maintainCandidate(path, "inspect").recoveryManifests, 0);
  saved.chunks[0].sha256 = "a".repeat(64);
  writeFileSync(`${path}.recovery-valid-shape`, JSON.stringify(saved));
  const before = readdirSync(`${path}.chunks`);
  assert.throws(() => maintainCandidate(path, "quarantine"), /ENOENT/);
  assert.deepEqual(readdirSync(`${path}.chunks`), before);
}));
