import { useEffect, useState } from "react";
import { oppositeTheme, parseStoredTheme, resolveTheme, THEME_COLORS, THEME_STORAGE_KEY, type Theme } from "../shared/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStored(): Theme | null {
  try {
    return parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

function currentTheme(): Theme {
  return resolveTheme(readStored(), window.matchMedia(DARK_QUERY).matches);
}

// Keep in step with the inline script in index.html, which does the same
// thing before first paint so there is no flash of the wrong theme.
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Until someone picks, track the OS live (sunset auto-switching, etc.).
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      if (readStored() === null) setTheme(currentTheme());
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = oppositeTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice still applies for this page view.
    }
    const change = () => {
      applyTheme(next);
      setTheme(next);
    };
    // A view transition cross-fades a snapshot of the page on the compositor,
    // so it costs the same on Browse's thousands of cards as on a short page;
    // transitioning every element's colors instead dropped Browse to ~2fps.
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(change);
    } else {
      change();
    }
  }

  return { theme, toggle };
}
