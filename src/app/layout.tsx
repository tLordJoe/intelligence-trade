import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://outfoxmarkets.com"),
  title: {
    default: "Outfox — Financial intelligence for the rest of us",
    template: "%s · Outfox",
  },
  description:
    "Explore official U.S. House stock-trade disclosures and market data across the AI supply chain.",
  icons: {
    icon: [{ url: "/brand/outfox-tail.svg", type: "image/svg+xml" }],
    shortcut: "/brand/outfox-tail.svg",
  },
  openGraph: {
    title: "Outfox — Financial intelligence for the rest of us",
    description:
      "Explore official U.S. House stock-trade disclosures across the AI supply chain.",
    url: "https://outfoxmarkets.com",
    siteName: "Outfox",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Outfox — Financial intelligence for the rest of us",
    description:
      "Explore official U.S. House stock-trade disclosures across the AI supply chain.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
