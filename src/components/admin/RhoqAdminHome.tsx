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

export function RhoqAdminHome() {
  const [tab, setTab] = useState<ListTab>("active");
  const [recorders, setRecorders] = useState<RecorderSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const loadRecorders = useCallback(async (listTab: ListTab) => {
    setLoadingList(true);
    setListError(null);
    try {
      const query = listTab === "archive" ? "?archived=1" : "";
      const response = await fetch(`/api/rhoq-admin/recorders${query}`);
      const data = (await response.json().catch(() => null)) as {
        recorders?: RecorderSummary[];
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load recorders");
      }
      setRecorders(data?.recorders ?? []);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Could not load");
      setRecorders([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadRecorders(tab);
  }, [loadRecorders, tab]);

  function switchTab(next: ListTab) {
    setTab(next);
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
      await loadRecorders("active");
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Could not create recorder"
      );
    } finally {
      setCreateBusy(false);
    }
  }

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
            onClick={() => void loadRecorders(tab)}
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
        )}
      </section>
    </RhoqAdminShell>
  );
}
