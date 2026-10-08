// The letter view's comment thread — a plain, flat list (no replies, no
// pre-moderation queue) plus a name+body form. Moderation happens after the
// fact in the admin comments panel, not here.

import { useEffect, useRef, useState } from "react";
import type { Comment } from "../../shared/types";
import { validateComment } from "../../shared/validateComment";
import { api } from "../api";
import { deviceId } from "../analytics";

function formatCommentDate(iso: string): string {
  // D1's datetime('now') comes back as "YYYY-MM-DD HH:MM:SS" (UTC, no
  // offset) — normalize to something Date can parse reliably cross-browser.
  const date = new Date(`${iso.replace(" ", "T")}Z`);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function CommentRow({
  comment,
  targetRef,
}: {
  comment: Comment;
  targetRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={targetRef} className={`comment${targetRef ? " comment--linked" : ""}`}>
      <div className="comment__meta">
        <span className="comment__author">{comment.authorName ?? "A family member"}</span>
        <span className="comment__date">{formatCommentDate(comment.createdAt)}</span>
      </div>
      <p className="comment__body">{comment.body}</p>
    </div>
  );
}

// A family member linking in from the homepage's recent-comments feed lands
// on `?comment=<id>` (a query param, like the search highlight below — the
// router (shared/internalPath.ts) drops URL fragments entirely, so `#id`
// anchors can't be used here).
export function Comments({ letterId, scrollToCommentId }: { letterId: number; scrollToCommentId?: number | null }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setComments(null);
    api
      .comments(letterId)
      .then((r) => setComments(r.comments))
      .catch(() => setComments([]));
  }, [letterId]);

  useEffect(() => {
    if (!comments || !scrollToCommentId) return;
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [comments, scrollToCommentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validated = validateComment({ authorName, body });
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { comment } = await api.postComment(letterId, { ...validated.value, deviceId: deviceId() });
      setComments((current) => [...(current ?? []), comment]);
      setAuthorName("");
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="comments">
      <div className="eyebrow eyebrow--muted">
        {comments === null
          ? "Comments"
          : comments.length === 0
            ? "Comments"
            : `${comments.length} comment${comments.length === 1 ? "" : "s"}`}
      </div>

      {comments === null ? null : comments.length === 0 ? (
        <p className="empty-state">Write her a note, or tell the family what this one brought back.</p>
      ) : (
        <div className="comment-list">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              targetRef={comment.id === scrollToCommentId ? targetRef : undefined}
            />
          ))}
        </div>
      )}

      <form className="comment-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Your name (optional)"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          maxLength={80}
        />
        <textarea
          placeholder="Say something about this letter…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          required
        />
        {error && <div className="error-text">{error}</div>}
        <button type="submit" disabled={busy}>
          {busy ? "Posting…" : "Post comment"}
        </button>
      </form>
    </div>
  );
}
