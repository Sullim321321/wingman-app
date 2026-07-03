// Wingman Design System — Obsidian v3.1
// Exact match to pre-seed deck visual language (Jun 2026)
// Warm espresso bg · pure white ink · champagne gold accent (restrained)
// Parchment Next Up card · Playfair Display serif + DM Sans

export const C = {
  // ─── Backgrounds ────────────────────────────────────────────────────────────
  bg:    "#1A1714",   // Warm espresso — exact deck background colour
  card:  "#221E1A",   // Elevated dark card surface
  card2: "#2A2520",   // Secondary card / input background
  card3: "#302B25",   // Tertiary — skeleton shimmer base
  parch: "#F5EDD8",   // Parchment cream — Next Up card (inverted light)
  parch2:"#EDE4CC",   // Slightly deeper parchment for inner elements

  // ─── Borders ────────────────────────────────────────────────────────────────
  line:  "#2E2A24",   // Warm hairline border
  lineP: "#C9A96E33", // Gold-tinted hairline for parchment card borders
  lineHi:"#FFFFFF08", // Subtle top-edge highlight
  lineSh:"#00000040", // Subtle bottom-edge shadow

  // ─── Typography ─────────────────────────────────────────────────────────────
  ink:   "#FFFFFF",   // Pure white — primary text (deck exact)
  inkD:  "#1A1510",   // Dark ink for parchment card text
  mut:   "#8A7F70",   // Warm muted secondary text
  mutD:  "#6B5F50",   // Dark muted for parchment card secondary text

  // ─── Accents ────────────────────────────────────────────────────────────────
  gold:  "#C9A96E",   // Champagne gold — wordmark, section labels, date ranges
  accent:"#C9A96E",   // Alias → gold
  goldD: "#A8884E",   // Deeper gold for pressed states
  goldL: "#D4B483",   // Lighter gold for gradient start
  goldBtn:"#E8D5A3",  // Primary action button fill (points/parchment CTA)
  goldGlass: "#C9A96E18", // Gold 10% opacity glass tint

  // ─── Status ─────────────────────────────────────────────────────────────────
  teal:   "#2DB896",   // "ON TIME" badge
  coral:  "#D95F5F",   // Disruption / high risk alert
  amber:  "#D4902A",   // Moderate delay risk
  indigo: "#818CF8",   // Landed / elite / premium accent (Tailwind indigo-400)

  // ─── Semantic shortcuts ──────────────────────────────────────────────────────
  ok:    "#2DB896",
  warn:  "#D4902A",
  risk:  "#D95F5F",

  // ─── Glass / Blur layer ──────────────────────────────────────────────────────
  glassTab:  "rgba(10,9,6,0.92)",    // Tab bar glass background
  glassBg:   "rgba(28,25,21,0.95)",  // Modal / overlay glass
  glassCard: "rgba(37,33,25,0.85)",  // Floating card glass
};

// Typography scale — exact match to deck
export const T = {
  // Serif — Playfair Display
  serif: "PlayfairDisplay_400Regular",
  serifI:"PlayfairDisplay_400Regular_Italic",
  serifB:"PlayfairDisplay_700Bold",
  // Editorial serif — EB Garamond (used in new Home screen briefing)
  garamond:  "EBGaramond_400Regular",
  garamondI: "EBGaramond_400Regular_Italic",
  garamondMI:"EBGaramond_500Medium_Italic",
  garamondSI:"EBGaramond_600SemiBold_Italic",
  // Sans — DM Sans
  sans:  "DMSans_400Regular",
  sansM: "DMSans_500Medium",
  sansB: "DMSans_700Bold",
  // Tracking values (letterSpacing)
  trackWide:  3.5,   // Section labels ("NEXT UP", "DISRUPTION DETECTED")
  trackMed:   2.0,   // Status badges, date ranges
  trackTight: -0.4,  // Serif headlines
  trackXWide: 4.0,   // Header "WINGMAN" brand label
  // Header monogram
  headerW:    "W",   // Serif italic W monogram (rendered in serifI font)
};

// Elevation system
export const E = {
  card: {
    borderTopColor:    "#FFFFFF08",
    borderBottomColor: "#00000050",
    borderLeftColor:   "#FFFFFF04",
    borderRightColor:  "#00000030",
  },
  modal: {
    borderTopColor:    "#FFFFFF10",
    borderBottomColor: "#00000060",
    borderLeftColor:   "#FFFFFF06",
    borderRightColor:  "#00000040",
  },
};

// Button gradient stops
export const GRAD = {
  gold:    ["#D4B483", "#C9A96E", "#A8884E"],
  goldSub: ["#C9A96E", "#A8884E"],
  teal:    ["#3ECBA8", "#2DB896", "#1E9B7A"],
  dark:    ["#2A261F", "#1C1915"],
  parch:   ["#F5EDD8", "#EDE4CC"],
  goldBtn: ["#EDE4CC", "#E8D5A3", "#D4B483"],
};

// Typography size constants — exact deck scale
export const TS = {
  greetingH:   34,   // Deck: ~34pt Playfair Display serif greeting
  greetingSub: 15,
  sectionLabel:10,
  nextUpTitle: 36,   // Deck: 'JFK to LAX' is VERY large — dominant serif headline
  nextUpSub:   13,
  nextUpRoute: 13,
  nextUpMeta:  13,
  tripDate:    10,
  tripName:    17,
  tripSub:     12,
  headerMark:  28,
  headerBrand: 11,
  alertLabel:  11,
  alertTitle:  28,   // Deck: disruption headline ~28pt
  alertBody:   14,
  btnLabel:    15,
  btnSub:      13,
  statusBadge: 10,
};
