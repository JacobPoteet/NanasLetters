// A minimal path-based router — no react-router dependency, per CLAUDE.md's
// "only three runtime deps" decision. Just enough for five flat routes.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

interface RouterState {
  path: string;
  /** window.location.search for the current path, including the leading "?" (or "" if none). */
  search: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterState | null>(null);

function splitPath(to: string): [path: string, search: string] {
  const i = to.indexOf("?");
  return i === -1 ? [to, ""] : [to.slice(0, i), to.slice(i)];
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname);
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (options?.replace) {
      window.history.replaceState(null, "", to);
    } else {
      window.history.pushState(null, "", to);
    }
    const [newPath, newSearch] = splitPath(to);
    setPath(newPath);
    setSearch(newSearch);
  }, []);

  return <RouterContext.Provider value={{ path, search, navigate }}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterState {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within a RouterProvider");
  return ctx;
}

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      className={className}
      onClick={(e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
