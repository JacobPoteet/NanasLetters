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
import { AdminBrowsePage } from "./pages/AdminBrowse";
import { AdminAnalyticsPage } from "./pages/AdminAnalytics";
import { AdminCalendarPage } from "./pages/AdminCalendar";
import { AdminShell } from "./components/AdminNav";

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
  const isAdminBrowse = role === "admin" && path === "/admin/browse";
  const isAdminAnalytics = role === "admin" && path === "/admin/analytics";
  const isAdminCalendar = role === "admin" && path === "/admin/calendar";
  const isAdminReview = role === "admin" && path === "/admin";

  return (
    <div className="page">
      <Header role={role} onLoggedOut={() => setRole(null)} />
      {adminEditId !== null ? (
        <AdminShell>
          <AdminEditLetterPage id={adminEditId} />
        </AdminShell>
      ) : isAdminBrowse ? (
        <AdminShell>
          <AdminBrowsePage />
        </AdminShell>
      ) : isAdminAnalytics ? (
        <AdminShell>
          <AdminAnalyticsPage />
        </AdminShell>
      ) : isAdminCalendar ? (
        <AdminShell>
          <AdminCalendarPage />
        </AdminShell>
      ) : isAdminReview ? (
        <AdminShell>
          <AdminPage />
        </AdminShell>
      ) : letterId !== null ? (
        <LetterPage id={letterId} role={role} />
      ) : path === "/browse" ? (
        <BrowsePage />
      ) : path === "/search" ? (
        <SearchPage />
      ) : (
        <HomePage />
      )}
    </div>
  );
}
