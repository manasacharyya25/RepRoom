export const THEME_STORAGE_KEY = "satara-theme";

export type ThemeId = "ember" | "cobalt";

export const DEFAULT_THEME: ThemeId = "ember";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === "ember" || value === "cobalt";
}

export function getNextTheme(theme: ThemeId): ThemeId {
  return theme === "ember" ? "cobalt" : "ember";
}
