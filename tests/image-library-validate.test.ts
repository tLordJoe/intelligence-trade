/**
 * Image validation: what may be written under public/.
 *
 * Every case is a file that would have been served as-is by a naive importer.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";

import { InvalidImage, LIMITS, formatFromContentType, sanitizeSvg, validateImage } from "../scripts/image-library/validate.ts";

const svg = (inner: string, attrs = "") => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" ${attrs}>${inner}</svg>`);

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
  const { bytes } = sanitizeSvg(svg(`<use xlink:href="https://evil.example/x.svg#a"/>`));
  assert.ok(!/https:\/\/evil|javascript:/i.test(bytes.toString()));
  assert.throws(() => sanitizeSvg(svg(`<image href="https://evil.example/tracker.png"/>`)), InvalidImage);
  assert.throws(() => sanitizeSvg(svg(`<style>rect{fill:url(https://evil.example/f)}</style>`)), InvalidImage);
});

test("XML namespaces and encoded references cannot bypass validation", () => {
  for (const inner of [
    '<s:script xmlns:s="http://www.w3.org/2000/svg">document.title="test"</s:script>',
    '<image href="&#104;ttps://example.com/image.png"/>',
    '<use href="../outside.svg#logo"/>',
    '<image href="/tracking.png"/>',
    '<use href="&#106;avascript:noop()"/>',
    '<h:script xmlns:h="http://www.w3.org/1999/xhtml"/>',
    '<g xml:base="https://example.com/"><use href="#shape"/></g>',
    '<style>rect{fill:u\\72l(https://example.com/)}</style>',
    '<style>@import "https://example.com/x.css";</style>',
    '<style>rect{background:image-set("/tracking.png" 1x)}</style>',
    '<path fill="u\\72l(https://example.com/paint)"/>',
    '<g><path></g>',
  ]) assert.throws(() => sanitizeSvg(svg(inner)), InvalidImage, inner);
});

test("safe SVG local references retain their exact bytes", () => {
  const input = svg('<defs><linearGradient id="paint"><stop offset="0" stop-color="#fff"/></linearGradient></defs><path id="shape" fill="url(#paint)" d="M0 0h1v1z"/><use xlink:href="#shape"/>');
  assert.deepEqual(sanitizeSvg(input).bytes, input);
});

test("every committed company/sponsor SVG passes the structural policy unchanged", () => {
  const dir = new URL("../public/company-logos/", import.meta.url);
  for (const name of readdirSync(dir).filter(name => name.endsWith(".svg"))) {
    const bytes = readFileSync(new URL(name, dir));
    assert.deepEqual(validateImage(bytes, "svg").bytes, bytes, `${name}: validation changed reviewed bytes`);
  }
});

test("entity declarations are refused outright", () => {
  assert.throws(() => sanitizeSvg(Buffer.from(`<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg"/>`)), InvalidImage);
  assert.throws(() => sanitizeSvg(Buffer.from(`<!DOCTYPE svg SYSTEM "https://example.com/unknown.dtd"><svg xmlns="http://www.w3.org/2000/svg"/>`)), InvalidImage);
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
