// Talks to the Gmail API directly over fetch — no Google API SDK (see
// CLAUDE.md's Tech stack decision). Read-only scope only (gmail.readonly).

import type { RawMessage } from "../parsing/extractLetter";

// "Fwd: Richard Rohr Meditation" — confirmed during the parsing experiment
// (CLAUDE.md): 1,927 messages / 1,859 threads as of Sept 2026.
export const LETTERS_LABEL_ID = "Label_6064425115864008158";

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

interface GmailMessagePayload extends GmailPart {
  headers?: GmailHeader[];
}

interface GmailMessage {
  id: string;
  internalDate: string;
  payload: GmailMessagePayload;
}

interface GmailListResponse {
  messages?: { id: string }[];
  nextPageToken?: string;
}

export async function getAccessToken(env: Env): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** Every message id under the letters label, optionally only those after a given date (YYYY-MM-DD). */
export async function listMessageIds(accessToken: string, afterDate: string | null): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ labelIds: LETTERS_LABEL_ID, maxResults: "100" });
    if (afterDate) params.set("q", `after:${afterDate.replaceAll("-", "/")}`);
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Gmail messages.list failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as GmailListResponse;
    ids.push(...(data.messages ?? []).map((m) => m.id));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return ids;
}

export function decodeBase64Url(data: string): string {
  const base64 = data.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

/** Recursively collects every part's decoded body text for a given MIME type. */
export function findPartsByMimeType(part: GmailPart, mimeType: string): string[] {
  const found: string[] = [];
  if (part.mimeType === mimeType && part.body?.data) found.push(decodeBase64Url(part.body.data));
  for (const child of part.parts ?? []) found.push(...findPartsByMimeType(child, mimeType));
  return found;
}

function getHeader(headers: GmailHeader[], name: string): string | null {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

export async function fetchMessage(accessToken: string, id: string): Promise<RawMessage> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail messages.get failed: ${res.status} ${await res.text()}`);
  const message = (await res.json()) as GmailMessage;

  const headers = message.payload.headers ?? [];
  const subject = getHeader(headers, "Subject") ?? "";
  const dateHeader = getHeader(headers, "Date");
  const date = (dateHeader ? new Date(dateHeader) : new Date(Number(message.internalDate)))
    .toISOString()
    .slice(0, 10);

  const plainParts = findPartsByMimeType(message.payload, "text/plain");
  const htmlParts = findPartsByMimeType(message.payload, "text/html");

  return {
    gmailMessageId: message.id,
    date,
    subject,
    plainTextBody: plainParts.length > 0 ? plainParts.join("\n") : null,
    htmlBody: htmlParts.length > 0 ? htmlParts.join("\n") : null,
  };
}
