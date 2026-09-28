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

function matchLetterId(path: string): number | null {
  const match = /^\/letters\/(\d+)$/.exec(path);
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

  const letterId = matchLetterId(path);

  return (
    <div className="page">
      <Header role={role} onLoggedOut={() => setRole(null)} />
      {letterId !== null ? (
        <LetterPage id={letterId} />
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
