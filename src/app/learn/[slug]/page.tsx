import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { getLearnEntry, learnEntries } from "@/lib/learn-data";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return learnEntries.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getLearnEntry(slug);
  if (!entry) return {};

  return {
    title: entry.title,
    description: entry.summary,
    alternates: { canonical: `/learn/${entry.slug}` },
    openGraph: {
      title: entry.title,
      description: entry.summary,
      url: `https://outfoxmarkets.com/learn/${entry.slug}`,
      type: "article",
    },
  };
}

export default async function LearnEntryPage({ params }: Props) {
  const { slug } = await params;
  const entry = getLearnEntry(slug);
  if (!entry) notFound();

  const related = entry.relatedSlugs
    .map((relatedSlug) => getLearnEntry(relatedSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        name: entry.shortTitle,
        description: entry.quickAnswer,
        url: `https://outfoxmarkets.com/learn/${entry.slug}`,
        inDefinedTermSet: {
          "@type": "DefinedTermSet",
          name: "Outfox Academy",
          url: "https://outfoxmarkets.com/learn",
        },
      },
      {
        "@type": "Article",
        headline: entry.title,
        description: entry.summary,
        datePublished: entry.publishedAt,
        dateModified: entry.reviewedAt,
        author: { "@type": "Organization", name: "Outfox Editorial" },
        publisher: {
          "@type": "Organization",
          name: "Outfox",
          url: "https://outfoxmarkets.com",
        },
        mainEntityOfPage: `https://outfoxmarkets.com/learn/${entry.slug}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Outfox", item: "https://outfoxmarkets.com" },
          { "@type": "ListItem", position: 2, name: "Academy", item: "https://outfoxmarkets.com/learn" },
          { "@type": "ListItem", position: 3, name: entry.shortTitle, item: `https://outfoxmarkets.com/learn/${entry.slug}` },
        ],
      },
    ],
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
        <article className="max-w-3xl mx-auto px-4 md:px-8 py-10 md:py-14">
          <nav aria-label="Breadcrumb" className="text-xs mb-7" style={{ color: "var(--text-dim)" }}>
            <Link href="/learn" className="hover:underline">Outfox Academy</Link>
            <span aria-hidden="true"> / </span>
            <span>{entry.shortTitle}</span>
          </nav>

          <div className="kicker mb-2">{entry.category}</div>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4" style={{ color: "var(--text)" }}>
            {entry.title}
          </h1>
          <p className="text-sm mb-8" style={{ color: "var(--text-dim)" }}>
            By Outfox Editorial · Reviewed {new Date(`${entry.reviewedAt}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
          </p>

          <section
            className="rounded-xl border p-5 md:p-6 mb-9"
            style={{ backgroundColor: "var(--accent-soft)", borderColor: "var(--border)" }}
            aria-labelledby="quick-answer-heading"
          >
            <h2 id="quick-answer-heading" className="kicker mb-2">Quick answer</h2>
            <p className="text-base md:text-lg font-semibold leading-relaxed" style={{ color: "var(--text)" }}>
              {entry.quickAnswer}
            </p>
          </section>

          <section className="mb-9" aria-labelledby="key-takeaways">
            <h2 id="key-takeaways" className="text-xl font-bold mb-3" style={{ color: "var(--text)" }}>Key takeaways</h2>
            <ul className="space-y-2 text-sm leading-relaxed list-disc pl-5" style={{ color: "var(--text-dim)" }}>
              {entry.takeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}
            </ul>
          </section>

          <div className="space-y-9">
            {entry.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-bold mb-3" style={{ color: "var(--text)" }}>{section.heading}</h2>
                <div className="space-y-3 text-sm md:text-base leading-relaxed" style={{ color: "var(--text-dim)" }}>
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>

          <section
            className="rounded-xl border p-5 md:p-6 my-10"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
            aria-labelledby="limitations"
          >
            <h2 id="limitations" className="text-xl font-bold mb-3" style={{ color: "var(--text)" }}>What this information cannot tell you</h2>
            <ul className="space-y-2 text-sm leading-relaxed list-disc pl-5" style={{ color: "var(--text-dim)" }}>
              {entry.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
            </ul>
          </section>

          <section className="mb-10" aria-labelledby="primary-sources">
            <h2 id="primary-sources" className="text-xl font-bold mb-3" style={{ color: "var(--text)" }}>Primary sources</h2>
            <ul className="space-y-3">
              {entry.sources.map((source) => (
                <li key={source.url} className="text-sm">
                  <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: "var(--accent)" }}>
                    {source.label}<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <div style={{ color: "var(--text-dim)" }}>{source.publisher} · Link verified {source.verifiedAt}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t pt-8" style={{ borderColor: "var(--border)" }} aria-labelledby="keep-learning">
            <h2 id="keep-learning" className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>Keep learning</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {related.map((item) => (
                <Link key={item.slug} href={`/learn/${item.slug}`} className="rounded-lg border p-4 hover:underline" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}>
                  <span className="font-semibold">{item.title}</span>
                </Link>
              ))}
            </div>
          </section>

          <p className="mt-10 text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
            Educational information only. This guide is not personalized investment advice or a recommendation to buy, sell, or hold a security.
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
