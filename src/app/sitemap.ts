import type { MetadataRoute } from "next";
import { layers } from "@/lib/data";
import { blogPosts } from "@/lib/blog-data";

const BASE = "https://outfoxmarkets.com";

/*
  The layer pages are the citable core of the site — the map of the AI
  economy — so they carry the highest priority after the homepage.
*/
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/congress`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/portfolio`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const layerPages: MetadataRoute.Sitemap = layers.map((layer) => ({
    url: `${BASE}/layer/${layer.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.9,
  }));

  const postPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...layerPages, ...postPages];
}
