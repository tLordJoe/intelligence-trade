import type { MetadataRoute } from "next";
import { layers } from "@/lib/data";
import { blogPosts } from "@/lib/blog-data";

const BASE_URL = "https://outfoxmarkets.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/congress`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/methodology`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/corrections`, changeFrequency: "monthly", priority: 0.6 },
  ];

  const layerPages: MetadataRoute.Sitemap = layers.map((layer) => ({
    url: `${BASE_URL}/layer/${layer.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const articlePages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...layerPages, ...articlePages];
}
