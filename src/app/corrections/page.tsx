import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Corrections Policy",
  description: "How Outfox reviews, corrects, and documents material errors.",
};

export default function CorrectionsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
          <div className="kicker mb-2">Trust center</div>
          <h1 className="text-3xl font-extrabold mb-3" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
            Corrections policy
          </h1>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: "var(--text-dim)" }}>
            Outfox corrects material errors openly. Financial information changes,
            source filings can be amended, and our own work can be wrong. Trust requires
            making those changes visible.
          </p>

          <div className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
            <section className="rounded-xl border p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
              <h2 className="text-lg font-bold mb-3" style={{ color: "var(--text)" }}>What we correct</h2>
              <p>We review factual statements, calculations, labels, source links, security identifiers, disclosure records, charts, dates, and material omissions. A changed market price is not itself a correction; a price attributed to the wrong date or source is.</p>
            </section>

            <section className="rounded-xl border p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
              <h2 className="text-lg font-bold mb-3" style={{ color: "var(--text)" }}>How corrections are handled</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Confirm the issue against the original or most authoritative available source.</li>
                <li>Correct the affected page, data record, or calculation.</li>
                <li>Add an updated date and correction note when the change is material to the conclusion.</li>
                <li>Preserve the official source link when a government filing is amended or superseded.</li>
                <li>Review related pages and derived calculations for the same error.</li>
              </ol>
            </section>

            <section className="rounded-xl border p-5 md:p-6" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
              <h2 className="text-lg font-bold mb-3" style={{ color: "var(--text)" }}>Report an issue</h2>
              <p>
                Email <a href="mailto:hello@outfoxmarkets.com" className="underline" style={{ color: "var(--accent)" }}>hello@outfoxmarkets.com</a>. Include the page URL, the statement or record in question, and a supporting source when possible. We do not accept payment to remove accurate reporting or alter a methodology result.
              </p>
            </section>

            <p className="text-xs">Policy published August 11, 2026. No public correction entries have been recorded under this policy yet.</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
