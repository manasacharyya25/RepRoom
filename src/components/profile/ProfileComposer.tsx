"use client";

import { useRef, useState } from "react";
import { MotivationQuoteCard } from "@/components/MotivationQuoteCard";
import {
  CAPTION_MAX_LENGTH,
  COMPOSER_TYPE_OPTIONS,
  resolveComposerType,
  type ComposerTypeId,
  type PostCategory,
  type PostKind
} from "@/lib/posts";

export type ComposerPublishPayload = {
  kind: PostKind;
  category: PostCategory;
  caption: string;
  location?: string;
  tags?: string[];
  /** Preview blob URLs for the upload card UI */
  image?: string;
  beforeImage?: string;
  afterImage?: string;
  /** Source files for compressed Storage upload */
  imageFile?: File;
  beforeFile?: File;
  afterFile?: File;
};

function ComposerTypeIcon({ id }: { id: ComposerTypeId }) {
  const srcById: Partial<Record<ComposerTypeId, string>> = {
    fit_check: "/images/icons/fit-check.png",
    pump_check: "/images/icons/pump-check.png",
    meal_prep: "/images/icons/meal-prep.png",
    weight_check: "/images/icons/weight-check.png",
    transformation: "/images/icons/before-after.png",
    achievement: "/images/icons/achievement.png",
    motivation: "/images/icons/motivation.png",
    goal_completed: "/images/icons/goal-completed.png"
  };

  const src = srcById[id];
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      aria-hidden
      className="profile-compose-type-icon-img"
      src={src}
    />
  );
}

