import Link from "next/link";
import FoxLogo from "./FoxLogo";

export default function SiteFooter() {
  return (
    <footer
      className="border-t mt-12"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: "var(--fox)" }}>
                <FoxLogo size={40} />
              </span>
              <span
                className="text-base font-extrabold"
                style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
              >
                outfox
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
              Financial intelligence for the rest of us. Congressional trades,
              live AI supply-chain prices, and the signals that show where the
              smart money is moving.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-xs">
            <Link href="/congress" className="hover:underline" style={{ color: "var(--text-dim)" }}>
              Congress Trades
            </Link>
            <Link href="/signals" className="hover:underline" style={{ color: "var(--text-dim)" }}>
              Signals
            </Link>
            <Link href="/blog" className="hover:underline" style={{ color: "var(--text-dim)" }}>
              The Briefing
            </Link>
            <Link href="/portfolio" className="hover:underline" style={{ color: "var(--text-dim)" }}>
              Watchlist
            </Link>
            <Link href="/about" className="hover:underline" style={{ color: "var(--text-dim)" }}>
              About &amp; Methodology
            </Link>
            <a
              href="mailto:hello@outfoxmarkets.com"
              className="hover:underline"
              style={{ color: "var(--text-dim)" }}
            >
              Contact
            </a>
          </div>
        </div>

        <div
          className="mt-8 pt-6 border-t text-[11px] leading-relaxed"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
        >
          <p className="mb-2">
            <strong>Not financial advice.</strong> Outfox is an information
            service. Nothing on this site is a recommendation to buy or sell any
            security. Congressional trade data is compiled from official STOCK
            Act filings published by the Clerk of the U.S. House of
            Representatives; filings can be amended and may contain errors.
            Market data is provided by Finnhub and may be delayed. Do your own
            research.
          </p>
          <p>© {new Date().getFullYear()} Outfox · outfoxmarkets.com</p>
        </div>
      </div>
    </footer>
  );
}
