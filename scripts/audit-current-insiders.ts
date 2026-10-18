/** Independent SAX source check for the dated public candidate, not publication approval. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { SaxesParser } from "saxes";
import { readCandidateFile } from "../src/lib/form4/candidate-storage.ts";
import type { InsiderRelease } from "../src/lib/form4/public-view.ts";

interface Node { name: string; text: string; attrs: Record<string, string>; children: Node[] }
function document(xml: string): Node {
  const parser = new SaxesParser({ xmlns: false }), stack: Node[] = [];
  let root: Node | undefined;
  parser.on("doctype", () => { throw new Error("DTD refused in audit input"); });
  parser.on("opentag", tag => {
    const node: Node = { name: tag.name, text: "", attrs: tag.attributes as Record<string, string>, children: [] };
    if (stack.length) stack.at(-1)!.children.push(node); else root = node;
    stack.push(node);
  });
  const append = (value: string) => { if (stack.length) stack.at(-1)!.text += value; };
  parser.on("text", append); parser.on("cdata", append);
  parser.on("closetag", () => { stack.pop(); });
  parser.write(xml).close();
  assert.equal(root?.name, "ownershipDocument");
  return root!;
}
const child = (node: Node | undefined, name: string) => node?.children.find(item => item.name === name);
const children = (node: Node | undefined, name: string) => node?.children.filter(item => item.name === name) ?? [];
const text = (node: Node | undefined) => node?.text.trim() || null;
const value = (node: Node | undefined, name: string) => text(child(child(node, name), "value"));
const bool = (raw: string | null) => raw === "1" || raw === "true" ? true : raw === "0" || raw === "false" ? false : null;
function decimal(raw: string | null) {
  if (raw === null) return null;
  let normalized = raw.replaceAll(",", "").replace(/^(-?)\./, "$10.");
  if (normalized.includes(".")) normalized = normalized.replace(/0+$/, "").replace(/\.$/, "");
  return normalized === "-0" ? "0" : normalized;
}
const root = resolve(import.meta.dirname, "..");
const data = resolve(root, process.env.OUTFOX_FORM4_DATA_DIR || "data");
const archive = readCandidateFile(resolve(data, "form4-candidate.json"));
const release: InsiderRelease = JSON.parse(readFileSync(resolve(root, "data/insider-public-candidate.json"), "utf8"));
assert.equal(release.payload.schemaVersion, 2);
const rowsByFiling = new Map<string, typeof release.payload.records>();
for (const row of release.payload.records) rowsByFiling.set(row.filingId, [...(rowsByFiling.get(row.filingId) ?? []), row]);
const checked: string[] = [];
let checkedDocuments = 0;
for (const filing of archive.filings) {
  const run = resolve(data, "form4-runs", filing.importRunId);
  const rawPath = resolve(run, filing.rawArtifactPath!);
  assert.ok(rawPath.startsWith(`${run}${sep}raw${sep}`));
  const bytes = readFileSync(rawPath);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), filing.documentSha256);
  const xml = document(bytes.toString("utf8"));
  checkedDocuments++;
  const sourceRows = child(xml, "nonDerivativeTable")?.children.filter(node => ["nonDerivativeTransaction", "nonDerivativeHolding"].includes(node.name)) ?? [];
  for (const row of rowsByFiling.get(filing.id) ?? []) {
    const ordinal = Number(row.id.split("::").at(-1)), source = sourceRows[ordinal];
    assert.equal(source?.name, "nonDerivativeTransaction", row.id);
    assert.equal(row.issuerCik, text(child(child(xml, "issuer"), "issuerCik"))!.padStart(10, "0"));
    assert.equal(row.issuerName, text(child(child(xml, "issuer"), "issuerName")));
    assert.equal(row.ticker, text(child(child(xml, "issuer"), "issuerTradingSymbol"))!.toUpperCase());
    assert.equal(row.securityTitle, value(source, "securityTitle"));
    const sourceDate = value(source, "transactionDate")!;
    assert.match(sourceDate, /^\d{4}-\d{2}-\d{2}(?:Z|[+-]\d{2}:\d{2})?$/);
    assert.equal(row.transactionDate, sourceDate.slice(0, 10));
    assert.equal(row.filedDate, filing.timestamps.filedDate.value);
    assert.equal(text(child(child(source, "transactionCoding"), "transactionCode")), row.classification === "reported_purchase" ? "P" : "S");
    const amounts = child(source, "transactionAmounts");
    assert.equal(value(amounts, "transactionAcquiredDisposedCode"), row.classification === "reported_purchase" ? "A" : "D");
    assert.equal(row.reportedShares, decimal(value(amounts, "transactionShares")));
    assert.equal(row.reportedPrice.raw, value(amounts, "transactionPricePerShare"));
    assert.equal(row.reportedPrice.value, decimal(value(amounts, "transactionPricePerShare")));
    assert.deepEqual(row.reportedPrice.footnoteIds, children(child(amounts, "transactionPricePerShare"), "footnoteId").map(node => node.attrs.id));
    const nature = child(source, "ownershipNature"), ownership = value(nature, "directOrIndirectOwnership");
    assert.equal(row.ownership, ownership === "D" ? "direct" : ownership === "I" ? "indirect" : "unknown");
    assert.equal(row.natureOfOwnership.raw, value(nature, "natureOfOwnership"));
    assert.equal(row.filingPlanIndicator, bool(text(child(xml, "aff10b5One"))));
    assert.equal(row.sourceRemarks, text(child(xml, "remarks")));
    assert.deepEqual(row.footnotes, Object.fromEntries(children(child(xml, "footnotes"), "footnote").map(node => [node.attrs.id, text(node)])));
    assert.deepEqual(row.reportingOwners, children(xml, "reportingOwner").map(owner => {
      const id = child(owner, "reportingOwnerId"), rel = child(owner, "reportingOwnerRelationship");
      return { cik: text(child(id, "rptOwnerCik"))!.padStart(10, "0"), name: text(child(id, "rptOwnerName")),
        isDirector: bool(text(child(rel, "isDirector"))), isOfficer: bool(text(child(rel, "isOfficer"))),
        isTenPercentOwner: bool(text(child(rel, "isTenPercentOwner"))), isOther: bool(text(child(rel, "isOther"))),
        officerTitle: text(child(rel, "officerTitle")), otherText: text(child(rel, "otherText")) };
    }));
    assert.equal(row.sourceDocumentSha256, filing.documentSha256);
    assert.equal(row.sourceUrl, filing.documentUrl);
    assert.ok(!checked.includes(row.id)); checked.push(row.id);
  }
}
assert.equal(checked.length, release.payload.records.length);
const evidence = { auditedAt: new Date().toISOString(), reviewer: "Codex", parser: "saxes (independent of application XML parser)",
  sourceDocumentsChecked: checkedDocuments, publicRowsChecked: checked.length,
  payloadSha256: createHash("sha256").update(JSON.stringify(release.payload)).digest("hex"),
  coverageFrom: release.payload.coverageFrom, coverageThrough: release.payload.coverageThrough,
  sourceRunIds: archive.runIds, checks: "Raw document hashes; row ordinal; issuer, owner and relationship fields; transaction code/direction/date; shares; price and references; ownership; plan flag; remarks; footnotes; source URLs. Official index enumeration and filing dates are independently replayed by the promotion gate.",
  heldIssuers: release.payload.heldIssuers, excluded: release.payload.excluded };
const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0) writeFileSync(resolve(process.argv[outputIndex + 1]), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
