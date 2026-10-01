// The admin landing page: a read-only summary of how the archive is doing.
// Triage lives on the Review queue page — this only points at it.

import { useEffect, useState } from "react";
import type { DashboardSummary } from "../../shared/types";
import { pageTitle } from "../../shared/pageTitle";
import { api } from "../api";
import { Link } from "../router";
import { useDocumentTitle } from "../useDocumentTitle";

function lastLetterNote(days: number | null): string {
  if (days === null) return "No letters yet";
  if (days === 0) return "Newest letter is from today";
  if (days === 1) return "Newest letter is from yesterday";
  return `Newest letter is ${days} days old`;
}

export function AdminDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentTitle(pageTitle("Dashboard"));

  useEffect(() => {
    api.dashboardSummary().then(setSummary).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="content error-text">{error}</div>;
  if (!summary) return <div className="content">Loading…</div>;

  const { archive, comments, analytics } = summary;

  return (
    <div className="content" style={{ maxWidth: 900, fontFamily: "system-ui, sans-serif" }}>
      <h1>Dashboard</h1>
      <p style={{ color: "#666" }}>Today is {summary.today} (Eastern time).</p>

      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: 4,
          padding: 16,
          margin: "16px 0 24px",
          background: summary.pendingReview > 0 ? "#fff8e1" : undefined,
        }}
      >
        {summary.pendingReview > 0 ? (
          <>
            <strong>
              {summary.pendingReview} {summary.pendingReview === 1 ? "letter needs" : "letters need"} review.
            </strong>{" "}
            <Link to="/admin/review">Open the review queue</Link>
          </>
        ) : (
          <>
            Nothing needs review. <Link to="/admin/review">Review queue</Link>
          </>
        )}
      </div>

      <h2>Archive</h2>
      <div style={{ display: "flex", gap: 32, margin: "12px 0 8px", flexWrap: "wrap" }}>
        <Stat label="Letters" value={archive.totalLetters} />
        <Stat label="Newest letter" value={archive.lastDate} small />
      </div>
      <p style={{ color: "#666" }}>
        {lastLetterNote(summary.daysSinceLastLetter)}. Ongoing ingestion is currently off, so new letters only arrive
        by hand.
      </p>

      <h2>Visits</h2>
      <div style={{ display: "flex", gap: 32, margin: "12px 0 8px", flexWrap: "wrap" }}>
        <Stat label="Visits today" value={summary.visitsToday} />
        <Stat label="Devices today" value={summary.devicesToday} />
        <Stat label="New devices today" value={analytics.newDevicesToday} />
        <Stat label="Devices seen (all time)" value={analytics.totalDevices} />
      </div>
      <p>
        <Link to="/admin/analytics">Full usage breakdown</Link>
      </p>

      <h2>Comments</h2>
      <div style={{ display: "flex", gap: 32, margin: "12px 0 8px", flexWrap: "wrap" }}>
        <Stat label="Today" value={comments.commentsToday} />
        <Stat label="Last 7 days" value={comments.commentsThisWeek} />
        <Stat label="All time" value={comments.totalComments} />
        <Stat label="Banned devices" value={comments.bannedDevices} />
      </div>
      <p>
        <Link to="/admin/comments">Moderate comments</Link>
      </p>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: small ? 22 : 28, fontWeight: 600, lineHeight: small ? "36px" : undefined }}>{value}</div>
      <div style={{ fontSize: 13, color: "#666" }}>{label}</div>
    </div>
  );
}
