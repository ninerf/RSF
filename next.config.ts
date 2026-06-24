import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles output automatically; no need for "standalone".
  // Allow Zillow CDN images if next/image is ever used.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.zillowstatic.com" },
      { protocol: "https", hostname: "**.zillow.com" },
    ],
  },
};

export default nextConfig;
