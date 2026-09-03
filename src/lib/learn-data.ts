export type LearnSource = {
  label: string;
  url: string;
  publisher: string;
};

export type LearnSection = {
  heading: string;
  paragraphs: string[];
};

export type LearnEntry = {
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  category: "Filings" | "People" | "Market basics";
  reviewedAt: string;
  quickAnswer: string;
  takeaways: string[];
  limitations: string[];
  sections: LearnSection[];
  sources: LearnSource[];
  relatedSlugs: string[];
};

export const learnEntries: LearnEntry[] = [
  {
    slug: "what-is-form-4",
    title: "What is an SEC Form 4?",
    shortTitle: "SEC Form 4",
    summary:
      "A plain-language guide to the SEC filing that reports many transactions by company directors, officers, and large shareholders.",
    category: "Filings",
    reviewedAt: "2026-09-02",
    quickAnswer:
      "Form 4 is a public SEC filing used to report many changes in ownership by a public company’s directors, officers, and shareholders who own more than 10% of a registered class of its equity securities. It is usually due within two business days of the transaction.",
    takeaways: [
      "Form 4 can reveal relatively recent activity by people closely connected to a company.",
      "Transaction code P generally identifies an open-market or private purchase; S generally identifies a sale.",
      "Awards, option exercises, gifts, and tax-withholding transactions should not be treated as ordinary purchases or sales.",
      "The original filing and its footnotes matter more than a headline about the filing.",
    ],
    limitations: [
      "A filing reports a transaction; it does not disclose the person’s complete investment thesis.",
      "An insider may have other holdings, derivatives, tax considerations, or prearranged trading instructions.",
      "A transaction by one insider is evidence to investigate, not proof that a security will rise or fall.",
    ],
    sections: [
      {
        heading: "What appears in the filing?",
        paragraphs: [
          "A Form 4 identifies the reporting person, the issuer, the reporting person’s relationship to the issuer, the transaction date, the security, the number of shares, the reported price, the transaction code, and the ownership remaining after the transaction. It can also include derivative securities and explanatory footnotes.",
          "Outfox will preserve the accession number and official SEC filing URL so readers can inspect the source rather than relying only on our interpretation.",
        ],
      },
      {
        heading: "Why do transaction codes matter?",
        paragraphs: [
          "Form 4 uses codes to describe why ownership changed. Code P generally means an open-market or private purchase and code S generally means an open-market or private sale. Code A can identify an award, code M an option exercise, code F shares used for an exercise price or tax liability, and code G a gift.",
          "Those events can have very different meanings. Outfox will classify them separately instead of combining every acquisition into ‘insider buying’ or every disposition into ‘insider selling.’",
        ],
      },
      {
        heading: "How Outfox will use Form 4 data",
        paragraphs: [
          "Outfox will compare verified open-market activity with congressional disclosures, institutional holdings, and company context. We will show agreement and disagreement rather than turning a single filing into a recommendation.",
        ],
      },
    ],
    sources: [
      {
        label: "Investor bulletin: Forms 3, 4 and 5",
        url: "https://www.sec.gov/files/forms-3-4-5.pdf",
        publisher: "U.S. Securities and Exchange Commission",
      },
      {
        label: "General instructions for Form 4",
        url: "https://www.sec.gov/about/forms/form4data.pdf",
        publisher: "U.S. Securities and Exchange Commission",
      },
    ],
    relatedSlugs: ["what-is-a-corporate-insider", "transaction-date-vs-filing-date", "what-is-form-13f"],
  },
  {
    slug: "what-is-form-13f",
    title: "What is an SEC Form 13F?",
    shortTitle: "SEC Form 13F",
    summary:
      "How quarterly institutional holdings reports work, what changes between filings can reveal, and why a 13F is not a real-time trade feed.",
    category: "Filings",
    reviewedAt: "2026-09-02",
    quickAnswer:
      "Form 13F is a quarterly holdings report filed by institutional investment managers that exercise investment discretion over at least $100 million in certain reportable securities. It shows covered holdings as of quarter-end, not a complete, real-time record of everything the manager bought and sold.",
    takeaways: [
      "A 13F is a delayed snapshot of certain long holdings at the end of a calendar quarter.",
      "Comparing consecutive filings can identify reported new, increased, reduced, and exited positions.",
      "The filing entity—not merely the famous person associated with it—is the reporting party.",
      "Concentration and multi-quarter changes are often more informative than one isolated holding.",
    ],
    limitations: [
      "A filing can arrive up to 45 days after quarter-end, so the manager’s current position may differ.",
      "The filing generally does not reveal the exact purchase date or purchase price.",
      "It does not provide a complete picture of short positions, cash, every derivative, or every asset class.",
      "Amendments and confidential-treatment requests can affect what is visible at a particular time.",
    ],
    sections: [
      {
        heading: "What does a 13F contain?",
        paragraphs: [
          "The information table identifies reportable securities, their value, share or principal amount, and certain voting-authority information. The SEC publishes structured 13F data extracted from filed XML, while warning that the official filing remains the authoritative record.",
        ],
      },
      {
        heading: "What can change analysis tell us?",
        paragraphs: [
          "When two consecutive quarter-end snapshots are compared carefully, Outfox can describe positions as newly reported, increased, reduced, exited, or unchanged. That language is more accurate than claiming a manager ‘bought today.’",
          "Cross-manager analysis can also reveal where several influential investment firms reported exposure to the same company or theme. Agreement is useful context, but it does not eliminate valuation, timing, or strategy risk.",
        ],
      },
      {
        heading: "How Outfox will identify managers",
        paragraphs: [
          "Outfox will connect each profile to the correct SEC filer and CIK. A well-known founder or chief executive may be associated with a firm, but the holdings belong to the filing manager and should not automatically be described as the individual’s personal portfolio.",
        ],
      },
    ],
    sources: [
      {
        label: "Form 13F data sets",
        url: "https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets",
        publisher: "U.S. Securities and Exchange Commission",
      },
      {
        label: "Frequently asked questions about Form 13F",
        url: "https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f",
        publisher: "U.S. Securities and Exchange Commission",
      },
    ],
    relatedSlugs: ["what-is-form-4", "transaction-date-vs-filing-date", "what-is-congressional-periodic-transaction-report"],
  },
  {
    slug: "what-is-congressional-periodic-transaction-report",
    title: "What is a congressional Periodic Transaction Report?",
    shortTitle: "Congressional PTR",
    summary:
      "What congressional transaction disclosures contain, why amounts appear as ranges, and why they are delayed public records rather than live trade alerts.",
    category: "Filings",
    reviewedAt: "2026-09-02",
    quickAnswer:
      "A Periodic Transaction Report, often shortened to PTR, is a public financial-disclosure report used by covered members, officers, employees, candidates, spouses, and dependent children to report certain securities transactions. The public record commonly provides an amount range rather than an exact dollar value.",
    takeaways: [
      "A PTR is a delayed disclosure of a reported transaction, not a live order feed.",
      "The transaction date and filing date answer different questions and should both be shown.",
      "Reported amounts commonly use broad ranges, so precise totals can create false certainty.",
      "House and Senate records come from separate official systems and require separate collection methods.",
    ],
    limitations: [
      "The filing does not prove motive, special knowledge, investment success, or wrongdoing.",
      "Filings can be late, amended, incomplete, difficult to parse, or corrected by the filer.",
      "Broad amount ranges prevent calculation of an exact investment value.",
      "Outfox currently publishes verified U.S. House records; Senate coverage is still being developed separately.",
    ],
    sections: [
      {
        heading: "What does the public record show?",
        paragraphs: [
          "A PTR can identify the filer, owner, asset, transaction type, transaction date, notification date, reported amount range, and filing date. Details vary, and some reported assets cannot be mapped reliably to a public-company ticker.",
        ],
      },
      {
        heading: "Why are the amounts ranges?",
        paragraphs: [
          "Congressional disclosure forms commonly report value categories rather than exact transaction amounts. Outfox preserves the filed range. When a filing contains no readable amount, we label it unavailable instead of converting it to zero or inventing a midpoint.",
        ],
      },
      {
        heading: "How Outfox uses PTRs",
        paragraphs: [
          "Outfox links displayed House transactions to the Clerk’s official filing and preserves the original text, provenance, import history, and revisions. We use the data to identify disclosed patterns and comparisons—not to allege misconduct or promise that copying a transaction will be profitable.",
        ],
      },
    ],
    sources: [
      {
        label: "Financial Disclosure Reports",
        url: "https://disclosures-clerk.house.gov/FinancialDisclosure",
        publisher: "Office of the Clerk, U.S. House of Representatives",
      },
      {
        label: "Financial Disclosure Reports database",
        url: "https://disclosures-clerk.house.gov/FinancialDisclosure/ViewSearch",
        publisher: "Office of the Clerk, U.S. House of Representatives",
      },
    ],
    relatedSlugs: ["transaction-date-vs-filing-date", "what-is-form-4", "what-is-form-13f"],
  },
  {
    slug: "what-is-a-corporate-insider",
    title: "What is a corporate insider?",
    shortTitle: "Corporate insider",
    summary:
      "Who is treated as a company insider for ownership reporting, and why insider activity requires context before it becomes useful evidence.",
    category: "People",
    reviewedAt: "2026-09-02",
    quickAnswer:
      "In the Form 3, 4, and 5 reporting context, corporate insiders generally include a public company’s directors and officers and beneficial owners of more than 10% of a registered class of the company’s equity securities.",
    takeaways: [
      "An insider has a reporting relationship to the company; the label is not itself an accusation of illegal conduct.",
      "Open-market purchases can be more informative than compensation awards because they may involve discretionary capital.",
      "Role, transaction code, remaining ownership, footnotes, and prior activity all provide necessary context.",
      "Clusters of independent insider purchases may deserve more attention than one isolated transaction.",
    ],
    limitations: [
      "Insiders can buy or sell for personal, tax, diversification, compensation, or planning reasons unrelated to near-term performance.",
      "A reported transaction does not reveal all of the person’s financial circumstances or exposures.",
      "Legal insider reporting is different from prohibited trading based on material nonpublic information.",
    ],
    sections: [
      {
        heading: "Insider does not automatically mean illegal",
        paragraphs: [
          "The word ‘insider’ is used in securities reporting to describe a person’s relationship to an issuer. Many insider transactions are lawful and routinely disclosed. Illegal insider trading is a separate legal concept involving trading or tipping in breach of a duty while aware of material nonpublic information.",
        ],
      },
      {
        heading: "Which activity may be most informative?",
        paragraphs: [
          "Outfox will initially emphasize verified open-market purchases and sales while displaying compensation awards, option exercises, gifts, and tax-related dispositions separately. We will also show whether ownership is direct or indirect and retain relevant footnotes.",
          "No single category is a prediction. The goal is to compare activity across time and against other independent evidence.",
        ],
      },
      {
        heading: "What is an insider cluster?",
        paragraphs: [
          "A cluster occurs when multiple insiders at the same company report similar activity within a defined period. Outfox will disclose the exact rule used for any cluster label, including eligible transaction codes, time window, and minimum number of distinct reporting people.",
        ],
      },
    ],
    sources: [
      {
        label: "Investor bulletin: Forms 3, 4 and 5",
        url: "https://www.sec.gov/files/forms-3-4-5.pdf",
        publisher: "U.S. Securities and Exchange Commission",
      },
      {
        label: "Insider trading policy information",
        url: "https://www.investor.gov/introduction-investing/investing-basics/glossary/insider-trading",
        publisher: "Investor.gov, U.S. Securities and Exchange Commission",
      },
    ],
    relatedSlugs: ["what-is-form-4", "transaction-date-vs-filing-date", "what-is-form-13f"],
  },
  {
    slug: "transaction-date-vs-filing-date",
    title: "Transaction date versus filing date",
    shortTitle: "Transaction date vs. filing date",
    summary:
      "Why the date an investment transaction occurred differs from the date the public learned about it—and why that delay changes the meaning of a signal.",
    category: "Market basics",
    reviewedAt: "2026-09-02",
    quickAnswer:
      "The transaction date is when the reported purchase, sale, or other ownership change occurred. The filing date is when the disclosure was submitted or made public. The time between them is disclosure lag, and it determines how stale a public signal may be.",
    takeaways: [
      "Always compare the transaction date with the filing date before interpreting a disclosed position.",
      "Form 4 activity is generally reported much sooner than congressional transactions or quarterly 13F holdings.",
      "A current filing can describe an event that occurred weeks—or, for quarter-end holdings, months—earlier.",
      "Outfox should label freshness by source instead of presenting all records as equally current.",
    ],
    limitations: [
      "A filing date does not reveal whether the position is still held when a reader sees it.",
      "Amendments can add or correct information after the original disclosure.",
      "Market-price movement between the transaction and filing dates can materially change the opportunity and risk.",
    ],
    sections: [
      {
        heading: "Why does the difference matter?",
        paragraphs: [
          "A headline published on the filing date can sound current even when the underlying activity is not. Showing both dates prevents a delayed disclosure from being mistaken for a real-time signal.",
          "Outfox will calculate disclosure lag in calendar days and retain source-specific explanations. We will never substitute the filing date for an unknown transaction date.",
        ],
      },
      {
        heading: "Different filings have different clocks",
        paragraphs: [
          "Form 4 is generally due within two business days after the transaction. Congressional PTRs operate under different reporting rules and can appear weeks later. Form 13F is a quarter-end holdings snapshot that can be filed up to 45 days after the end of a calendar quarter.",
        ],
      },
      {
        heading: "The Outfox freshness ladder",
        paragraphs: [
          "Outfox will show the source, as-of date, filing date, transaction date when available, and calculated lag. Comparisons across Congress, insiders, and institutions will preserve those differences instead of pretending every signal arrived at the same time.",
        ],
      },
    ],
    sources: [
      {
        label: "Investor bulletin: Forms 3, 4 and 5",
        url: "https://www.sec.gov/files/forms-3-4-5.pdf",
        publisher: "U.S. Securities and Exchange Commission",
      },
      {
        label: "Frequently asked questions about Form 13F",
        url: "https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f",
        publisher: "U.S. Securities and Exchange Commission",
      },
      {
        label: "Financial Disclosure Reports",
        url: "https://disclosures-clerk.house.gov/FinancialDisclosure",
        publisher: "Office of the Clerk, U.S. House of Representatives",
      },
    ],
    relatedSlugs: ["what-is-form-4", "what-is-form-13f", "what-is-congressional-periodic-transaction-report"],
  },
];

export function getLearnEntry(slug: string) {
  return learnEntries.find((entry) => entry.slug === slug);
}
