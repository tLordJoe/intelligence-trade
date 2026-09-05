import type { Metadata } from "next";
import { Suspense } from "react";

import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import FundComparison from "@/components/compare/FundComparison";

export const metadata: Metadata = {
  title: "Compare funds on price history",
  description:
    "Compare exchange-traded funds on price change over one, three or five years, with an example-amount illustration. Price return only — dividends and distributions are not included.",
  alternates: { canonical: "/compare" },
};

export default function ComparePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/*
          The comparison reads its initial state from the query string, so it is
          rendered on the client. The fallback is a real message rather than a
          blank frame — a page that shows nothing while loading is
          indistinguishable from one that failed.
        */}
        <Suspense
          fallback={
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-12">
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                Loading the fund comparison…
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
