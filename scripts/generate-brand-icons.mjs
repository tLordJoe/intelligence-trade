// Deterministic raster exports of the approved SVG, using Next's bundled sharp.
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

const source = await readFile(new URL("../public/brand/outfox-tail.svg", import.meta.url));
async function icon(size) {
  const padding = Math.round(size * 0.12);
  const logo = await sharp(source).resize(size - padding * 2, size - padding * 2, { fit: "contain", background: "#f7f4ef" }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: "#f7f4ef" } })
    .composite([{ input: logo, gravity: "centre" }]).png().toBuffer();
}

await writeFile(new URL("../src/app/apple-icon.png", import.meta.url), await icon(180));
await writeFile(new URL("../src/app/icon.png", import.meta.url), await icon(512));
const sizes = [16, 32, 48, 256];
const images = await Promise.all(sizes.map(icon));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((png, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index] % 256;
  header[entry + 1] = sizes[index] % 256;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(new URL("../src/app/favicon.ico", import.meta.url), Buffer.concat([header, ...images]));
