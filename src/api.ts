import type {
  AdminCalendarSummary,
  AdminComment,
  AnalyticsSummary,
  DashboardSummary,
  ArchiveStats,
  BannedDevice,
  Comment,
  CommentsAdminSummary,
  Letter,
  OnThisDayResult,
  LetterSummary,
  RecentComment,
  Role,
  SearchResult,
  SearchSort,
} from "../shared/types";

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
  stats: () => request<ArchiveStats>("/stats"),
  browse: (params: { year?: number; month?: number; before?: { date: string; id: number }; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.limit) query.set("limit", String(params.limit));
    if (params.year) query.set("year", String(params.year));
    if (params.month) query.set("month", String(params.month));
    if (params.before) {
      query.set("beforeDate", params.before.date);
      query.set("beforeId", String(params.before.id));
    }
    return request<{ letters: LetterSummary[] }>(`/letters?${query}`);
  },
  randomLetter: (excludeId?: number) =>
    request<{ id: number }>(`/letters/random${excludeId ? `?exclude=${excludeId}` : ""}`),
  letter: (id: number) => request<{ letter: Letter; prevId: number | null; nextId: number | null }>(`/letters/${id}`),
  updateLetter: (
    id: number,
    fields: { date?: string; text?: string; meditationTitle?: string | null; meditationUrl?: string | null },
  ) =>
    request<{ letter: Letter }>(`/admin/letters/${id}`, { method: "PUT", body: JSON.stringify(fields) }),
  deleteLetter: (id: number) => request<{ ok: true }>(`/admin/letters/${id}`, { method: "DELETE" }),
  dashboardSummary: () => request<DashboardSummary>("/admin/dashboard"),
  analyticsSummary: () => request<AnalyticsSummary>("/admin/analytics"),
  calendarSummary: () => request<AdminCalendarSummary>("/admin/calendar"),
  search: (q: string, from?: string, to?: string, sort?: SearchSort) => {
    const query = new URLSearchParams({ q });
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (sort) query.set("sort", sort);
    return request<{ results: SearchResult[] }>(`/search?${query}`);
  },
  comments: (letterId: number) => request<{ comments: Comment[] }>(`/letters/${letterId}/comments`),
  postComment: (letterId: number, fields: { authorName: string | null; body: string; deviceId: string }) =>
    request<{ comment: Comment }>(`/letters/${letterId}/comments`, { method: "POST", body: JSON.stringify(fields) }),
  recentComments: (limit?: number) =>
    request<{ comments: RecentComment[] }>(`/comments/recent${limit ? `?limit=${limit}` : ""}`),
  adminComments: (filters?: { letterId?: number; deviceId?: string; includeDeleted?: boolean }) => {
    const query = new URLSearchParams();
    if (filters?.letterId) query.set("letterId", String(filters.letterId));
    if (filters?.deviceId) query.set("deviceId", filters.deviceId);
    if (filters?.includeDeleted) query.set("includeDeleted", "true");
    const qs = query.toString();
    return request<{ comments: AdminComment[] }>(`/admin/comments${qs ? `?${qs}` : ""}`);
  },
  adminCommentsSummary: () => request<CommentsAdminSummary>("/admin/comments/summary"),
  adminBannedDevices: () => request<{ devices: BannedDevice[] }>("/admin/comments/banned"),
  deleteComment: (id: number) => request<{ ok: true }>(`/admin/comments/${id}`, { method: "DELETE" }),
  deleteCommentsByDevice: (deviceId: string) =>
    request<{ ok: true }>(`/admin/comments/device/${encodeURIComponent(deviceId)}`, { method: "DELETE" }),
  banDevice: (deviceId: string, reason?: string) =>
    request<{ ok: true }>(`/admin/comments/device/${encodeURIComponent(deviceId)}/ban`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  unbanDevice: (deviceId: string) =>
    request<{ ok: true }>(`/admin/comments/device/${encodeURIComponent(deviceId)}/unban`, { method: "POST" }),
  getSettings: () => request<{ commentsRequireLogin: boolean }>("/admin/settings"),
  updateSettings: (fields: { commentsRequireLogin: boolean }) =>
    request<{ ok: true }>("/admin/settings", { method: "PUT", body: JSON.stringify(fields) }),
};
