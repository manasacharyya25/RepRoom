"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { MotivationQuoteCard } from "@/components/MotivationQuoteCard";
import type { ComposerPublishPayload } from "@/components/profile/ProfileComposer";

type PostUploadPreviewProps = {
  payload: ComposerPublishPayload;
  author: string;
  handle: string;
  avatarSrc: string;
  onComplete: () => void;
};

function formatCaption(caption: string, tags?: string[]) {
  const parts: { text: string; tag?: boolean }[] = [];
  const regex = /#([\w]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(caption)) !== null) {
    if (match.index > last) {
      parts.push({ text: caption.slice(last, match.index) });
    }
    parts.push({ text: `#${match[1]}`, tag: true });
    last = match.index + match[0].length;
  }
  if (last < caption.length) {
    parts.push({ text: caption.slice(last) });
  }

  const existing = new Set(
    parts.filter((p) => p.tag).map((p) => p.text.slice(1).toLowerCase())
  );
  const extras = (tags ?? []).filter((tag) => !existing.has(tag.toLowerCase()));

  return { parts: parts.length > 0 ? parts : [{ text: caption }], extras };
}

export function PostUploadPreview({
  payload,
  author,
  handle,
  avatarSrc,
  onComplete
}: PostUploadPreviewProps) {
  const [progress, setProgress] = useState(0);
  const { parts, extras } = formatCaption(payload.caption, payload.tags);
  const isTransform =
    payload.kind === "transform" &&
    Boolean(payload.beforeImage && payload.afterImage);
  const isMotivation = payload.category === "motivation";
  const cover = isTransform
    ? payload.afterImage
    : payload.image ?? payload.afterImage ?? payload.beforeImage;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const durationMs = 2200;
    const started = performance.now();
    let frame = 0;
    let finished = false;

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / durationMs);
      // Ease-out cubic so it feels like a real upload.
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.round(eased * 100));

      if (t < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }

      if (!finished) {
        finished = true;
        window.setTimeout(onComplete, 280);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => {
      document.body.style.overflow = previousOverflow;
      cancelAnimationFrame(frame);
    };
  }, [onComplete]);

  return (
    <div className="post-upload-backdrop" role="presentation">
      <article
        className="post-upload-card feed-post"
        role="status"
        aria-live="polite"
        aria-label="Uploading post"
      >
        <div
          className="post-upload-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Upload progress"
        >
          <span
            className="post-upload-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="feed-post-top">
          <div className="feed-post-avatar">
            <Image
              alt=""
              className="feed-post-avatar-image"
              fill
              sizes="36px"
              src={avatarSrc}
              unoptimized={
                avatarSrc.startsWith("blob:") ||
                avatarSrc.includes("supabase.co")
              }
            />
          </div>
          <div>
            <p className="feed-post-author">{author}</p>
            <p className="feed-post-handle">{handle}</p>
          </div>
        </div>

        {isMotivation ? (
          <MotivationQuoteCard text={payload.caption} />
        ) : isTransform && payload.beforeImage && payload.afterImage ? (
          <div className="post-upload-media">
            <BeforeAfterSlider
              afterSrc={payload.afterImage}
              beforeSrc={payload.beforeImage}
            />
          </div>
        ) : cover ? (
          <div className="post-upload-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="post-upload-image" src={cover} />
          </div>
        ) : null}

        {!isMotivation ? (
          <p className="feed-post-caption">
            {parts.map((part, index) =>
              part.tag ? (
                <span className="feed-post-hashtag" key={`t-${index}`}>
                  {part.text}
                </span>
              ) : (
                <span key={`c-${index}`}>{part.text}</span>
              )
            )}
            {extras.map((tag) => (
              <span className="feed-post-hashtag" key={tag}>
                {" "}
                #{tag}
              </span>
            ))}
          </p>
        ) : extras.length > 0 ? (
          <p className="feed-post-caption">
            {extras.map((tag) => (
              <span className="feed-post-hashtag" key={tag}>
                #{tag}{" "}
              </span>
            ))}
          </p>
        ) : null}

        <div className="feed-post-actions">
          <span className="feed-post-action">
            <span aria-hidden>♡</span> 0
          </span>
          <span className="feed-post-action">
            <span aria-hidden>💬</span> 0
          </span>
        </div>
      </article>
    </div>
  );
}
