import { createHash } from "node:crypto";

/** Scoped to one audit. Retains parsed values, never the archived byte buffers. */
export class EvidenceSnapshotCache<T> {
  private readonly values = new Map<string, T>();

  read(parts: readonly { context: string; bytes: Uint8Array | null }[], parse: () => T): T {
    // Hash fresh bytes on every call. Paths alone would miss modified evidence;
    // context also binds identical bytes to their date, URL, and issuer universe.
    const key = createHash("sha256").update(JSON.stringify(parts.map(part => [
      part.context,
      part.bytes === null ? null : createHash("sha256").update(part.bytes).digest("hex"),
    ]))).digest("hex");
    if (this.values.has(key)) return this.values.get(key)!;
    const value = parse();
    this.values.set(key, value);
    return value;
  }
}
