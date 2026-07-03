// Wingman ThemeContext — dynamic dark / light palette
// Reads iOS system preference + AsyncStorage manual override
// Provides C tokens that update at runtime without app restart

import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const THEME_KEY = "wingman_appearance"; // "system" | "dark" | "light"

// ─── Dark palette (Obsidian v3 — deck exact) ─────────────────────────────────
const DARK = {
  bg:    "#1A1714",
  card:  "#221E1A",
  card2: "#2A2520",
  card3: "#302B25",
  parch: "#F5EDD8",
  parch2:"#EDE4CC",
  line:  "#2E2A24",
  lineP: "#C9A96E33",
  lineHi:"#FFFFFF08",
  lineSh:"#00000040",
  ink:   "#FFFFFF",
  inkD:  "#1A1510",
  mut:   "#8A7F70",
  mutD:  "#6B5F50",
  gold:  "#C9A96E",
  accent:"#C9A96E",
  goldD: "#A8884E",
  goldL: "#D4B483",
  goldBtn:"#E8D5A3",
  goldGlass: "#C9A96E18",
  teal:  "#2DB896",
  coral: "#D95F5F",
  amber: "#D4902A",
  ok:    "#2DB896",
  warn:  "#D4902A",
  risk:  "#D95F5F",
  glassTab:  "rgba(10,9,6,0.92)",
  glassBg:   "rgba(28,25,21,0.95)",
  glassCard: "rgba(37,33,25,0.85)",
  isDark: true,
};

// ─── Light palette (Parchment — warm cream inversion) ────────────────────────
const LIGHT = {
  bg:    "#F5F0E8",   // Warm cream — parchment expanded to full screen
  card:  "#EDE8DC",   // Slightly deeper cream card
  card2: "#E5DFD0",   // Input / secondary card
  card3: "#DDD7C6",   // Tertiary / shimmer
  parch: "#1A1714",   // Inverted — dark parchment card on light bg
  parch2:"#221E1A",
  line:  "#D8D0C0",   // Warm hairline
  lineP: "#C9A96E44",
  lineHi:"#FFFFFF60",
  lineSh:"#00000015",
  ink:   "#1A1510",   // Dark espresso — primary text
  inkD:  "#FFFFFF",   // White — for inverted (dark) parchment card
  mut:   "#7A6F60",   // Warm muted
  mutD:  "#A89880",
  gold:  "#A8884E",   // Deeper gold — readable on cream
  accent:"#A8884E",
  goldD: "#8A6E38",
  goldL: "#C9A96E",
  goldBtn:"#C9A96E",
  goldGlass: "#A8884E18",
  teal:  "#1A9B7A",
  coral: "#C04040",
  amber: "#B87820",
  ok:    "#1A9B7A",
  warn:  "#B87820",
  risk:  "#C04040",
  glassTab:  "rgba(240,235,225,0.94)",
  glassBg:   "rgba(245,240,232,0.97)",
  glassCard: "rgba(237,232,220,0.90)",
  isDark: false,
};

const ThemeContext = createContext({ C: DARK, appearance: "system", setAppearance: () => {} });

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // "dark" | "light" | null
  const [appearance, setAppearanceState] = useState("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(v => {
      if (v === "dark" || v === "light" || v === "system") {
        setAppearanceState(v);
      }
    }).catch(() => {});
  }, []);

  async function setAppearance(value) {
    setAppearanceState(value);
    await AsyncStorage.setItem(THEME_KEY, value).catch(() => {});
  }

  const resolvedScheme = appearance === "system"
    ? "dark"  // Default to dark mode — Wingman's primary aesthetic
    : appearance;

  const C = resolvedScheme === "light" ? LIGHT : DARK;

  return (
    <ThemeContext.Provider value={{ C, appearance, setAppearance, isDark: C.isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Convenience hook — returns just C tokens
export function useC() {
  return useContext(ThemeContext).C;
}
