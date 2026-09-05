/**
 * A deliberately small, safe XML reader for SEC ownership documents.
 *
 * Purpose-built rather than a general XML library because the contract's
 * security requirements *are* the specification: no external entity or DTD
 * resolution of any kind, and hard bounds on input size and nesting depth. A
 * general parser would have to be configured into this shape and then verified;
 * here the unsafe paths do not exist to begin with.
 *
 * It understands exactly what ownership documents contain: elements, attributes,
 * text, comments, CDATA, and the XML declaration. Anything else — a doctype, an
 * entity declaration, a processing instruction — is refused rather than skipped,
 * because a document containing constructs we do not model is a document we
 * cannot claim to have read.
 */

export type XmlErrorCode =
  | "doctype_forbidden"
  | "entity_forbidden"
  | "processing_instruction_forbidden"
  | "too_large"
  | "too_deep"
  | "malformed"
  | "unexpected_entity"
  | "multiple_roots"
  | "content_outside_root"
  | "malformed_attributes"
  | "invalid_character_reference";

export class XmlError extends Error {
  // Written longhand rather than as a constructor parameter property: the test
  // runner strips types without transforming, and parameter properties are not
  // supported in that mode.
  code: XmlErrorCode;

  constructor(message: string, code: XmlErrorCode) {
    super(message);
    this.name = "XmlError";
    this.code = code;
  }
}

export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  /** Concatenated direct text content, trimmed. */
  text: string;
}

export interface XmlLimits {
  maxBytes: number;
  maxDepth: number;
}

/**
 * Bounds sized for ownership documents.
 *
 * The largest filing in the fixture set is a few tens of kilobytes; real Form 4
 * documents with many rows reach a few hundred. 4 MB is far above any
 * legitimate document and still small enough that a hostile response cannot
 * exhaust memory. Depth 40 is roughly four times the deepest legitimate nesting.
 */
export const DEFAULT_LIMITS: XmlLimits = { maxBytes: 4 * 1024 * 1024, maxDepth: 40 };

/** The five predefined entities. Nothing else is resolvable, by design. */
const PREDEFINED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/**
 * Decode text content.
 *
 * Numeric character references are allowed because they are self-contained.
 * Any *named* entity outside the predefined five is refused rather than passed
 * through: an unresolved `&companyName;` in a filing means the document depends
 * on a declaration we deliberately do not read.
 */
/**
 * Whether a code point is legal in XML 1.0 character data.
 *
 * Excludes the surrogate range, which is not a character at all, and the
 * control characters XML forbids. `&#0;` and `&#xD800;` are well-formed
 * *syntax* for values that cannot appear in a document, so they are refused
 * rather than substituted with a replacement character.
 */
function isLegalXmlCodePoint(code: number): boolean {
  if (!Number.isInteger(code)) return false;
  if (code === 0x9 || code === 0xa || code === 0xd) return true;
  if (code >= 0x20 && code <= 0xd7ff) return true;
  if (code >= 0xe000 && code <= 0xfffd) return true;
  if (code >= 0x10000 && code <= 0x10ffff) return true;
  return false;
}

