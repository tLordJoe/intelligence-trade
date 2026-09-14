import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import DisclosureCard from "@/components/DisclosureCard";
import liveData from "@/lib/congress-live.json";
import type { DisclosureRecord } from "@/lib/congress-schema";
import { buildFilerProfile, filerProfilePath, filerKeyFromRoute } from "@/lib/filer-profile";
import { resolvePortrait, srcOrNull } from "@/lib/image-library";
import { previewAccessFromEnv } from "@/lib/funds/access";

export default async function FilerPage({ params, searchParams }: {
  params: Promise<{ filer: string }>; searchParams: Promise<{ page?: string }>;
}) {
  const { filer } = await params;
  const query = await searchParams;
  const key = filerKeyFromRoute(filer);
  if (!key) notFound();
  const profile = buildFilerProfile(liveData.trades as DisclosureRecord[], key, new Date().toISOString().slice(0, 10));
  if (!profile) notFound();
  const pages = Math.max(1, Math.ceil(profile.records.length / 20));
  const requested = Number(query.page ?? "1");
  const page = Number.isInteger(requested) ? Math.min(pages, Math.max(1, requested)) : 1;
  const portrait = srcOrNull(resolvePortrait({ filerKey: profile.key, name: profile.name, chamber: "House", state: profile.state, district: profile.district }));
  return <><Navbar showCompare={previewAccessFromEnv().allowed} /><main className="max-w-7xl w-full mx-auto px-4 md:px-8 py-8 flex-1">
    <Link className="text-sm underline inline-flex min-h-11 items-center" href="/">← Back to what they’re trading</Link>
    <header className="flex items-center gap-5 my-7">
      {portrait && <Image src={portrait} alt={profile.name} width={90} height={110} className="rounded-xl" />}
      <div><p className="kicker mb-2">House disclosure profile</p><h1 className="text-3xl md:text-5xl font-extrabold">{profile.name}</h1><p className="text-sm mt-3" style={{ color: "var(--text-dim)" }}>{profile.district || profile.state} as reported in filings · Archive refreshed {liveData.updatedAt.slice(0, 10)}</p></div>
    </header>
    <p className="max-w-3xl text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>Disclosed activity across the available archive, including reported family holdings. These are filing records, not a complete portfolio or verified personal investment returns.</p>
    <dl className="flex flex-wrap gap-10 my-7">{[["Purchase records", profile.purchases], ["Sale records", profile.sales], ["Distinct filings", profile.filingCount]].map(([label, value]) => <div key={label}><dt className="text-xs" style={{ color: "var(--text-dim)" }}>{label}</dt><dd className="text-3xl font-bold mt-1">{value}</dd></div>)}</dl>
    <h2 className="text-2xl font-bold mb-3">Disclosure history</h2><p className="text-xs mb-5" style={{ color: "var(--text-dim)" }}>Newest filings first · Page {page} of {pages} · Original evidence linked on each record</p>
    <div className="grid md:grid-cols-2 gap-4">{profile.records.slice((page - 1) * 20, page * 20).map(record => <DisclosureCard key={record.id} record={record} />)}</div>
    <nav className="flex gap-8 my-6" aria-label="Filer disclosure pages">{page > 1 && <Link className="underline min-h-11 inline-flex items-center" href={`${filerProfilePath(profile.key)}?page=${page - 1}`}>← Previous</Link>}{page < pages && <Link className="underline min-h-11 inline-flex items-center" href={`${filerProfilePath(profile.key)}?page=${page + 1}`}>Next →</Link>}</nav>
    <p className="text-xs max-w-3xl leading-relaxed" style={{ color: "var(--text-dim)" }}>Stock-performance comparisons and estimated holdings are not connected yet. Nothing here represents actual personal profit. Name and district matching is scoped to this archive; it is not a government-issued identity key.</p>
  </main><SiteFooter /></>;
}
