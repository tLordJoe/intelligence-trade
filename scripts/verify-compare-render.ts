/** Verify browser-deliverable HTML/RSC, separately from private server bundles. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Mode = "production" | "preview";
const PROVIDER = "outfox-demonstration-v1";

function filesBelow(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

export function verifyCompareRender(root: string, mode: Mode): number {
  const app = join(root, ".next/server/app");
  // Required reads fail closed if the route stops prerendering or the build
  // output format changes. A missing artifact is not a successful check.
  const htmlPath = join(app, "compare.html");
  const rscPath = join(app, "compare.rsc");
  const html = readFileSync(htmlPath, "utf8");
  const rsc = readFileSync(rscPath, "utf8");
  const fixture = JSON.parse(readFileSync(
    join(root, "src/lib/funds/fixtures/demo-price-series.json"), "utf8"
  )) as { disclaimer: string; series: Record<string, { values: number[] }> };
  const valueMarkers = Object.entries(fixture.series).map(([symbol, series]) => ({
    name: symbol, text: series.values.slice(0, 5).join(","),
  }));
  if (!valueMarkers.length || valueMarkers.some((marker) => !marker.text)) {
    throw new Error("Fixture has no usable series markers");
  }
  const files = [htmlPath, rscPath, ...filesBelow(join(app, "compare.segments"))];
  if (!/<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html)) {
    throw new Error("Comparison must remain noindex");
  }
  if (mode === "production") {
    if (!html.includes("Not available here")) {
      throw new Error("Production comparison did not render its refusal page");
    }
    const markers = [PROVIDER, fixture.disclaimer.slice(0, 60),
      ...valueMarkers.map((marker) => marker.text), '"demonstration":true', '"values":['];
    for (const file of files) {
      // HTML embeds an escaped flight payload; RSC uses plain JSON strings.
      const text = readFileSync(file, "utf8").replace(/\\"/g, '"');
      if (markers.some((marker) => marker && text.includes(marker))) {
        throw new Error(`Demonstration data leaked into production render: ${file}`);
      }
    }
  } else {
    if (html.includes("Not available here") || !rsc.includes(PROVIDER)) {
      throw new Error("Preview comparison did not receive its demonstration dataset");
    }
    for (const marker of valueMarkers) {
      if (!rsc.includes(marker.text)) {
        throw new Error(`Preview is missing demonstration series: ${marker.name}`);
      }
    }
  }
  return files.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv[2];
  if (mode !== "production" && mode !== "preview") {
    throw new Error("Specify production or preview explicitly");
  }
  const count = verifyCompareRender(resolve(import.meta.dirname, ".."), mode);
  console.log(`Verified ${mode} comparison HTML/RSC (${count} artifacts).`);
}
