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

// ─── One identity, one palette ───────────────────────────────────────────────
//
// Wingman's identity is now the ivory / bronze / sage "quiet luxury" palette,
// defined once in theme.js. It is a LIGHT theme — ivory ground, deep-ink type,
// bronze accent, sage for what Wingman knows — so isDark is false and the status
// bar / nav chrome render dark content on the cream ground.
//
// There used to be two palettes here (a dark espresso variant and a hand-written
// cream inversion) with a resolver switching between them. That's exactly the
// two-sources-of-truth trap the comment below warns about: theme.js got the new
// palette and this file didn't. So both variants now collapse to the single
// theme.js palette. The Settings appearance toggle is a no-op until a proper
// dark variant of the quiet-luxury identity is designed and approved.
const IVORY = { ...PALETTE, isDark: false };
const DARK = IVORY;
const LIGHT = IVORY;

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
