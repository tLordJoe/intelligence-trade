/** Reading and writing the catalog and the resumable import state. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { Catalog, CatalogEntry } from "../../src/lib/image-library/types.ts";

export const ROOT = resolve(import.meta.dirname, "../..");
export const CATALOG_PATH = resolve(ROOT, "src/lib/image-library/catalog.json");
export const STATE_PATH = resolve(ROOT, "data/image-library/import-state.json");
export const PUBLIC_DIR = resolve(ROOT, "public");

export interface ImportState {
  /** identity -> last attempt outcome, so a rerun skips what it has settled. */
  attempts: Record<string, { at: string; outcome: string; note?: string }>;
  /** sha256 -> public path, so identical bytes are stored once. */
  hashes: Record<string, string>;
  runs: Array<{ startedAt: string; universe: string; processed: number; note?: string }>;
}

export function readCatalog(): Catalog {
  if (!existsSync(CATALOG_PATH)) return { schemaVersion: 1, generatedAt: "", universes: {}, entries: [] };
  return JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as Catalog;
}

export function writeCatalog(catalog: Catalog): void {
  catalog.entries.sort((a, b) => a.identity.localeCompare(b.identity));
  catalog.generatedAt = new Date().toISOString();
  writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 1)}\n`, "utf8");
}

export function readState(): ImportState {
  if (!existsSync(STATE_PATH)) return { attempts: {}, hashes: {}, runs: [] };
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as ImportState;
}

export function writeState(state: ImportState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 1)}\n`, "utf8");
}

export function upsert(catalog: Catalog, entry: CatalogEntry): void {
  const i = catalog.entries.findIndex((e) => e.identity === entry.identity);
  if (i === -1) catalog.entries.push(entry); else catalog.entries[i] = entry;
}

export function writePublicFile(relativePath: string, bytes: Buffer): string {
  const full = resolve(PUBLIC_DIR, relativePath.replace(/^\//, ""));
  if (!full.startsWith(PUBLIC_DIR)) throw new Error(`Refusing to write outside public/: ${relativePath}`);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, bytes);
  return `/${relativePath.replace(/^\//, "")}`;
}

export function publicFileExists(relativePath: string): boolean {
  return existsSync(resolve(PUBLIC_DIR, relativePath.replace(/^\//, "")));
}

export function readPublicFile(relativePath: string): Buffer {
  return readFileSync(resolve(PUBLIC_DIR, relativePath.replace(/^\//, "")));
}
