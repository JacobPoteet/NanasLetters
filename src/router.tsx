// A minimal path-based router — no react-router dependency, per CLAUDE.md's
// "only three runtime deps" decision. Just enough for five flat routes.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { resolveInternalPath } from "../shared/internalPath";

interface RouterState {
  path: string;
  /** window.location.search for the current path, including the leading "?" (or "" if none). */
  search: string;
  navigate: (to: string, options?: { replace?: boolean; state?: object }) => void;
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

  const navigate = useCallback((to: string, options?: { replace?: boolean; state?: object }) => {
    const safeTo = resolveInternalPath(to, window.location.origin);
    if (options?.replace) {
      window.history.replaceState(null, "", safeTo);
    } else {
      window.history.pushState(options?.state ?? null, "", safeTo);
    }
    const [newPath, newSearch] = splitPath(safeTo);
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

export function Link({
  to,
  children,
  className,
  state,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  state?: object;
}) {
  const { navigate } = useRouter();
  const safeTo = resolveInternalPath(to, window.location.origin);
  return (
    <a
      href={safeTo}
      className={className}
      onClick={(e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(safeTo, { state });
      }}
    >
      {children}
    </a>
  );
}
