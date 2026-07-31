"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { BrandName, Logo } from "@/components/brand/Logo";
import { LIVE_IMAGES } from "@/lib/live-images";
import {
  captureLiveCamera,
  stopMediaStream
} from "@/lib/streaming/capture";
import {
  startChunkRecorder,
  type ChunkRecorder
} from "@/lib/streaming/chunk-recorder";
import { OnboardingSessionPlayer } from "@/components/onboard/OnboardingSessionPlayer";

type LibraryRecording = {
  sessionId: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  lastChunkNumber: number;
  r2Folder: string;
  availableChunks?: number[] | null;
};

const GO_LIVE_AVOID_EXAMPLES = [
  { src: "/images/onboard/avoid-1.png", alt: "Camera pointed at the ceiling; only the top of your head is visible" },
  { src: "/images/onboard/avoid-2.png", alt: "Camera too close to equipment; workout not visible" },
  { src: "/images/onboard/avoid-3.png", alt: "Person mostly out of frame with empty wall in view" },
  { src: "/images/onboard/avoid-4.png", alt: "Low angle blocked by a bench; body not in frame" }
] as const;

type LibraryImage = {
  imageId: string;
  publicUrl: string | null;
  originalFilename: string | null;
  createdAt: string;
};

type StatusPayload = {
  authenticated?: boolean;
  remainingSeconds?: number | null;
  maxSeconds?: number | null;
  secondsUsed?: number | null;
  exhausted?: boolean | null;
  error?: string;
};

