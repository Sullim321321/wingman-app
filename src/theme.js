// Wingman Design System — Quiet Luxury / Editorial
// Warm espresso + champagne gold + parchment
// Matches the pitch deck aesthetic (Afar / Aman / SLH)

export const C = {
  // ─── Backgrounds ────────────────────────────────────────────────────────────
  bg:    "#0F0D0A",   // Warm espresso black (not cold OLED blue)
  card:  "#1C1915",   // Elevated charcoal surface
  card2: "#252119",   // Secondary card / input background
  parch: "#F5EDD8",   // Parchment cream — used for Next Up card (inverted)
  parch2:"#EDE4CC",   // Slightly deeper parchment for parch card elements

  // ─── Borders ────────────────────────────────────────────────────────────────
  line:  "#2E2A24",   // Warm hairline border
  lineP: "#C9A96E44", // Gold-tinted hairline for parchment card borders

  // ─── Typography ─────────────────────────────────────────────────────────────
  ink:   "#F0EAE0",   // Warm off-white (not cold #FFF)
  inkD:  "#1A1510",   // Dark ink for parchment card text
  mut:   "#8A8070",   // Warm muted — not cold grey
  mutD:  "#6B5F50",   // Dark muted for parchment card secondary text

  // ─── Accents ────────────────────────────────────────────────────────────────
  gold:  "#C9A96E",   // Champagne gold — primary accent (replaces blue)
  accent:"#C9A96E",   // Alias → gold (used in TripDetail, Alert, Onboarding, etc.)
  goldD: "#A8884E",   // Deeper gold for pressed states
  teal:  "#2DB896",   // Muted emerald — used sparingly for "on time" status
  coral: "#D95F5F",   // Warm red for alerts / disruptions
  amber: "#D4902A",   // Warm amber for moderate risk

  // ─── Semantic shortcuts ──────────────────────────────────────────────────────
  ok:    "#2DB896",   // Green / on time
  warn:  "#D4902A",   // Amber / moderate risk
  risk:  "#D95F5F",   // Red / high risk
};

// Typography scale — used consistently across all screens
export const T = {
  // Serif — Playfair Display (loaded via useFonts in App.js)
  serif: "PlayfairDisplay_400Regular",
  serifI:"PlayfairDisplay_400Regular_Italic",
  serifB:"PlayfairDisplay_700Bold",

  // Sans — DM Sans (clean, editorial, pairs beautifully with Playfair)
  sans:  "DMSans_400Regular",
  sansM: "DMSans_500Medium",
  sansB: "DMSans_700Bold",

  // Tracking values (letterSpacing)
  trackWide:  2.5,   // All-caps section labels ("NEXT UP", "YOUR CHANNELS")
  trackMed:   1.2,   // Sub-labels and badges
  trackTight: -0.4,  // Large serif headlines
};
