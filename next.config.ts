import type { NextConfig } from "next";

function hostnameFromUrl(raw: string | undefined) {
  try {
    return raw?.trim() ? new URL(raw.trim()).hostname : null;
  } catch {
    return null;
  }
}

const supabaseHostname = hostnameFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const r2Hostname =
  hostnameFromUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL) ||
  hostnameFromUrl(process.env.R2_PUBLIC_BASE_URL);

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];

if (supabaseHostname) {
  remotePatterns.push({
    protocol: "https",
    hostname: supabaseHostname,
    pathname: "/storage/v1/object/public/**"
  });
}

if (r2Hostname) {
  remotePatterns.push({
    protocol: "https",
    hostname: r2Hostname,
    pathname: "/**"
  });
}

const nextConfig: NextConfig = {
  images: {
    // Avoid long-lived optimized cache while iterating on public/ mock assets.
    minimumCacheTTL: 60,
    remotePatterns
  }
};

export default nextConfig;
