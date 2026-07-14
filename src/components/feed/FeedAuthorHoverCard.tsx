"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { FeedAuthorPreview } from "@/lib/feed-posts";

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

export function FeedAuthorHoverCard({
  author,
  size = 32,
  className
}: {
  author: FeedAuthorPreview;
  size?: number;
  className?: string;
}) {
  const cardId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);

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

  return (
    <div
      ref={rootRef}
      className={`feed-author-hover${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onFocus={scheduleOpen}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) {
          scheduleClose();
        }
      }}
    >
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

      {open ? (
        <div
          id={cardId}
          className="feed-author-card"
          role="dialog"
          aria-label={`${author.name} profile`}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
