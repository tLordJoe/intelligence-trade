import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./src/lib/insider-live.json", "./src/lib/institutions-live.json", "./src/lib/published-data/*.json.gz", "./data/security-master.json"],
  },
  async redirects() {
    return [
      // Canonical host: send www to the apex domain
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.outfoxmarkets.com" }],
        destination: "https://outfoxmarkets.com/:path*",
        permanent: true,
      },
      // Defensive domain: forward outfoxtrades.com traffic to the primary site
      {
        source: "/:path*",
        has: [{ type: "host", value: "outfoxtrades.com" }],
        destination: "https://outfoxmarkets.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.outfoxtrades.com" }],
        destination: "https://outfoxmarkets.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
