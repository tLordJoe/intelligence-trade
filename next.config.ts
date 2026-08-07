import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
