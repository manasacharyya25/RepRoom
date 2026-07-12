"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LocalVideoTrack, Room, RoomEvent, Track, type RemoteTrackPublication } from "livekit-client";
import { ParticipantTile } from "@/components/ParticipantTile";
import { DEFAULT_FACE_STYLE } from "@/lib/face-styles";
import { SESSION_STORAGE_KEY, createDefaultSettings, type PreviewSettings } from "@/lib/session";
import { useTransformedCamera } from "@/lib/use-transformed-camera";

type RemoteView = {
  sid: string;
  name: string;
  publication?: RemoteTrackPublication;
};

function collectRemoteViews(room: Room): RemoteView[] {
  return Array.from(room.remoteParticipants.values()).map((participant) => {
    const publication = Array.from(participant.trackPublications.values()).find(
      (trackPublication) => trackPublication.kind === Track.Kind.Video
    ) as RemoteTrackPublication | undefined;

    return {
      sid: participant.sid,
      name: participant.name || participant.identity || "Participant",
      publication
    };
  });
}

export function RoomExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings | null>(null);
  const [roomStatus, setRoomStatus] = useState("Loading your transformed stream...");
  const [roomError, setRoomError] = useState<string | null>(null);
  const [localTrack, setLocalTrack] = useState<LocalVideoTrack | null>(null);
  const [remoteViews, setRemoteViews] = useState<RemoteView[]>([]);

  useEffect(() => {
    const storedSettings = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const roomName = searchParams.get("room")?.trim() || "";
    const participantName = searchParams.get("name")?.trim() || "";

    if (!storedSettings) {
      setPreviewSettings(createDefaultSettings(roomName, participantName));
      return;
    }

    try {
      const parsed = JSON.parse(storedSettings) as PreviewSettings;
      setPreviewSettings({
        ...createDefaultSettings(roomName, participantName),
        ...parsed,
        roomName: roomName || parsed.roomName,
        participantName: participantName || parsed.participantName
      });
    } catch {
      setPreviewSettings(createDefaultSettings(roomName, participantName));
    }
  }, [searchParams]);

  const settings = useMemo(
    () =>
      previewSettings ??
      createDefaultSettings(searchParams.get("room") ?? "", searchParams.get("name") ?? ""),
    [previewSettings, searchParams]
  );

  const { previewRef, processedStream, status, error } = useTransformedCamera({
    styleId: settings.styleId ?? DEFAULT_FACE_STYLE,
    uploadedImageDataUrl: settings.uploadedImageDataUrl
  });

  useEffect(() => {
    if (!processedStream || !settings.roomName || !settings.participantName) {
      return;
    }

    let cancelled = false;
    const room = new Room();

    const connect = async () => {
      try {
        setRoomStatus("Fetching LiveKit access token...");
        setRoomError(null);

        const response = await fetch("/api/livekit/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            roomName: settings.roomName,
            participantName: settings.participantName
          })
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? "Could not create a room token.");
        }

        const data = (await response.json()) as {
          token: string;
          url: string;
        };

        setRoomStatus("Connecting to room...");
        await room.connect(data.url, data.token);

        if (cancelled) {
          return;
        }

        const videoMediaTrack = processedStream.getVideoTracks()[0];

        if (!videoMediaTrack) {
          throw new Error("Processed video track is missing.");
        }

        const nextLocalTrack = new LocalVideoTrack(videoMediaTrack, undefined, true);

        await room.localParticipant.publishTrack(nextLocalTrack, {
          name: "camera",
          source: Track.Source.Camera
        });

        setLocalTrack(nextLocalTrack);
        setRemoteViews(collectRemoteViews(room));
        setRoomStatus("Connected. Only your transformed video is being sent.");

        const updateRemoteViews = () => {
          if (!cancelled) {
            setRemoteViews(collectRemoteViews(room));
          }
        };

        room
          .on(RoomEvent.ParticipantConnected, updateRemoteViews)
          .on(RoomEvent.ParticipantDisconnected, updateRemoteViews)
          .on(RoomEvent.TrackSubscribed, updateRemoteViews)
          .on(RoomEvent.TrackUnsubscribed, updateRemoteViews)
          .on(RoomEvent.TrackPublished, updateRemoteViews)
          .on(RoomEvent.TrackUnpublished, updateRemoteViews)
          .on(RoomEvent.Disconnected, () => {
            if (!cancelled) {
              setRoomStatus("Disconnected from room.");
            }
          });
      } catch (caughtError) {
        if (!cancelled) {
          setRoomError(
            caughtError instanceof Error ? caughtError.message : "Could not join the room."
          );
          setRoomStatus("Room connection failed.");
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      room.disconnect();
      setLocalTrack((existingTrack) => {
        existingTrack?.stop();
        return null;
      });
    };
  }, [processedStream, settings.participantName, settings.roomName]);

  const showCameraError = status === "error";

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Live room</p>
            <h1 style={styles.heading}>{settings.roomName || "Workout room"}</h1>
            <p style={showCameraError || roomError ? styles.errorText : styles.statusText}>
              {showCameraError ? error : roomError ?? roomStatus}
            </p>
          </div>

          <div style={styles.headerActions}>
            <span style={styles.pill}>Video only</span>
            <button onClick={() => router.push("/")} style={styles.leaveButton} type="button">
              Leave room
            </button>
          </div>
        </div>

        <div style={styles.grid}>
          <canvas aria-hidden ref={previewRef} style={styles.hiddenCanvas} />

          <div style={styles.remoteGrid}>
            <ParticipantTile isLocal name={settings.participantName || "You"} videoTrack={localTrack} />
            {remoteViews.length === 0 ? (
              <div style={styles.emptyState}>
                Waiting for other people to join <strong>{settings.roomName}</strong>.
              </div>
            ) : (
              remoteViews.map((view) => (
                <ParticipantTile
                  key={view.sid}
                  name={view.name}
                  publication={view.publication}
                />
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 24
  },
  shell: {
    display: "grid",
    gap: 20
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16
  },
  eyebrow: {
    margin: 0,
    color: "#67e8f9",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontSize: 12
  },
  heading: {
    margin: "10px 0 8px",
    fontSize: 40
  },
  statusText: {
    margin: 0,
    color: "#b8c5d8"
  },
  errorText: {
    margin: 0,
    color: "#fca5a5"
  },
  headerActions: {
    display: "flex",
    gap: 12,
    alignItems: "center"
  },
  pill: {
    padding: "10px 12px",
    borderRadius: 999,
    background: "rgba(15, 23, 42, 0.82)",
    border: "1px solid rgba(148, 163, 184, 0.18)"
  },
  leaveButton: {
    borderRadius: 14,
    border: "1px solid rgba(248, 113, 113, 0.35)",
    background: "rgba(69, 10, 10, 0.28)",
    color: "#fecaca",
    padding: "12px 14px"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 20
  },
  hiddenCanvas: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: "none"
  },
  remoteGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
    alignContent: "start"
  },
  emptyState: {
    gridColumn: "1 / -1",
    minHeight: 180,
    display: "grid",
    placeItems: "center",
    borderRadius: 22,
    background: "rgba(15, 23, 42, 0.82)",
    border: "1px dashed rgba(148, 163, 184, 0.22)",
    color: "#a7b6ca",
    textAlign: "center",
    padding: 20
  }
};
