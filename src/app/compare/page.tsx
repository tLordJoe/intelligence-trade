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
 * The comparison is pulled in by dynamic `import()` inside the allowed branch,
 * and the gate itself comes from `access.ts`, which can be imported without the
 * fixture. Both are deliberate attempts to keep the demonstration data out of a
 * refused page's bundle.
 *
 * **Measured, and only partly successful.** Building with `VERCEL_ENV=production`
 * produces a `/compare` that renders the refusal and contains no value from the
 * fixture — but it still references the route's client chunk, which is 242 KB
 * and does contain it. Next groups a route's client modules into one chunk from
 * the static module graph, so a branch that is never taken still contributes to
 * it. Nothing is shown and nothing is claimed; a visitor who types the URL on
 * production downloads a file the page then ignores. Removing that would mean
 * serving the fixture as a fetched static asset rather than an imported module,
 * which is a larger change than this stage should make on its own.
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

  const { default: FundComparison } = await import("@/components/compare/FundComparison");

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
          <FundComparison />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
