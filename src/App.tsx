import { useEffect, useState } from "react";
import type { Role } from "../shared/types";
import { api } from "./api";
import { Header } from "./components/Header";
import { useRouter } from "./router";
import { HomePage } from "./pages/Home";
import { BrowsePage } from "./pages/Browse";
import { SearchPage } from "./pages/Search";
import { LetterPage } from "./pages/Letter";
import { LoginPage } from "./pages/Login";
import { AdminPage } from "./pages/Admin";
import { AdminEditLetterPage } from "./pages/AdminEditLetter";

function matchId(pattern: RegExp, path: string): number | null {
  const match = pattern.exec(path);
  return match ? Number(match[1]) : null;
}

export function App() {
  const { path } = useRouter();
  const [role, setRole] = useState<Role | null | undefined>(undefined); // undefined = still checking

  useEffect(() => {
    api
      .session()
      .then((s) => setRole(s.role))
      .catch(() => setRole(null));
  }, []);

  if (role === undefined) return null; // avoid a login-page flash while checking

  if (!role) return <LoginPage onLoggedIn={setRole} />;

  const letterId = matchId(/^\/letters\/(\d+)$/, path);
  const adminEditId = role === "admin" ? matchId(/^\/admin\/letters\/(\d+)$/, path) : null;

  return (
    <div className="page">
      <Header role={role} onLoggedOut={() => setRole(null)} />
      {adminEditId !== null ? (
        <AdminEditLetterPage id={adminEditId} />
      ) : letterId !== null ? (
        <LetterPage id={letterId} role={role} />
      ) : path === "/browse" ? (
        <BrowsePage />
      ) : path === "/search" ? (
        <SearchPage />
      ) : path === "/admin" && role === "admin" ? (
        <AdminPage />
      ) : (
        <HomePage />
      )}
    </div>
  );
}
