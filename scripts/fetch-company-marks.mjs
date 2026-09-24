// Run only after reviewing these specific Commons file pages and reuse evidence.
// Deliberately not a general-purpose automatic license clearance service.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const sources = [
  ["MSFT", "Microsoft logo.svg", "Public domain"],
  ["META", "Meta Platforms logo.svg", "Public domain"],
  ["AAPL", "Apple logo black.svg", "Public domain"],
  ["AMD", "AMD Logo.svg", "Public domain"],
  ["AMZN", "Amazon 2024.svg", "Public domain"],
  ["NVDA", "NVIDIA logo.svg", "Apache License 2.0"],
  ["ACN", "Accenture.svg", "Public domain"],
  ["AEP", "AEP logo.svg", "Public domain"],
  ["FITB", "Fifth Third Bank 2023 logo-shieldonly-primary.svg", "Public domain"],
  ["FSLR", "Logo FirstSolar.svg", "Public domain"],
  ["UNH", "UnitedHealth Group logo.svg", "Public domain"],
];
async function download(url) {
  const response = await fetch(url, { headers: { "User-Agent": "OutfoxAssetReview/1.0 (https://outfoxmarkets.com)" } });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
const api = new URL("https://commons.wikimedia.org/w/api.php");
api.search = new URLSearchParams({ action: "query", format: "json", prop: "imageinfo", iiprop: "url|extmetadata", titles: sources.map(([, file]) => `File:${file}`).join("|") });
const pages = Object.values(JSON.parse((await download(api)).toString()).query.pages);
await mkdir(new URL("../public/company-logos/", import.meta.url), { recursive: true });
const manifest = [];
for (const [ticker, file, expectedLicense] of sources) {
  const page = pages.find(p => p.title === `File:${file}`);
  const info = page?.imageinfo?.[0];
  const metadata = info?.extmetadata;
  if (metadata?.LicenseShortName?.value !== expectedLicense || metadata?.Restrictions?.value !== "trademarked") {
    throw new Error(`Source conditions changed for ${ticker}; review again before downloading.`);
  }
  const source = new URL(info.url);
  source.search = "";
  const bytes = await download(source);
  const svg = bytes.toString();
  if (!svg.includes("<svg") || /<(script|foreignObject|image)\b|\bon\w+\s*=|(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/|data:|javascript:)/i.test(svg)) throw new Error(`Unsafe SVG: ${ticker}`);
  const asset = `${ticker.toLowerCase()}.svg`;
  await writeFile(new URL(`../public/company-logos/${asset}`, import.meta.url), bytes);
  manifest.push({ ticker, file: asset, source: source.href, evidence: info.descriptionurl, reviewed: "2026-09-13", downloaded: new Date().toISOString(), license: expectedLicense, restrictions: metadata.Restrictions.value, attributionRequired: metadata.AttributionRequired?.value, sha256: createHash("sha256").update(bytes).digest("hex"), sourceMetadata: metadata });
  console.log(`Saved ${ticker}`);
}
await writeFile(new URL("../docs/company-logo-manifest.json", import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
const license = await download("https://raw.githubusercontent.com/NVIDIA/bionemo-framework/5d4995be85d258ca04e7c31d8b5d83af970850cf/LICENSE/license.txt");
await writeFile(new URL("../public/company-logos/LICENSE-NVIDIA.txt", import.meta.url), license);
