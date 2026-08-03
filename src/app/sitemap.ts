import type { MetadataRoute } from "next";
import { isRoomComingSoon, WORKOUT_ROOMS } from "@/lib/rooms";
import { resolveSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${base}/rooms`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: `${base}/feed`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5
    },
    {
      url: `${base}/about`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3
    },
    {
      url: `${base}/community-guidelines`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3
    },
    {
      url: `${base}/credits`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3
    }
  ];

  const roomRoutes: MetadataRoute.Sitemap = WORKOUT_ROOMS.filter(
    (room) => !isRoomComingSoon(room.id)
  ).map((room) => ({
    url: `${base}/rooms/${room.id}`,
    lastModified: now,
    changeFrequency: "hourly" as const,
    priority: 0.85
  }));

  return [...staticRoutes, ...roomRoutes];
}
