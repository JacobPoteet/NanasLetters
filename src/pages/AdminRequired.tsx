// Shown when a logged-in family-role visitor lands on an /admin/* path.
// Lets them step up to an admin session right there — entering the admin
// passphrase just calls the same /api/login used everywhere (CLAUDE.md:
// "the admin passphrase grants family access too, same person, stronger
// secret" — there's no separate admin login flow, just this one gate,
// which previously only ever appeared when logged out entirely). Without
// this, hitting an admin path while already logged in as family silently
// fell through to the Home page with no explanation (see the fix for that
// gap) and the only way in was logging all the way out first, which also
// lost your place (LoginPage redirects to "/" after signing in).

import { useState } from "react";
import type { Role } from "../../shared/types";
import { pageTitle } from "../../shared/pageTitle";
import { api } from "../api";
import { useDocumentTitle } from "../useDocumentTitle";

export function AdminRequiredPage({ onSteppedUp }: { onSteppedUp: (role: Role) => void }) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useDocumentTitle(pageTitle("Admin access required"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { role } = await api.login(passphrase);
      if (role !== "admin") {
        setError("That's the family passphrase — the admin one is different.");
        return;
      }
      onSteppedUp(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="header__wordmark" style={{ textAlign: "center" }}>
        Admin access required
      </div>
      <div className="subtext" style={{ marginTop: -8 }}>
        This page needs the admin passphrase, not the family one.
      </div>
      <input
        type="password"
        placeholder="Admin passphrase"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        autoFocus
      />
      {error && <div className="error-text">{error}</div>}
      <button type="submit" disabled={submitting || !passphrase}>
        Continue
      </button>
    </form>
  );
}
