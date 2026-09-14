/**
 * The catalog carries provenance for hundreds of identities. It belongs on the
 * server; a client component that imports the lookup would ship it to every
 * visitor. These read the sources for that mistake.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const clientFiles = readdirSync(join(ROOT, "src/components")).filter((f) => f.endsWith(".tsx"))
  .map((f) => join("src/components", f))
  .filter((f) => readFileSync(join(ROOT, f), "utf8").startsWith('"use client"'));

test("no client component imports the image library, company-marks, or the catalog", () => {
  for (const file of clientFiles) {
    const text = readFileSync(join(ROOT, file), "utf8");
    assert.ok(!/from ["']@\/lib\/image-library|from ["']@\/lib\/company-marks|catalog\.json/.test(text), `${file} imports server-only image resolution`);
  }
});

test("CompanyMark takes a resolved src and never a CIK", () => {
  const text = readFileSync(join(ROOT, "src/components/CompanyMark.tsx"), "utf8");
  assert.ok(text.includes("src?: string | null"));
  assert.ok(!/cik/i.test(text));
  assert.ok(text.includes('className="home-ticker-tile"'), "the fallback tile markup is unchanged");
});

test("consumers pass server-resolved paths instead of looking images up themselves", () => {
  for (const file of ["src/components/HomeTradingTable.tsx", "src/components/HomeSectorExplorer.tsx"]) {
    const text = readFileSync(join(ROOT, file), "utf8");
    assert.ok(!text.includes("HOME_FILER_IMAGES"), `${file} still reads the static portrait map`);
    assert.ok(!/<CompanyMark[^>]*cik=/.test(text), `${file} still passes a CIK to CompanyMark`);
  }
});
