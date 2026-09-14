import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

test("branded raster icons have the required dimensions", () => {
  for (const [file, size] of [["icon.png", 512], ["apple-icon.png", 180]] as const) {
    const png = readFileSync(new URL(`../src/app/${file}`, import.meta.url));
    assert.deepEqual(png.subarray(0, 8), pngSignature);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});

test("favicon contains four valid PNG icons, including small browser sizes", () => {
  const ico = readFileSync(new URL("../src/app/favicon.ico", import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 4);
  for (const [index, size] of [16, 32, 48, 256].entries()) {
    const entry = 6 + index * 16;
    assert.equal(ico[entry] || 256, size);
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const png = ico.subarray(offset, offset + length);
    assert.equal(png.length, length);
    assert.deepEqual(png.subarray(0, 8), pngSignature);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});
