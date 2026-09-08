import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { verifyCompareRender } from "../scripts/verify-compare-render.ts";

const robots = '<meta name="robots" content="noindex, nofollow"/>';
const values = "100,101.123,102.456,99.789,103.321";

function sandbox(run: (root: string, write: (path: string, text: string) => void) => void) {
  const root = mkdtempSync(join(tmpdir(), "outfox-render-check-"));
  const write = (path: string, text: string) => {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  };
  try {
    write("src/lib/funds/fixtures/demo-price-series.json", JSON.stringify({
      disclaimer: "Invented demonstration only", series: { VOO: { values: values.split(",").map(Number) } },
    }));
    write(".next/server/app/compare.html", robots + "Not available here");
    write(".next/server/app/compare.rsc", "refused render");
    run(root, write);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("production checker accepts refusal without data", () => sandbox((root) => {
  assert.equal(verifyCompareRender(root, "production"), 2);
}));

for (const path of ["compare.html", "compare.rsc", "compare.segments/compare/__PAGE__.segment.rsc"]) {
  test(`production checker catches data in ${path} even with a refusal page`, () => sandbox((root, write) => {
    write(`.next/server/app/${path}`, robots + 'Not available here \\"values\\":[' + values + "]");
    assert.throws(() => verifyCompareRender(root, "production"), /leaked/);
  }));
}

test("production checker rejects an accidentally enabled preview build", () => sandbox((root, write) => {
  write(".next/server/app/compare.html", robots + "Comparison preview");
  assert.throws(() => verifyCompareRender(root, "production"), /refusal/);
}));

test("checker fails closed on absent rendered output", () => sandbox((root) => {
  rmSync(join(root, ".next/server/app/compare.rsc"));
  assert.throws(() => verifyCompareRender(root, "production"), /ENOENT/);
}));

test("preview checker requires real fixture markers, not merely a route", () => sandbox((root, write) => {
  write(".next/server/app/compare.html", robots + "Comparison preview");
  write(".next/server/app/compare.rsc", "outfox-demonstration-v1");
  assert.throws(() => verifyCompareRender(root, "preview"), /missing demonstration series/);
  write(".next/server/app/compare.rsc", "outfox-demonstration-v1 " + values);
  assert.equal(verifyCompareRender(root, "preview"), 2);
}));

test("both environments must remain excluded from search", () => sandbox((root, write) => {
  write(".next/server/app/compare.html", "Not available here");
  assert.throws(() => verifyCompareRender(root, "production"), /noindex/);
}));
