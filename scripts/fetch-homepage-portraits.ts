/** Explicitly invoked asset download only; never run during build or on a schedule. */
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { HOME_FILER_IMAGES } from "../src/lib/home-filer-images.ts";
const dir = new URL("../public/portraits/", import.meta.url);
await mkdir(dir, { recursive: true });
const manifest = [];
for (const id of new Set(Object.values(HOME_FILER_IMAGES))) {
  if (!/^[A-Z]\d{6}$/.test(id)) throw new Error("Invalid Bioguide ID");
  const source = `https://unitedstates.github.io/images/congress/225x275/${id}.jpg`;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Portrait unavailable for ${id}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes.length > 1_000_000) throw new Error(`Invalid JPEG for ${id}`);
  await writeFile(new URL(`${id}.jpg`, dir), bytes);
  manifest.push({ bioguide: id, source, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
    retrieved: new Date().toISOString(), rightsBasis: "GPO public-domain provenance stated by unitedstates/images; repository CC0; not a warranty of third-party rights" });
}
await writeFile(new URL("../docs/homepage-portrait-manifest.json", import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Downloaded and recorded ${manifest.length} source-keyed portraits.`);
