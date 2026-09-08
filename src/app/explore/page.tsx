import type { Metadata } from "next";
import ExploreBuildout from "@/components/ExploreBuildout";
import { previewAccessFromEnv } from "@/lib/funds/access";

export const metadata: Metadata = {
  title: "Explore the AI buildout",
  description: "Explore ten industries behind the AI supply chain, with company context, market data, and sourced explanations.",
  alternates: { canonical: "/explore" },
};

export default function ExplorePage() {
  return <ExploreBuildout showCompare={previewAccessFromEnv().allowed} />;
}
