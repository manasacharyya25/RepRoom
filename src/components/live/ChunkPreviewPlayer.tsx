"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PREVIEW_CHUNK_SECONDS,
  previewChunkPublicUrl
} from "@/lib/streaming/preview-chunks";

type ChunkPreviewPlayerProps = {
  roomId: string;
  userId: string;
  paused?: boolean;
  className?: string;
};

function getPublicBaseUrl() {
  return process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
}

export function ChunkPreviewPlayer({
  roomId,
  userId,
  paused = false,
  className
}: ChunkPreviewPlayerProps) {
  const publicBase = getPublicBaseUrl();
  const [chunkIndex, setChunkIndex] = useState(1);
  const [maxChunkIndex, setMaxChunkIndex] = useState(1);
  const maxChunkRef = useRef(1);
  const probeInFlightRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const chunkUrl = publicBase
    ? previewChunkPublicUrl(publicBase, { roomId, userId, chunkIndex })
    : null;

  const probeForNewChunks = useCallback(async () => {
    if (!publicBase || probeInFlightRef.current) return;
    probeInFlightRef.current = true;
    try {
      let candidate = maxChunkRef.current + 1;
      while (candidate <= maxChunkRef.current + 8) {
        const url = previewChunkPublicUrl(publicBase, {
          roomId,
          userId,
          chunkIndex: candidate
        });
        const response = await fetch(url, { method: "HEAD" });
        if (!response.ok) break;
        maxChunkRef.current = candidate;
        setMaxChunkIndex(candidate);
        candidate += 1;
      }
    } finally {
      probeInFlightRef.current = false;
    }
  }, [publicBase, roomId, userId]);

  useEffect(() => {
    if (!publicBase) return;
    void probeForNewChunks();
    const timer = window.setInterval(
      () => void probeForNewChunks(),
      PREVIEW_CHUNK_SECONDS * 1000
    );
    return () => window.clearInterval(timer);
  }, [probeForNewChunks, publicBase]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !chunkUrl) return;
    video.load();
    if (!paused) {
      void video.play().catch(() => {});
    }
  }, [chunkUrl, paused]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) {
      video.pause();
      return;
    }
    void video.play().catch(() => {});
  }, [paused]);

  const advanceChunk = useCallback(() => {
    setChunkIndex((current) => {
      if (current < maxChunkRef.current) return current + 1;
      return 1;
    });
  }, []);

  if (!publicBase) {
    return null;
  }

  return (
    <div className={`live-video-player ${className ?? ""}`}>
      <video
        ref={videoRef}
        autoPlay
        className="live-video-player-video"
        muted
        playsInline
        src={chunkUrl ?? undefined}
        onEnded={advanceChunk}
        onError={() => {
          void probeForNewChunks();
          advanceChunk();
        }}
      />
      {maxChunkIndex > 0 ? (
        <span className="sr-only">
          Playing chunk {chunkIndex} of {maxChunkIndex}
        </span>
      ) : null}
    </div>
  );
}
