"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type LiveVideoPlayerProps = {
  /** Live LL-HLS or MediaMTX playback URL (.m3u8 / /get). */
  hlsUrl?: string | null;
  /** Direct MP4 archive file (e.g. /api/archives/file/...). */
  src?: string | null;
  muted?: boolean;
  loop?: boolean;
  /** Native controls; default off (silent looping tiles). */
  controls?: boolean;
  /** When true, pause playback (incoming tiles while tab hidden). */
  paused?: boolean;
  className?: string;
  poster?: string;
  label?: string;
  /** Fired once when media is ready to display. */
  onReady?: () => void;
  /** Hide inline error text (parent handles fallback). */
  suppressErrorDisplay?: boolean;
};

export function LiveVideoPlayer({
  hlsUrl,
  src,
  muted = true,
  loop = false,
  controls = false,
  paused = false,
  className,
  poster,
  label,
  onReady,
  suppressErrorDisplay = false
}: LiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const readySentRef = useRef(false);
  const onReadyRef = useRef(onReady);
  const [error, setError] = useState<string | null>(null);

  onReadyRef.current = onReady;

  const mediaUrl = hlsUrl || src || null;
  const isDirectFile = Boolean(src) && !hlsUrl;

  useEffect(() => {
    readySentRef.current = false;
  }, [mediaUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaUrl) return;

    let cancelled = false;
    setError(null);

    const notifyReady = () => {
      if (cancelled || readySentRef.current) return;
      readySentRef.current = true;
      onReadyRef.current?.();
    };

    const play = () => {
      void video.play().then(notifyReady).catch(() => {
        /* Autoplay can fail until user gesture; muted should usually allow it */
      });
    };

    const destroyHls = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    destroyHls();
    video.removeAttribute("src");
    video.load();

    const onPlaying = () => notifyReady();
    video.addEventListener("playing", onPlaying);

    if (isDirectFile) {
      video.src = mediaUrl;
      const onLoaded = () => {
        if (!cancelled) play();
      };
      const onError = () => {
        if (!cancelled) setError("Video unavailable.");
      };
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);
      return () => {
        cancelled = true;
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
        video.removeAttribute("src");
        video.load();
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        enableWorker: true,
        backBufferLength: 30
      });
      hlsRef.current = hls;
      hls.loadSource(mediaUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) play();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }
        setError("Live stream unavailable.");
        destroyHls();
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = mediaUrl;
      const onLoaded = () => {
        if (!cancelled) play();
      };
      const onError = () => {
        if (!cancelled) setError("Live stream unavailable.");
      };
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);
      return () => {
        cancelled = true;
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
        video.removeAttribute("src");
        video.load();
      };
    } else {
      setError("HLS is not supported in this browser.");
    }

    return () => {
      cancelled = true;
      video.removeEventListener("playing", onPlaying);
      destroyHls();
      video.removeAttribute("src");
      video.load();
    };
  }, [mediaUrl, isDirectFile]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) {
      video.pause();
      return;
    }
    void video.play().catch(() => {
      /* ignore */
    });
  }, [paused]);

  return (
    <div className={`live-video-player${className ? ` ${className}` : ""}`}>
      <video
        ref={videoRef}
        className="live-video-player-video"
        muted={muted}
        autoPlay
        playsInline
        loop={loop}
        controls={controls}
        poster={poster}
      />
      {error && !suppressErrorDisplay ? (
        <p className="live-video-player-error" role="status">
          {error}
        </p>
      ) : null}
      {label ? <span className="live-video-player-label">{label}</span> : null}
    </div>
  );
}