type OnboardingRecorderPageProps = {
  username: string;
};

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function OnboardingRecorderPage({ username }: OnboardingRecorderPageProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [elapsedLive, setElapsedLive] = useState(0);
  const [recordings, setRecordings] = useState<LibraryRecording[]>([]);
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [imageUploadBusy, setImageUploadBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showGoLivePrep, setShowGoLivePrep] = useState(false);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<ChunkRecorder | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const liveEpochRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const budgetRef = useRef<number | null>(null);
  const flushedRef = useRef(0);
  const limitNotifiedRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    const response = await fetch(
      `/api/onboarding-record/status?username=${encodeURIComponent(username)}`
    );
    if (response.status === 404) {
      setAuthenticated(false);
      setLoading(false);
      setAuthError("This recording link is not available.");
      return;
    }
    const data = (await response.json().catch(() => null)) as StatusPayload | null;
    if (!response.ok) {
      setAuthError(data?.error ?? "Could not load status.");
      setLoading(false);
      return;
    }
    setAuthenticated(Boolean(data?.authenticated));
    if (data?.authenticated) {
      setRemainingSeconds(
        data.remainingSeconds === undefined || data.remainingSeconds === null
          ? null
          : data.remainingSeconds
      );
    }
    setLoading(false);
  }, [username]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const refreshLibrary = useCallback(async () => {
    if (!authenticated) return;
    setLibraryLoading(true);
    try {
      const response = await fetch("/api/onboarding-record/library");
      const data = (await response.json().catch(() => null)) as {
        recordings?: LibraryRecording[];
        images?: LibraryImage[];
        error?: string;
      } | null;
      if (!response.ok) {
        setImageError(data?.error ?? "Could not load your uploads.");
        return;
      }
      setRecordings(data?.recordings ?? []);
      setLibraryImages(data?.images ?? []);
      setImageError(null);
    } catch {
      setImageError("Could not load your uploads.");
    } finally {
      setLibraryLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    if (authenticated) {
      void refreshLibrary();
    }
  }, [authenticated, refreshLibrary]);

  const onPickImages = () => {
    imageInputRef.current?.click();
  };

  const onImageFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    // Snapshot before clearing — FileList is live and empties when value is reset.
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;

    const remainingSlots = 5 - libraryImages.length;
    if (remainingSlots <= 0) {
      setImageError("You can upload up to 5 images.");
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
        const response = await fetch("/api/onboarding-record/images/upload", {
          method: "POST",
          body: form
        });
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
    await refreshLibrary();
  };

  const formatSessionWhen = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      });
    } catch {
      return iso;
    }
  };

  const flushUsage = useCallback(async () => {
    const started = startedAtRef.current;
    const budget = budgetRef.current;
    if (started === null) return;

    const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
    const capped =
      budget === null ? elapsed : Math.min(elapsed, Math.max(0, budget));
    const seconds = Math.max(0, capped - flushedRef.current);
    if (seconds <= 0) return;

    flushedRef.current += seconds;

    try {
      const response = await fetch("/api/onboarding-record/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds }),
        keepalive: true
      });
      if (!response.ok) {
        flushedRef.current = Math.max(0, flushedRef.current - seconds);
        return;
      }
      const data = (await response.json()) as {
        remainingSeconds?: number;
        exhausted?: boolean;
      };
      if (typeof data.remainingSeconds === "number") {
        setRemainingSeconds(data.remainingSeconds);
      }
      if (data.exhausted) {
        limitNotifiedRef.current = true;
      }
    } catch {
      flushedRef.current = Math.max(0, flushedRef.current - seconds);
    }
  }, []);

  const stopLive = useCallback(async () => {
    liveEpochRef.current += 1;
    recorderRef.current?.stop();
    recorderRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    setIsLive(false);
    setIsGoingLive(false);
    setElapsedLive(0);

    await flushUsage();
    startedAtRef.current = null;
    budgetRef.current = null;
    flushedRef.current = 0;

    if (sessionId) {
      try {
        await fetch("/api/onboarding-record/session/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          keepalive: true
        });
      } catch {
        /* ignore */
      }
    }

    void refreshStatus();
    void refreshLibrary();
  }, [flushUsage, refreshLibrary, refreshStatus]);

  const startLive = useCallback(async () => {
    setIsGoingLive(true);
    setCameraError(null);
    setUploadError(null);

    if (remainingSeconds !== null && remainingSeconds <= 0) {
      setIsGoingLive(false);
      setCameraError("Your recording time limit has been reached.");
      return;
    }

    const epoch = liveEpochRef.current + 1;
    liveEpochRef.current = epoch;

    try {
      const startResponse = await fetch("/api/onboarding-record/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
      const startData = (await startResponse.json().catch(() => null)) as {
        sessionId?: string;
        remainingSeconds?: number;
        error?: string;
        reason?: string;
      } | null;

      if (!startResponse.ok || !startData?.sessionId) {
        setIsGoingLive(false);
        setCameraError(
          startData?.error ??
            (startData?.reason === "time_limit"
              ? "Your recording time limit has been reached."
              : "Could not start session.")
        );
        if (typeof startData?.remainingSeconds === "number") {
          setRemainingSeconds(startData.remainingSeconds);
        }
        return;
      }

      if (liveEpochRef.current !== epoch) return;

      const stream = await captureLiveCamera();
      if (liveEpochRef.current !== epoch) {
        stopMediaStream(stream);
        return;
      }

      streamRef.current = stream;
      sessionIdRef.current = startData.sessionId;
      limitNotifiedRef.current = false;
      flushedRef.current = 0;
      budgetRef.current =
        typeof startData.remainingSeconds === "number"
          ? startData.remainingSeconds
          : remainingSeconds;
      startedAtRef.current = Date.now();
      if (typeof startData.remainingSeconds === "number") {
        setRemainingSeconds(startData.remainingSeconds);
      }

      setIsLive(true);
      setIsGoingLive(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }

      recorderRef.current = startChunkRecorder({
        stream,
        roomId: "onboarding",
        sessionId: startData.sessionId,
        uploadUrl: "/api/onboarding-record/upload",
        onError: (message) => setUploadError(message),
        onUploaded: () => setUploadError(null)
      });
    } catch (error) {
      setIsGoingLive(false);
      setCameraError(
        error instanceof Error ? error.message : "Could not access camera."
      );
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }
  }, [remainingSeconds, username]);

  useEffect(() => {
    if (!isLive) return;
    const tick = window.setInterval(() => {
      const started = startedAtRef.current;
      if (started === null) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
      setElapsedLive(elapsed);
      const budget = budgetRef.current;
      if (budget !== null && elapsed >= budget) {
        setCameraError("Your recording time limit has been reached.");
        void stopLive();
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [isLive, stopLive]);

  useEffect(() => {
    if (!isLive) return;
    const flush = window.setInterval(() => {
      void flushUsage();
    }, 60_000);
    return () => window.clearInterval(flush);
  }, [flushUsage, isLive]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      stopMediaStream(streamRef.current);
    };
  }, []);

  const onSubmitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    try {
      const response = await fetch("/api/onboarding-record/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        remainingSeconds?: number;
      } | null;
      if (!response.ok) {
        setAuthError(data?.error ?? "Invalid username or password");
        setAuthBusy(false);
        return;
      }
      setPassword("");
      setAuthenticated(true);
      setRemainingSeconds(
        typeof data?.remainingSeconds === "number" ? data.remainingSeconds : null
      );
    } catch {
      setAuthError("Could not sign in. Try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="onboard-recorder">
      <header className="onboard-recorder-nav">
        <Logo href="/" />
        {authenticated ? (
          <p className="onboard-recorder-user">@{username}</p>
        ) : (
          <p className="onboard-recorder-nav-tag">Early access</p>
        )}
      </header>

      <main className="onboard-recorder-main">
        {loading ? (
          <p className="onboard-recorder-muted">Loading…</p>
        ) : !authenticated ? (
          <div className="onboard-recorder-welcome">
            <BrandName className="onboard-recorder-hero-brand" height={52} />
            <p className="onboard-recorder-kicker">Welcome to RhoQ</p>
            <h1>Work out together. Motivate each other.</h1>
            <p className="onboard-recorder-lede">
              RhoQ is a live fitness community — shared rooms for Yoga, Strength,
              Cardio, Zumba, and Meditation, where people show up side by side
              and keep each other accountable.
            </p>
            <p className="onboard-recorder-lede onboard-recorder-lede--soft">
              You’re on a private early link. Enter your password to record a
              short session so we can set up your place in the community.
            </p>

            <form className="onboard-recorder-gate" onSubmit={onSubmitPassword}>
              <label
                className="onboard-recorder-label"
                htmlFor="onboard-password"
              >
                Password
              </label>
              <input
                autoComplete="current-password"
                className="onboard-recorder-input"
                id="onboard-password"
                onChange={(e) => setPassword(e.target.value)}
                required
                type="password"
                value={password}
              />
              {authError ? (
                <p className="onboard-recorder-error" role="alert">
                  {authError}
                </p>
              ) : null}
              <button
                className="onboard-recorder-submit"
                disabled={authBusy || !password}
                type="submit"
              >
                {authBusy ? "Checking…" : "Continue"}
              </button>
            </form>
          </div>
        ) : (
          <div className="onboard-recorder-stage">
            {!isLive ? (
              <div className="onboard-recorder-intro">
                <p className="onboard-recorder-kicker onboard-recorder-kicker--soft">
                  You’re in, @{username}
                  <span aria-hidden>🎉</span>
                </p>
                <h2>Let&apos;s get your first workout recorded</h2>
                <p>
                  Hit <strong>Go Live</strong>, set up your camera, and exercise
                  just like you usually do. Don&apos;t worry about being
                  perfect—we&apos;re simply getting you ready for RhoQ&apos;s
                  live rooms.
                </p>
              </div>
            ) : null}

            <div className="onboard-recorder-workspace">
              <div className="onboard-recorder-workspace-main">
                <div
                  className={`onboard-recorder-preview${
                    isLive ? "" : " onboard-recorder-preview--idle"
                  }`}
                >
                  <video
                    autoPlay
                    className="onboard-recorder-video"
                    muted
                    playsInline
                    ref={videoRef}
                  />
                  {!isLive ? (
                    <div className="onboard-recorder-idle">
                      <p className="onboard-recorder-idle-pill">
                        Your camera preview appears when you go live
                      </p>

                      <aside className="onboard-recorder-tip onboard-recorder-tip--left">
                        <p className="onboard-recorder-tip-title">
                          Welcome aboard
                        </p>
                        <ul>
                          <li>Find a comfortable space</li>
                          <li>Face the camera</li>
                          <li>Move like a normal workout</li>
                        </ul>
                      </aside>

                      <aside className="onboard-recorder-tip onboard-recorder-tip--right">
                        <p className="onboard-recorder-tip-title">
                          Community ready
                        </p>
                        <p>
                          This intro helps match you with people and rooms that
                          fit how you train.
                        </p>
                      </aside>

                      <div className="onboard-recorder-mock-room" aria-hidden>
                        <div className="onboard-recorder-mock-chrome">
                          <span className="onboard-recorder-mock-brand">
                            Rho<span>Q</span>
                          </span>
                        </div>
                        <div className="onboard-recorder-mock-tiles">
                          <div className="onboard-recorder-mock-tile onboard-recorder-mock-tile--side">
                            <Image
                              alt=""
                              fill
                              sizes="140px"
                              src={LIVE_IMAGES.participant2}
                              unoptimized
                            />
                          </div>
                          <div className="onboard-recorder-mock-tile onboard-recorder-mock-tile--main">
                            <Image
                              alt=""
                              fill
                              sizes="220px"
                              src={LIVE_IMAGES.participant1}
                              unoptimized
                            />
                          </div>
                          <div className="onboard-recorder-mock-tile onboard-recorder-mock-tile--side">
                            <Image
                              alt=""
                              fill
                              sizes="140px"
                              src={LIVE_IMAGES.participant3}
                              unoptimized
                            />
                          </div>
                        </div>
                        <div className="onboard-recorder-mock-bar">
                          <span />
                          <span />
                          <span />
                          <span className="onboard-recorder-mock-bar-end" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="onboard-recorder-live-badge"
                      aria-live="polite"
                    >
                      LIVE {formatClock(elapsedLive)}
                    </span>
                  )}
                </div>

                <div className="onboard-recorder-meta">
                  {cameraError ? (
                    <p className="onboard-recorder-error" role="alert">
                      {cameraError}
                    </p>
                  ) : null}
                  {uploadError ? (
                    <p className="onboard-recorder-error" role="alert">
                      Upload: {uploadError}
                    </p>
                  ) : null}
                </div>

                <button
                  className={`onboard-recorder-live-btn${
                    isLive ? " onboard-recorder-live-btn--end" : ""
                  }`}
                  disabled={isGoingLive}
                  onClick={() => {
                    if (isLive) void stopLive();
                    else setShowGoLivePrep(true);
                  }}
                  type="button"
                >
                  {!isLive && !isGoingLive ? (
                    <span className="onboard-recorder-live-btn-icon" aria-hidden>
                      ▶
                    </span>
                  ) : null}
                  {isGoingLive ? "Starting…" : isLive ? "End Live" : "Go Live"}
                </button>

                {!isLive ? (
                  <p className="onboard-recorder-hint">
                    This workout becomes the first of many workouts in RhoQ
                    Community, inspiring future members to discover and work
                    alongside you.
                  </p>
                ) : null}
              </div>

              <aside className="onboard-recorder-photos" aria-label="Upload photos">
                <div className="onboard-recorder-photos-head">
                  <h3>Photos</h3>
                  <p>
                    Add up to 5 images (JPEG, PNG, or WebP).
                  </p>
                </div>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="onboard-recorder-photos-input"
                  multiple
                  onChange={(e) => void onImageFilesSelected(e)}
                  ref={imageInputRef}
                  type="file"
                />
                <div className="onboard-recorder-photos-grid">
                  {libraryImages.map((img) => (
                    <div className="onboard-recorder-photo-slot" key={img.imageId}>
                      {img.publicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={img.originalFilename ?? "Uploaded photo"}
                          className="onboard-recorder-photo-thumb"
                          src={img.publicUrl}
                        />
                      ) : (
                        <span className="onboard-recorder-muted">Saved</span>
                      )}
                    </div>
                  ))}
                  {Array.from({
                    length: Math.max(
                      0,
                      5 - libraryImages.length
                    )
                  }).map((_, index) => (
                    <button
                      className="onboard-recorder-photo-slot onboard-recorder-photo-slot--add"
                      disabled={imageUploadBusy}
                      key={`empty-${index}`}
                      onClick={onPickImages}
                      type="button"
                    >
                      {imageUploadBusy ? "…" : "+"}
                    </button>
                  ))}
                </div>
                {imageError ? (
                  <p className="onboard-recorder-error" role="alert">
                    {imageError}
                  </p>
                ) : null}
                <p className="onboard-recorder-photos-count">
                  {libraryImages.length} / 5 uploaded
                </p>
              </aside>
            </div>

            <section className="onboard-recorder-library" aria-label="Your uploads">
              <h3>Your uploads</h3>
              {libraryLoading ? (
                <p className="onboard-recorder-muted">Loading…</p>
              ) : (
                <>
                  <div className="onboard-recorder-library-block">
                    <h4>Recordings</h4>
                    {recordings.length === 0 ? (
                      <p className="onboard-recorder-muted">
                        No recordings yet. Go live to create your first session.
                      </p>
                    ) : (
                      <ul className="onboard-recorder-recording-list">
                        {recordings.map((rec) => (
                          <li key={rec.sessionId}>
                            <div className="onboard-recorder-recording-card">
                              <div className="onboard-recorder-recording-player">
                                <OnboardingSessionPlayer
                                  availableChunks={rec.availableChunks}
                                  chunksResolve={
                                    rec.status === "ended"
                                      ? { kind: "onboarding" }
                                      : null
                                  }
                                  lastChunkNumber={rec.lastChunkNumber}
                                  r2Folder={rec.r2Folder}
                                  sessionId={rec.sessionId}
                                />
                              </div>
                              <div className="onboard-recorder-recording-meta">
                                <p>
                                  <strong>
                                    {formatSessionWhen(rec.startedAt)}
                                  </strong>
                                </p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="onboard-recorder-library-block">
                    <h4>Photos</h4>
                    {libraryImages.length === 0 ? (
                      <p className="onboard-recorder-muted">
                        No photos yet. Use the panel on the right to add images.
                      </p>
                    ) : (
                      <ul className="onboard-recorder-image-list">
                        {libraryImages.map((img) => (
                          <li key={img.imageId}>
                            <div className="onboard-recorder-image-card">
                              {img.publicUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  alt={img.originalFilename ?? "Uploaded photo"}
                                  className="onboard-recorder-image-card-thumb"
                                  src={img.publicUrl}
                                />
                              ) : null}
                              <p className="onboard-recorder-muted">
                                {formatSessionWhen(img.createdAt)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="onboard-recorder-footer">
        <span>RhoQ · Work out together. Motivate each other.</span>
      </footer>

      {showGoLivePrep ? (
        <div
          className="onboard-go-live-modal"
          role="presentation"
          onClick={() => setShowGoLivePrep(false)}
        >
          <div
            aria-labelledby="onboard-go-live-modal-title"
            aria-modal="true"
            className="onboard-go-live-modal-card"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="onboard-go-live-modal-title">Before you go live</h2>
            <p>
              To give everyone the best workout experience, please make sure
              your entire body is visible throughout the session. Before you
              start, position your phone so you&apos;re fully in frame from
              start to finish. A quick check before going live goes a long way!
            </p>
            <p className="onboard-go-live-modal-note">
              Stay on this browser tab for the whole recording. Switching tabs or
              minimizing the window can interrupt your stream.
            </p>
            <div className="onboard-go-live-modal-avoid">
              <p className="onboard-go-live-modal-avoid-title">
                Avoid scenes like these
              </p>
              <ul className="onboard-go-live-modal-avoid-grid">
                {GO_LIVE_AVOID_EXAMPLES.map((example) => (
                  <li key={example.src}>
                    <Image
                      alt={example.alt}
                      className="onboard-go-live-modal-avoid-img"
                      height={320}
                      src={example.src}
                      unoptimized
                      width={180}
                    />
                  </li>
                ))}
              </ul>
            </div>
            <div className="onboard-go-live-modal-actions">
              <button
                className="onboard-go-live-modal-cancel"
                onClick={() => setShowGoLivePrep(false)}
                type="button"
              >
                Not yet
              </button>
              <button
                className="onboard-go-live-modal-confirm"
                disabled={isGoingLive}
                onClick={() => {
                  setShowGoLivePrep(false);
                  void startLive();
                }}
                type="button"
              >
                {isGoingLive ? "Starting…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
