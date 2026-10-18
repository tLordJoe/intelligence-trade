import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

/** The public dataset stays compressed on disk, never as a giant JS module.
 * The small JSON pointer binds its immutable data file to a content hash. */
export function readDisclosureRelease(path: string): unknown {
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (value?.storage !== "gzip-v1") return value; // Older reviewed releases.
  if (!/^[a-f0-9]{64}\.json\.gz$/.test(value.file) || value.file !== `${value.sha256}.json.gz`) throw new Error("Invalid published dataset path");
  const bytes = readFileSync(join(dirname(path), "published-data", value.file));
  if (createHash("sha256").update(bytes).digest("hex") !== value.sha256) throw new Error("Published dataset hash mismatch");
  return JSON.parse(gunzipSync(bytes, { maxOutputLength: 512 * 1024 * 1024 }).toString("utf8"));
}
export function writeDisclosureRelease(path: string, release: unknown) {
  const bytes = gzipSync(JSON.stringify(release), { level: 9 });
  const sha256 = createHash("sha256").update(bytes).digest("hex"), file = `${sha256}.json.gz`;
  // Caller creates the release directory. Data is content-addressed and
  // installed before the pointer; existing generations are not deleted here.
  const target = join(dirname(path), "published-data", file);
  writeFileSync(target, bytes);
  writeFileSync(`${path}.next`, JSON.stringify({ storage: "gzip-v1", file, sha256 }, null, 2) + "\n", { flag: "wx" });
  renameSync(`${path}.next`, path);
  return { file, sha256, compressedBytes: bytes.length };
}
