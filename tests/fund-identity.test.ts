/**
 * Fund legal identity.
 *
 * The collision this file guards against is real and specific: XLK and XLU are
 * both series of Select Sector SPDR Trust, so they share CIK 1064641. Anything
 * keyed on CIK merges a technology fund with a utilities fund, and the merge is
 * silent — the resulting record looks perfectly well formed.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { FUND_IDENTITIES, fundKey, getLegalIdentity, sharesRegistrant } from "../src/lib/funds/identity.ts";
import { toFundIdentity } from "../src/lib/funds/types.ts";

const SYMBOLS = ["VOO", "QQQ", "XLK", "SMH", "XLU", "SOXX"];

test("every fund in the preview has a legal identity", () => {
  for (const symbol of SYMBOLS) {
    assert.ok(getLegalIdentity(symbol), `${symbol} has no identity`);
  }
});

test("XLK and XLU share a CIK, and are still distinguishable", () => {
  const xlk = getLegalIdentity("XLK");
  const xlu = getLegalIdentity("XLU");
  assert.ok(xlk && xlu);

  assert.equal(xlk.cik, xlu.cik, "the premise of this test is that the CIKs match");
  assert.equal(xlk.cik, 1064641);

  assert.notEqual(xlk.seriesId, xlu.seriesId);
  assert.notEqual(xlk.classId, xlu.classId);
  assert.notEqual(fundKey(xlk), fundKey(xlu));
  assert.equal(sharesRegistrant(xlk, xlu), true);
});

test("the fund key is unique across every fund, where the CIK is not", () => {
  const identities = SYMBOLS.map((s) => getLegalIdentity(s)).filter((i) => i !== null);
  const keys = new Set(identities.map(fundKey));
  const ciks = new Set(identities.map((i) => i.cik));

  assert.equal(keys.size, identities.length);
  assert.ok(ciks.size < identities.length, "at least one CIK must be shared, or this proves nothing");
});

test("series and class identifiers have the EDGAR shape", () => {
  for (const identity of Object.values(FUND_IDENTITIES)) {
    assert.match(identity.seriesId, /^S\d{9}$/, `${identity.symbol} series id`);
    assert.match(identity.classId, /^C\d{9}$/, `${identity.symbol} class id`);
    assert.ok(Number.isInteger(identity.cik) && identity.cik > 0);
  }
});

test("VOO is not described as the whole market", () => {
  const voo = getLegalIdentity("VOO");
  assert.ok(voo);
  const text = `${voo.seriesName} ${voo.exposure}`.toLowerCase();

  assert.ok(!text.includes("whole market"));
  assert.ok(!text.includes("total market"));
  assert.ok(!text.includes("entire market"));
  assert.ok(!text.includes("the whole stock market"));
  assert.ok(text.includes("500"), "the mandate is an index of 500 large companies");
});

test("no fund description claims to cover a whole market", () => {
  for (const identity of Object.values(FUND_IDENTITIES)) {
    const text = identity.exposure.toLowerCase();
    for (const banned of ["whole market", "total market", "entire market", "all stocks"]) {
      assert.ok(!text.includes(banned), `${identity.symbol}: "${banned}"`);
    }
  }
});

test("VOO is recorded as a share class, not as the fund itself", () => {
  const voo = getLegalIdentity("VOO");
  assert.ok(voo);
  assert.equal(voo.seriesName, "Vanguard 500 Index Fund");
  assert.equal(voo.className, "ETF Shares");
  assert.notEqual(voo.seriesName, voo.className);
});

test("official names are current, not the superseded ones", () => {
  // The Select Sector funds are registered as ETFs, not "Funds", and carry the
  // State Street prefix. The earlier draft of this feature had both wrong.
  assert.equal(
    getLegalIdentity("XLK")?.seriesName,
    "State Street Technology Select Sector SPDR ETF"
  );
  assert.equal(
    getLegalIdentity("XLU")?.seriesName,
    "State Street Utilities Select Sector SPDR ETF"
  );
  assert.equal(getLegalIdentity("QQQ")?.seriesName, "Invesco QQQ Trust, Series 1");
});

test("every identity cites where it came from", () => {
  for (const identity of Object.values(FUND_IDENTITIES)) {
    assert.ok(identity.sourceNote.includes("EDGAR"));
    assert.ok(identity.sourceNote.includes("2026-09-05"));
  }
});

test("the display identity takes its name from the registered one", () => {
  const xlk = getLegalIdentity("XLK");
  assert.ok(xlk);
  const identity = toFundIdentity(xlk);
  assert.equal(identity.symbol, "XLK");
  assert.equal(identity.displayName, xlk.seriesName);
});

test("SOXX is present as SMH's semiconductor peer", () => {
  const soxx = getLegalIdentity("SOXX");
  const smh = getLegalIdentity("SMH");
  assert.ok(soxx && smh);
  assert.equal(soxx.grouping, "Industry");
  assert.equal(smh.grouping, "Industry");
  assert.notEqual(soxx.cik, smh.cik);
});
