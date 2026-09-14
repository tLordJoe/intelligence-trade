import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HOME_SECTORS } from "../src/lib/home-sectors.ts";
import { allSectorFunds, findSectorFund } from "../src/lib/sector-funds.ts";
import { resolveTicker } from "../src/lib/security-master.ts";

const source = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("all sector fund destinations resolve to their own dated, sourced profile", () => {
  const funds = allSectorFunds();
  assert.equal(funds.length, 22);
  assert.equal(new Set(funds.map(f => f.ticker)).size, 22);
  for (const fund of funds) {
    assert.deepEqual(findSectorFund(fund.ticker.toLowerCase()), findSectorFund(fund.ticker));
    assert.ok(HOME_SECTORS.some(s => s.id === fund.sectorId));
    assert.ok(fund.name.includes("ETF") && fund.name.length > 15);
    assert.ok(fund.expensePercent > 0 && fund.expensePercent < 1);
    assert.match(fund.expenseAsOf, /^2026-\d{2}-\d{2}$/);
    assert.ok(new URL(fund.expenseSource).protocol === "https:");
  }
  assert.equal(findSectorFund("not-a-fund"), undefined);
  assert.equal(findSectorFund("VNQ")?.expensePercent, 0.13);
  assert.equal(findSectorFund("VHT")?.expensePercent, 0.09);
  assert.equal(findSectorFund("XLV")?.expensePercent, 0.08);
});
test("every featured stock has an SEC-matched company identity", () => {
  const master = JSON.parse(source("data/security-master.json"));
  for (const sector of HOME_SECTORS) for (const ticker of sector.tickers) {
    const match = resolveTicker(ticker, master);
    assert.notEqual(match.resolution, "unknown", ticker);
    assert.ok(match.cik && match.title, ticker);
  }
});
test("sector clicks distinguish stock overviews from ETF profiles", () => {
  const home = source("src/components/HomeSectorExplorer.tsx");
  assert.match(home, /\/stocks\//);
  assert.match(home, /\/etfs\//);
  assert.doesNotMatch(home, /\/congress\?ticker=/);
  for (const path of ["stocks", "etfs"]) {
    const page = source(`src/app/${path}/[ticker]/page.tsx`);
    assert.match(page, /aria-label="Breadcrumb"/);
    assert.match(page, /aria-current="page"/);
    assert.match(page, /Back to/);
    assert.doesNotMatch(page, /funds\/data|demonstrationProvider|fixtures/);
  }
  const etf = source("src/app/etfs/[ticker]/page.tsx");
  assert.match(etf, /unavailable—not zero/);
  assert.match(etf, /not a holdings list/);
});
