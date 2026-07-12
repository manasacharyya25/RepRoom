"use client";

import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function buildRoomSlug() {
  return `room-${Math.random().toString(36).slice(2, 8)}`;
}

export default function JoinPage() {
  const router = useRouter();
  const suggestedRoom = useMemo(() => buildRoomSlug(), []);
  const [roomName, setRoomName] = useState(suggestedRoom);
  const [participantName, setParticipantName] = useState("");

  const canContinue = roomName.trim().length > 1 && participantName.trim().length > 1;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canContinue) {
      return;
    }

    router.push(
      `/preview?room=${encodeURIComponent(roomName.trim())}&name=${encodeURIComponent(participantName.trim())}`
    );
  };

  return (
    <main style={styles.page}>
      <Link href="/" style={styles.backLink}>
        ← Back to home
      </Link>
      <section style={styles.hero}>
        <div style={styles.copy}>
          <p style={styles.eyebrow}>Join a room</p>
          <h1 style={styles.heading}>Enter your details to continue</h1>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.label}>Your name</span>
            <input
              onChange={(event) => setParticipantName(event.target.value)}
              placeholder="Workout buddy"
              style={styles.input}
              value={participantName}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Room name</span>
            <input
              onChange={(event) => setRoomName(event.target.value)}
              style={styles.input}
              value={roomName}
            />
          </label>

          <button
            disabled={!canContinue}
            style={{
              ...styles.primaryButton,
              ...(!canContinue ? styles.disabledButton : {})
            }}
            type="submit"
          >
            Continue to preview
          </button>
        </form>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "#0c0c0e",
    color: "#f5f5f7"
  },
  backLink: {
    alignSelf: "flex-start",
    marginBottom: 16,
    color: "#9a9aa3",
    fontSize: 14
  },
  hero: {
    width: "min(720px, 100%)",
    display: "grid",
    gap: 24,
    padding: 28,
    borderRadius: 28,
    background: "#1a1a1f",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.45)"
  },
  copy: {
    padding: "0 4px"
  },
  eyebrow: {
    margin: 0,
    color: "#ff5c2b",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontSize: 12,
    fontWeight: 700
  },
  heading: {
    margin: "14px 0 0",
    fontSize: 32,
    lineHeight: 1.2,
    letterSpacing: "-0.03em"
  },
  form: {
    display: "grid",
    gap: 16
  },
  field: {
    display: "grid",
    gap: 8
  },
  label: {
    fontWeight: 700
  },
  input: {
    borderRadius: 14,
    border: "1px solid rgba(255, 255, 255, 0.12)",
    background: "#141417",
    color: "inherit",
    padding: "14px 16px"
  },
  primaryButton: {
    border: "none",
    borderRadius: 999,
    background: "#ff5c2b",
    color: "#fff",
    fontWeight: 700,
    padding: "16px 20px",
    marginTop: 8,
    boxShadow: "0 10px 28px rgba(255, 92, 43, 0.28)"
  },
  disabledButton: {
    opacity: 0.45,
    cursor: "not-allowed"
  }
};
