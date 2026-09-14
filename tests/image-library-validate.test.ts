/**
 * Image validation: what may be written under public/.
 *
 * Every case is a file that would have been served as-is by a naive importer.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { InvalidImage, LIMITS, formatFromContentType, sanitizeSvg, validateImage } from "../scripts/image-library/validate.ts";

const svg = (inner: string, attrs = "") => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${attrs}>${inner}</svg>`);

test("a plain SVG passes unchanged and reports its dimensions", () => {
  const v = validateImage(svg(`<path d="M0 0h24v24H0z"/>`, `width="48" height="24"`), "svg");
  assert.equal(v.format, "svg"); assert.equal(v.width, 48); assert.equal(v.height, 24); assert.deepEqual(v.removed, []);
});

test("script, foreignObject and event handlers are stripped and reported", () => {
  const { bytes, removed } = sanitizeSvg(svg(`<script>alert(1)</script><foreignObject><div>x</div></foreignObject><rect onclick="steal()" width="1" height="1"/>`));
  const text = bytes.toString();
  assert.ok(!/<script|<foreignObject|onclick/i.test(text));
  assert.deepEqual(removed, ["active elements", "event handlers"]);
});

test("external and data references are removed; an embedded external image is refused", () => {
  const { bytes } = sanitizeSvg(svg(`<use xlink:href="https://evil.example/x.svg#a"/><a href="javascript:alert(1)">t</a>`));
  assert.ok(!/https:\/\/evil|javascript:/i.test(bytes.toString()));
  assert.throws(() => sanitizeSvg(svg(`<image href="https://evil.example/tracker.png"/>`)), InvalidImage);
  assert.throws(() => sanitizeSvg(svg(`<style>rect{fill:url(https://evil.example/f)}</style>`)), InvalidImage);
});

test("entity declarations are refused outright", () => {
  assert.throws(() => sanitizeSvg(Buffer.from(`<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg"/>`)), InvalidImage);
});

test("a file that only claims to be an image is refused", () => {
  assert.throws(() => validateImage(Buffer.from("<html><body>logo</body></html>"), "svg"), InvalidImage);
  assert.throws(() => validateImage(Buffer.from("not a jpeg at all"), "jpg"), InvalidImage);
  assert.throws(() => validateImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), "png"), InvalidImage);
});

test("a truncated JPEG is a corrupt file, not an image", () => {
  // SOI then an APP0 segment that promises more bytes than exist.
  assert.throws(() => validateImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]), "jpg"), InvalidImage);
});

test("a minimal valid JPEG frame header yields dimensions", () => {
  const b = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x13, 0x00, 0xe1, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]);
  const v = validateImage(b, "jpg");
  assert.equal(v.width, 225); assert.equal(v.height, 275);
});

test("size limits are enforced before parsing", () => {
  assert.throws(() => validateImage(Buffer.alloc(LIMITS.svgBytes + 1, 0x20), "svg"), /exceeds/);
  assert.throws(() => validateImage(Buffer.alloc(LIMITS.rasterBytes + 1), "jpg"), /exceeds/);
});

test("format is taken from content type first, then extension, never guessed", () => {
  assert.equal(formatFromContentType("image/svg+xml; charset=utf-8", "x"), "svg");
  assert.equal(formatFromContentType("application/octet-stream", "https://h/a.png?x=1"), "png");
  assert.equal(formatFromContentType("text/html", "https://h/a"), null);
});
