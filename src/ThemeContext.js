// Wingman ThemeContext — dynamic dark / light palette
// Reads iOS system preference + AsyncStorage manual override
// Provides C tokens that update at runtime without app restart

import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const THEME_KEY = "wingman_appearance"; // "system" | "dark" | "light"

// ─── Dark palette ────────────────────────────────────────────────────────────
//
// THIS FILE USED TO CARRY ITS OWN COPY OF THE ENTIRE PALETTE.
//
// So there were two sources of truth for colour: `theme.js`, which every screen reads,
// and this one, which the tab bar and the floating pill read via useTheme(). When the
// palette was replaced, this copy never got the memo — and the result was an app whose
// screens were black-and-cream sitting inside a tab bar that was still espresso-and-gold.
// Nothing errored. It just quietly disagreed with itself.
//
// Same bug as the itinerary that hid the seaplane the cascade was defending, and the
// display name that doubled as an API key: two things that must agree, with no mechanism
// forcing them to. So this now IMPORTS the palette rather than restating it, and the
// duplicate is gone for good.
import { C as PALETTE } from "./theme";

const DARK = { ...PALETTE, isDark: true };

// ─── Light palette (Parchment — warm cream inversion) ────────────────────────
// ─── Light palette — the same identity, inverted ─────────────────────────────
// Cream ground, ink type, brass monogram. The accent flips: on black the accent is
// the brightest thing (cream); on cream it must be the DARKEST thing (ink).
const LIGHT = {
  ...PALETTE,
  bg:    "#EDEBE7",   // cream — the ground
  card:  "#E4E1DA",   // raised
  card2: "#DAD6CD",   // lifted / inputs
  card3: "#D0CBC0",   // shimmer
  parch: "#0E0E10",   // the inverted plane is now BLACK
  parch2:"#1D1D22",
  line:  "#D5D1C7",
  lineP: "#0E0E1022",
  lineHi:"rgba(255,255,255,0.7)",
  lineSh:"rgba(0,0,0,0.08)",
  ink:   "#191817",   // ink on paper
  inkD:  "#EDEBE7",   // cream, for the inverted (black) plane
  mut:   "#6E6B64",
  mutD:  "#98948B",

  // On a cream page, the accent is INK — the darkest thing, not the brightest.
  // Keeping cream here would have made every button invisible, which is exactly
  // the failure the dark sweep was checked against.
  gold:  "#191817",
  accent:"#191817",
  goldD: "#3A3833",
  goldL: "#000000",
  goldBtn:"#191817",
  goldGlass: "#1918170D",

  brass: "#8A7043",   // deeper brass — the pale one vanishes on cream
  teal:  "#3F6B52",
  coral: "#A8342C",
  amber: "#8A7043",
  ok:    "#3F6B52",
  warn:  "#8A7043",
  risk:  "#A8342C",
  action:     "#191817",
  confirmed:  "#3F6B52",
  attention:  "#A8342C",
  attentionM: "#8A7043",
  neutral:    "#6E6B64",
  glassTab:  "rgba(237,235,231,0.94)",
  glassBg:   "rgba(237,235,231,0.97)",
  glassCard: "rgba(228,225,218,0.90)",
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
