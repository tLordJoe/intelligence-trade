import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { learnEntries } from "@/lib/learn-data";

export const metadata: Metadata = {
  title: "Outfox Academy — Learn investing in plain English",
  description:
    "Plain-language guides to SEC filings, congressional disclosures, informed money, investment funds, and the terms used throughout Outfox.",
  alternates: { canonical: "/learn" },
};

const categories = ["Filings", "People", "Market basics"] as const;

export default function LearnPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Outfox Academy",
    description: metadata.description,
    url: "https://outfoxmarkets.com/learn",
    hasPart: learnEntries.map((entry) => ({
      "@type": "DefinedTerm",
      name: entry.shortTitle,
      url: `https://outfoxmarkets.com/learn/${entry.slug}`,
    })),
  };

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-14">
          <div className="max-w-3xl mb-10">
            <div className="kicker mb-2">Outfox Academy</div>
            <h1 className="text-3xl md:text-5xl font-extrabold mb-4" style={{ color: "var(--text)" }}>
              Understand the market without leaving the conversation.
            </h1>
            <p className="text-base md:text-lg leading-relaxed" style={{ color: "var(--text-dim)" }}>
              Clear explanations, real filing examples, important limitations, and
              direct links to official sources. Start with the short answer, then go
              as deep as you need.
            </p>
          </div>

          <div className="space-y-10">
            {categories.map((category) => {
              const entries = learnEntries.filter((entry) => entry.category === category);
              if (entries.length === 0) return null;
              return (
                <section key={category} aria-labelledby={`category-${category.replace(/\s/g, "-").toLowerCase()}`}>
                  <h2
                    id={`category-${category.replace(/\s/g, "-").toLowerCase()}`}
                    className="text-xl font-bold mb-4"
                    style={{ color: "var(--text)" }}
                  >
                    {category}
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {entries.map((entry) => (
                      <Link
                        key={entry.slug}
                        href={`/learn/${entry.slug}`}
                        className="group rounded-xl border p-5 transition-colors"
                        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
                      >
                        <div className="text-xs font-bold mb-2" style={{ color: "var(--accent)" }}>
                          {entry.category}
                        </div>
                        <h3 className="text-lg font-bold mb-2 group-hover:underline" style={{ color: "var(--text)" }}>
                          {entry.title}
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
                          {entry.summary}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <aside
            className="mt-12 rounded-xl border p-5 md:p-6"
            style={{ backgroundColor: "var(--accent-soft)", borderColor: "var(--border)" }}
          >
            <h2 className="font-bold mb-2" style={{ color: "var(--text)" }}>How these guides are made</h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
              Outfox begins with primary government and regulatory sources, identifies
              where interpretation begins, and states what the evidence cannot prove.
              Guides show their review date and source list. Corrections are handled
              under our <Link href="/corrections" className="underline" style={{ color: "var(--accent)" }}>public corrections policy</Link>.
            </p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
