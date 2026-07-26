"use client";

import {
  pickMediaRecorderMimeType,
  PREVIEW_CHUNK_SECONDS
} from "@/lib/streaming/preview-chunks";

export type ChunkRecorder = {
  stop: () => void;
};

type StartChunkRecorderOptions = {
  stream: MediaStream;
  roomId: string;
  sessionId: string;
  /** Defaults to /api/previews/upload (room live). */
  uploadUrl?: string;
  /** Called when a chunk fails to upload (non-fatal). */
  onError?: (message: string) => void;
  /** Fired after each successful upload. */
  onUploaded?: (info: {
    chunkIndex: number;
    key: string;
    publicUrl: string | null;
  }) => void;
};

/**
 * Records the local MediaStream into fixed-length WebM blobs and uploads each
 * to R2 via the Next.js proxy (avoids browser → R2 CORS).
 */
export function startChunkRecorder(
  options: StartChunkRecorderOptions
): ChunkRecorder {
  const {
    stream,
    roomId,
    sessionId,
    uploadUrl = "/api/previews/upload",
    onError,
    onUploaded
  } = options;
  const mimeType = pickMediaRecorderMimeType();
  if (!mimeType) {
    onError?.("MediaRecorder WebM is not supported in this browser.");
    return { stop: () => undefined };
  }

  let chunkIndex = 0;
  let stopped = false;
  let recorder: MediaRecorder | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRestart = () => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const uploadBlob = async (blob: Blob, index: number) => {
    if (blob.size < 64) return;

    const form = new FormData();
    form.set("roomId", roomId);
    form.set("sessionId", sessionId);
    form.set("chunkIndex", String(index));
    form.set("file", blob, `chunk_${String(index).padStart(6, "0")}.webm`);

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: form
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(payload?.error ?? `Upload failed (${response.status})`);
    }

    const data = (await response.json()) as {
      key: string;
      publicUrl: string | null;
    };

    onUploaded?.({
      chunkIndex: index,
      key: data.key,
      publicUrl: data.publicUrl
    });
  };

  const startSegment = () => {
    if (stopped) return;
    clearRestart();

    const segment = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 400_000
    });
    recorder = segment;
    const parts: Blob[] = [];

    segment.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        parts.push(event.data);
      }
    };

    segment.onerror = () => {
      onError?.("MediaRecorder error");
    };

    segment.onstop = () => {
      const blob = new Blob(parts, { type: mimeType });
      if (!stopped && blob.size >= 64) {
        chunkIndex += 1;
        const index = chunkIndex;
        void uploadBlob(blob, index).catch((error) => {
          onError?.(
            error instanceof Error ? error.message : "Chunk upload failed"
          );
        });
      }
      if (!stopped) {
        restartTimer = setTimeout(startSegment, 0);
      }
    };

    try {
      segment.start();
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : "Could not start recorder"
      );
      return;
    }

    restartTimer = setTimeout(() => {
      if (stopped) return;
      if (segment.state === "recording") {
        try {
          segment.stop();
        } catch {
          /* ignore */
        }
      }
    }, PREVIEW_CHUNK_SECONDS * 1000);
  };

  startSegment();

  return {
    stop: () => {
      stopped = true;
      clearRestart();
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
      }
      recorder = null;
    }
  };
}
