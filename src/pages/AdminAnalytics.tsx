// Operational visibility only ("is this working, roughly what scale") --
// see GitHub #8. No per-person tracking, no engagement optimization.

import { useEffect, useState } from "react";
import type { AnalyticsSummary } from "../../shared/types";
import { pageTitle } from "../../shared/pageTitle";
import { api } from "../api";
import { Link } from "../router";
import { useDocumentTitle } from "../useDocumentTitle";

export function AdminAnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentTitle(pageTitle("Analytics"));

  useEffect(() => {
    api.analyticsSummary().then(setSummary).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="content error-text">{error}</div>;
  if (!summary) return <div className="content">Loading…</div>;

  return (
    <div className="content" style={{ maxWidth: 900, fontFamily: "system-ui, sans-serif" }}>
      <h1>Usage</h1>
      <p style={{ color: "#666" }}>
        Anonymous, operational visibility only — no per-person tracking. All-time totals, plus the last{" "}
        {summary.windowDays} days.
      </p>

      <div style={{ display: "flex", gap: 32, margin: "20px 0", flexWrap: "wrap" }}>
        <Stat label="Visits (all time)" value={summary.totalVisits} />
        <Stat label="Devices seen (all time)" value={summary.totalDevices} />
        <Stat label={`Home-page visits (${summary.windowDays}d)`} value={summary.homeVisitsInWindow} />
        <Stat label="New devices today" value={summary.newDevicesToday} />
      </div>

      <h2>Visits per day (last {summary.windowDays} days)</h2>
      {summary.daily.length === 0 ? (
        <p>No activity recorded yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: "4px 8px 4px 0" }}>Day</th>
              <th style={{ padding: "4px 8px" }}>Visits</th>
              <th style={{ padding: "4px 8px" }}>Devices</th>
            </tr>
          </thead>
          <tbody>
            {[...summary.daily].reverse().map((d) => (
              <tr key={d.day} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "4px 8px 4px 0" }}>{d.day}</td>
                <td style={{ padding: "4px 8px" }}>{d.visits}</td>
                <td style={{ padding: "4px 8px" }}>{d.devices}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Most-read letters</h2>
      {summary.mostRead.length === 0 ? (
        <p>No letter reads recorded yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {summary.mostRead.map((m) => (
              <tr key={m.letterId} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 8px 8px 0", whiteSpace: "nowrap", verticalAlign: "top" }}>{m.date}</td>
                <td style={{ padding: 8 }}>{m.excerpt}</td>
                <td style={{ padding: 8, whiteSpace: "nowrap" }}>{m.reads} reads</td>
                <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                  <Link to={`/admin/letters/${m.letterId}`}>Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 13, color: "#666" }}>{label}</div>
    </div>
  );
}
