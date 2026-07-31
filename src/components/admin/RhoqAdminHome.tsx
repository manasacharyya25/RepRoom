"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { RhoqAdminShell } from "@/components/admin/RhoqAdminShell";

type ListTab = "active" | "archive";

type RecorderSummary = {
  id: string;
  username: string;
  maxSeconds: number;
  secondsUsed: number;
  active: boolean;
  createdAt: string;
  promotedAt: string | null;
  promotedUserId: string | null;
  sessionCount: number;
  imageCount: number;
};

const PAGE_SIZE = 20;

export function RhoqAdminHome() {
  const [tab, setTab] = useState<ListTab>("active");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [recorders, setRecorders] = useState<RecorderSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const loadRecorders = useCallback(async (listTab: ListTab, listPage: number) => {
    setLoadingList(true);
    setListError(null);
    try {
      const params = new URLSearchParams({
        page: String(listPage),
        limit: String(PAGE_SIZE)
      });
      if (listTab === "archive") params.set("archived", "1");
      const response = await fetch(
        `/api/rhoq-admin/recorders?${params.toString()}`
      );
      const data = (await response.json().catch(() => null)) as {
        recorders?: RecorderSummary[];
        page?: number;
        total?: number;
        hasMore?: boolean;
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load recorders");
      }
      setRecorders(data?.recorders ?? []);
      setTotal(data?.total ?? 0);
      setHasMore(Boolean(data?.hasMore));
      if (typeof data?.page === "number" && data.page !== listPage) {
        setPage(data.page);
      }
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Could not load");
      setRecorders([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadRecorders(tab, page);
  }, [loadRecorders, tab, page]);

  function switchTab(next: ListTab) {
    setTab(next);
    setPage(1);
  }

  async function onCreateRecorder(event: FormEvent) {
    event.preventDefault();
    setCreateBusy(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const response = await fetch("/api/rhoq-admin/recorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword
        })
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        recorder?: { username: string; id: string };
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not create recorder");
      }
      setCreateSuccess(
        `Created @${data?.recorder?.username} — /onboard/${data?.recorder?.username}`
      );
      setNewUsername("");
      setNewPassword("");
      setTab("active");
      setPage(1);
      await loadRecorders("active", 1);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Could not create recorder"
      );
    } finally {
      setCreateBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <RhoqAdminShell>
      <section className="rhoq-admin-panel">
        <h2>Create onboard user</h2>
        <p className="rhoq-admin-muted">
          Creates a password-gated recorder at{" "}
          <code>/onboard/&#123;username&#125;</code>.
        </p>
        <form className="rhoq-admin-create" onSubmit={onCreateRecorder}>
          <label className="rhoq-admin-label" htmlFor="create-username">
            Username
          </label>
          <input
            autoComplete="off"
            className="rhoq-admin-input"
            id="create-username"
            onChange={(event) => setNewUsername(event.target.value)}
            placeholder="alex"
            required
            value={newUsername}
          />
          <label className="rhoq-admin-label" htmlFor="create-password">
            Password
          </label>
          <input
            autoComplete="new-password"
            className="rhoq-admin-input"
            id="create-password"
            minLength={4}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
          {createError ? (
            <p className="rhoq-admin-error" role="alert">
              {createError}
            </p>
          ) : null}
          {createSuccess ? (
            <p className="rhoq-admin-success" role="status">
              {createSuccess}
            </p>
          ) : null}
          <button
            className="rhoq-admin-primary-btn"
            disabled={createBusy || !newUsername || newPassword.length < 4}
            type="submit"
          >
            {createBusy ? "Creating…" : "Create user"}
          </button>
        </form>
      </section>

      <section className="rhoq-admin-panel">
        <div className="rhoq-admin-panel-head">
          <h1>
            {tab === "archive" ? "Promoted archive" : "Onboarding recorders"}
          </h1>
          <button
            className="rhoq-admin-ghost-btn"
            disabled={loadingList}
            onClick={() => void loadRecorders(tab, page)}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="rhoq-admin-tabs" role="tablist">
          <button
            aria-selected={tab === "active"}
            className={`rhoq-admin-tab${tab === "active" ? " is-active" : ""}`}
            onClick={() => switchTab("active")}
            role="tab"
            type="button"
          >
            Active
          </button>
          <button
            aria-selected={tab === "archive"}
            className={`rhoq-admin-tab${tab === "archive" ? " is-active" : ""}`}
            onClick={() => switchTab("archive")}
            role="tab"
            type="button"
          >
            Archive
          </button>
        </div>

        {listError ? (
          <p className="rhoq-admin-error" role="alert">
            {listError}
          </p>
        ) : null}
        {loadingList && recorders.length === 0 ? (
          <p className="rhoq-admin-muted">Loading…</p>
        ) : recorders.length === 0 ? (
          <p className="rhoq-admin-muted">
            {tab === "archive"
              ? "No promoted recorders yet."
              : "No active recorders."}
          </p>
        ) : (
          <>
            <div className="rhoq-admin-table-wrap">
              <table className="rhoq-admin-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Usage</th>
                    <th>Sessions</th>
                    <th>Photos</th>
                    {tab === "archive" ? <th>Promoted</th> : <th>Active</th>}
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recorders.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/rhoq-admin/${row.id}`}>
                          @{row.username}
                        </Link>
                      </td>
                      <td>
                        {row.secondsUsed}s / {row.maxSeconds}s
                      </td>
                      <td>{row.sessionCount}</td>
                      <td>{row.imageCount}</td>
                      <td>
                        {tab === "archive"
                          ? row.promotedAt
                            ? new Date(row.promotedAt).toLocaleDateString()
                            : "—"
                          : row.active
                            ? "Yes"
                            : "No"}
                      </td>
                      <td>{new Date(row.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rhoq-admin-pagination">
              <p className="rhoq-admin-muted">
                Showing {rangeStart}–{rangeEnd} of {total}
                {tab === "active" ? " · newest first" : " · recently promoted first"}
              </p>
              <div className="rhoq-admin-pagination-actions">
                <button
                  className="rhoq-admin-ghost-btn"
                  disabled={loadingList || page <= 1}
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
                  disabled={loadingList || !hasMore}
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
