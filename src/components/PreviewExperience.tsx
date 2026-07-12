"use client";

import type { ChangeEvent, CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_FACE_STYLE, FACE_STYLES, type FaceStyleId } from "@/lib/face-styles";
import {
  SESSION_STORAGE_KEY,
  createDefaultSettings,
  type PreviewSettings
} from "@/lib/session";
import { useTransformedCamera } from "@/lib/use-transformed-camera";

function createRoomSlug() {
  return `room-${Math.random().toString(36).slice(2, 8)}`;
}

export function PreviewExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRoom = searchParams.get("room")?.trim() || createRoomSlug();
  const initialName = searchParams.get("name")?.trim() || "Workout buddy";

  const [roomName] = useState(initialRoom);
  const [participantName] = useState(initialName);
  const [styleId, setStyleId] = useState<FaceStyleId>(DEFAULT_FACE_STYLE);
  const [uploadedImageDataUrl, setUploadedImageDataUrl] = useState<string | undefined>();

  const { previewRef, processedStream, status, error, detectionMode } = useTransformedCamera({
    styleId,
    uploadedImageDataUrl
  });

  const isReady = status === "ready" && processedStream;

  const statusCopy = useMemo(() => {
    if (status === "starting") {
      return "Starting camera and local face transform...";
    }
    if (status === "error") {
      return error ?? "Camera setup failed.";
    }
    if (status === "ready") {
      return detectionMode === "mediapipe"
        ? "Your transformed face is ready. Only this version will be streamed."
        : "Fallback mask mode is active. Only the transformed preview will be streamed.";
    }
    return "Waiting for camera access...";
  }, [detectionMode, error, status]);

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImageDataUrl(typeof reader.result === "string" ? reader.result : undefined);
      setStyleId("avatar");
    };
    reader.readAsDataURL(file);
  };

  const handleJoinRoom = () => {
    const settings: PreviewSettings = {
      ...createDefaultSettings(roomName, participantName),
      styleId,
      uploadedImageDataUrl
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(settings));
    router.push(
      `/room?room=${encodeURIComponent(roomName)}&name=${encodeURIComponent(participantName)}`
    );
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <p style={styles.eyebrow}>Preview</p>
            <h1 style={styles.heading}>Choose how your face looks before you join</h1>
            <p style={styles.subheading}>
              Room <strong>{roomName}</strong> as <strong>{participantName}</strong>
            </p>
          </div>
          <button style={styles.secondaryButton} onClick={() => router.push("/")}>
            Back
          </button>
        </div>

        <div style={styles.previewLayout}>
          <div style={styles.previewPanel}>
            <canvas ref={previewRef} style={styles.canvas} />
            <p style={status === "error" ? styles.errorText : styles.statusText}>{statusCopy}</p>
          </div>

          <div style={styles.controlPanel}>
            <div style={styles.section}>
              <p style={styles.sectionTitle}>Face styles</p>
              <div style={styles.styleGrid}>
                {FACE_STYLES.map((style) => (
                  <button
                    key={style.id}
                    style={{
                      ...styles.styleCard,
                      ...(styleId === style.id ? styles.styleCardActive : {})
                    }}
                    onClick={() => setStyleId(style.id)}
                    type="button"
                  >
                    <span style={styles.styleLabel}>{style.label}</span>
                    <span style={styles.styleDescription}>{style.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.section}>
              <p style={styles.sectionTitle}>Optional reference image</p>
              <label style={styles.uploadBox}>
                <input
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: "none" }}
                  type="file"
                />
                {uploadedImageDataUrl
                  ? "Replace uploaded image"
                  : "Upload an image to use with Avatar mode"}
              </label>
              {uploadedImageDataUrl ? (
                <button
                  onClick={() => setUploadedImageDataUrl(undefined)}
                  style={styles.removeButton}
                  type="button"
                >
                  Remove uploaded image
                </button>
              ) : null}
            </div>

            <button
              disabled={!isReady}
              onClick={handleJoinRoom}
              style={{
                ...styles.primaryButton,
                ...(!isReady ? styles.disabledButton : {})
              }}
              type="button"
            >
              Join room
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  card: {
    width: "min(1180px, 100%)",
    background: "rgba(8, 15, 27, 0.9)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.35)"
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 24
  },
  eyebrow: {
    margin: 0,
    color: "#67e8f9",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontSize: 12
  },
  heading: {
    margin: "8px 0 6px",
    fontSize: 34,
    lineHeight: 1.1
  },
  subheading: {
    margin: 0,
    color: "#b8c5d8"
  },
  previewLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)",
    gap: 24
  },
  previewPanel: {
    background: "rgba(15, 23, 42, 0.85)",
    borderRadius: 24,
    border: "1px solid rgba(148, 163, 184, 0.18)",
    padding: 18
  },
  canvas: {
    width: "100%",
    aspectRatio: "16 / 9",
    borderRadius: 18,
    background: "#020617",
    objectFit: "cover"
  },
  statusText: {
    margin: "14px 0 0",
    color: "#b8c5d8"
  },
  errorText: {
    margin: "14px 0 0",
    color: "#fca5a5"
  },
  controlPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 20
  },
  section: {
    background: "rgba(15, 23, 42, 0.85)",
    borderRadius: 20,
    border: "1px solid rgba(148, 163, 184, 0.18)",
    padding: 18
  },
  sectionTitle: {
    margin: "0 0 14px",
    fontSize: 15,
    fontWeight: 700
  },
  styleGrid: {
    display: "grid",
    gap: 12
  },
  styleCard: {
    textAlign: "left",
    background: "rgba(30, 41, 59, 0.65)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    borderRadius: 16,
    color: "inherit",
    padding: 14,
    display: "grid",
    gap: 4
  },
  styleCardActive: {
    borderColor: "#67e8f9",
    boxShadow: "0 0 0 1px rgba(103, 232, 249, 0.5)"
  },
  styleLabel: {
    fontWeight: 700
  },
  styleDescription: {
    color: "#a7b6ca",
    fontSize: 14,
    lineHeight: 1.4
  },
  uploadBox: {
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px dashed rgba(148, 163, 184, 0.45)",
    background: "rgba(30, 41, 59, 0.35)"
  },
  removeButton: {
    marginTop: 12,
    background: "transparent",
    border: "none",
    color: "#fca5a5",
    padding: 0
  },
  primaryButton: {
    border: "none",
    borderRadius: 16,
    background: "linear-gradient(135deg, #06b6d4, #22c55e)",
    color: "#04111e",
    fontWeight: 800,
    padding: "16px 20px"
  },
  secondaryButton: {
    borderRadius: 14,
    border: "1px solid rgba(148, 163, 184, 0.18)",
    background: "rgba(15, 23, 42, 0.8)",
    color: "inherit",
    padding: "12px 14px"
  },
  disabledButton: {
    opacity: 0.45,
    cursor: "not-allowed"
  }
};
