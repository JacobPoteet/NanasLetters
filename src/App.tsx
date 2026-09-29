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
import { AdminRequiredPage } from "./pages/AdminRequired";
import { AdminPage } from "./pages/Admin";
import { AdminEditLetterPage } from "./pages/AdminEditLetter";
import { AdminBrowsePage } from "./pages/AdminBrowse";
import { AdminAnalyticsPage } from "./pages/AdminAnalytics";
import { AdminCalendarPage } from "./pages/AdminCalendar";
import { AdminCommentsPage } from "./pages/AdminComments";
import { NotFoundPage } from "./pages/NotFound";
import { AdminShell } from "./components/AdminNav";

function matchId(pattern: RegExp, path: string): number | null {
  const match = pattern.exec(path);
  return match ? Number(match[1]) : null;
}

export function App() {
  const { path, search } = useRouter();
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
  const isAdminComments = role === "admin" && path === "/admin/comments";
  const isAdminReview = role === "admin" && path === "/admin";
  const isAdminPath = path === "/admin" || path.startsWith("/admin/");
  const needsAdminStepUp = role !== "admin" && isAdminPath;
  const isKnownAdminRoute =
    adminEditId !== null || isAdminBrowse || isAdminAnalytics || isAdminCalendar || isAdminComments || isAdminReview;

  return (
    <div className="page">
      <Header role={role} onLoggedOut={() => setRole(null)} />
      {needsAdminStepUp ? (
        <AdminRequiredPage onSteppedUp={setRole} />
      ) : adminEditId !== null ? (
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
      ) : isAdminComments ? (
        <AdminShell>
          <AdminCommentsPage />
        </AdminShell>
      ) : isAdminReview ? (
        <AdminShell>
          <AdminPage />
        </AdminShell>
      ) : isAdminPath && !isKnownAdminRoute ? (
        <AdminShell>
          <NotFoundPage />
        </AdminShell>
      ) : letterId !== null ? (
        <LetterPage id={letterId} role={role} search={search} />
      ) : path === "/browse" ? (
        <BrowsePage />
      ) : path === "/search" ? (
        <SearchPage search={search} />
      ) : path === "/" ? (
        <HomePage />
      ) : (
        <NotFoundPage />
      )}
    </div>
  );
}
