import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Methodology & Data Sources",
  description:
    "How Outfox sources disclosures, calculates market comparisons, organizes the AI economy, and communicates limitations.",
};

function Method({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl border p-5 md:p-6"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <h2 className="text-lg font-bold mb-3" style={{ color: "var(--text)" }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed space-y-3" style={{ color: "var(--text-dim)" }}>
        {children}
      </div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
          <div className="kicker mb-2">Trust center</div>
          <h1 className="text-3xl font-extrabold mb-3" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
            Methodology and data sources
          </h1>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: "var(--text-dim)" }}>
            Outfox separates source records, calculations, editorial classifications,
            and interpretation. This page explains which is which—and what the data
            cannot tell you.
          </p>

          <div className="space-y-4">
            <Method title="Public-official disclosures">
              <p>
                The current product covers periodic transaction reports published by
                the Clerk of the U.S. House of Representatives. Each displayed record
                retains its filer, ticker or reported asset, transaction type, reported
                amount range, transaction date, filing date, and official filing link.
              </p>
              <p>
                Duplicate internal record IDs are removed before display. Filings may
                be delayed, amended, incomplete, or corrected by the filer. A disclosure
                does not establish motive, investment performance, or illegal conduct.
                Senate records are not included until their separate collection and
                verification process is complete.
              </p>
            </Method>

            <Method title="Market prices and comparisons">
              <p>
                Current quote cards use Finnhub and may be delayed. Historical comparison
                charts currently use an unofficial Yahoo Finance chart integration. If a
                provider returns no usable data, Outfox shows an unavailable state rather
                than generating a substitute value.
              </p>
              <p>
                Performance lines show percentage change from the first available closing
                value in the selected period. They are comparisons, not total-return
                calculations, and do not currently incorporate dividends, taxes, fees, or
                a user&apos;s execution price.
              </p>
            </Method>

            <Method title="AI-economy layers">
              <p>
                Layer membership is an Outfox editorial classification intended to make
                the AI supply chain understandable. It is not an industry standard, credit
                rating, recommendation, or claim that every company earns most of its
                revenue from artificial intelligence.
              </p>
              <p>
                Layer-performance lines are equal-weight averages of the constituent
                securities for which usable historical data is available. Constituents
                can therefore differ by date range or provider availability. Approximate
                market-cap visuals are editorial context and are labeled as estimates.
              </p>
            </Method>

            <Method title="Editorial standards">
              <p>
                Facts, calculations, interpretations, and scenarios should be identified
                separately. Political affiliation is context, not an investment thesis;
                Outfox applies the same presentation standard across parties. Precise
                claims should include an original or authoritative source and an applicable
                date.
              </p>
              <p>
                Outfox is an educational information service—not a broker, registered
                investment adviser, or fiduciary. Nothing on the site is a personalized
                recommendation to buy, sell, or hold a security.
              </p>
            </Method>

            <Method title="Questions and corrections">
              <p>
                See the <Link href="/corrections" className="underline" style={{ color: "var(--accent)" }}>corrections policy</Link>{" "}
                or email <a href="mailto:hello@outfoxmarkets.com" className="underline" style={{ color: "var(--accent)" }}>hello@outfoxmarkets.com</a> with the page URL, the statement or record in question, and a supporting source when available.
              </p>
            </Method>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
