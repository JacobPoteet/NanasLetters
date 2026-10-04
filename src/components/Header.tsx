import type { Role } from "../../shared/types";
import { api } from "../api";
import { openRandomLetter } from "../surprise";
import { Link, useRouter } from "../router";
import { useTheme } from "../theme";

export function Header({ role, onLoggedOut }: { role: Role | null; onLoggedOut: () => void }) {
  const { navigate } = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();

  async function handleLogout() {
    await api.logout();
    onLoggedOut();
    navigate("/login");
  }

  return (
    <div className="header">
      <Link to="/" className="header__wordmark">
        The Daily
      </Link>
      <div className="header__nav">
        <Link to="/browse">Browse</Link>
        <Link to="/search">Search</Link>
        <button onClick={() => openRandomLetter(navigate)}>Surprise me</button>
        {role === "admin" && <Link to="/admin">Dashboard</Link>}
        {role && <button onClick={handleLogout}>Log out</button>}
        <button
          type="button"
          role="switch"
          aria-checked={theme === "dark"}
          aria-label="Dark mode"
          className="theme-switch"
          onClick={toggleTheme}
        >
          <span className="theme-switch__knob" aria-hidden="true">
            <svg className="theme-switch__icon theme-switch__icon--sun" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
            </svg>
            <svg className="theme-switch__icon theme-switch__icon--moon" viewBox="0 0 16 16">
              <path d="M12.8 9.7A5.3 5.3 0 0 1 6.3 3.2a5.3 5.3 0 1 0 6.5 6.5z" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}
