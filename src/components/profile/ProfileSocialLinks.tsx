import type { SocialLinks, SocialPlatformId } from "@/lib/social-links";
import { SOCIAL_LINK_FIELDS, profileHasSocialLinks } from "@/lib/social-links";

function SocialIcon({ id }: { id: SocialPlatformId }) {
  switch (id) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden fill="none">
          <rect
            x="3.5"
            y="3.5"
            width="17"
            height="17"
            rx="5"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" aria-hidden fill="none">
          <path
            d="M14 4.5c.7 2.2 2.3 3.6 4.5 4v3.1c-1.7-.1-3.2-.7-4.5-1.7v5.7A5.4 5.4 0 1 1 8.6 10.3v3.2a2.2 2.2 0 1 0 2.2 2.2V4.5H14Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" aria-hidden fill="none">
          <rect
            x="2.75"
            y="6"
            width="18.5"
            height="12"
            rx="3.2"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path d="M10.5 9.8v4.4L14.8 12 10.5 9.8Z" fill="currentColor" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" aria-hidden fill="none">
          <path
            d="M6.5 5.5h3.1l3 4.2 3.7-4.2H19l-5.1 5.8L19.5 18.5h-3.1l-3.3-4.5-4 4.5H6l5.4-6.1L6.5 5.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "website":
      return (
        <svg viewBox="0 0 24 24" aria-hidden fill="none">
          <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M3.75 12h16.5M12 3.75c2.2 2.4 3.3 5.1 3.3 8.25S14.2 17.85 12 20.25c-2.2-2.4-3.3-5.1-3.3-8.25S9.8 6.15 12 3.75Z"
            stroke="currentColor"
            strokeWidth="1.7"
          />
        </svg>
      );
  }
}

export function ProfileSocialLinks({
  links
}: {
  links: Partial<SocialLinks> | null | undefined;
}) {
  if (!profileHasSocialLinks(links)) return null;

  return (
    <ul className="profile-social-links" aria-label="Social links">
      {SOCIAL_LINK_FIELDS.map((field) => {
        const href = links?.[field.column];
        if (!href) return null;
        return (
          <li key={field.id}>
            <a
              className="profile-social-link"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={field.label}
              title={field.label}
            >
              <SocialIcon id={field.id} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
