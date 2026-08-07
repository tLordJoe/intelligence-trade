import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://outfoxmarkets.com"),
  title: {
    default: "Outfox — Financial intelligence for the rest of us",
    template: "%s · Outfox",
  },
  description:
    "See every AI stock Congress is buying, sourced from their own required filings. Live prices across the AI supply chain and the signals that show where the smart money is moving.",
  openGraph: {
    title: "Outfox — Financial intelligence for the rest of us",
    description:
      "See every AI stock Congress is buying — sourced from their own required filings.",
    url: "https://outfoxmarkets.com",
    siteName: "Outfox",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Outfox — Financial intelligence for the rest of us",
    description:
      "See every AI stock Congress is buying — sourced from their own required filings.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
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
