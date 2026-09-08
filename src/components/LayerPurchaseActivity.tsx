"use client";

import { useState } from "react";
import Link from "next/link";
import type { ActivityPeriod, LayerActivity } from "@/lib/layer-activity";

export default function LayerPurchaseActivity({ activity, slug, name, previewing }: {
  activity: LayerActivity; slug: string; name: string; previewing: boolean;
}) {
  const [period, setPeriod] = useState<ActivityPeriod>("year");
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);
  const window = activity.byLayer[slug]?.[period];
  if (!window) return null;
  const expanded = expandedLayer === `${slug}:${period}`;
  const visible = expanded ? window.stocks : window.stocks.slice(0, 5);
  const scale = Math.max(1, ...window.stocks.flatMap(s => [s.buyers, s.sellers]));
  return <section aria-label={`Disclosed stock activity in ${name}`} className="rounded-xl border p-4 md:p-6 mt-4"
    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
    <p className="kicker text-[10px] mb-2">Follow the disclosures</p>
    <h3 className="text-xl font-bold">Who&apos;s buying in this layer?</h3>
    <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>{previewing ? "Previewing" : "Selected"} · {name}. Click a stack layer to pin it while you inspect the evidence.</p>
    <div className="flex gap-2 my-4" role="group" aria-label="Stock activity period">
      {([ ["year", "This year"], ["month", "Last 30 days"] ] as const).map(([value, label]) =>
        <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}
          className="rounded-lg border px-3 min-h-11 text-xs font-semibold"
          style={{ borderColor: "var(--border)", backgroundColor: period === value ? "var(--accent-soft)" : "transparent", color: "var(--text)" }}>{label}</button>)}
    </div>
    <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>Traded {window.start} – {window.end} · House archive</p>
    <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>Bars count distinct filers, not dollars. Purchases and sales stay separate.</p>
    <div className="space-y-3">
      {visible.map(stock => <details key={`${slug}:${period}:${stock.ticker}`} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
        <summary className="cursor-pointer list-none min-h-11">
          <span className="flex justify-between gap-3 text-sm font-bold"><span>{stock.ticker}</span><span>{stock.buyers} {stock.buyers === 1 ? "buyer" : "buyers"}</span></span>
          <span className="block text-xs mt-1 mb-3" style={{ color: "var(--text-dim)" }}>{stock.name}</span>
          <span className="flex items-center gap-2 text-xs"><span className="w-14 shrink-0">Buying</span><span aria-hidden="true" className="h-2 flex-1 rounded" style={{ backgroundColor: "var(--bg-inset)" }}><span className="block h-2 rounded" style={{ width: `${stock.buyers / scale * 100}%`, backgroundColor: "var(--green)" }} /></span><span className="w-4 text-right">{stock.buyers}</span></span>
          <span className="flex items-center gap-2 text-xs mt-2"><span className="w-14 shrink-0">Selling</span><span aria-hidden="true" className="h-2 flex-1 rounded" style={{ backgroundColor: "var(--bg-inset)" }}><span className="block h-2 rounded" style={{ width: `${stock.sellers / scale * 100}%`, backgroundColor: "var(--red)" }} /></span><span className="w-4 text-right">{stock.sellers}</span></span>
          <span className="block text-xs mt-3" style={{ color: "var(--text-dim)" }}>{stock.purchases} purchase records · {stock.sales} sale records · View evidence ↓</span>
        </summary>
        <ul className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
          {stock.evidence.map(row => <li key={row.id} className="text-xs leading-relaxed">
            <a href={row.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{row.filer} · {row.direction === "Buy" ? "Purchase" : "Sale"} ↗</a>
            <span className="block" style={{ color: "var(--text-dim)" }}>Traded {row.traded} · Filed {row.filed}</span>
          </li>)}
        </ul>
        <Link href={`/congress?ticker=${encodeURIComponent(stock.ticker)}`} className="inline-flex items-center min-h-11 text-xs font-semibold" style={{ color: "var(--accent)" }}>All {stock.ticker} disclosures →</Link>
      </details>)}
    </div>
    {window.stocks.length === 0 && <p className="text-sm rounded-lg p-4" style={{ backgroundColor: "var(--bg-inset)" }}>No eligible stock transactions found for this layer in this period. That does not mean nobody traded; our coverage is incomplete.</p>}
    {window.stocks.length > 5 && <button onClick={() => setExpandedLayer(expanded ? null : `${slug}:${period}`)} className="min-h-11 text-xs font-semibold mt-2" style={{ color: "var(--accent)" }}>{expanded ? "Show fewer stocks" : `Show all ${window.stocks.length} stocks with activity`}</button>}
    <p className="text-xs leading-relaxed mt-4" style={{ color: "var(--text-dim)" }}>Archive refreshed {activity.updatedAt.slice(0, 10)}. Readable House filings only; Senate and insider activity are not connected. Options and unresolved stock identities are excluded. Filers may report family holdings. This shows disclosed activity, not live buying or a recommendation.</p>
  </section>;
}
