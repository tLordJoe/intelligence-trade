import test from "node:test";
import assert from "node:assert/strict";
import { EvidenceSnapshotCache } from "../src/lib/form4/evidence-cache.ts";

test("repeated archived snapshots share one parsed object without trusting file paths", () => {
  const cache = new EvidenceSnapshotCache<{ ciks: string[] }>();
  let parses = 0;
  const results = Array.from({ length: 1000 }, () => cache.read([
    { context: "universe", bytes: Buffer.from("identical archived bytes") },
  ], () => { parses++; return { ciks: ["0001045810"] }; }));
  assert.equal(parses, 1);
  assert.ok(results.every(result => result === results[0]));
  const changed = cache.read([{ context: "universe", bytes: Buffer.from("modified bytes") }], () => {
    parses++; return { ciks: ["0000789019"] };
  });
  assert.equal(parses, 2);
  assert.notEqual(changed, results[0]);
});

test("index cache identity binds ordered bytes, date/URL context, missing files and universe", () => {
  const cache = new EvidenceSnapshotCache<number>();
  let parses = 0;
  const read = (context: string, bytes: Buffer | null, universe = "A") => cache.read([
    { context: universe, bytes: null }, { context, bytes },
  ], () => ++parses);
  assert.equal(read("2026-01-01", Buffer.from("index")), 1);
  assert.equal(read("2026-01-01", Buffer.from("index")), 1);
  assert.equal(read("2026-01-02", Buffer.from("index")), 2);
  assert.equal(read("2026-01-01", Buffer.from("index"), "B"), 3);
  assert.equal(read("2026-01-01", null), 4);
  assert.equal(read("2026-01-01", Buffer.from("")), 5);
  assert.equal(read("2026-01-01", Buffer.from("changed")), 6);
});

test("failed evidence validation is never cached", () => {
  const cache = new EvidenceSnapshotCache<number>();
  const parts = [{ context: "invalid archive", bytes: Buffer.from("bad") }];
  let attempts = 0;
  for (let index = 0; index < 2; index++) assert.throws(() => cache.read(parts, () => {
    attempts++; throw new Error("invalid source");
  }), /invalid source/);
  assert.equal(attempts, 2);
});
