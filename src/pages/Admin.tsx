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

async function resolveItem(id: number, status: "resolved" | "dismissed") {
  await fetch(`/api/admin/review-queue/${id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function AdminPage() {
  const [items, setItems] = useState<ReviewQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue().then(setItems).catch((err) => setError(err.message));
  }, []);

  async function handleResolve(id: number, status: "resolved" | "dismissed") {
    await resolveItem(id, status);
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
        items.map((item) => (
          <div key={item.id} style={{ border: "1px solid #ccc", borderRadius: 4, padding: 16, marginBottom: 16 }}>
            <div>
              <strong>{item.receivedDate}</strong> — <code>{item.reason}</code>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 8, maxHeight: 200, overflow: "auto" }}>
              {item.rawText}
            </pre>
            <button onClick={() => handleResolve(item.id, "resolved")}>Mark resolved</button>{" "}
            <button onClick={() => handleResolve(item.id, "dismissed")}>Dismiss</button>
          </div>
        ))
      )}
    </div>
  );
}
