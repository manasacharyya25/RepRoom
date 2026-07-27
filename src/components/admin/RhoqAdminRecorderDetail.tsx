"use client";

import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent
} from "react";
import { RhoqAdminShell } from "@/components/admin/RhoqAdminShell";
import { OnboardingSessionPlayer } from "@/components/onboard/OnboardingSessionPlayer";
import { WORKOUT_ROOMS, type RoomId } from "@/lib/rooms";

const MAX_ONBOARDING_IMAGES = 5;

type Recording = {
  sessionId: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  lastChunkNumber: number;
  r2Folder: string;
};

type LibraryImage = {
  imageId: string;
  publicUrl: string | null;
  originalFilename: string | null;
  createdAt: string;
};

type RecorderDetail = {
  id: string;
  username: string;
  maxSeconds: number;
  secondsUsed: number;
  active: boolean;
  promotedAt: string | null;
  promotedUserId: string | null;
};

type RhoqAdminRecorderDetailProps = {
  recorderId: string;
};

export function RhoqAdminRecorderDetail({
  recorderId
}: RhoqAdminRecorderDetailProps) {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [recorder, setRecorder] = useState<RecorderDetail | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedImages, setSelectedImages] = useState<Set<string>>(
    () => new Set()
  );
  const [roomId, setRoomId] = useState<RoomId>("workout");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promoteSuccess, setPromoteSuccess] = useState<string | null>(null);
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (options?: { silent?: boolean; keepSelection?: boolean }) => {
      const silent = Boolean(options?.silent);
      const keepSelection = Boolean(options?.keepSelection);
      if (!silent) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const response = await fetch(`/api/rhoq-admin/recorders/${recorderId}`);
        const data = (await response.json().catch(() => null)) as {
          recorder?: RecorderDetail;
          recordings?: Recording[];
          images?: LibraryImage[];
          error?: string;
        } | null;
        if (response.status === 401) {
          setLoadError("Unauthorized");
          return;
        }
        if (!response.ok) {
          throw new Error(data?.error || "Could not load recorder");
        }
        setRecorder(data?.recorder ?? null);
        const nextRecordings = data?.recordings ?? [];
        const nextImages = data?.images ?? [];
        setRecordings(nextRecordings);
        setImages(nextImages);
        if (!keepSelection) {
          setSelectedSessions(
            new Set(nextRecordings.map((row) => row.sessionId))
          );
          setSelectedImages(new Set(nextImages.map((row) => row.imageId)));
        } else {
          const validImageIds = new Set(nextImages.map((row) => row.imageId));
          setSelectedImages((prev) => {
            const next = new Set(
              [...prev].filter((id) => validImageIds.has(id))
            );
            for (const img of nextImages) {
              if (!prev.has(img.imageId)) next.add(img.imageId);
            }
            return next;
          });
        }
      } catch (error) {
        if (!silent) {
          setLoadError(
            error instanceof Error ? error.message : "Could not load"
          );
        } else {
          setImageError(
            error instanceof Error ? error.message : "Could not refresh photos"
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [recorderId]
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  function toggleSession(sessionId: string) {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  function toggleImage(imageId: string) {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }

  async function onUploadPhotos(event: ChangeEvent<HTMLInputElement>) {
    // Snapshot before clearing — FileList is live and empties when value is reset.
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;

    const remainingSlots = MAX_ONBOARDING_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setImageError(`You can upload up to ${MAX_ONBOARDING_IMAGES} images.`);
      return;
    }

    const toUpload = selected.slice(0, remainingSlots);
    setImageUploadBusy(true);
    setImageError(null);

    for (const file of toUpload) {
      const form = new FormData();
      form.set("file", file);
      form.set("filename", file.name);
      try {
        const response = await fetch(
          `/api/rhoq-admin/recorders/${recorderId}/images`,
          { method: "POST", body: form }
        );
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!response.ok) {
          setImageError(data?.error ?? "Could not upload image.");
          break;
        }
      } catch {
        setImageError("Could not upload image.");
        break;
      }
    }

    setImageUploadBusy(false);
    await loadDetail({ silent: true, keepSelection: true });
  }

  async function onPromote(event: FormEvent) {
    event.preventDefault();
    setPromoting(true);
    setPromoteError(null);
    setPromoteSuccess(null);
    try {
      const response = await fetch("/api/rhoq-admin/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recorderId,
          email,
          password,
          roomId,
          sessionIds: [...selectedSessions],
          imageIds: [...selectedImages]
        })
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        username?: string;
        email?: string;
        archivedSessions?: number;
        createdPosts?: number;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Promote failed");
      }
      setPromoteSuccess(
        `Created @${data?.username} (${data?.email}). Archives: ${data?.archivedSessions ?? 0}. Posts: ${data?.createdPosts ?? 0}. Moved to archive.`
      );
      setPassword("");
      await loadDetail({ silent: true, keepSelection: true });
    } catch (error) {
      setPromoteError(error instanceof Error ? error.message : "Promote failed");
    } finally {
      setPromoting(false);
    }
  }

  async function setPromotedStatus(promoted: boolean) {
    setArchiveBusy(true);
    setArchiveError(null);
    try {
      const response = await fetch(
        `/api/rhoq-admin/recorders/${recorderId}/promote-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            promoted,
            userId: recorder?.promotedUserId ?? undefined
          })
        }
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not update archive status");
      }
      await loadDetail({ silent: true, keepSelection: true });
    } catch (error) {
      setArchiveError(
        error instanceof Error ? error.message : "Could not update status"
      );
    } finally {
      setArchiveBusy(false);
    }
  }

  const canUploadMore = images.length < MAX_ONBOARDING_IMAGES;
  const isArchived = Boolean(recorder?.promotedAt);

  return (
    <RhoqAdminShell wide>
      {loading ? (
        <p className="rhoq-admin-muted">Loading…</p>
      ) : loadError ? (
        <p className="rhoq-admin-error" role="alert">
          {loadError}
        </p>
      ) : !recorder ? (
        <p className="rhoq-admin-muted">Recorder not found.</p>
      ) : (
        <>
          <p className="rhoq-admin-back">
            <Link href="/rhoq-admin">← Onboard list</Link>
          </p>
            <section className="rhoq-admin-panel">
              <div className="rhoq-admin-panel-head">
                <div>
                  <h1>@{recorder.username}</h1>
                  <p className="rhoq-admin-muted">
                    Usage {recorder.secondsUsed}s / {recorder.maxSeconds}s ·{" "}
                    {recorder.active ? "Active" : "Inactive"}
                    {isArchived
                      ? ` · Promoted ${new Date(
                          recorder.promotedAt!
                        ).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <button
                  className="rhoq-admin-ghost-btn"
                  disabled={archiveBusy}
                  onClick={() => void setPromotedStatus(!isArchived)}
                  type="button"
                >
                  {archiveBusy
                    ? "Updating…"
                    : isArchived
                      ? "Restore to active"
                      : "Mark as promoted"}
                </button>
              </div>
              {archiveError ? (
                <p className="rhoq-admin-error" role="alert">
                  {archiveError}
                </p>
              ) : null}
              {isArchived ? (
                <p className="rhoq-admin-success" role="status">
                  This recorder is in the archive list
                  {recorder.promotedUserId
                    ? ` (profile ${recorder.promotedUserId.slice(0, 8)}…)`
                    : ""}
                  .
                </p>
              ) : null}
            </section>

            <section className="rhoq-admin-panel">
              <h2>Recordings</h2>
              {recordings.length === 0 ? (
                <p className="rhoq-admin-muted">No recordings with chunks.</p>
              ) : (
                <ul className="rhoq-admin-recording-list">
                  {recordings.map((row) => (
                    <li className="rhoq-admin-recording-card" key={row.sessionId}>
                      <label className="rhoq-admin-check-row">
                        <input
                          checked={selectedSessions.has(row.sessionId)}
                          onChange={() => toggleSession(row.sessionId)}
                          type="checkbox"
                        />
                        <span>
                          {new Date(row.startedAt).toLocaleString()} ·{" "}
                          {row.lastChunkNumber} chunks · {row.status}
                        </span>
                      </label>
                      <div className="rhoq-admin-player onboard-recorder-recording-player">
                        <OnboardingSessionPlayer
                          lastChunkNumber={row.lastChunkNumber}
                          r2Folder={row.r2Folder}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rhoq-admin-panel">
              <div className="rhoq-admin-panel-head">
                <h2>Photos</h2>
                <div className="rhoq-admin-photo-actions">
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="rhoq-admin-photo-input"
                    disabled={!canUploadMore || imageUploadBusy}
                    multiple
                    onChange={(event) => void onUploadPhotos(event)}
                    ref={photoInputRef}
                    type="file"
                  />
                  <button
                    className="rhoq-admin-ghost-btn"
                    disabled={!canUploadMore || imageUploadBusy}
                    onClick={() => photoInputRef.current?.click()}
                    type="button"
                  >
                    {imageUploadBusy
                      ? "Uploading…"
                      : canUploadMore
                        ? "Upload photo"
                        : "Limit reached"}
                  </button>
                </div>
              </div>
              <p className="rhoq-admin-muted">
                {images.length} / {MAX_ONBOARDING_IMAGES} photos · JPEG, PNG, or
                WebP
              </p>
              {imageError ? (
                <p className="rhoq-admin-error" role="alert">
                  {imageError}
                </p>
              ) : null}
              {images.length === 0 ? (
                <p className="rhoq-admin-muted">No photos uploaded yet.</p>
              ) : (
                <ul className="rhoq-admin-photo-grid">
                  {images.map((img) => (
                    <li key={img.imageId}>
                      <label className="rhoq-admin-photo-card">
                        <input
                          checked={selectedImages.has(img.imageId)}
                          onChange={() => toggleImage(img.imageId)}
                          type="checkbox"
                        />
                        {img.publicUrl ? (
                          <Image
                            alt={img.originalFilename || "Onboarding photo"}
                            className="rhoq-admin-photo-img"
                            height={240}
                            src={img.publicUrl}
                            unoptimized
                            width={180}
                          />
                        ) : (
                          <span className="rhoq-admin-muted">No URL</span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rhoq-admin-panel">
              <h2>Create profile &amp; publish</h2>
              <p className="rhoq-admin-muted">
                Creates a confirmed Auth user, profile with username{" "}
                <strong>@{recorder.username}</strong>, archive sessions for
                selected recordings, and feed posts for selected photos.
              </p>
              <form className="rhoq-admin-promote" onSubmit={onPromote}>
                <label className="rhoq-admin-label" htmlFor="promote-room">
                  Archive room
                </label>
                <select
                  className="rhoq-admin-input"
                  id="promote-room"
                  onChange={(event) => setRoomId(event.target.value as RoomId)}
                  value={roomId}
                >
                  {WORKOUT_ROOMS.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>

                <label className="rhoq-admin-label" htmlFor="promote-email">
                  Email
                </label>
                <input
                  autoComplete="off"
                  className="rhoq-admin-input"
                  id="promote-email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />

                <label className="rhoq-admin-label" htmlFor="promote-password">
                  Password
                </label>
                <input
                  autoComplete="new-password"
                  className="rhoq-admin-input"
                  id="promote-password"
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />

                <p className="rhoq-admin-muted">
                  Selected: {selectedSessions.size} recording
                  {selectedSessions.size === 1 ? "" : "s"},{" "}
                  {selectedImages.size} photo
                  {selectedImages.size === 1 ? "" : "s"}
                </p>

                {promoteError ? (
                  <p className="rhoq-admin-error" role="alert">
                    {promoteError}
                  </p>
                ) : null}
                {promoteSuccess ? (
                  <p className="rhoq-admin-success" role="status">
                    {promoteSuccess}
                  </p>
                ) : null}

                <button
                  className="rhoq-admin-primary-btn"
                  disabled={
                    promoting ||
                    !email ||
                    password.length < 6 ||
                    (selectedSessions.size === 0 && selectedImages.size === 0)
                  }
                  type="submit"
                >
                  {promoting ? "Creating…" : "Create account & publish"}
                </button>
              </form>
            </section>
          </>
      )}
    </RhoqAdminShell>
  );
}
