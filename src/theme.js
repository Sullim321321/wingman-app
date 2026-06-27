// Wingman Design System — Quiet Luxury / Editorial v2
// Warm espresso + champagne gold + parchment
// Matches the pitch deck aesthetic (Afar / Aman / SLH)

export const C = {
  // ─── Backgrounds ────────────────────────────────────────────────────────────
  bg:    "#0F0D0A",   // Warm espresso black (not cold OLED blue)
  card:  "#1C1915",   // Elevated charcoal surface
  card2: "#252119",   // Secondary card / input background
  card3: "#2A261F",   // Tertiary — skeleton shimmer base
  parch: "#F5EDD8",   // Parchment cream — used for Next Up card (inverted)
  parch2:"#EDE4CC",   // Slightly deeper parchment for parch card elements

  // ─── Borders ────────────────────────────────────────────────────────────────
  line:  "#2E2A24",   // Warm hairline border
  lineP: "#C9A96E44", // Gold-tinted hairline for parchment card borders
  lineHi:"#FFFFFF0A", // Subtle top-edge highlight for card depth
  lineSh:"#00000040", // Subtle bottom-edge shadow for card depth

  // ─── Typography ─────────────────────────────────────────────────────────────
  ink:   "#F0EAE0",   // Warm off-white (not cold #FFF)
  inkD:  "#1A1510",   // Dark ink for parchment card text
  mut:   "#8A8070",   // Warm muted — not cold grey
  mutD:  "#6B5F50",   // Dark muted for parchment card secondary text

  // ─── Accents ────────────────────────────────────────────────────────────────
  gold:  "#C9A96E",   // Champagne gold — primary accent
  accent:"#C9A96E",   // Alias → gold
  goldD: "#A8884E",   // Deeper gold for pressed states
  goldL: "#D4B483",   // Lighter gold for gradient start
  goldGlass: "#C9A96E18", // Gold with 10% opacity — glass tint
  teal:  "#2DB896",   // Muted emerald — used sparingly for "on time" status
  coral: "#D95F5F",   // Warm red for alerts / disruptions
  amber: "#D4902A",   // Warm amber for moderate risk

  // ─── Semantic shortcuts ──────────────────────────────────────────────────────
  ok:    "#2DB896",   // Green / on time
  warn:  "#D4902A",   // Amber / moderate risk
  risk:  "#D95F5F",   // Red / high risk

  // ─── Glass / Blur layer ──────────────────────────────────────────────────────
  glassTab:  "rgba(15,13,10,0.85)",  // Tab bar glass background
  glassBg:   "rgba(28,25,21,0.92)",  // Modal / overlay glass
  glassCard: "rgba(37,33,25,0.80)",  // Floating card glass
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
  trackXWide: 4.0,   // Welcome screen hero text
};

// Elevation system — card depth via border highlights + shadows
export const E = {
  // Apply to card containers for physical depth
  card: {
    borderTopColor:    "#FFFFFF0A",
    borderBottomColor: "#00000050",
    borderLeftColor:   "#FFFFFF05",
    borderRightColor:  "#00000030",
  },
  // Stronger elevation for floating modals
  modal: {
    borderTopColor:    "#FFFFFF12",
    borderBottomColor: "#00000060",
    borderLeftColor:   "#FFFFFF08",
    borderRightColor:  "#00000040",
  },
};

// Button gradient stops — 3-stop for depth
export const GRAD = {
  gold:    ["#D4B483", "#C9A96E", "#A8884E"],
  goldSub: ["#C9A96E", "#A8884E"],
  teal:    ["#3ECBA8", "#2DB896", "#1E9B7A"],
  dark:    ["#2A261F", "#1C1915"],
  parch:   ["#F5EDD8", "#EDE4CC"],
};
