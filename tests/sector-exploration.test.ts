import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HOME_SECTORS } from "../src/lib/home-sectors.ts";
import { sectorFunds } from "../src/lib/sector-funds.ts";
import { layers } from "../src/lib/data.ts";
import { MARKET_CAPS, STACK_GRADIENTS, stackWidth } from "../src/lib/stack-presentation.ts";

test("every sector has two separate sourced ETF examples; unknown sectors fail closed", () => {
  const seen = new Set<string>();
  for (const sector of HOME_SECTORS) {
    const funds = sectorFunds(sector.id);
    assert.equal(funds.length, 2);
    assert.notEqual(funds[0].provider, funds[1].provider);
    for (const fund of funds) {
      assert.ok(!seen.has(fund.ticker)); seen.add(fund.ticker);
      assert.ok(["www.ssga.com", "www.vanguard.com", "investor.vanguard.com", "www.sec.gov"].includes(new URL(fund.source).hostname));
      assert.ok(!("holdings" in fund) && !("return" in fund) && !("rank" in fund));
    }
  }
  assert.deepEqual(sectorFunds("not-a-sector"), []);
  assert.deepEqual(sectorFunds("healthcare").map(f => f.ticker), ["XLV", "VHT"]);
});
test("miniature and Explore share colors and width measurements for all ten layers", () => {
  assert.equal(layers.length, 10);
  for (const layer of layers) {
    assert.ok(MARKET_CAPS[layer.slug] > 0);
    assert.ok(STACK_GRADIENTS[layer.slug].startsWith("linear-gradient"));
    assert.ok(stackWidth(layer.slug) >= 40 && stackWidth(layer.slug) <= 100);
  }
  for (const name of ["StackVisualization", "BuildoutStackIcon"]) {
    assert.match(readFileSync(new URL(`../src/components/${name}.tsx`, import.meta.url), "utf8"), /@\/lib\/stack-presentation/);
  }
});
test("sector route validates slugs and does not import demonstration comparisons", () => {
  const page = readFileSync(new URL("../src/app/sectors/[sector]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(!active\) notFound\(\)/);
  assert.doesNotMatch(page, /funds\/data|funds\/fixtures|funds\/providers/);
  assert.match(page, /not a complete sector list or a verified holdings list/);
  const home = readFileSync(new URL("../src/components/HomeSectorExplorer.tsx", import.meta.url), "utf8");
  assert.match(home, /\/sectors\/\$\{active.id\}/);
});
