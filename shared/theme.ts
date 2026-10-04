export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "nanas-letters-theme";

// theme-color tints mobile browser chrome; it follows the page background
// rather than the accent so the address bar doesn't flash against dark mode.
export const THEME_COLORS: Record<Theme, string> = { light: "#F6F1E7", dark: "#1C1814" };

export function parseStoredTheme(raw: string | null): Theme | null {
  return raw === "light" || raw === "dark" ? raw : null;
}

// An explicit choice always beats the OS setting; the OS only decides until
// someone picks.
export function resolveTheme(stored: Theme | null, systemPrefersDark: boolean): Theme {
  return stored ?? (systemPrefersDark ? "dark" : "light");
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
