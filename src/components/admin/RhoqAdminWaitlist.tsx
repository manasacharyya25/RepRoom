"use client";

import { useCallback, useEffect, useState } from "react";
import { RhoqAdminShell } from "@/components/admin/RhoqAdminShell";

type WaitlistEntry = {
  id: string;
  email: string;
  source: string | null;
  createdAt: string;
};

export function RhoqAdminWaitlist() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/rhoq-admin/waitlist");
      const data = (await response.json().catch(() => null)) as {
        entries?: WaitlistEntry[];
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not load waitlist");
      }
      setEntries(data?.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load waitlist");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RhoqAdminShell>
      <section className="rhoq-admin-panel">
        <div className="rhoq-admin-panel-head">
          <h1>Waitlist</h1>
          <button
            className="rhoq-admin-ghost-btn"
            disabled={loading}
            onClick={() => void load()}
            type="button"
          >
            Refresh
          </button>
        </div>
        <p className="rhoq-admin-muted">
          Emails collected from the landing waitlist form.
        </p>
        {error ? (
          <p className="rhoq-admin-error" role="alert">
            {error}
          </p>
        ) : null}
        {loading && entries.length === 0 ? (
          <p className="rhoq-admin-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="rhoq-admin-muted">No waitlist emails yet.</p>
        ) : (
          <div className="rhoq-admin-table-wrap">
            <table className="rhoq-admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Source</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.id}>
                    <td>{row.email}</td>
                    <td>{row.source ?? "—"}</td>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
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
