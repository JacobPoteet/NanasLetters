// Fixes a bad parse by hand (wrong date, bad split between her words and the
// forwarded block, a meditation link that resolved wrong or not at all).
// Deliberately plain — CLAUDE.md exempts the admin screen from the
// family-facing design bar, same reasoning as Lunch Special's /admin.

import { useEffect, useState } from "react";
import type { Letter } from "../../shared/types";
import { api } from "../api";
import { Link, useRouter } from "../router";

export function AdminEditLetterPage({ id }: { id: number }) {
  const { navigate } = useRouter();
  const [letter, setLetter] = useState<Letter | null>(null);
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [meditationTitle, setMeditationTitle] = useState("");
  const [meditationUrl, setMeditationUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLetter(null);
    setSaved(false);
    api
      .letter(id)
      .then(({ letter }) => {
        setLetter(letter);
        setDate(letter.date);
        setText(letter.text);
        setMeditationTitle(letter.meditationTitle ?? "");
        setMeditationUrl(letter.meditationUrl ?? "");
      })
      .catch((err) => setError(err.message));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateLetter(id, {
        date,
        text,
        meditationTitle: meditationTitle.trim() || null,
        meditationUrl: meditationUrl.trim() || null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteLetter(id);
      navigate("/admin/browse");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDeleting(false);
    }
  }

  if (error && !letter) return <div className="content error-text">{error}</div>;
  if (!letter) return <div className="content">Loading…</div>;

  return (
    <div className="content" style={{ maxWidth: 700, fontFamily: "system-ui, sans-serif" }}>
      <p>
        <Link to={`/letters/${id}`}>← Back to letter</Link>
      </p>
      <h1>Edit letter #{id}</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label>
          Date
          <br />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <label>
          Text
          <br />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            style={{ width: "100%", fontFamily: "inherit", fontSize: 14 }}
            required
          />
        </label>

        <label>
          Meditation title
          <br />
          <input
            type="text"
            value={meditationTitle}
            onChange={(e) => setMeditationTitle(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Meditation URL (cac.org — leave blank if none resolved)
          <br />
          <input
            type="url"
            value={meditationUrl}
            onChange={(e) => setMeditationUrl(e.target.value)}
            placeholder="https://cac.org/daily-meditations/…"
            style={{ width: "100%" }}
          />
        </label>

        {error && <div className="error-text">{error}</div>}
        {saved && <div style={{ color: "green" }}>Saved.</div>}

        <div>
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #ccc" }}>
        {!confirmingDelete ? (
          <button onClick={() => setConfirmingDelete(true)} style={{ color: "#a00" }}>
            Delete this letter…
          </button>
        ) : (
          <div style={{ color: "#a00" }}>
            <p>
              Permanently delete the letter from {date}? This can't be undone — only do this for a confirmed duplicate
              that should have been merged.
            </p>
            <button onClick={handleDelete} disabled={deleting} style={{ color: "#a00", fontWeight: "bold" }}>
              {deleting ? "Deleting…" : "Yes, permanently delete"}
            </button>{" "}
            <button onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
