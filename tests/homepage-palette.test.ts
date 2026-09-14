import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/homepage.css", import.meta.url), "utf8");
const globals = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})/gi)].map(m => [m[1], m[2]]));
}
function luminance(hex: string) {
  const c = hex.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
test("homepage blue hierarchy remains readable on page and panel surfaces in both themes", () => {
  const light = tokens(css.match(/^\.home-shell\s*\{([^}]+)\}/m)![1]);
  const dark = tokens(css.match(/\.dark \.home-shell\s*\{([^}]+)\}/)![1]);
  const page = globals.match(/--bg:\s*(#[\da-f]{6})/i)![1];
  const darkPage = tokens(globals.match(/\.dark\s*\{([^}]+)\}/)![1])["--bg"];
  assert.notEqual(light["--bg-card"], page, "panels must not disappear into the page");
  assert.notEqual(light["--text"], light["--text-dim"], "supporting text needs its own blue");
  assert.notEqual(light["--home-heading"], light["--home-hero-ink"]);
  for (const [palette, background] of [[light, page], [dark, darkPage]] as const) {
    for (const key of ["--text", "--text-dim", "--home-heading", "--home-hero-ink"]) {
      for (const surface of [background, palette["--bg-card"]]) {
        assert.ok(contrast(palette[key], surface) >= 4.5, `${key} on ${surface} must meet normal-text contrast`);
      }
    }
  }
});
test("homepage tables retain column dividers with a mobile card override", () => {
  assert.match(css, /td:not\(:last-child\).*border-right:1px/);
  assert.match(css, /td:not\(:last-child\).*border-right:0/);
  assert.match(css, /button:disabled[^}]+opacity:1/);
});
