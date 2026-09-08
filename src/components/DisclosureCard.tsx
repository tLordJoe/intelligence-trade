import type { DisclosureRecord } from "@/lib/congress-schema";
import { displayFiler, validDisclosureDate } from "@/lib/home-discovery";
import { formatAmount } from "@/lib/amounts";
import Link from "next/link";

export default function DisclosureCard({ record }: { record: DisclosureRecord }) {
  return (
    <article className="rounded-xl border p-5" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/congress?ticker=${encodeURIComponent(record.ticker)}`} className="font-bold text-xl" style={{ color: "var(--text)" }}>{record.ticker}</Link>
          <p className="text-sm mt-1 break-words" style={{ color: "var(--text-dim)" }}>{record.companyName}</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1.5 rounded-md" style={{ backgroundColor: "var(--bg-inset)", color: record.type === "Buy" ? "var(--green)" : "var(--text-dim)" }}>
          {record.type === "Buy" ? "Purchase" : record.type === "Sell" ? "Sale" : "Exchange"}{record.isOptions ? " · options" : ""}
        </span>
      </div>
      <p className="text-sm mt-4 font-semibold">Reported by {displayFiler(record.politician)}</p>
      <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>{record.chamber} · {record.state} · {formatAmount(record)}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs mt-3" style={{ color: "var(--text-dim)" }}>
        <span>Traded <time dateTime={record.transactionDate}>{record.transactionDate}</time></span>
        <span>Filed <time dateTime={record.filedDate}>{record.filedDate}</time></span>
      </div>
      {(!validDisclosureDate(record.transactionDate) || record.transactionDate > record.filedDate) && <p className="text-xs mt-3 font-semibold" style={{ color: "var(--red)" }}>Date inconsistency in the archive: excluded from homepage activity calculations. Check the original filing.</p>}
      <details className="text-xs mt-3 leading-relaxed" style={{ color: "var(--text-dim)" }}>
        <summary className="cursor-pointer py-2 min-h-11 font-semibold" style={{ color: "var(--accent)" }}>Inspect the evidence</summary>
        <p>Owner field: {record.raw.ownerText || "Not captured in this archive. Do not assume the member personally made this trade."}</p>
        {record.status === "warning" && <p className="mt-2">Validation notes: {record.warnings.map((w) => w.replaceAll("_", " ")).join("; ")}.</p>}
        {record.tickerResolution === "unknown" && <p>Security identity is unverified; excluded from homepage purchase clusters.</p>}
        <a className="inline-flex items-center min-h-11 underline underline-offset-4" href={record.source} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Open original House filing ↗</a>
      </details>
    </article>
  );
}
