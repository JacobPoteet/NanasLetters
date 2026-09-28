import { useState } from "react";
import type { Role } from "../../shared/types";
import { api } from "../api";
import { useRouter } from "../router";

export function LoginPage({ onLoggedIn }: { onLoggedIn: (role: Role) => void }) {
  const { navigate } = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      <input
        type="password"
        placeholder="Passphrase"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        autoFocus
      />
      {error && <div className="error-text">{error}</div>}
      <button type="submit" disabled={submitting || !passphrase}>
        Enter
      </button>
    </form>
  );
}
