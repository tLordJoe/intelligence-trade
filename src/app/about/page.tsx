import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { getAllTickers } from "@/lib/data";

export const metadata: Metadata = {
  title: "About & Methodology",
  description:
    "Where Outfox's data comes from, how it's processed, and what this site is (and isn't).",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl border p-5 md:p-6 mb-4"
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

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
          <div className="kicker mb-2">About</div>
          <h1
            className="text-3xl font-extrabold mb-3"
            style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
          >
            What Outfox is
          </h1>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: "var(--text-dim)" }}>
            Outfox tracks the money moving through the AI economy — who&apos;s
            building it, who&apos;s funding it, and what the people with the best
            information are doing with their own portfolios. Financial
            intelligence for the rest of us.
          </p>

          <Section title="Congressional trade data">
            <p>
              Every trade shown on Outfox comes from official STOCK Act periodic
              transaction reports (PTRs) published by the{" "}
              <a
                href="https://disclosures-clerk.house.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                Clerk of the U.S. House of Representatives
              </a>
              . Members of Congress are required by law to disclose trades within
              45 days. We download the filings, extract each transaction, and
              link every trade back to its source PDF so you can verify it
              yourself.
            </p>
            <p>
              Amounts are reported by Congress in ranges (e.g. $1,001–$15,000),
              not exact figures — that&apos;s how the law works, not a limitation
              of our data. Currently covers the House; Senate coverage is coming.
              Filings can be amended after publication and may contain errors.
            </p>
            <p>
              Outfox currently ingests the House&apos;s annual disclosure index,
              selects periodic transaction reports, downloads each source PDF,
              and extracts the filer, ticker, transaction type, amount range,
              transaction date, and filing date. Duplicate record IDs are removed
              before the API responds. Every displayed record links to the
              government PDF used as its source.
            </p>
            <p>
              A disclosure is not proof of illegal insider trading, a recommendation,
              or a real-time signal. Transactions may belong to a spouse or dependent,
              may be reported weeks after execution, and may later be amended. Senate
              records will remain unpublished until their separate official source,
              parsing, duplicate handling, and verification workflow pass the same review.
            </p>
          </Section>

          <Section title="Market data">
            <p>
              Stock prices come from{" "}
              <a
                href="https://finnhub.io"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                Finnhub
              </a>{" "}
              and may be delayed. Some non-US listings may not have live quotes —
              we show &quot;n/a&quot; instead of fake numbers. Charts are provided
              by TradingView.
            </p>
          </Section>

          <Section title="Technical indicators">
            <p>
              Technical indicators are temporarily unpublished while we validate
              their market-data source, formulas, adjustment rules, and refresh
              timing. We will not display them until the values are reproducible
              and their methodology is documented.
            </p>
          </Section>

          <Section title="The AI stack">
            <p>
              We organize {getAllTickers().length} public companies into 10 supply-chain layers — from
              raw materials and semiconductor equipment through foundries,
              processors, memory, networking, energy, data centers, software,
              and security. Layer membership is editorial: companies are placed
              where they earn most of their AI-related revenue.
            </p>
          </Section>

          <Section title="What Outfox is not">
            <p>
              Outfox is not an investment adviser, broker, or fiduciary. Nothing
              here is a recommendation to buy or sell anything. Congressional
              trades appear with a legal delay of up to 45 days. Do your own
              research, and never invest money you can&apos;t afford to lose.
            </p>
          </Section>

          <Section title="Contact & corrections">
            <p>
              Spotted an error? We&apos;ll fix it and note the correction. Reach
              us at{" "}
              <a
                href="mailto:hello@outfoxmarkets.com"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                hello@outfoxmarkets.com
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
