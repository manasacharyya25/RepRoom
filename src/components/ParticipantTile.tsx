"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import type { LocalVideoTrack, RemoteTrackPublication } from "livekit-client";

type ParticipantTileProps = {
  name: string;
  videoTrack?: LocalVideoTrack | null;
  publication?: RemoteTrackPublication;
  isLocal?: boolean;
};

export function ParticipantTile({
  name,
  videoTrack,
  publication,
  isLocal = false
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    if (videoTrack) {
      videoTrack.attach(videoElement);
      return () => {
        videoTrack.detach(videoElement);
      };
    }

    const remoteTrack = publication?.videoTrack;

    if (!remoteTrack) {
      return;
    }

    remoteTrack.attach(videoElement);
    return () => {
      remoteTrack.detach(videoElement);
    };
  }, [publication, videoTrack]);

  return (
    <article style={styles.card}>
      {isLocal && videoTrack ? (
        <video autoPlay muted playsInline ref={videoRef} style={styles.video} />
      ) : publication?.videoTrack ? (
        <video autoPlay playsInline ref={videoRef} style={styles.video} />
      ) : (
        <div style={styles.placeholder}>Waiting for video...</div>
      )}
      <div style={styles.footer}>
        <span>{name}</span>
        {isLocal ? <span style={styles.badge}>You</span> : null}
      </div>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "rgba(15, 23, 42, 0.88)",
    borderRadius: 22,
    overflow: "hidden",
    border: "1px solid rgba(148, 163, 184, 0.15)"
  },
  video: {
    display: "block",
    width: "100%",
    aspectRatio: "16 / 9",
    objectFit: "cover",
    background: "#020617"
  },
  placeholder: {
    display: "grid",
    placeItems: "center",
    width: "100%",
    aspectRatio: "16 / 9",
    color: "#93a4bd",
    background: "#020617"
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    fontWeight: 700
  },
  badge: {
    color: "#67e8f9",
    fontSize: 13
  }
};
