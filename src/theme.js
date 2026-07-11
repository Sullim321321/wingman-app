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

  // ─── Codified color semantics (Design #4) ────────────────────────────────────
  // One rule, used everywhere. Prefer these names over raw palette colours when the
  // colour is carrying *meaning* (not just decoration):
  //   action     → gold   · anything the user can tap / the primary next step
  //   confirmed  → teal   · done, booked, on-time, "handled"
  //   attention  → coral  · needs the user now (disruption, high risk, error)
  //   attentionM → amber  · worth noting, not urgent (moderate risk, minor delay)
  //   premium    → indigo · elite / upgraded / landed
  //   neutral    → mut    · quiet, routine, informational
  action:     "#C9A96E",
  confirmed:  "#2DB896",
  attention:  "#D95F5F",
  attentionM: "#D4902A",
  premium:    "#818CF8",
  neutral:    "#8A7F70",
  // Soft tinted fills for the above (backgrounds behind semantic content)
  actionFill:    "#C9A96E14",
  confirmedFill: "#2DB89614",
  attentionFill: "#D95F5F14",

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

// ─── Depth & materials (Design #6) ───────────────────────────────────────────
// Two reusable presets so elevation reads consistently against the obsidian bg.
//   SHADOW.soft  → resting cards (barely-there lift)
//   SHADOW.sheet → floating surfaces / bottom sheets (clear separation)
// `litEdge` adds a faint top-highlight hairline — a subtle lit bevel that makes a
// card feel like a physical surface catching light. Spread it into a card style
// that already sets borderWidth/borderColor; it only overrides the top edge.
export const SHADOW = {
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sheet: {
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
};

export const litEdge = { borderTopColor: "#FFFFFF12" };

// Button gradient stops
export const GRAD = {
  gold:    ["#D4B483", "#C9A96E", "#A8884E"],
  goldSub: ["#C9A96E", "#A8884E"],
  teal:    ["#3ECBA8", "#2DB896", "#1E9B7A"],
  dark:    ["#2A261F", "#1C1915"],
  parch:   ["#F5EDD8", "#EDE4CC"],
  goldBtn: ["#EDE4CC", "#E8D5A3", "#D4B483"],
};

// ─── Locked type ramp (Design #2) ────────────────────────────────────────────
// One named scale, used everywhere. Each entry is { size, line, track } — pair it
// with the right family from T (serif/garamond for editorial, sans for UI).
// Replaces ad-hoc fontSize literals so headings/body stay consistent across screens.
//   display  → hero editorial headline (route, greeting)   · Garamond/Playfair
//   title    → screen title ("Your trips.")                · Garamond italic
//   headline → card headline, decision headline            · Garamond/serif
//   body     → reading prose (briefing)                    · Garamond or sans
//   callout  → primary UI text, list row title             · sans medium
//   sub      → secondary UI text, meta                     · sans
//   caption  → small meta, timestamps                      · sans
//   label    → all-caps tracked section labels             · sans bold
export const TR = {
  display:  { size: 34, line: 40, track: -0.4 },
  title:    { size: 30, line: 36, track: -0.3 },
  headline: { size: 22, line: 28, track: -0.2 },
  body:     { size: 17, line: 25, track: 0 },
  callout:  { size: 15, line: 20, track: 0 },
  sub:      { size: 13, line: 18, track: 0 },
  caption:  { size: 12, line: 16, track: 0.2 },
  label:    { size: 10, line: 13, track: 1.6 },
};

// Convenience: spread a ramp entry into a style ({ fontSize, lineHeight, letterSpacing }).
export const ramp = (key) => {
  const r = TR[key] || TR.body;
  return { fontSize: r.size, lineHeight: r.line, letterSpacing: r.track };
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
