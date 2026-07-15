"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type LiveVideoPlayerProps = {
  /** Live LL-HLS or MediaMTX playback URL (.m3u8 / /get). */
  hlsUrl?: string | null;
  /** Direct MP4 archive file (e.g. /api/archives/file/...). */
  src?: string | null;
  muted?: boolean;
  className?: string;
  poster?: string;
  label?: string;
};

export function LiveVideoPlayer({
  hlsUrl,
  src,
  muted = true,
  className,
  poster,
  label
}: LiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaUrl = hlsUrl || src || null;
  const isDirectFile = Boolean(src) && !hlsUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaUrl) return;

    let cancelled = false;
    setError(null);

    const play = () => {
      void video.play().catch(() => {
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

    if (isDirectFile) {
      video.src = mediaUrl;
      const onLoaded = () => {
        if (!cancelled) play();
      };
      const onError = () => {
        if (!cancelled) setError("Archive unavailable.");
      };
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);
      return () => {
        cancelled = true;
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
      destroyHls();
      video.removeAttribute("src");
      video.load();
    };
  }, [mediaUrl, isDirectFile]);

  return (
    <div className={`live-video-player${className ? ` ${className}` : ""}`}>
      <video
        ref={videoRef}
        className="live-video-player-video"
        muted={muted}
        autoPlay
        playsInline
        controls={isDirectFile}
        poster={poster}
      />
      {error ? (
        <p className="live-video-player-error" role="status">
          {error}
        </p>
      ) : null}
      {label ? <span className="live-video-player-label">{label}</span> : null}
    </div>
  );
}
