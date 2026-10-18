/** Copies an existing candidate to a new storage location, verifies every filing, never deletes the original. */
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { readCandidateFile, writeCandidateFile } from "../src/lib/form4/candidate-storage.ts";
const args = process.argv.slice(2);
if (args.length !== 2) throw new Error("Usage: migrate-form4-candidate.ts SOURCE DESTINATION (destination must not exist)");
const [source, destination] = args.map(path => resolve(path));
if (!existsSync(source) || existsSync(destination) || existsSync(`${destination}.chunks`)) throw new Error("Source must exist; destination and its chunks must be new");
const locks: string[] = [];
try {
for (const parent of [...new Set([dirname(source), dirname(destination)])].sort()) {
  const directory = resolve(parent, "form4-runs");
  mkdirSync(directory, { recursive: true });
  const lock = resolve(directory, ".import.lock");
  writeFileSync(lock, "candidate migration\n", { flag: "wx" });
  locks.push(lock);
}
if (existsSync(destination) || existsSync(`${destination}.chunks`)) throw new Error("Destination appeared while acquiring locks");
let input = readCandidateFile(source);
const metadata = { count: input.filings.length, runIds: input.runIds, updatedAt: input.updatedAt };
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const expected = new Map(input.filings.map(f => [f.accessionNumber + "::" + f.documentSha256, digest(f)]));
writeCandidateFile(destination, input);
input = { schemaVersion: 1, updatedAt: "", runIds: [], filings: [] };
const output = readCandidateFile(destination);
if (output.filings.length !== metadata.count || JSON.stringify(output.runIds) !== JSON.stringify(metadata.runIds) || output.updatedAt !== metadata.updatedAt ||
    output.filings.some(f => digest(f) !== expected.get(f.accessionNumber + "::" + f.documentSha256))) throw new Error("Migration round-trip failed; original remains unchanged");
console.log(JSON.stringify({ verified: true, filings: metadata.count, runs: metadata.runIds.length, sourcePreserved: true, destination }));
} finally {
  for (const lock of locks.reverse()) rmSync(lock, { force: true });
}
