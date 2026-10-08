import { useState } from "react";
import type { Role } from "../../shared/types";
import { pageTitle } from "../../shared/pageTitle";
import { api } from "../api";
import { useRouter } from "../router";
import { useDocumentTitle } from "../useDocumentTitle";

export function LoginPage({ onLoggedIn }: { onLoggedIn: (role: Role) => void }) {
  const { navigate } = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useDocumentTitle(pageTitle("Log in"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { role } = await api.login(passphrase);
      onLoggedIn(role);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="header__wordmark" style={{ textAlign: "center" }}>
        The Daily
      </div>
      <p className="login-form__intro">Enter the family passphrase to read Nana's letters.</p>
      <label htmlFor="passphrase">Passphrase</label>
      <input
        id="passphrase"
        type={showPassphrase ? "text" : "password"}
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        autoFocus
      />
      <button type="button" className="login-form__show" onClick={() => setShowPassphrase((v) => !v)}>
        {showPassphrase ? "Hide passphrase" : "Show passphrase"}
      </button>
      {error && <div className="error-text">{error}</div>}
      <button type="submit" disabled={submitting || !passphrase}>
        Enter
      </button>
    </form>
  );
}
