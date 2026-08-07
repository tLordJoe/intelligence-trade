import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Signals methodology review",
  robots: { index: false, follow: false },
};

export default function SignalsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 px-4 md:px-8 py-16">
        <div className="max-w-2xl mx-auto rounded-xl border p-6 md:p-8" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
          <div className="kicker mb-2">Methodology review</div>
          <h1 className="text-2xl font-extrabold mb-3" style={{ color: "var(--text)" }}>
            Signals are temporarily unavailable
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
            We are validating the market-data source, calculation methodology,
            adjustment rules, and refresh timing before publishing technical
            indicators. Outfox will only restore this page when every displayed
            value is reproducible and clearly sourced.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
