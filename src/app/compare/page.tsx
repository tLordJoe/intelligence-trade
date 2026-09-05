import type { Metadata } from "next";
import { Suspense } from "react";

import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { previewAccessFromEnv } from "@/lib/funds/access";

/**
 * The fund comparison preview.
 *
 * A server component, so the two gates in `access.ts` are evaluated before any
 * markup exists rather than in a browser that could be told to ignore them.
 * When the gate refuses, the reader gets an explanation rather than an empty
 * frame.
 *
 * **The fixture never reaches a browser asset.** The client component does not
 * import a provider; it is handed a `ComparisonDataset` built here, on the
 * server, only after the gate has said yes. So the demonstration values travel
 * as props in the RSC payload of an allowed render, and nowhere else: not in
 * any chunk under `.next/static`, not in `public/`, and not in the payload of a
 * refused render, because a refused render never builds them. The data modules
 * carry `import "server-only"`, so a client import of them is a build error.
 * `scripts/verify-compare-assets.ts` scans the emitted build for the fixture
 * and runs in CI after every build.
 *
 * The gate comes from `access.ts`, which can be imported without the fixture,
 * and the data module is pulled in by dynamic `import()` inside the allowed
 * branch so the refusal path touches none of it.
 *
 * Not indexed and not in the sitemap: a preview running on generated data is
 * exactly the sort of page that should not turn up in a search for fund
 * performance.
 */

export const metadata: Metadata = {
  title: "Fund comparison preview",
  description:
    "A preview of Outfox's fund comparison, running on generated demonstration data. " +
    "Not actual market performance, and not a record of any fund's results.",
  alternates: { canonical: "/compare" },
  robots: { index: false, follow: false },
};

export default async function ComparePage() {
  const access = previewAccessFromEnv();

  if (!access.allowed) {
    return (
      <>
        <Navbar />
        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-4 md:px-8 py-16 md:py-24">
            <div className="kicker mb-2">Fund comparison · Preview</div>
            <h1
              className="text-3xl md:text-4xl font-extrabold mb-4"
              style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
            >
              Not available here
            </h1>
            <p className="text-base leading-relaxed" style={{ color: "var(--text-dim)" }}>
              {access.reason}
            </p>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const [{ default: FundComparison }, { buildComparisonDataset }] = await Promise.all([
    import("@/components/compare/FundComparison"),
    import("@/lib/funds/data"),
  ]);
  const dataset = buildComparisonDataset();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/*
          The comparison reads its initial state from the query string, so the
          tree below this boundary is client-rendered. The fallback is a real
          message rather than a blank frame — a page that shows nothing while
          loading is indistinguishable from one that failed.
        */}
        <Suspense
          fallback={
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-12">
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                Loading the fund comparison preview…
              </p>
            </div>
          }
        >
          <FundComparison dataset={dataset} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