export function ProfileComposer({
  onPublish
}: {
  onPublish: (payload: ComposerPublishPayload) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [composerType, setComposerType] = useState<ComposerTypeId>("fit_check");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [afterPreviewUrl, setAfterPreviewUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [showLocation, setShowLocation] = useState(false);
  const [showTags, setShowTags] = useState(false);

  const selectedType = resolveComposerType(composerType);
  const isTransform = selectedType?.kind === "transform";
  const isMotivation = selectedType?.category === "motivation";

  const canPost =
    Boolean(selectedType?.kind && selectedType.category) &&
    draft.trim().length > 0 &&
    (isMotivation
      ? true
      : isTransform
        ? Boolean(beforeFile && afterFile)
        : Boolean(imageFile));

  const clearMedia = (revoke = true) => {
    if (revoke) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (afterPreviewUrl) URL.revokeObjectURL(afterPreviewUrl);
    }
    setPreviewUrl(null);
    setAfterPreviewUrl(null);
    setImageFile(null);
    setBeforeFile(null);
    setAfterFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (beforeInputRef.current) beforeInputRef.current.value = "";
    if (afterInputRef.current) afterInputRef.current.value = "";
  };

  const clearComposer = (revokeMedia = true) => {
    setDraft("");
    clearMedia(revokeMedia);
    setLocation("");
    setTags([]);
    setTagDraft("");
    setShowLocation(false);
    setShowTags(false);
  };

  const onSelectImage = (
    file: File | null,
    slot: "main" | "before" | "after" = "main"
  ) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (slot === "after") {
      if (afterPreviewUrl) URL.revokeObjectURL(afterPreviewUrl);
      setAfterPreviewUrl(url);
      setAfterFile(file);
      return;
    }
    if (slot === "before") {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      setBeforeFile(file);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
    setImageFile(file);
  };

  const selectComposerType = (id: ComposerTypeId) => {
    const option = resolveComposerType(id);
    if (!option || option.auto) return;

    if (option.category === "motivation" || option.kind !== "transform") {
      if (afterPreviewUrl) {
        URL.revokeObjectURL(afterPreviewUrl);
        setAfterPreviewUrl(null);
      }
      setAfterFile(null);
      if (afterInputRef.current) afterInputRef.current.value = "";
    }
    if (option.category === "motivation") {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setImageFile(null);
      setBeforeFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (beforeInputRef.current) beforeInputRef.current.value = "";
    }
    if (option.kind === "transform") {
      setImageFile(null);
    } else if (option.category !== "motivation") {
      setBeforeFile(null);
    }
    setComposerType(id);
  };

  const commitTagDraft = () => {
    const raw = tagDraft.trim().replace(/^#/, "");
    if (!raw) return;
    const normalized = raw.toLowerCase().replace(/\s+/g, "");
    if (!normalized || tags.includes(normalized) || tags.length >= 8) {
      setTagDraft("");
      return;
    }
    setTags((prev) => [...prev, normalized]);
    setTagDraft("");
  };

  const publish = () => {
    if (!canPost || !selectedType?.kind || !selectedType.category) return;

    onPublish({
      kind: selectedType.kind,
      category: selectedType.category,
      caption: draft.trim(),
      image:
        isTransform || isMotivation ? undefined : previewUrl ?? undefined,
      beforeImage: isTransform ? previewUrl ?? undefined : undefined,
      afterImage: isTransform ? afterPreviewUrl ?? undefined : undefined,
      imageFile: isTransform || isMotivation ? undefined : imageFile ?? undefined,
      beforeFile: isTransform ? beforeFile ?? undefined : undefined,
      afterFile: isTransform ? afterFile ?? undefined : undefined,
      location: location.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined
    });
    // Keep blob URLs alive for the upload preview UI.
    clearComposer(false);
  };

  return (
    <div className="profile-composer">
      <div className="profile-compose-main">
        <h2>Share an update</h2>

        <section className="profile-compose-step">
          <h3>
            <span className="profile-compose-step-num">1</span>
            Choose post type
          </h3>

          <div className="profile-compose-type-grid" role="listbox" aria-label="Post type">
            {COMPOSER_TYPE_OPTIONS.map((option) => {
              const selected = composerType === option.id;
              const disabled = Boolean(option.auto);

              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-disabled={disabled}
                  disabled={disabled}
                  className={`profile-compose-type-card${
                    selected ? " is-active" : ""
                  }${disabled ? " is-auto" : ""}`}
                  onClick={() => selectComposerType(option.id)}
                >
                  {disabled ? (
                    <span className="profile-compose-auto-badge">Auto</span>
                  ) : selected ? (
                    <span className="profile-compose-check" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                  <span className="profile-compose-type-icon is-image">
                    <ComposerTypeIcon id={option.id} />
                  </span>
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              );
            })}
          </div>

          <p className="profile-compose-info">
            <span className="profile-compose-info-icon" aria-hidden>
              i
            </span>
            More post types coming soon. We keep it focused on fitness.
          </p>
        </section>

        {isMotivation ? (
          <section className="profile-compose-step">
            <h3>
              <span className="profile-compose-step-num">2</span>
              Write your quote
            </h3>

            <MotivationQuoteCard text={draft} />

            <div className="profile-compose-caption-wrap">
              <textarea
                className="profile-composer-input"
                placeholder="There is no finish line — only the community that keeps you going."
                rows={4}
                maxLength={CAPTION_MAX_LENGTH}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <span className="profile-compose-char-count">
                {draft.length}/{CAPTION_MAX_LENGTH}
              </span>
            </div>
          </section>
        ) : (
          <>
            <section className="profile-compose-step">
              <h3>
                <span className="profile-compose-step-num">2</span>
                {isTransform ? "Add your photos" : "Add your photo"}
              </h3>

              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  onSelectImage(event.target.files?.[0] ?? null, "main")
                }
              />
              <input
                ref={beforeInputRef}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  onSelectImage(event.target.files?.[0] ?? null, "before")
                }
              />
              <input
                ref={afterInputRef}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  onSelectImage(event.target.files?.[0] ?? null, "after")
                }
              />

              {isTransform ? (
                <div className="profile-compose-transform-grid">
                  <div className="profile-compose-transform-slot">
                    <span className="profile-compose-transform-label">Before</span>
                    {previewUrl ? (
                      <div className="profile-composer-preview">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt=""
                          src={previewUrl}
                          className="profile-composer-preview-image"
                        />
                        <button
                          type="button"
                          className="profile-composer-remove"
                          onClick={() => {
                            if (previewUrl) URL.revokeObjectURL(previewUrl);
                            setPreviewUrl(null);
                            setBeforeFile(null);
                            if (beforeInputRef.current) {
                              beforeInputRef.current.value = "";
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="profile-compose-dropzone"
                        onClick={() => beforeInputRef.current?.click()}
                      >
                        <span className="profile-compose-dropzone-icon" aria-hidden>
                          <svg viewBox="0 0 24 24" fill="none">
                            <path
                              d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
                              stroke="currentColor"
                              strokeWidth="1.7"
                            />
                            <path
                              d="M12 9v6M9 12h6"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                        <strong>Before photo</strong>
                        <span>JPG, PNG, WEBP · Max 10MB</span>
                      </button>
                    )}
                  </div>
                  <div className="profile-compose-transform-slot">
                    <span className="profile-compose-transform-label">After</span>
                    {afterPreviewUrl ? (
                      <div className="profile-composer-preview">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt=""
                          src={afterPreviewUrl}
                          className="profile-composer-preview-image"
                        />
                        <button
                          type="button"
                          className="profile-composer-remove"
                          onClick={() => {
                            if (afterPreviewUrl) {
                              URL.revokeObjectURL(afterPreviewUrl);
                            }
                            setAfterPreviewUrl(null);
                            setAfterFile(null);
                            if (afterInputRef.current) {
                              afterInputRef.current.value = "";
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="profile-compose-dropzone"
                        onClick={() => afterInputRef.current?.click()}
                      >
                        <span className="profile-compose-dropzone-icon" aria-hidden>
                          <svg viewBox="0 0 24 24" fill="none">
                            <path
                              d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
                              stroke="currentColor"
                              strokeWidth="1.7"
                            />
                            <path
                              d="M12 9v6M9 12h6"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                        <strong>After photo</strong>
                        <span>JPG, PNG, WEBP · Max 10MB</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="profile-composer-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    src={previewUrl}
                    className="profile-composer-preview-image"
                  />
                  <button
                    type="button"
                    className="profile-composer-remove"
                    onClick={() => {
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                      setImageFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="profile-compose-dropzone profile-compose-dropzone--lg"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="profile-compose-dropzone-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                      <path
                        d="M12 9v6M9 12h6"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <strong>Add a photo</strong>
                  <span>JPG, PNG, WEBP · Max 10MB</span>
                  <span className="profile-compose-dropzone-tip">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M9.5 18.5h5M10.2 21h3.6M12 3.5a5.5 5.5 0 0 1 3.3 9.9c-.7.5-1.1 1.3-1.1 2.1v.5h-4.4v-.5c0-.8-.4-1.6-1.1-2.1A5.5 5.5 0 0 1 12 3.5Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Use good lighting and clear photos for more engagement.
                  </span>
                </button>
              )}
            </section>

            <section className="profile-compose-step">
              <h3>
                <span className="profile-compose-step-num">3</span>
                Write your caption
              </h3>

              <div className="profile-compose-caption-wrap">
                <textarea
                  className="profile-composer-input"
                  placeholder="Write something about your update..."
                  rows={4}
                  maxLength={CAPTION_MAX_LENGTH}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <span className="profile-compose-char-count">
                  {draft.length}/{CAPTION_MAX_LENGTH}
                </span>
              </div>
            </section>
          </>
        )}

        {(showLocation || location) && (
          <div className="profile-compose-meta-field">
            <label className="sr-only" htmlFor="compose-location">
              Location
            </label>
            <input
              id="compose-location"
              className="profile-compose-meta-input"
              placeholder="Add a location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              autoFocus={showLocation && !location}
            />
            <button
              type="button"
              className="profile-compose-meta-clear"
              onClick={() => {
                setLocation("");
                setShowLocation(false);
              }}
            >
              Clear
            </button>
          </div>
        )}

        {(showTags || tags.length > 0) && (
          <div className="profile-compose-tags-editor">
            <div className="profile-compose-tag-chips">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="profile-compose-tag-chip"
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  title="Remove tag"
                >
                  #{tag} ×
                </button>
              ))}
            </div>
            {tags.length < 8 ? (
              <input
                className="profile-compose-meta-input"
                placeholder="Add a tag and press Enter"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    commitTagDraft();
                  }
                }}
                onBlur={commitTagDraft}
              />
            ) : null}
          </div>
        )}
      </div>

      <div className="profile-compose-toolbar">
        <div className="profile-compose-tools">
          <button
            type="button"
            className={`profile-compose-chip-btn${
              showLocation || location ? " is-active" : ""
            }`}
            onClick={() => setShowLocation((open) => !open || Boolean(location))}
          >
            <svg viewBox="0 0 24 24" aria-hidden fill="none">
              <path
                d="M12 21s6-5.2 6-10.2A6 6 0 0 0 6 10.8C6 15.8 12 21 12 21Z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <circle cx="12" cy="10.5" r="2.2" stroke="currentColor" strokeWidth="1.7" />
            </svg>
            Add location
          </button>
          <button
            type="button"
            className={`profile-compose-chip-btn${
              showTags || tags.length > 0 ? " is-active" : ""
            }`}
            onClick={() => setShowTags((open) => !open || tags.length > 0)}
          >
            <svg viewBox="0 0 24 24" aria-hidden fill="none">
              <path
                d="M10 4 8.2 20M15.8 4 14 20M5.5 9.5h13M4.5 14.5h13"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            Add tags
          </button>
        </div>

        <button
          type="button"
          className="profile-compose-post"
          disabled={!canPost}
          onClick={publish}
        >
          Post Update
        </button>
      </div>
    </div>
  );
}
