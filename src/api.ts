import type { AnalyticsSummary, Letter, OnThisDayResult, LetterSummary, Role, SearchResult } from "../shared/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  session: () => request<{ role: Role | null }>("/session"),
  login: (passphrase: string) =>
    request<{ ok: true; role: Role }>("/login", { method: "POST", body: JSON.stringify({ passphrase }) }),
  logout: () => request<{ ok: true }>("/logout", { method: "POST" }),
  onThisDay: (date?: string) => request<OnThisDayResult>(`/on-this-day${date ? `?date=${date}` : ""}`),
  browse: (params: { year?: number; month?: number; before?: { date: string; id: number } }) => {
    const query = new URLSearchParams();
    if (params.year) query.set("year", String(params.year));
    if (params.month) query.set("month", String(params.month));
    if (params.before) {
      query.set("beforeDate", params.before.date);
      query.set("beforeId", String(params.before.id));
    }
    return request<{ letters: LetterSummary[] }>(`/letters?${query}`);
  },
  letter: (id: number) => request<{ letter: Letter; prevId: number | null; nextId: number | null }>(`/letters/${id}`),
  updateLetter: (
    id: number,
    fields: { date?: string; text?: string; meditationTitle?: string | null; meditationUrl?: string | null },
  ) =>
    request<{ letter: Letter }>(`/admin/letters/${id}`, { method: "PUT", body: JSON.stringify(fields) }),
  deleteLetter: (id: number) => request<{ ok: true }>(`/admin/letters/${id}`, { method: "DELETE" }),
  analyticsSummary: () => request<AnalyticsSummary>("/admin/analytics"),
  search: (q: string, from?: string, to?: string) => {
    const query = new URLSearchParams({ q });
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return request<{ results: SearchResult[] }>(`/search?${query}`);
  },
};
