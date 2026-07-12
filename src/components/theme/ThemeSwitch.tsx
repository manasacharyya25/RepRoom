"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  getNextTheme,
  isThemeId,
  THEME_STORAGE_KEY,
  type ThemeId
} from "@/lib/theme";

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeSwitch({ className }: { className?: string }) {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initial = isThemeId(stored) ? stored : DEFAULT_THEME;
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggleTheme = () => {
    const next = getNextTheme(theme);
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  const label = theme === "ember" ? "Switch to cobalt theme" : "Switch to ember theme";

  return (
    <button
      aria-label={label}
      className={`theme-switch${className ? ` ${className}` : ""}`}
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      <span aria-hidden className="theme-switch-swatch theme-switch-swatch--ember" />
      <span aria-hidden className="theme-switch-swatch theme-switch-swatch--cobalt" />
      <span className="theme-switch-label">{theme === "ember" ? "Ember" : "Cobalt"}</span>
    </button>
  );
}
