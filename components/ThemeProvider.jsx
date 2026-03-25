"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("dark");
  const [colorTheme, setColorTheme] = useState("default");

  /* Load saved preferences on mount */
  useEffect(() => {
    const savedTheme = localStorage.getItem("tz-theme") || "dark";
    const savedColor = localStorage.getItem("tz-color-theme") || "default";
    setTheme(savedTheme);
    setColorTheme(savedColor);
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.documentElement.setAttribute("data-color-theme", savedColor);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("tz-theme", next);
      return next;
    });
  }, []);

  const cycleColorTheme = useCallback(() => {
    setColorTheme((prev) => {
      const order = ["default", "premium", "repair-pro"];
      const idx = order.indexOf(prev);
      const next = order[(idx + 1) % order.length];
      document.documentElement.setAttribute("data-color-theme", next);
      localStorage.setItem("tz-color-theme", next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, colorTheme, toggleTheme, cycleColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
