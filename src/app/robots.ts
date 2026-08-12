import type { MetadataRoute } from "next";

const BASE = "https://outfoxmarkets.com";

/*
  Outfox wants to be read and cited — by search engines and by AI assistants
  alike. Everything public is open to crawlers; only API routes are excluded,
  since they return raw JSON that adds nothing to an index.
*/
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
