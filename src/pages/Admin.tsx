// The admin edit screen — explicitly exempt from the family-facing design
// bar (CLAUDE.md's UI/layout decision), so this stays plain and functional.
// v1 covers the review queue; per-letter editing (fixing a bad date or a bad
// parse split) is the PUT /api/admin/letters/:id endpoint, not yet wired to
// a form here — a follow-up within this same implementation pass.

import { useEffect, useState } from "react";
import type { ReviewQueueItem } from "../../shared/types";

async function fetchQueue(): Promise<ReviewQueueItem[]> {
  const res = await fetch("/api/admin/review-queue");
  if (!res.ok) throw new Error(`Failed to load review queue: ${res.status}`);
  const data = (await res.json()) as { items: ReviewQueueItem[] };
  return data.items;
}

async function dismissItem(id: number): Promise<void> {
  const res = await fetch(`/api/admin/review-queue/${id}/dismiss`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to dismiss: ${res.status}`);
}

interface AcceptFields {
  date: string;
  text: string;
  meditationTitle: string;
  meditationUrl: string;
}

async function acceptItem(id: number, fields: AcceptFields): Promise<void> {
  const res = await fetch(`/api/admin/review-queue/${id}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: fields.date,
      text: fields.text,
      meditationTitle: fields.meditationTitle.trim() === "" ? null : fields.meditationTitle,
      meditationUrl: fields.meditationUrl.trim() === "" ? null : fields.meditationUrl,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to accept: ${res.status}`);
  }
}

function ReviewItemCard({ item, onHandled }: { item: ReviewQueueItem; onHandled: (id: number) => void }) {
  const [fields, setFields] = useState<AcceptFields>({
    date: item.receivedDate,
    text: item.rawText,
    meditationTitle: "",
    meditationUrl: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setBusy(true);
    setError(null);
    try {
      await acceptItem(item.id, fields);
      onHandled(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss() {
    setBusy(true);
    setError(null);
    try {
      await dismissItem(item.id);
      onHandled(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 4, padding: 16, marginBottom: 16 }}>
      <div>
        <strong>Received {item.receivedDate}</strong> — <code>{item.reason}</code>
      </div>
      <details style={{ margin: "8px 0" }}>
        <summary>Raw email text</summary>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 8, maxHeight: 200, overflow: "auto" }}>
          {item.rawText}
        </pre>
      </details>

      <label style={{ display: "block", marginTop: 8 }}>
        Date
        <input
          type="date"
          value={fields.date}
          onChange={(e) => setFields((f) => ({ ...f, date: e.target.value }))}
          style={{ display: "block", marginTop: 4 }}
        />
      </label>

      <label style={{ display: "block", marginTop: 8 }}>
        Letter text (trim down to just her own words above the forwarded meditation)
        <textarea
          value={fields.text}
          onChange={(e) => setFields((f) => ({ ...f, text: e.target.value }))}
          rows={8}
          style={{ display: "block", width: "100%", marginTop: 4, fontFamily: "inherit" }}
        />
      </label>

      <label style={{ display: "block", marginTop: 8 }}>
        Meditation title (optional)
        <input
          type="text"
          value={fields.meditationTitle}
          onChange={(e) => setFields((f) => ({ ...f, meditationTitle: e.target.value }))}
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>

      <label style={{ display: "block", marginTop: 8 }}>
        Meditation URL (optional)
        <input
          type="text"
          value={fields.meditationUrl}
          onChange={(e) => setFields((f) => ({ ...f, meditationUrl: e.target.value }))}
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>

      {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}

      <div style={{ marginTop: 12 }}>
        <button onClick={handleAccept} disabled={busy}>
          Accept &amp; create letter
        </button>{" "}
        <button onClick={handleDismiss} disabled={busy}>
          Dismiss (not a letter)
        </button>
      </div>
    </div>
  );
}

export function AdminPage() {
  const [items, setItems] = useState<ReviewQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue().then(setItems).catch((err) => setError(err.message));
  }, []);

  function handleHandled(id: number) {
    setItems((current) => current?.filter((item) => item.id !== id) ?? null);
  }

  return (
    <div className="content" style={{ maxWidth: 900, fontFamily: "system-ui, sans-serif" }}>
      <h1>Review queue</h1>
      {error && <div className="error-text">{error}</div>}
      {!items ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p>Nothing needs review right now.</p>
      ) : (
        items.map((item) => <ReviewItemCard key={item.id} item={item} onHandled={handleHandled} />)
      )}
    </div>
  );
}
