/**
 * File validation for imported images.
 *
 * An image is data from a third party. Before it is written under `public/`
 * it has to be what it claims to be (magic bytes, not extension), within the
 * size the site is willing to serve, and — for SVG — free of anything that
 * executes, loads, or reaches out. Sanitisation here removes rather than
 * rejects where the removal is safe, and rejects where it is not.
 */

import { createHash } from "node:crypto";

export const LIMITS = {
  svgBytes: 256 * 1024,
  rasterBytes: 512 * 1024,
  maxDimension: 2400,
};

export interface ValidatedImage {
  format: "svg" | "jpg" | "png";
  bytes: Buffer;
  sha256: string;
  width?: number;
  height?: number;
  /** What the sanitiser removed, for the log. Empty for raster files. */
  removed: string[];
}

export class InvalidImage extends Error {}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// --- SVG ---------------------------------------------------------------------

const FORBIDDEN_ELEMENTS = /<\s*(script|foreignObject|iframe|object|embed|audio|video|animate|set|animateTransform|animateMotion)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|foreignObject|iframe|object|embed|audio|video|animate|set|animateTransform|animateMotion)\b[^>]*\/?>/gi;
const EVENT_ATTRS = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const EXTERNAL_REF = /\s+(?:xlink:href|href|src)\s*=\s*("|')(?:\s*(?:https?:|\/\/|data:|javascript:|file:|ftp:))[^"']*\1/gi;
const STYLE_URL = /url\s*\(\s*(?:"|')?\s*(?:https?:|\/\/|data:|javascript:)/i;

export function sanitizeSvg(input: Buffer): { bytes: Buffer; removed: string[] } {
  let text = input.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (!/<svg[\s>]/i.test(text)) throw new InvalidImage("Not an SVG document");
  if (/<!DOCTYPE[^>]*\[|<!ENTITY/i.test(text)) throw new InvalidImage("SVG declares entities");

  const removed: string[] = [];
  const strip = (pattern: RegExp, name: string) => {
    const before = text;
    text = text.replace(pattern, "");
    if (text !== before) removed.push(name);
  };
  // <image> with an external or data source is a network fetch in disguise.
  // Checked before anything is stripped, so the evidence is still there.
  if (/<\s*image\b[^>]*\b(?:xlink:href|href)\s*=\s*["'](?:https?:|\/\/|data:)/i.test(text)) {
    throw new InvalidImage("SVG embeds an external or data image");
  }
  strip(/<\?xml-stylesheet[^>]*\?>/gi, "xml-stylesheet");
  strip(FORBIDDEN_ELEMENTS, "active elements");
  strip(EVENT_ATTRS, "event handlers");
  strip(EXTERNAL_REF, "external references");
  if (STYLE_URL.test(text)) throw new InvalidImage("SVG style references an external URL");
  if (/javascript:/i.test(text)) throw new InvalidImage("SVG still contains javascript:");
  return { bytes: Buffer.from(text, "utf8"), removed };
}

function svgDimensions(text: string): { width?: number; height?: number } {
  const open = text.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  const num = (attr: string) => {
    const m = open.match(new RegExp(`\\s${attr}\\s*=\\s*["']?([0-9.]+)`, "i"));
    return m ? Number(m[1]) : undefined;
  };
  let width = num("width"), height = num("height");
  if ((!width || !height)) {
    const vb = open.match(/viewBox\s*=\s*["']\s*[-0-9.]+[\s,]+[-0-9.]+[\s,]+([0-9.]+)[\s,]+([0-9.]+)/i);
    if (vb) { width ??= Number(vb[1]); height ??= Number(vb[2]); }
  }
  return { width, height };
}

// --- raster ------------------------------------------------------------------

function pngDimensions(b: Buffer): { width: number; height: number } {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) throw new InvalidImage("Not a PNG");
  if (b.toString("ascii", 12, 16) !== "IHDR") throw new InvalidImage("PNG missing IHDR");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function jpegDimensions(b: Buffer): { width: number; height: number } {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw new InvalidImage("Not a JPEG");
  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) throw new InvalidImage("Corrupt JPEG marker stream");
    const marker = b[offset + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { offset += 2; continue; }
    const length = b.readUInt16BE(offset + 2);
    if (length < 2) throw new InvalidImage("Corrupt JPEG segment length");
    const isSof = (marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: b.readUInt16BE(offset + 5), width: b.readUInt16BE(offset + 7) };
    offset += 2 + length;
  }
  throw new InvalidImage("JPEG has no frame header");
}

// --- entry point -------------------------------------------------------------

export function validateImage(bytes: Buffer, expected: "svg" | "jpg" | "png"): ValidatedImage {
  if (expected === "svg") {
    if (bytes.length > LIMITS.svgBytes) throw new InvalidImage(`SVG exceeds ${LIMITS.svgBytes} bytes`);
    const { bytes: clean, removed } = sanitizeSvg(bytes);
    const { width, height } = svgDimensions(clean.toString("utf8"));
    return { format: "svg", bytes: clean, sha256: sha256(clean), width, height, removed };
  }
  if (bytes.length > LIMITS.rasterBytes) throw new InvalidImage(`Raster exceeds ${LIMITS.rasterBytes} bytes`);
  const dims = expected === "png" ? pngDimensions(bytes) : jpegDimensions(bytes);
  if (dims.width < 1 || dims.height < 1 || dims.width > LIMITS.maxDimension || dims.height > LIMITS.maxDimension) {
    throw new InvalidImage(`Unreasonable dimensions ${dims.width}x${dims.height}`);
  }
  return { format: expected, bytes, sha256: sha256(bytes), ...dims, removed: [] };
}

export function formatFromContentType(contentType: string, url: string): "svg" | "jpg" | "png" | null {
  const ct = contentType.toLowerCase();
  if (ct.includes("svg")) return "svg";
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  const ext = url.toLowerCase().split("?")[0].split(".").pop();
  if (ext === "svg") return "svg";
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  return null;
}