export function decodeXmlText(input: string): string {
  // A bare `&` that is not the start of a reference is itself malformed, and is
  // caught here rather than silently surviving into a value.
  const stray = input.match(/&(?!#x?[0-9a-fA-F]+;|[A-Za-z][A-Za-z0-9._-]*;)/);
  if (stray) {
    throw new XmlError("stray '&' outside a character or entity reference", "malformed");
  }

  return input.replace(/&(#x?[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9._-]*);/g, (whole, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const digits = hex ? body.slice(2) : body.slice(1);
      if (!digits) {
        throw new XmlError(`invalid character reference ${whole}`, "invalid_character_reference");
      }
      const code = Number.parseInt(digits, hex ? 16 : 10);
      if (!isLegalXmlCodePoint(code)) {
        throw new XmlError(
          `character reference ${whole} is not a legal XML character`,
          "invalid_character_reference"
        );
      }
      return String.fromCodePoint(code);
    }
    const resolved = PREDEFINED[body];
    if (resolved === undefined) {
      throw new XmlError(`unsupported entity reference ${whole}`, "unexpected_entity");
    }
    return resolved;
  });
}

const ATTR_RE = /\s+([A-Za-z_:][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/y;

/**
 * Parse an attribute list, requiring the *whole* list to be well formed.
 *
 * The previous implementation scanned for anything that looked like a pair and
 * ignored the rest, so `<a foo=bar baz>` silently produced no attributes and
 * `<a x="1" ="2">` quietly dropped the malformed half. Anything left over after
 * the sticky scan is now an error: an attribute list we only partly understood
 * is a tag we cannot claim to have read.
 */
function parseAttrs(raw: string, tagName: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let position = 0;

  while (position < raw.length) {
    ATTR_RE.lastIndex = position;
    const m = ATTR_RE.exec(raw);
    if (!m) break;
    if (m[1] in attrs) {
      throw new XmlError(`duplicate attribute ${m[1]} on <${tagName}>`, "malformed_attributes");
    }
    attrs[m[1]] = decodeXmlText(m[3] ?? m[4] ?? "");
    position = ATTR_RE.lastIndex;
  }

  if (raw.slice(position).trim().length > 0) {
    throw new XmlError(
      `unparsed attribute content on <${tagName}>: ${raw.slice(position).trim().slice(0, 40)}`,
      "malformed_attributes"
    );
  }
  return attrs;
}

/**
 * Find the `>` that ends a tag, ignoring any inside a quoted attribute value.
 *
 * Scanning for the next `>` truncated `<a title="x > y">` mid-attribute: the
 * attribute was lost and the remainder leaked into the document as text.
 */
function findTagEnd(source: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ">") return i;
  }
  return -1;
}

/**
 * Parse an ownership document into a node tree.
 *
 * Throws `XmlError` rather than returning a partial tree: a document we could
 * only half-read must be quarantined, not parsed optimistically.
 */
export function parseXml(source: string, limits: XmlLimits = DEFAULT_LIMITS): XmlNode {
  if (Buffer.byteLength(source, "utf8") > limits.maxBytes) {
    throw new XmlError("document exceeds the maximum accepted size", "too_large");
  }
  if (/<!DOCTYPE/i.test(source)) {
    throw new XmlError("doctype declarations are not accepted", "doctype_forbidden");
  }
  if (/<!ENTITY/i.test(source)) {
    throw new XmlError("entity declarations are not accepted", "entity_forbidden");
  }

  const root: XmlNode = { name: "#document", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  let i = 0;

  while (i < source.length) {
    const lt = source.indexOf("<", i);
    if (lt === -1) {
      const rest = source.slice(i);
      if (stack.length === 1 && rest.trim().length > 0) {
        throw new XmlError(
          "non-whitespace content after the root element",
          "content_outside_root"
        );
      }
      if (stack.length > 1) appendText(stack[stack.length - 1], rest);
      break;
    }
    if (lt > i) {
      const between = source.slice(i, lt);
      if (stack.length === 1 && between.trim().length > 0) {
        throw new XmlError(
          "non-whitespace content outside the root element",
          "content_outside_root"
        );
      }
      if (stack.length > 1) appendText(stack[stack.length - 1], between);
    }

    // Comments, CDATA, declarations.
    if (source.startsWith("<!--", lt)) {
      const end = source.indexOf("-->", lt + 4);
      if (end === -1) throw new XmlError("unterminated comment", "malformed");
      i = end + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", lt)) {
      const end = source.indexOf("]]>", lt + 9);
      if (end === -1) throw new XmlError("unterminated CDATA", "malformed");
      if (stack.length === 1) {
        throw new XmlError("CDATA outside the root element", "content_outside_root");
      }
      // CDATA is literal: appended without entity decoding.
      stack[stack.length - 1].text += source.slice(lt + 9, end);
      i = end + 3;
      continue;
    }
    if (source.startsWith("<?", lt)) {
      const end = source.indexOf("?>", lt + 2);
      if (end === -1) throw new XmlError("unterminated processing instruction", "malformed");
      const body = source.slice(lt + 2, end);
      // The XML declaration is expected; any other PI is refused.
      if (!/^xml\s/i.test(body) && body.trim().toLowerCase() !== "xml") {
        throw new XmlError(
          "processing instructions are not accepted",
          "processing_instruction_forbidden"
        );
      }
      i = end + 2;
      continue;
    }

    const gt = findTagEnd(source, lt);
    if (gt === -1) throw new XmlError("unterminated tag", "malformed");
    const inner = source.slice(lt + 1, gt);

    if (inner.startsWith("/")) {
      const name = inner.slice(1).trim();
      const open = stack.pop();
      if (!open || open.name !== name || stack.length === 0) {
        throw new XmlError(`unbalanced closing tag </${name}>`, "malformed");
      }
      i = gt + 1;
      continue;
    }

    const selfClosing = inner.endsWith("/");
    const body = selfClosing ? inner.slice(0, -1) : inner;
    const nameMatch = body.match(/^([A-Za-z_:][\w.:-]*)/);
    if (!nameMatch) throw new XmlError(`malformed tag <${body}>`, "malformed");

    const node: XmlNode = {
      name: nameMatch[1],
      attrs: parseAttrs(body.slice(nameMatch[1].length), nameMatch[1]),
      children: [],
      text: "",
    };
    if (stack.length === 1 && root.children.length > 0) {
      throw new XmlError("document declares more than one root element", "multiple_roots");
    }
    stack[stack.length - 1].children.push(node);

    if (!selfClosing) {
      if (stack.length >= limits.maxDepth) {
        throw new XmlError("document nesting exceeds the maximum accepted depth", "too_deep");
      }
      stack.push(node);
    }
    i = gt + 1;
  }

  if (stack.length !== 1) throw new XmlError("unclosed elements at end of document", "malformed");

  if (root.children.length !== 1) {
    throw new XmlError(
      root.children.length === 0
        ? "document has no root element"
        : "document declares more than one root element",
      root.children.length === 0 ? "malformed" : "multiple_roots"
    );
  }
  return root.children[0];
}

function appendText(node: XmlNode, raw: string) {
  if (!raw) return;
  node.text += decodeXmlText(raw);
}

// --- small accessors, so callers never hand-walk the tree --------------------

export function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((c) => c.name === name);
}

export function children(node: XmlNode | undefined, name: string): XmlNode[] {
  return node?.children.filter((c) => c.name === name) ?? [];
}

/** Trimmed direct text of a child element, or `null` when absent or empty. */
export function childText(node: XmlNode | undefined, name: string): string | null {
  const found = child(node, name);
  if (!found) return null;
  const value = found.text.trim();
  return value.length > 0 ? value : null;
}

/**
 * Ownership documents wrap most leaves as `<field><value>X</value></field>`,
 * where `<value>` may be absent and replaced by one or more `<footnoteId/>`.
 * Both halves are returned so a caller can tell "no value" from "value zero"
 * and can keep the footnotes that explain either.
 */
export function valueAndFootnotes(
  node: XmlNode | undefined,
  name: string
): { value: string | null; footnoteIds: string[] } {
  const field = child(node, name);
  if (!field) return { value: null, footnoteIds: [] };
  const valueNode = child(field, "value");
  const raw = valueNode ? valueNode.text.trim() : field.text.trim();
  return {
    value: raw.length > 0 ? raw : null,
    footnoteIds: children(field, "footnoteId")
      .map((f) => f.attrs.id)
      .filter((id): id is string => Boolean(id)),
  };
}
