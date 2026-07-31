import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = resolveSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/rhoq-admin",
          "/rhoq-admin/",
          "/onboard/",
          "/onboarding",
          "/billing/",
          "/profile",
          "/inbox",
          "/auth/"
        ]
      }
    ],
    sitemap: `${base}/sitemap.xml`
  };
}
