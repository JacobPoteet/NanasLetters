// Comments moderation + usage tracking (Jacob's ask). No pre-moderation
// queue exists — this is entirely reactive: see every comment across the
// site, delete one, ban a device, or wipe everything a device ever posted.
// Exempt from the family-facing design bar, same as every other /admin page.

import { useCallback, useEffect, useState } from "react";
import type { AdminComment, BannedDevice, CommentsAdminSummary } from "../../shared/types";
import { pageTitle } from "../../shared/pageTitle";
import { api } from "../api";
import { Link } from "../router";
import { useDocumentTitle } from "../useDocumentTitle";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 13, color: "#666" }}>{label}</div>
    </div>
  );
}

export function AdminCommentsPage() {
  const [summary, setSummary] = useState<CommentsAdminSummary | null>(null);
  const [comments, setComments] = useState<AdminComment[] | null>(null);
  const [bannedDevices, setBannedDevices] = useState<BannedDevice[] | null>(null);
  const [requireLogin, setRequireLogin] = useState<boolean | null>(null);
  const [deviceFilter, setDeviceFilter] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useDocumentTitle(pageTitle("Comments"));

  const reload = useCallback(() => {
    api.adminCommentsSummary().then(setSummary).catch((err) => setError(err.message));
    api
      .adminComments({ deviceId: deviceFilter || undefined, includeDeleted })
      .then((r) => setComments(r.comments))
      .catch((err) => setError(err.message));
    api.adminBannedDevices().then((r) => setBannedDevices(r.devices)).catch(() => {});
  }, [deviceFilter, includeDeleted]);

  useEffect(() => {
    api.getSettings().then((s) => setRequireLogin(s.commentsRequireLogin)).catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleDelete(id: number) {
    setBusyId(`comment-${id}`);
    try {
      await api.deleteComment(id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleBan(deviceId: string) {
    setBusyId(`ban-${deviceId}`);
    try {
      await api.banDevice(deviceId);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnban(deviceId: string) {
    setBusyId(`unban-${deviceId}`);
    try {
      await api.unbanDevice(deviceId);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteAllFromDevice(deviceId: string) {
    if (!window.confirm(`Delete every comment from device ${deviceId}? This can't be undone from here.`)) return;
    setBusyId(`wipe-${deviceId}`);
    try {
      await api.deleteCommentsByDevice(deviceId);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleRequireLogin() {
    if (requireLogin === null) return;
    const next = !requireLogin;
    setRequireLogin(next);
    try {
      await api.updateSettings({ commentsRequireLogin: next });
    } catch (err) {
      setRequireLogin(!next);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="content" style={{ maxWidth: 1100, fontFamily: "system-ui, sans-serif" }}>
      <h1>Comments</h1>
      {error && <div className="error-text">{error}</div>}

      {summary && (
        <div style={{ display: "flex", gap: 32, margin: "20px 0", flexWrap: "wrap" }}>
          <Stat label="Total comments" value={summary.totalComments} />
          <Stat label="Today" value={summary.commentsToday} />
          <Stat label="This week" value={summary.commentsThisWeek} />
          <Stat label="Unique devices" value={summary.uniqueDevices} />
          <Stat label="Banned devices" value={summary.bannedDevices} />
        </div>
      )}

      {requireLogin !== null && (
        <label style={{ display: "block", margin: "16px 0" }}>
          <input type="checkbox" checked={requireLogin} onChange={handleToggleRequireLogin} />{" "}
          Require login to comment
          <span style={{ color: "#888", marginLeft: 8, fontSize: 13 }}>
            (every page already requires a family login today, so this only matters once the site's reading is ever made public)
          </span>
        </label>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "16px 0" }}>
        <input
          type="text"
          placeholder="Filter by device id"
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value)}
          style={{ padding: 6, minWidth: 280 }}
        />
        <label>
          <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} /> Include
          deleted
        </label>
      </div>

      {!comments ? (
        <p>Loading…</p>
      ) : comments.length === 0 ? (
        <p>No comments match this filter.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: "4px 8px 4px 0" }}>Letter</th>
              <th style={{ padding: "4px 8px" }}>Author</th>
              <th style={{ padding: "4px 8px" }}>Comment</th>
              <th style={{ padding: "4px 8px" }}>Device</th>
              <th style={{ padding: "4px 8px" }}>Status</th>
              <th style={{ padding: "4px 8px" }}>Posted</th>
              <th style={{ padding: "4px 8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {comments.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #eee", opacity: c.status === "deleted" ? 0.5 : 1 }}>
                <td style={{ padding: "8px 8px 8px 0", whiteSpace: "nowrap", verticalAlign: "top" }}>
                  <Link to={`/letters/${c.letterId}`}>{c.letterDate}</Link>
                </td>
                <td style={{ padding: 8, verticalAlign: "top", whiteSpace: "nowrap" }}>{c.authorName ?? "(none)"}</td>
                <td style={{ padding: 8, verticalAlign: "top", maxWidth: 360 }}>{c.body}</td>
                <td style={{ padding: 8, verticalAlign: "top", fontFamily: "monospace", fontSize: 12 }}>
                  {c.deviceId}
                  {c.bannedDevice && <div style={{ color: "#b0522d", fontWeight: 600 }}>banned</div>}
                  {c.ipHash && (
                    <div style={{ color: "#888", fontSize: 11 }} title="Salted hash of the connecting IP — a moderation hint, never the raw IP">
                      ip: {c.ipHash.slice(0, 10)}…
                    </div>
                  )}
                </td>
                <td style={{ padding: 8, verticalAlign: "top" }}>{c.status}</td>
                <td style={{ padding: 8, verticalAlign: "top", whiteSpace: "nowrap" }}>{c.createdAt}</td>
                <td style={{ padding: 8, verticalAlign: "top", whiteSpace: "nowrap" }}>
                  {c.status === "visible" && (
                    <button onClick={() => handleDelete(c.id)} disabled={busyId === `comment-${c.id}`}>
                      Delete
                    </button>
                  )}{" "}
                  {c.bannedDevice ? (
                    <button onClick={() => handleUnban(c.deviceId)} disabled={busyId === `unban-${c.deviceId}`}>
                      Unban device
                    </button>
                  ) : (
                    <button onClick={() => handleBan(c.deviceId)} disabled={busyId === `ban-${c.deviceId}`}>
                      Ban device
                    </button>
                  )}{" "}
                  <button onClick={() => handleDeleteAllFromDevice(c.deviceId)} disabled={busyId === `wipe-${c.deviceId}`}>
                    Delete all from device
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Banned devices</h2>
      {!bannedDevices || bannedDevices.length === 0 ? (
        <p>No devices are currently banned.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {bannedDevices.map((d) => (
              <tr key={d.deviceId} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 8px 8px 0", fontFamily: "monospace", fontSize: 12 }}>{d.deviceId}</td>
                <td style={{ padding: 8 }}>{d.reason ?? "—"}</td>
                <td style={{ padding: 8, whiteSpace: "nowrap" }}>{d.commentCount} comments ever</td>
                <td style={{ padding: 8, whiteSpace: "nowrap" }}>{d.bannedAt}</td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => handleUnban(d.deviceId)} disabled={busyId === `unban-${d.deviceId}`}>
                    Unban
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
