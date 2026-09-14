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
import { SaxesParser } from "saxes";

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

const SVG_NS = "http://www.w3.org/2000/svg";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const XML_NS = "http://www.w3.org/XML/1998/namespace";
// Only inert editor/provenance namespaces found in the reviewed source files.
// Never admit HTML, MathML or an arbitrary foreign namespace.
const INERT_NAMESPACES = new Set([
  "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd",
  "http://www.inkscape.org/namespaces/inkscape",
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  "http://creativecommons.org/ns#", "http://purl.org/dc/elements/1.1/",
  "http://ns.adobe.com/Variables/1.0/", "http://ns.adobe.com/SaveForWeb/1.0/",
  "http://ns.adobe.com/AdobeIllustrator/10.0/",
]);
const SVG_ELEMENTS = new Set(`svg g defs title desc metadata path rect circle ellipse line polyline polygon
  linearGradient radialGradient stop clipPath mask pattern marker symbol use image style switch
  filter feGaussianBlur feColorMatrix feOffset feComposite feFlood feBlend feMerge feMergeNode
  text tspan textPath`.split(/\s+/));
const SVG_ATTRIBUTES = new Set(`id class version width height x y x1 x2 y1 y2 d points viewBox
  fill fill-rule fill-opacity stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity
  stroke-dasharray stroke-dashoffset opacity transform style type offset cx cy fx fy r rx ry
  gradientTransform gradientUnits spreadMethod stop-color stop-opacity clipPathUnits clip-path clip-rule
  mask maskUnits maskContentUnits patternUnits patternContentUnits patternTransform preserveAspectRatio
  color color-interpolation color-interpolation-filters filter filterUnits primitiveUnits stdDeviation
  in in2 result dx dy values operator k1 k2 k3 k4 flood-color flood-opacity mode
  markerWidth markerHeight markerUnits refX refY orient font-family font-size font-weight font-style
  font-variant font-stretch font-feature-settings font-specification text-anchor dominant-baseline
  alignment-baseline letter-spacing word-spacing text-decoration writing-mode direction unicode-bidi
  overflow visibility display enable-background paint-order vector-effect shape-rendering text-rendering
  image-rendering color-rendering fill-break href requiredFeatures requiredExtensions systemLanguage
  lengthAdjust textLength startOffset media focusable role key`.split(/\s+/));

function assertSafeCss(raw: string): void {
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  // Reject escapes and at-rules instead of attempting a second CSS grammar.
  if (/[\\@]/.test(css) || /(?:expression|binding|behavior)\s*[:(]/i.test(css)) throw new InvalidImage("Unsupported SVG CSS");
  for (const match of css.matchAll(/([a-z-]+)\s*\(/gi)) {
    if (!/^(?:url|rgb|rgba|hsl|hsla|var)$/.test(match[1].toLowerCase())) throw new InvalidImage("Unsupported SVG CSS function");
  }
  const withoutLocalUrls = css.replace(/url\s*\(\s*(["']?)#[A-Za-z0-9_.:-]+\1\s*\)/gi, "");
  if (/url\s*\(|(?:https?:|data:|javascript:|file:|ftp:)|\/\//i.test(withoutLocalUrls)) throw new InvalidImage("SVG style references an external URL");
}

/** Validate the browser-parsed structure after legacy safe stripping. Namespaces
 * and character references are resolved by XML parsing, not regex matching.
 * Safe input is returned byte-for-byte so reviewed asset hashes do not change. */
function assertSafeSvgStructure(text: string): void {
  const parser = new SaxesParser({ xmlns: true });
  let depth = 0;
  let styleDepth = -1;
  let css = "";
  parser.on("error", error => { throw new InvalidImage(`Malformed SVG: ${error.message}`); });
  parser.on("doctype", value => {
    if (/[\[\]]/.test(value)) throw new InvalidImage("SVG declares entities");
    const declaration = value.trim().replace(/\s+/g, " ");
    const legacyDeclarations = new Set([
      'svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"',
      'svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd"',
      'svg PUBLIC "-//W3C//DTD SVG 20010904//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd"',
    ]);
    // Saxes never resolves DTDs. Keep only these legacy declarations already
    // present in reviewed assets; reject arbitrary external systems/subsets.
    if (!legacyDeclarations.has(declaration)) throw new InvalidImage("Unsupported SVG doctype");
  });
  parser.on("processinginstruction", () => { throw new InvalidImage("SVG processing instruction"); });
  parser.on("opentag", node => {
    if (depth === 0 && (node.uri !== SVG_NS || node.local !== "svg")) throw new InvalidImage("Not an SVG document");
    if (node.uri === SVG_NS) {
      if (!SVG_ELEMENTS.has(node.local)) throw new InvalidImage(`Unsupported SVG element: ${node.local}`);
    } else if (!INERT_NAMESPACES.has(node.uri)) throw new InvalidImage("Unsupported SVG namespace");
    for (const attr of Object.values(node.attributes)) {
      if (attr.uri === XMLNS_NS) continue;
      if (/^on/i.test(attr.local)) throw new InvalidImage("SVG event handler");
      if (attr.uri === XML_NS) {
        if (attr.local !== "space" && attr.local !== "lang") throw new InvalidImage("Unsupported XML attribute");
        continue;
      }
      if (INERT_NAMESPACES.has(attr.uri)) continue;
      if (attr.uri && attr.uri !== XLINK_NS) throw new InvalidImage("Unsupported SVG attribute namespace");
      if (attr.uri === XLINK_NS || attr.local === "href" || attr.local === "src") {
        if (attr.local !== "href" || !/^#[A-Za-z0-9_.:-]+$/.test(attr.value)) throw new InvalidImage("SVG nonlocal reference");
        continue;
      }
      if (node.uri === SVG_NS && !SVG_ATTRIBUTES.has(attr.local) && !/^(?:data-|aria-)/.test(attr.local)) {
        throw new InvalidImage(`Unsupported SVG attribute: ${attr.local}`);
      }
      if (["style", "fill", "stroke", "filter", "mask", "clip-path"].includes(attr.local) || /url\s*\(/i.test(attr.value)) assertSafeCss(attr.value);
    }
    depth += 1;
    if (node.uri === SVG_NS && node.local === "style") { styleDepth = depth; css = ""; }
  });
  parser.on("text", value => { if (styleDepth !== -1) css += value; });
  parser.on("cdata", value => { if (styleDepth !== -1) css += value; });
  parser.on("closetag", () => {
    if (depth === styleDepth) { assertSafeCss(css); styleDepth = -1; }
    depth -= 1;
  });
  parser.write(text).close();
}

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
  assertSafeSvgStructure(text);
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
