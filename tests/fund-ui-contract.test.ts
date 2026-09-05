/**
 * Standing guarantees about the comparison interface.
 *
 * These read the component source. That is a blunt instrument and no substitute
 * for driving the page in a browser — which is how the accessibility claims in
 * the pull request were actually established. What it catches is the regression
 * a browser check made once cannot: the keyboard path or the touch sizing being
 * removed six weeks from now, silently, by someone tidying up.
 *
 * Each assertion below corresponds to a defect that has already occurred in
 * this feature or was specifically ruled out for it.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const COMPONENT = readFileSync(join(ROOT, "src/components/compare/FundComparison.tsx"), "utf8");
const PAGE = readFileSync(join(ROOT, "src/app/compare/page.tsx"), "utf8");

// --- keyboard and touch ------------------------------------------------------

test("the chart can be inspected without a pointer", () => {
  // A range input is the keyboard and touch path to the crosshair. Without it,
  // the date readout is reachable only by hovering.
  assert.ok(COMPONENT.includes('type="range"'));
  assert.ok(COMPONENT.includes('aria-label="Inspect a date on the chart"'));
});

test("the inspection readout is announced when it changes", () => {
  assert.ok(/role="status"[\s\S]{0,80}aria-live="polite"/.test(COMPONENT));
});

test("touch targets carry an explicit minimum", () => {
  // The remove control measured 22×16px on a 375px viewport before this.
  const minimums = COMPONENT.match(/minHeight: 44/g) ?? [];
  assert.ok(minimums.length >= 6, `expected several 44px minimums, found ${minimums.length}`);
  assert.ok(COMPONENT.includes("minWidth: 44"));
});

test("the chart accepts pointer input from touch as well as mouse", () => {
  assert.ok(COMPONENT.includes("onPointerDown"));
  assert.ok(COMPONENT.includes("onPointerMove"));
  // Without this the browser scrolls the page instead of tracking the finger.
  assert.ok(COMPONENT.includes("touch-none"));
});

test("the chart carries a text alternative that points at the table", () => {
  assert.ok(COMPONENT.includes('role="img"'));
  assert.ok(COMPONENT.includes("aria-label="));
  assert.ok(COMPONENT.includes("comparison table"));
});

// --- colour ------------------------------------------------------------------

test("colours come from the shared assignment, never from a list index", () => {
  assert.ok(COMPONENT.includes("COLORS.colorFor"));
  // The original defect: SERIES_COLORS[i % SERIES_COLORS.length].
  assert.ok(!/SERIES_COLORS\s*\[/.test(COMPONENT));
  assert.ok(!/colorIndex/.test(COMPONENT));
});

// --- alignment ---------------------------------------------------------------

test("the chart draws from the aligned frame, in runs, so gaps stay gaps", () => {
  assert.ok(COMPONENT.includes("contiguousRuns"));
  assert.ok(COMPONENT.includes("AlignedFrame"));
});

// --- labelling ---------------------------------------------------------------

test("the demonstration label is rendered, not merely stored", () => {
  assert.ok(COMPONENT.includes("Demonstration data — not actual market performance."));
  assert.ok(COMPONENT.includes("DemonstrationBanner"));
});

test("nothing on the page calls a price change growth or total return", () => {
  const text = COMPONENT.toLowerCase();
  for (const banned of ["investment growth", "your return", "you would have earned$", "total return of"]) {
    assert.ok(!text.includes(banned), `component must not say "${banned}"`);
  }
});

test("the product is not named Outfox Academy", () => {
  assert.ok(!COMPONENT.includes("Outfox Academy"));
  assert.ok(!PAGE.includes("Outfox Academy"));
});

test("the page is named a preview", () => {
  assert.ok(PAGE.includes("Fund comparison preview"));
});

// --- the gate ----------------------------------------------------------------

test("the page evaluates the access gate on the server before rendering anything", () => {
  assert.ok(PAGE.includes("previewAccessFromEnv"));
  // From `access.ts`, which carries no data — see the note in that file.
  assert.ok(PAGE.includes('from "@/lib/funds/access"'));
  // The refusal must return early, so nothing below it is reached at all.
  assert.ok(/if \(!access\.allowed\)/.test(PAGE));
});

test("the comparison is imported inside the allowed branch, not at module scope", () => {
  // A static import ships the component and the whole fixture in the page's
  // client bundle whether or not the gate lets it render.
  assert.ok(
    !/^import .*compare\/FundComparison/m.test(PAGE),
    "FundComparison must not be statically imported by the page"
  );
  assert.ok(/await import\(.@\/components\/compare\/FundComparison.\)/.test(PAGE));
});

test("the preview is kept out of search results while it runs on generated data", () => {
  assert.ok(/robots:\s*\{\s*index:\s*false/.test(PAGE));
});
