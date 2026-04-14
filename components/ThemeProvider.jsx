"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  SITE_THEME_DEFAULT,
  SITE_THEME_STORAGE_KEY,
  getThemeLabel,
  resolveInitialThemeValue,
  toggleThemeValue,
} from "@/lib/themeModel";

const ThemeContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(SITE_THEME_DEFAULT);

  useEffect(() => {
    setTheme("dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.removeAttribute("data-color-theme");
    window.localStorage.setItem(SITE_THEME_STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      colorTheme: "techfix",
      themeLabel: getThemeLabel(theme),
      toggleTheme: () => setTheme((currentTheme) => toggleThemeValue(currentTheme)),
      cycleColorTheme: () => {},
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
