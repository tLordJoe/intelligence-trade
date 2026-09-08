import type { Metadata } from "next";
import ExploreBuildout from "@/components/ExploreBuildout";
import { previewAccessFromEnv } from "@/lib/funds/access";
import { layers } from "@/lib/data";
import liveData from "@/lib/congress-live.json";
import type { DisclosureRecord } from "@/lib/congress-schema";
import { buildLayerActivity } from "@/lib/layer-activity";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Explore the AI buildout",
  description: "Explore ten industries behind the AI supply chain, with company context, market data, and sourced explanations.",
  alternates: { canonical: "/explore" },
};

export default function ExplorePage() {
  const activity = buildLayerActivity(liveData.trades as DisclosureRecord[], layers,
    liveData.updatedAt, new Date().toISOString().slice(0, 10));
  return <ExploreBuildout showCompare={previewAccessFromEnv().allowed} activity={activity} />;
}
