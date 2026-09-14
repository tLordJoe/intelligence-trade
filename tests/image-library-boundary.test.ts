/**
 * The catalog carries provenance for hundreds of identities. It belongs on the
 * server; a client component that imports the lookup would ship it to every
 * visitor. These read the sources for that mistake.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import ts from "typescript";

const ROOT = new URL("..", import.meta.url).pathname;
const clientFiles = readdirSync(join(ROOT, "src/components")).filter((f) => f.endsWith(".tsx"))
  .map((f) => join("src/components", f))
  .filter((f) => readFileSync(join(ROOT, f), "utf8").startsWith('"use client"'));

function sourceFiles(directory: string): string[] {
  return readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(?:ts|tsx|js|jsx|json)$/.test(path) ? [path] : [];
  });
}

function findClientCatalogPaths(files: Map<string, string>): string[] {
  const graph = new Map<string, string[]>();
  const roots: string[] = [];
  const forbidden = new Set(["src/lib/image-library/index.ts", "src/lib/image-library/catalog.json", "src/lib/company-marks.ts"]);
  const resolveImport = (from: string, specifier: string) => {
    const base = specifier.startsWith("@/") ? `src/${specifier.slice(2)}` :
      specifier.startsWith(".") ? normalize(join(dirname(from), specifier)) : null;
    if (!base) return null;
    return [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`, `${base}/index.tsx`].find(path => files.has(path)) ?? null;
  };
  for (const [file, text] of files) {
    if (extname(file) === ".json") continue;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    if (source.statements.some(statement => ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === "use client")) roots.push(file);
    const imports: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        if (node.importClause?.isTypeOnly) return;
        const bindings = node.importClause?.namedBindings;
        if (!node.importClause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.every(element => element.isTypeOnly)) return;
        if (ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
        if (node.arguments[0] && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    graph.set(file, imports.map(specifier => resolveImport(file, specifier)).filter((path): path is string => !!path));
  }
  const violations: string[] = [];
  for (const root of roots) {
    const seen = new Set<string>();
    const visit = (file: string, chain: string[]) => {
      if (seen.has(file)) return;
      seen.add(file);
      const path = [...chain, file];
      if (forbidden.has(file)) { violations.push(path.join(" -> ")); return; }
      for (const dependency of graph.get(file) ?? []) visit(dependency, path);
    };
    visit(root, []);
  }
  return violations;
}

test("client import graphs cannot reach catalog resolution through helpers or re-exports", () => {
  const files = new Map(sourceFiles("src").map(file => [file, readFileSync(join(ROOT, file), "utf8")]));
  assert.deepEqual(findClientCatalogPaths(files), []);
});

test("boundary check catches indirect relative imports but permits type-only imports", () => {
  const files = new Map([
    ["src/app/test/page.tsx", '/* comment */ "use client"; import { mark } from "@/lib/helper";'],
    ["src/lib/helper.ts", 'export { resolveCompanyMark as mark } from "./image-library/index";'],
    ["src/lib/image-library/index.ts", 'import catalog from "./catalog.json";'],
    ["src/lib/image-library/catalog.json", '{}'],
  ]);
  assert.equal(findClientCatalogPaths(files).length, 1);
  files.set("src/app/test/page.tsx", '"use client"; import type { Mark } from "@/lib/helper";');
  assert.deepEqual(findClientCatalogPaths(files), []);
});

test("no client component imports the image library, company-marks, or the catalog", () => {
  for (const file of clientFiles) {
    const text = readFileSync(join(ROOT, file), "utf8");
    assert.ok(!/from ["']@\/lib\/image-library|from ["']@\/lib\/company-marks|catalog\.json/.test(text), `${file} imports server-only image resolution`);
  }
});

test("CompanyMark takes a resolved src and never a CIK", () => {
  const text = readFileSync(join(ROOT, "src/components/CompanyMark.tsx"), "utf8");
  assert.ok(text.includes("src?: string | null"));
  assert.ok(!/cik/i.test(text));
  assert.ok(text.includes('className="home-ticker-tile"'), "the fallback tile markup is unchanged");
});

test("consumers pass server-resolved paths instead of looking images up themselves", () => {
  for (const file of ["src/components/HomeTradingTable.tsx", "src/components/HomeSectorExplorer.tsx"]) {
    const text = readFileSync(join(ROOT, file), "utf8");
    assert.ok(!text.includes("HOME_FILER_IMAGES"), `${file} still reads the static portrait map`);
    assert.ok(!/<CompanyMark[^>]*cik=/.test(text), `${file} still passes a CIK to CompanyMark`);
  }
});
