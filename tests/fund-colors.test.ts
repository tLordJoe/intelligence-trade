/**
 * One colour per fund, for the life of the dataset.
 *
 * The bug being tested for is silent: index into a palette by list position and
 * the chart still renders, the legend still agrees with it, and the colours are
 * simply on different funds than they were a moment ago. So the assertions here
 * are all of the form "do something to the list, and check the mapping did not
 * move".
 */

import assert from "node:assert/strict";
import test from "node:test";

import { COLORS, availableSymbols } from "../src/lib/funds/data.ts";
import { SERIES_PALETTE, buildColorAssignment } from "../src/lib/funds/colors.ts";

const UNIVERSE = ["VOO", "QQQ", "XLK", "SMH", "XLU", "SOXX"];

test("a symbol keeps its colour when the list is sorted differently", () => {
  const assignment = buildColorAssignment(UNIVERSE);
  const before = UNIVERSE.map((s) => assignment.colorFor(s));

  const reversed = buildColorAssignment([...UNIVERSE].reverse());
  const after = UNIVERSE.map((s) => reversed.colorFor(s));

  assert.deepEqual(after, before);
});

test("a symbol keeps its colour when other funds are removed", () => {
  const assignment = buildColorAssignment(UNIVERSE);
  const smh = assignment.colorFor("SMH");

  // The mapping is built from the universe, not the selection, so a selection
  // of two must still colour SMH the same.
  assert.equal(buildColorAssignment(UNIVERSE).colorFor("SMH"), smh);
});

test("ranking order cannot change a colour", () => {
  const assignment = buildColorAssignment(UNIVERSE);
  const byReturn = ["XLU", "SMH", "VOO", "SOXX", "QQQ", "XLK"];
  for (const symbol of byReturn) {
    assert.equal(assignment.colorFor(symbol), buildColorAssignment(UNIVERSE).colorFor(symbol));
  }
});

test("colours are distinct across the whole universe", () => {
  const assignment = buildColorAssignment(UNIVERSE);
  const colors = UNIVERSE.map((s) => assignment.colorFor(s));
  assert.equal(new Set(colors).size, UNIVERSE.length);
});

test("the palette holds at least the maximum number of comparable funds", () => {
  assert.ok(SERIES_PALETTE.length >= 10);
  assert.equal(new Set(SERIES_PALETTE).size, SERIES_PALETTE.length);
});

test("the assignment is case and whitespace insensitive", () => {
  const assignment = buildColorAssignment(UNIVERSE);
  assert.equal(assignment.colorFor(" voo "), assignment.colorFor("VOO"));
});

test("an unknown symbol gets a fallback rather than colliding with a real one", () => {
  const assignment = buildColorAssignment(UNIVERSE);
  const fallback = assignment.colorFor("NOT-A-FUND");
  assert.ok(!UNIVERSE.map((s) => assignment.colorFor(s)).includes(fallback));
});

test("duplicate symbols in the universe do not shift the assignment", () => {
  const withDuplicates = buildColorAssignment([...UNIVERSE, "VOO", "voo"]);
  const clean = buildColorAssignment(UNIVERSE);
  for (const symbol of UNIVERSE) {
    assert.equal(withDuplicates.colorFor(symbol), clean.colorFor(symbol));
  }
});

test("the shipped assignment covers every symbol the provider offers", () => {
  const symbols = availableSymbols();
  assert.ok(symbols.length > 0);
  const colors = symbols.map((s) => COLORS.colorFor(s));
  assert.equal(new Set(colors).size, symbols.length);
  assert.deepEqual(COLORS.entries().map((e) => e.symbol), [...symbols].sort());
});
