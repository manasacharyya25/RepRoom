/** Canonical site origin for Open Graph / absolute URLs (no trailing slash). */
export function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

export const DEFAULT_OG_IMAGE = {
  url: "/images/og/default-card.png",
  width: 1024,
  height: 289,
  alt: "RhoQ — Work out together. Motivate each other."
} as const;

export const ONBOARD_OG_IMAGE = {
  url: "/images/onboard/og-card.png",
  width: 1024,
  height: 467,
  alt: "RhoQ — welcome aboard and get ready for live workout rooms"
} as const;
