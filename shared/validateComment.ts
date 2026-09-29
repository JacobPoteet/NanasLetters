// Shared between the worker (source of truth) and the client (immediate
// feedback before a round trip) so the two can't silently drift on what a
// valid comment looks like.

export interface ValidatedComment {
  authorName: string | null;
  body: string;
}

export type ValidateCommentResult = { ok: true; value: ValidatedComment } | { ok: false; error: string };

export const MAX_COMMENT_BODY_LENGTH = 2000;
export const MAX_COMMENT_NAME_LENGTH = 80;

export function validateComment(input: { authorName?: unknown; body?: unknown }): ValidateCommentResult {
  if (typeof input.body !== "string") return { ok: false, error: "Comment text is required" };
  const body = input.body.trim();
  if (body.length === 0) return { ok: false, error: "Comment text is required" };
  if (body.length > MAX_COMMENT_BODY_LENGTH) {
    return { ok: false, error: `Comments are limited to ${MAX_COMMENT_BODY_LENGTH} characters` };
  }

  let authorName: string | null = null;
  if (input.authorName !== undefined && input.authorName !== null) {
    if (typeof input.authorName !== "string") return { ok: false, error: "Name must be text" };
    const trimmed = input.authorName.trim();
    if (trimmed.length > MAX_COMMENT_NAME_LENGTH) {
      return { ok: false, error: `Name is limited to ${MAX_COMMENT_NAME_LENGTH} characters` };
    }
    authorName = trimmed.length > 0 ? trimmed : null;
  }

  return { ok: true, value: { authorName, body } };
}
