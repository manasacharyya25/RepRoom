"use client";

import { useEffect, useRef, useState } from "react";
import { PostUploadPreview } from "@/components/profile/PostUploadPreview";
import {
  CAPTION_MAX_LENGTH,
  COMPOSER_TYPE_OPTIONS,
  extractHashtagsFromText,
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

type LocationSuggestion = {
  placeId: number | null;
  displayName: string;
  name: string | null;
};

const PILL_OPTIONS = COMPOSER_TYPE_OPTIONS.filter(
  (option) => !option.auto && option.id !== "motivation"
);

export function ProfileComposer({
  onPublish,
  author,
  handle,
  avatarSrc
}: {
  onPublish: (payload: ComposerPublishPayload) => void;
  author: string;
  handle: string;
  avatarSrc: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);
  const locationBlurTimer = useRef<number | null>(null);
  const [draft, setDraft] = useState("");
  /** null = text-only motivation post */
  const [composerType, setComposerType] = useState<ComposerTypeId | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [afterPreviewUrl, setAfterPreviewUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [location, setLocation] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<
    LocationSuggestion[]
  >([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [draftPreview, setDraftPreview] =
    useState<ComposerPublishPayload | null>(null);

  const selectedType = composerType ? resolveComposerType(composerType) : null;
  const isTransform = selectedType?.kind === "transform";
  const isTextOnly = !selectedType;

  const canPost =
    draft.trim().length > 0 &&
    (isTextOnly
      ? true
      : isTransform
        ? Boolean(beforeFile && afterFile)
        : Boolean(imageFile));

  useEffect(() => {
    if (!showLocation) return;
    const q = locationQuery.trim();
    if (q.length < 2) {
      setLocationSuggestions([]);
      setLocationLoading(false);
      return;
    }

    let cancelled = false;
    setLocationLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/geo/search?q=${encodeURIComponent(q)}`
          );
          const data = (await response.json().catch(() => null)) as {
            results?: LocationSuggestion[];
          } | null;
          if (cancelled) return;
          setLocationSuggestions(
            Array.isArray(data?.results) ? data.results.slice(0, 10) : []
          );
          setShowLocationMenu(true);
        } catch {
          if (!cancelled) setLocationSuggestions([]);
        } finally {
          if (!cancelled) setLocationLoading(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [locationQuery, showLocation]);

  useEffect(() => {
    return () => {
      if (locationBlurTimer.current) {
        window.clearTimeout(locationBlurTimer.current);
      }
    };
  }, []);

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
    setComposerType(null);
    setLocation("");
    setLocationQuery("");
    setLocationSuggestions([]);
    setShowLocation(false);
    setShowLocationMenu(false);
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

  const togglePill = (id: ComposerTypeId) => {
    const option = resolveComposerType(id);
    if (!option || option.auto) return;

    if (composerType === id) {
      clearMedia();
      setComposerType(null);
      return;
    }

    clearMedia();
    setComposerType(id);
  };

  const buildPayload = (): ComposerPublishPayload | null => {
    if (!canPost) return null;
    const caption = draft.trim();
    const tags = extractHashtagsFromText(caption);
    const locationValue = location.trim() || undefined;

    if (isTextOnly) {
      return {
        kind: "standard",
        category: "motivation",
        caption,
        location: locationValue,
        tags: tags.length > 0 ? tags : undefined
      };
    }
    if (!selectedType?.kind || !selectedType.category) return null;
    return {
      kind: selectedType.kind,
      category: selectedType.category,
      caption,
      image: isTransform ? undefined : previewUrl ?? undefined,
      beforeImage: isTransform ? previewUrl ?? undefined : undefined,
      afterImage: isTransform ? afterPreviewUrl ?? undefined : undefined,
      imageFile: isTransform ? undefined : imageFile ?? undefined,
      beforeFile: isTransform ? beforeFile ?? undefined : undefined,
      afterFile: isTransform ? afterFile ?? undefined : undefined,
      location: locationValue,
      tags: tags.length > 0 ? tags : undefined
    };
  };

  const publish = () => {
    const payload = buildPayload();
    if (!payload) return;
    onPublish(payload);
    clearComposer(false);
  };

  const preview = () => {
    const payload = buildPayload();
    if (!payload) return;
    setDraftPreview(payload);
  };

  const confirmDraftPost = () => {
    if (!draftPreview) return;
    const payload = draftPreview;
    setDraftPreview(null);
    onPublish(payload);
    clearComposer(false);
  };

  const pickLocation = (suggestion: LocationSuggestion) => {
    setLocation(suggestion.displayName);
    setLocationQuery(suggestion.displayName);
    setLocationSuggestions([]);
    setShowLocationMenu(false);
  };

  return (
    <div className="profile-composer">
      <div className="profile-compose-main">
        <h2>Share an update</h2>

        <div
          className={`profile-compose-shell${
            selectedType ? " has-media" : ""
          }`}
        >
          <div className="profile-compose-text-col">
            <div className="profile-compose-caption-wrap">
              <textarea
                className="profile-composer-input"
                placeholder={
                  isTextOnly
                    ? "Share a thought with the community… Use #tags in your text."
                    : "Write something about your update… Use #tags in your text."
                }
                rows={4}
                maxLength={CAPTION_MAX_LENGTH}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <span className="profile-compose-char-count">
                {draft.length}/{CAPTION_MAX_LENGTH}
              </span>
            </div>
          </div>

          {selectedType ? (
            <div className="profile-compose-media-col">
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
                <div className="profile-compose-transform-grid profile-compose-transform-grid--compact">
                  <div className="profile-compose-transform-slot">
                    <span className="profile-compose-transform-label">
                      Before
                    </span>
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
                        <strong>Before</strong>
                        <span>Add photo</span>
                      </button>
                    )}
                  </div>
                  <div className="profile-compose-transform-slot">
                    <span className="profile-compose-transform-label">
                      After
                    </span>
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
                        <strong>After</strong>
                        <span>Add photo</span>
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
                  className="profile-compose-dropzone profile-compose-dropzone--side"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <strong>Add a photo</strong>
                  <span>JPG, PNG, WEBP</span>
                </button>
              )}
            </div>
          ) : null}
        </div>

        <div
          className="profile-compose-pills"
          role="group"
          aria-label="Post type"
        >
          {PILL_OPTIONS.map((option) => {
            const selected = composerType === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`profile-compose-pill${
                  selected ? " is-active" : ""
                }`}
                aria-pressed={selected}
                onClick={() => togglePill(option.id)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {(showLocation || location) && (
          <div className="profile-compose-location">
            <div className="profile-compose-meta-field">
              <label className="sr-only" htmlFor="compose-location">
                Location
              </label>
              <input
                id="compose-location"
                className="profile-compose-meta-input"
                placeholder="Search for a place"
                value={locationQuery}
                autoComplete="off"
                autoFocus={showLocation && !location}
                onChange={(event) => {
                  setLocationQuery(event.target.value);
                  if (location) setLocation("");
                }}
                onFocus={() => {
                  if (locationSuggestions.length > 0) setShowLocationMenu(true);
                }}
                onBlur={() => {
                  locationBlurTimer.current = window.setTimeout(() => {
                    setShowLocationMenu(false);
                  }, 150);
                }}
              />
              <button
                type="button"
                className="profile-compose-meta-clear"
                onClick={() => {
                  setLocation("");
                  setLocationQuery("");
                  setLocationSuggestions([]);
                  setShowLocation(false);
                  setShowLocationMenu(false);
                }}
              >
                Clear
              </button>
            </div>

            {showLocationMenu &&
            (locationLoading || locationSuggestions.length > 0) ? (
              <ul className="profile-compose-location-menu" role="listbox">
                {locationLoading && locationSuggestions.length === 0 ? (
                  <li className="profile-compose-location-empty">Searching…</li>
                ) : (
                  locationSuggestions.map((suggestion) => (
                    <li key={`${suggestion.placeId}-${suggestion.displayName}`}>
                      <button
                        type="button"
                        className="profile-compose-location-option"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pickLocation(suggestion)}
                      >
                        {suggestion.displayName}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}

            <p className="profile-compose-location-attribution">
              Location search ©{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
              >
                OpenStreetMap
              </a>{" "}
              contributors
            </p>
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
            onClick={() =>
              setShowLocation((open) => !open || Boolean(location))
            }
          >
            Add location
          </button>
        </div>

        <div className="profile-compose-toolbar-actions">
          <button
            type="button"
            className="profile-compose-preview"
            disabled={!canPost}
            onClick={preview}
          >
            Preview
          </button>
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

      {draftPreview ? (
        <PostUploadPreview
          payload={draftPreview}
          author={author}
          handle={handle}
          avatarSrc={avatarSrc}
          onCloseDraft={() => setDraftPreview(null)}
          onConfirmPost={confirmDraftPost}
        />
      ) : null}
    </div>
  );
}
