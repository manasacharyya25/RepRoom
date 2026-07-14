export type SocialPlatformId =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "website";

export type SocialLinks = {
  instagram_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  website_url: string | null;
};

export const SOCIAL_LINK_FIELDS: {
  id: SocialPlatformId;
  label: string;
  column: keyof SocialLinks;
  placeholder: string;
}[] = [
  {
    id: "instagram",
    label: "Instagram",
    column: "instagram_url",
    placeholder: "@you or instagram.com/you"
  },
  {
    id: "tiktok",
    label: "TikTok",
    column: "tiktok_url",
    placeholder: "@you or tiktok.com/@you"
  },
  {
    id: "youtube",
    label: "YouTube",
    column: "youtube_url",
    placeholder: "@channel or youtube.com/@you"
  },
  {
    id: "x",
    label: "X",
    column: "x_url",
    placeholder: "@you or x.com/you"
  },
  {
    id: "website",
    label: "Website",
    column: "website_url",
    placeholder: "https://yoursite.com"
  }
];

const BASE: Record<Exclude<SocialPlatformId, "website">, string> = {
  instagram: "https://instagram.com/",
  tiktok: "https://www.tiktok.com/@",
  youtube: "https://www.youtube.com/@",
  x: "https://x.com/"
};

function stripHandle(value: string) {
  return value.replace(/^@+/, "").trim();
}

function ensureHttps(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Normalize user input into a stored https URL, or null when empty. */
export function normalizeSocialLink(
  platform: SocialPlatformId,
  raw: string
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (platform === "website") {
    const url = ensureHttps(trimmed);
    if (!isValidHttpUrl(url)) {
      throw new Error("Enter a valid website URL.");
    }
    return url;
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.includes(".")) {
    const url = ensureHttps(trimmed);
    if (!isValidHttpUrl(url)) {
      throw new Error(`Enter a valid ${platform} link.`);
    }
    return url;
  }

  const handle = stripHandle(trimmed);
  if (!handle || /\s/.test(handle)) {
    throw new Error(`Enter a valid ${platform} username or URL.`);
  }

  return `${BASE[platform]}${handle}`;
}

export function normalizeSocialLinks(input: {
  instagram: string;
  tiktok: string;
  youtube: string;
  x: string;
  website: string;
}): SocialLinks {
  return {
    instagram_url: normalizeSocialLink("instagram", input.instagram),
    tiktok_url: normalizeSocialLink("tiktok", input.tiktok),
    youtube_url: normalizeSocialLink("youtube", input.youtube),
    x_url: normalizeSocialLink("x", input.x),
    website_url: normalizeSocialLink("website", input.website)
  };
}

/** Short label for inputs (prefer handle / hostname). */
export function socialLinkInputValue(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "");

    if (host.includes("instagram.com") && path) return path.slice(1);
    if (host.includes("tiktok.com") && path.startsWith("/@")) return path.slice(1);
    if (host.includes("youtube.com") && path.startsWith("/@")) return path.slice(1);
    if ((host === "x.com" || host === "twitter.com") && path) {
      return path.slice(1);
    }
    if (path && path !== "/") return `${host}${path}`;
    return host;
  } catch {
    return url;
  }
}

export function profileHasSocialLinks(links: Partial<SocialLinks> | null | undefined) {
  if (!links) return false;
  return SOCIAL_LINK_FIELDS.some((field) => Boolean(links[field.column]));
}
