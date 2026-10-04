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
        <button onClick={toggleTheme}>{theme === "dark" ? "Light mode" : "Dark mode"}</button>
        {role === "admin" && <Link to="/admin">Dashboard</Link>}
        {role && <button onClick={handleLogout}>Log out</button>}
      </div>
    </div>
  );
}
