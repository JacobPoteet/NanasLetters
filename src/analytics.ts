// Anonymous, fire-and-forget visit beacon (GitHub #8). Never throws, never
// blocks a page — a blocked or failed beacon should be indistinguishable
// from a page that simply doesn't track anything.

const DEVICE_ID_KEY = "nanas-letters-device-id";

// Also the identity a comment (and a comment ban) is attached to — see
// src/components/Comments.tsx — not a second id scheme.
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // Storage unavailable (private browsing, blocked, etc.) — the beacon
    // below still fires, just uncorrelated across visits from this device.
    return crypto.randomUUID();
  }
}

export function trackVisit(page: "home" | "browse" | "letter" | "search", letterId?: number): void {
  try {
    void fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: deviceId(), page, letterId }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let analytics break the page it's measuring.
  }
}
