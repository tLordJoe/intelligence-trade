/** Offline scan-to-text evidence. Never converts OCR into approved transactions. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const runId = process.argv[2];
if (!/^senate_[A-Za-z0-9_-]+$/.test(runId ?? "")) throw Error("Supply a Senate run identity");
if (!process.env.OUTFOX_OCR_MODULE || !process.env.OUTFOX_OCR_LANGUAGE_DIR) throw Error("Configure installed OCR module and local language cache");
const directory = path.join(root, "data/senate-runs", runId);
const manifests = fs.readdirSync(directory).filter(f => /^[0-9a-f-]{36}\.paper\.json$/.test(f));
if (!manifests.length) throw Error("No archived paper reports in this run");
const output = path.join(directory, "ocr-review"); fs.mkdirSync(output, { recursive: true });
const { createWorker } = require(process.env.OUTFOX_OCR_MODULE);
const worker = await createWorker("eng", 1, { langPath: process.env.OUTFOX_OCR_LANGUAGE_DIR, gzip: false,
  cachePath: output, cacheMethod: "none" });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const completed = [];
try {
  for (const filename of manifests) {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, filename), "utf8"));
    if (manifest.runId !== runId || !manifest.pages?.length) throw Error("Paper manifest does not match the run");
    for (const page of manifest.pages) {
      const image = path.resolve(directory, page.path);
      if (!image.startsWith(path.join(directory, "raw") + path.sep)) throw Error("Invalid archived scan path");
      const bytes = fs.readFileSync(image);
      if (sha(bytes) !== page.sha256) throw Error("Archived scan hash mismatch");
      const { data } = await worker.recognize(bytes, {}, { text: true, tsv: true });
      const evidence = { kind: "unreviewed-ocr-not-transactions", runId, reportId: manifest.reference.id,
        page: page.page, totalPages: manifest.pages.length, sourceUrl: page.sourceUrl, sourceSha256: page.sha256,
        confidence: data.confidence, text: data.text, tsv: data.tsv, publicationApproved: false };
      fs.writeFileSync(path.join(output, `${manifest.reference.id}-page${page.page}.json`), JSON.stringify(evidence, null, 2));
      completed.push({ reportId: manifest.reference.id, page: page.page, confidence: data.confidence, characters: data.text.length });
      console.log(`OCR evidence: page ${page.page}/${manifest.pages.length}, ${data.text.length} characters`);
    }
  }
} finally { await worker.terminate(); }
fs.writeFileSync(path.join(output, "index.json"), JSON.stringify({ kind: "unreviewed-ocr-not-transactions", runId,
  reports: manifests.length, pages: completed, promotedTransactions: 0 }, null, 2));
console.log(JSON.stringify({ reports: manifests.length, pages: completed.length, promotedTransactions: 0 }));
