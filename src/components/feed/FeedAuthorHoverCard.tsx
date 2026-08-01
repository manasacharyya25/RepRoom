"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import type { FeedAuthorPreview } from "@/lib/feed-posts";
import { createClient } from "@/lib/supabase/client";
import { followUser, isFollowing, unfollowUser } from "@/lib/social-api";

function isRemoteSrc(src: string) {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("blob:")
  );
}

function AgeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.75 19.25c.9-3.1 3.2-4.75 6.25-4.75s5.35 1.65 6.25 4.75"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CountryIcon() {
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

function HoursIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 8v4.25l2.75 1.75"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M10 5.75h-2.5A2.75 2.75 0 0 0 4.75 8.5v9A2.75 2.75 0 0 0 7.5 20.25h9a2.75 2.75 0 0 0 2.75-2.75V15.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M12.75 12.75 19.25 6.25M14.5 5.75h4.75V10.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FollowIcon({ following }: { following: boolean }) {
  if (following) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden fill="none">
        <path
          d="M9 11a3.25 3.25 0 1 0 0-6.5A3.25 3.25 0 0 0 9 11Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M3.75 18.25c0-2.7 2.15-4.9 4.8-4.9h1.1c1.35 0 2.55.6 3.35 1.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="m14.5 14.75 1.75 1.75 3.25-3.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M9 11a3.25 3.25 0 1 0 0-6.5A3.25 3.25 0 0 0 9 11Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3.75 18.25c0-2.7 2.15-4.9 4.8-4.9h1.1c1.35 0 2.55.6 3.35 1.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M17.5 10.5v5M15 13h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M5.75 6.75h12.5A2 2 0 0 1 20.25 8.75v6.5a2 2 0 0 1-2 2H11l-3.75 2.5V17.25h-1.5a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FeedAuthorHoverCard({
  author,
  size = 32,
  className,
  children,
  cardPlacement = "below",
  portal = false
}: {
  author: FeedAuthorPreview;
  size?: number;
  className?: string;
  /** Custom trigger (e.g. room tile name). Defaults to avatar button. */
  children?: ReactNode;
  cardPlacement?: "below" | "above";
  /** Render the preview card in a portal so overflow parents cannot clip it. */
  portal?: boolean;
}) {
  const cardId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [portalStyle, setPortalStyle] = useState<CSSProperties | null>(null);

  const clearTimers = () => {
    if (openTimer.current != null) window.clearTimeout(openTimer.current);
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  const scheduleOpen = () => {
    clearTimers();
    openTimer.current = window.setTimeout(() => setOpen(true), 160);
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user || user.id === author.id) {
          setIsSelf(Boolean(user && user.id === author.id));
          setFollowing(false);
          return;
        }
        setIsSelf(false);
        const value = await isFollowing(supabase, author.id);
        if (!cancelled) setFollowing(value);
      } catch {
        if (!cancelled) setFollowing(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, author.id]);

  useLayoutEffect(() => {
    if (!open || !portal) {
      setPortalStyle(null);
      return;
    }

    const update = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(240, window.innerWidth - 32);
      let left = rect.left;
      left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
      const belowTop = rect.bottom + 8;
      const aboveTop = rect.top - 8;
      const placeAbove =
        cardPlacement === "above" ||
        (cardPlacement === "below" &&
          belowTop + 220 > window.innerHeight &&
          aboveTop > 220);

      setPortalStyle({
        position: "fixed",
        top: placeAbove ? undefined : belowTop,
        bottom: placeAbove ? window.innerHeight - aboveTop : undefined,
        left,
        width,
        zIndex: 200
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, portal, cardPlacement]);

  const metrics = [
    {
      key: "age",
      label: "Age",
      value: author.ageLabel,
      icon: <AgeIcon />
    },
    {
      key: "country",
      label: "Country",
      value: author.countryLabel,
      icon: <CountryIcon />
    },
    {
      key: "hours",
      label: "Hours worked",
      value: author.hoursLabel,
      icon: <HoursIcon />
    }
  ].filter((metric) => Boolean(metric.value));

  const toggleFollow = async () => {
    if (followBusy || isSelf) return;
    setFollowBusy(true);
    try {
      const supabase = createClient();
      if (following) {
        await unfollowUser(supabase, author.id);
        setFollowing(false);
      } else {
        await followUser(supabase, author.id);
        setFollowing(true);
      }
    } catch {
      // Keep prior follow state on failure.
    } finally {
      setFollowBusy(false);
    }
  };

  const hasCustomTrigger = Boolean(children);

  const card = open ? (
    <div
      id={cardId}
      className={`feed-author-card${
        !portal && cardPlacement === "above" ? " feed-author-card--above" : ""
      }${portal ? " feed-author-card--portal" : ""}`}
      role="dialog"
      aria-label={`${author.name} profile`}
      style={portal ? portalStyle ?? undefined : undefined}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <div className="feed-author-card-top">
        <div className="feed-author-card-avatar">
          <Image
            alt=""
            className="feed-post-avatar-image"
            fill
            sizes="44px"
            src={author.avatar}
            unoptimized={isRemoteSrc(author.avatar)}
          />
        </div>
        <div className="feed-author-card-copy">
          <p className="feed-author-card-name">{author.name}</p>
          <p className="feed-author-card-handle">{author.handle}</p>
        </div>
      </div>

      <div className="feed-author-card-footer">
        {metrics.length > 0 ? (
          <ul className="feed-author-card-meta">
            {metrics.map((metric) => (
              <li
                key={metric.key}
                className="feed-author-card-metric"
                aria-label={`${metric.label}: ${metric.value}`}
              >
                <span className="feed-author-card-metric-icon" aria-hidden>
                  {metric.icon}
                </span>
                <span>{metric.value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="feed-author-card-footer-spacer" aria-hidden />
        )}
        <div className="feed-author-card-actions">
          {!isSelf ? (
            <>
              <button
                type="button"
                className={`feed-author-card-profile-btn${
                  following ? " is-active" : ""
                }`}
                aria-label={
                  following
                    ? `Unfollow ${author.name}`
                    : `Follow ${author.name}`
                }
                title={following ? "Following" : "Follow"}
                disabled={followBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleFollow();
                }}
              >
                <FollowIcon following={following} />
              </button>
              <button
                type="button"
                className="feed-author-card-profile-btn"
                aria-label={`Message ${author.name}`}
                title="Message"
                onClick={(event) => {
                  event.stopPropagation();
                  router.push(
                    `${pathname}?dm=${encodeURIComponent(author.id)}`
                  );
                }}
              >
                <MessageIcon />
              </button>
            </>
          ) : null}
          {author.profileHref ? (
            <Link
              href={author.profileHref}
              className="feed-author-card-profile-btn"
              aria-label={`View ${author.name}'s profile`}
              title="View profile"
              onClick={(event) => event.stopPropagation()}
            >
              <ProfileIcon />
            </Link>
          ) : (
            <span
              className="feed-author-card-profile-btn is-disabled"
              aria-hidden
            >
              <ProfileIcon />
            </span>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`feed-author-hover${hasCustomTrigger ? " feed-author-hover--custom" : ""}${className ? ` ${className}` : ""}`}
      style={hasCustomTrigger ? undefined : { width: size, height: size }}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onFocus={scheduleOpen}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) {
          scheduleClose();
        }
      }}
    >
      {hasCustomTrigger ? (
        <button
          type="button"
          className="feed-author-hover-trigger feed-author-hover-trigger--custom"
          aria-describedby={open ? cardId : undefined}
          aria-expanded={open}
          aria-label={`${author.name} profile preview`}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {children}
        </button>
      ) : (
        <button
          type="button"
          className="feed-author-hover-trigger"
          aria-describedby={open ? cardId : undefined}
          aria-expanded={open}
          aria-label={`${author.name} profile preview`}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <span
            className="feed-post-avatar"
            style={{ width: size, height: size }}
          >
            <Image
              alt=""
              className="feed-post-avatar-image"
              fill
              sizes={`${size}px`}
              src={author.avatar}
              unoptimized={isRemoteSrc(author.avatar)}
            />
          </span>
        </button>
      )}

      {portal && typeof document !== "undefined"
        ? card
          ? createPortal(card, document.body)
          : null
        : card}
    </div>
  );
}
