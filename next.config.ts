import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Avoid long-lived optimized cache while iterating on public/ mock assets.
    minimumCacheTTL: 60
  }
};

export default nextConfig;
