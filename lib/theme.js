import { THEME_OPTIONS } from "./model.js";

export function resolvedTheme(preference = "system", prefersDark = false) {
  if (preference === "dark" || preference === "light") return preference;
  return prefersDark ? "dark" : "light";
}

export function applyThemePreference(preference = "system") {
  const safePreference = THEME_OPTIONS.includes(preference) ? preference : "system";
  const query = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
  const apply = () => {
    document.documentElement.dataset.theme = resolvedTheme(safePreference, Boolean(query?.matches));
    document.documentElement.dataset.themePreference = safePreference;
  };
  apply();
  if (safePreference !== "system" || !query) return () => {};
  query.addEventListener?.("change", apply);
  return () => query.removeEventListener?.("change", apply);
}
