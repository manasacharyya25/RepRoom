"use client";

import { useCallback, useEffect, useState } from "react";
import { RhoqAdminShell } from "@/components/admin/RhoqAdminShell";
import { OnboardingSessionPlayer } from "@/components/onboard/OnboardingSessionPlayer";
import "@/app/onboard-recorder.css";

type ArchiveSessionRow = {
  sessionId: string;
  userId: string;
  displayName: string | null;
  username: string | null;
  roomId: string;
  r2Folder: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  lastChunkNumber: number;
  lastChunkUploadedAt: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  availableChunks: number[] | null;
};

function archiveUserLabel(row: ArchiveSessionRow) {
  const name = row.displayName?.trim();
  const handle = row.username?.trim();
  if (name && handle) return `${name} (@${handle})`;
  if (name) return name;
  if (handle) return `@${handle}`;
  return row.userId;
}

const PAGE_SIZE = 20;

export function RhoqAdminArchives() {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [sessions, setSessions] = useState<ArchiveSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Only one preview mounts at a time — click starts chunk pull/playback. */
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  const load = useCallback(async (listPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(listPage),
        limit: String(PAGE_SIZE)
      });
      const response = await fetch(
        `/api/rhoq-admin/archives?${params.toString()}`
      );
      const data = (await response.json().catch(() => null)) as {
        sessions?: ArchiveSessionRow[];
        page?: number;
        total?: number;
        hasMore?: boolean;
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load archives");
      }
      setSessions(data?.sessions ?? []);
      setTotal(data?.total ?? 0);
      setHasMore(Boolean(data?.hasMore));
      if (typeof data?.page === "number" && data.page !== listPage) {
        setPage(data.page);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load archives");
      setSessions([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  useEffect(() => {
    setActivePreviewId(null);
  }, [page]);

  async function onDelete(session: ArchiveSessionRow) {
    const confirmed = window.confirm(
      `Delete archive session from the database?\n\n${session.sessionId}\n\nR2 path (not deleted):\n${session.r2Folder}\n\nIt will no longer appear in Rooms.`
    );
    if (!confirmed) return;

    setDeletingId(session.sessionId);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/rhoq-admin/archives/${encodeURIComponent(session.sessionId)}`,
        { method: "DELETE" }
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not delete archive");
      }
      if (activePreviewId === session.sessionId) {
        setActivePreviewId(null);
      }
      const remainingOnPage = sessions.length - 1;
      if (remainingOnPage <= 0 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await load(page);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not delete archive"
      );
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <RhoqAdminShell wide>
      <section className="rhoq-admin-panel">
        <div className="rhoq-admin-panel-head">
          <h1>Archive sessions</h1>
          <button
            className="rhoq-admin-ghost-btn"
            disabled={loading}
            onClick={() => void load(page)}
            type="button"
          >
            Refresh
          </button>
        </div>
        <p className="rhoq-admin-muted">
          Sessions used to fill empty room tiles. Click a preview to load chunks
          and play. Deleting removes the DB row only — R2 objects are left in
          place.
        </p>

        {error ? (
          <p className="rhoq-admin-error" role="alert">
            {error}
          </p>
        ) : null}
        {actionError ? (
          <p className="rhoq-admin-error" role="alert">
            {actionError}
          </p>
        ) : null}

        {loading && sessions.length === 0 ? (
          <p className="rhoq-admin-muted">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="rhoq-admin-muted">No archive sessions.</p>
        ) : (
          <>
            <ul className="rhoq-admin-archive-list">
              {sessions.map((row) => {
                const isActive = activePreviewId === row.sessionId;
                return (
                  <li className="rhoq-admin-archive-card" key={row.sessionId}>
                    <div className="rhoq-admin-archive-preview">
                      {isActive ? (
                        <div className="rhoq-admin-player">
                          <OnboardingSessionPlayer
                            availableChunks={row.availableChunks}
                            chunksResolve={{ kind: "live-archive" }}
                            lastChunkNumber={row.lastChunkNumber}
                            r2Folder={row.r2Folder}
                            sessionId={row.sessionId}
                          />
                        </div>
                      ) : (
                        <button
                          className="rhoq-admin-archive-play"
                          disabled={row.lastChunkNumber < 1}
                          onClick={() => setActivePreviewId(row.sessionId)}
                          type="button"
                        >
                          <span className="rhoq-admin-archive-play-icon" aria-hidden>
                            ▶
                          </span>
                          <span>
                            {row.lastChunkNumber < 1
                              ? "No chunks"
                              : "Click to preview"}
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="rhoq-admin-archive-meta">
                      <p>
                        <strong>{archiveUserLabel(row)}</strong>
                      </p>
                      <p>
                        <strong>{row.roomId}</strong>
                        {" · "}
                        tip {row.lastChunkNumber}
                        {row.availableChunks?.length
                          ? ` · ${row.availableChunks.length} listed`
                          : ""}
                      </p>
                      <p className="rhoq-admin-muted">
                        Ended{" "}
                        {row.endedAt
                          ? new Date(row.endedAt).toLocaleString()
                          : "—"}
                        {row.archiveReason ? ` · ${row.archiveReason}` : ""}
                      </p>
                      <p>
                        <span className="rhoq-admin-muted">Session </span>
                        <code className="rhoq-admin-code">{row.sessionId}</code>
                      </p>
                      <p>
                        <span className="rhoq-admin-muted">User id </span>
                        <code className="rhoq-admin-code">{row.userId}</code>
                      </p>
                      <p className="rhoq-admin-archive-path-row">
                        <span className="rhoq-admin-muted">R2 </span>
                        <code className="rhoq-admin-path">{row.r2Folder}</code>
                      </p>
                      <div className="rhoq-admin-archive-actions">
                        {isActive ? (
                          <button
                            className="rhoq-admin-ghost-btn"
                            onClick={() => setActivePreviewId(null)}
                            type="button"
                          >
                            Stop preview
                          </button>
                        ) : null}
                        <button
                          className="rhoq-admin-danger-btn"
                          disabled={deletingId === row.sessionId}
                          onClick={() => void onDelete(row)}
                          type="button"
                        >
                          {deletingId === row.sessionId
                            ? "Deleting…"
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="rhoq-admin-pagination">
              <p className="rhoq-admin-muted">
                Showing {rangeStart}–{rangeEnd} of {total} · newest ended first
              </p>
              <div className="rhoq-admin-pagination-actions">
                <button
                  className="rhoq-admin-ghost-btn"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  Previous
                </button>
                <span className="rhoq-admin-pagination-page">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="rhoq-admin-ghost-btn"
                  disabled={loading || !hasMore}
                  onClick={() => setPage((current) => current + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </RhoqAdminShell>
  );
}
