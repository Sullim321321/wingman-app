// Wingman Design System — THE FAMILY OFFICE (v4)
//
// Black ground · cream ink · editorial structure · real depth
// Source Serif 4 (voice) · Inter (interface) · IBM Plex Mono (measured)
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT WAS WRONG WITH v3, AND WHY IT MATTERED
//
// v3 was espresso + champagne gold + Playfair. Three problems, and they compound:
//
// 1. THE GOLD DID THREE JOBS AT ONCE. It was the brand colour, the "you can tap
//    this" colour, and the section-label colour. So it appeared on every screen,
//    on every element, constantly — which meant the interface could never RAISE
//    ITS VOICE. When a flight is cancelled and something must scream, there was
//    no register left to scream in. A palette that is loud all the time is a
//    palette that is silent when it counts.
//
//    Gold is now a hairline and a monogram. Nothing else. The signal colour is
//    held in reserve and appears, on most screens, never.
//
// 2. IT WAS FLAT. #221E1A cards on a #1A1714 page — flat colour on flat colour,
//    no light, no shadow, no material. That is why it read as a website rather
//    than an object you paid for.
//
//    There are now exactly THREE PLANES, and elevation MEANS something:
//      ground  → the page. Type only.
//      raised  → facts. A hairline of light on the top edge, soft shadow beneath.
//      lifted  → the one thing that needs you. Highest, hardest shadow.
//    The most urgent object on any screen is literally the closest to your thumb.
//    Hierarchy, made physical.
//
// 3. PLAYFAIR WAS A DISPLAY FACE DOING BODY WORK. Beautiful at 60pt on a deck,
//    mushy at 15pt on a phone. Replaced with Source Serif 4 — a TEXT serif, which
//    is a different tool for a different job.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE TYPE RULE — three faces, three jobs, no overlap
//
//   T.serif  Source Serif 4  → Wingman's VOICE. What it is saying to you.
//   T.serifI (italic)        → Wingman's REASONS. "the only transfer that day."
//                              Every explanation is set in italic. The system
//                              explaining itself has its own register.
//   T.sans   Inter           → THE INTERFACE. Anything you tap, scan, or skim.
//   T.mono   IBM Plex Mono   → MEASURED VALUES ONLY. 40 MIN · −80 · 95.
//
// That last rule is the honesty architecture made visible. Mono is reserved for
// numbers the system actually MEASURED and can defend — the arrival-to-departure
// gap, the slack left, the delay. Never for a number it guessed, rounded for
// effect, or inherited from a source it can't cite. A reader learns to trust the
// distinction without ever being told it exists, which is the only kind of trust
// worth having.
//
// If you are about to set an unverified number in mono: don't. That is the whole
// point of the rule, and it is the same rule that runs through constraints.js.
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  // ─── Grounds ────────────────────────────────────────────────────────────────
  // Near-black with a breath of warmth — a true #000 is a void, and a void has no
  // material. These are surfaces, and they catch light.
  bg:    "#0E0E10",   // THE GROUND. Nothing sits at this level except type.
  card:  "#16161A",   // RAISED — facts, ledger rows, resting cards
  card2: "#1D1D22",   // LIFTED — the thing that needs you; inputs; pressed states
  card3: "#232329",   // Tertiary — skeleton shimmer, hover, deepest lift
  parch: "#EDEBE7",   // CREAM — the inverted plane (primary CTA, "Next Up" card)
  parch2:"#D8D5CF",   // Deeper cream for inner elements / gradient end

  // ─── Structure ──────────────────────────────────────────────────────────────
  // Hairlines do the editorial work. NYT rules, not borders.
  line:  "#1F1F24",   // The standard hairline. Everywhere.
  lineP: "#0E0E1022", // Hairline on cream surfaces
  lineHi:"rgba(255,255,255,0.07)",  // TOP-EDGE LIGHT — the thing that makes a
                                     // surface feel like a surface. Do not skip it.
  lineSh:"rgba(0,0,0,0.55)",         // Shadow beneath

  // ─── Ink ────────────────────────────────────────────────────────────────────
  ink:   "#EDEBE7",   // CREAM, not white. Pure white on near-black is a headache
                      // at 6am; cream is the colour of paper and it reads as one.
  inkD:  "#0E0E10",   // Ink on the cream plane
  mut:   "#918E88",   // Secondary — still fully readable
  mutD:  "#5F5D59",   // Tertiary — quiet, structural, "I checked this and it's fine"

  // ─── The accent, demoted ────────────────────────────────────────────────────
  // Brass, and it appears in exactly two places: the monogram, and the hairline
  // under the masthead. It is NOT the button colour. It is NOT the label colour.
  // In v3 it was all three, and that is why nothing could ever be urgent.
  gold:  "#A98C57",
  accent:"#A98C57",
  goldD: "#8A7043",
  goldL: "#C4A874",
  goldBtn:"#EDEBE7",  // The primary CTA is CREAM. Not gold. Cream is louder here,
                      // because it is the only bright thing on a black page.
  goldGlass: "#A98C5714",

  // ─── Status ─────────────────────────────────────────────────────────────────
  // Muted, editorial, adult. These are not iOS system colours — they are ink.
  teal:   "#5C8A72",   // HOLDS. Sage, not neon. Quiet reassurance is still quiet.
  coral:  "#C8564C",   // WON'T SURVIVE. The signal. Appears roughly once a month,
                       // and when it does it is the only coloured thing on screen.
  amber:  "#A98C57",   // TIGHT. Brass doubles as the caution note — deliberately,
                       // so the palette has ONE warm and ONE hot, not a rainbow.
  indigo: "#7E8BA3",   // Premium / landed — slate, not lavender.

  ok:    "#5C8A72",
  warn:  "#A98C57",
  risk:  "#C8564C",

  // ─── Codified semantics (unchanged contract, new values) ────────────────────
  //   action     → cream  · the primary next step. The brightest thing on a black
  //                         page IS the affordance. No colour needed.
  //   confirmed  → sage   · done, booked, on-time, handled
  //   attention  → signal · needs you NOW
  //   attentionM → brass  · worth knowing, not urgent
  //   premium    → slate
  //   neutral    → mut
  action:     "#EDEBE7",
  confirmed:  "#5C8A72",
  attention:  "#C8564C",
  attentionM: "#A98C57",
  premium:    "#7E8BA3",
  neutral:    "#918E88",
  actionFill:    "#EDEBE70F",
  confirmedFill: "#5C8A7218",
  attentionFill: "#C8564C1C",

  // ─── Glass ──────────────────────────────────────────────────────────────────
  glassTab:  "rgba(10,10,12,0.94)",
  glassBg:   "rgba(14,14,16,0.96)",
  glassCard: "rgba(22,22,26,0.88)",
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPE
// ─────────────────────────────────────────────────────────────────────────────
export const T = {
  // VOICE — Source Serif 4. What Wingman is saying.
  serif:  "SourceSerif4_300Light",
  serifI: "SourceSerif4_300Light_Italic",
  serifB: "SourceSerif4_500Medium",

  // REASONS — the italic. Every explanation Wingman gives is set in this.
  // (Aliased to the old Garamond names so the 70 existing screens keep working;
  //  the names lie about the family now, but the ROLE they encode is identical —
  //  garamondI was already "the voice of a reason" everywhere it was used.)
  garamond:  "SourceSerif4_400Regular",
  garamondI: "SourceSerif4_300Light_Italic",
  garamondMI:"SourceSerif4_400Regular_Italic",
  garamondSI:"SourceSerif4_500Medium_Italic",

  // INTERFACE — Inter. Anything you tap or scan.
  sans:  "Inter_400Regular",
  sansM: "Inter_500Medium",
  sansB: "Inter_600SemiBold",

  // MEASURED — IBM Plex Mono. Numbers the system measured and can defend.
  // See the type rule at the top of this file before you use it for anything else.
  mono:  "IBMPlexMono_400Regular",
  monoM: "IBMPlexMono_500Medium",

  // Tracking. Editorial labels are SMALL and WIDE — that ratio is the whole look.
  trackWide:  3.6,
  trackMed:   2.0,
  trackTight: -0.3,
  trackXWide: 4.4,
  headerW:    "W",
};

// ─────────────────────────────────────────────────────────────────────────────
// DEPTH — three planes, strictly ranked. Elevation is not decoration; it is rank.
// ─────────────────────────────────────────────────────────────────────────────
export const E = {
  card: {
    borderTopColor:    "rgba(255,255,255,0.07)",
    borderBottomColor: "rgba(0,0,0,0.5)",
    borderLeftColor:   "rgba(255,255,255,0.03)",
    borderRightColor:  "rgba(0,0,0,0.3)",
  },
  modal: {
    borderTopColor:    "rgba(255,255,255,0.1)",
    borderBottomColor: "rgba(0,0,0,0.6)",
    borderLeftColor:   "rgba(255,255,255,0.05)",
    borderRightColor:  "rgba(0,0,0,0.4)",
  },
};

// SHADOW.soft   → RAISED. A fact at rest.
// SHADOW.sheet  → LIFTED. The thing that needs you, and modals.
// Pair either with `litEdge`: the top-edge highlight is what makes a rectangle
// read as a lit surface rather than a coloured hole. It is the single cheapest
// thing in this file and it does more work than any colour in it.
export const SHADOW = {
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  sheet: {
    shadowColor: "#000",
    shadowOpacity: 0.62,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
};

export const litEdge = { borderTopColor: "rgba(255,255,255,0.09)" };

// Gradients — subtle, top-lit, 168°. A surface catching light from above, never a
// decorative sweep. If a gradient is visible AS a gradient, it is wrong.
export const GRAD = {
  gold:    ["#C4A874", "#A98C57", "#8A7043"],
  goldSub: ["#A98C57", "#8A7043"],
  teal:    ["#6D9B82", "#5C8A72", "#48705B"],
  dark:    ["#1D1D22", "#141418"],
  parch:   ["#EDEBE7", "#D8D5CF"],
  goldBtn: ["#EDEBE7", "#D8D5CF"],   // the CTA is cream
  raised:  ["#1A1A1F", "#141418"],   // RAISED plane
  lifted:  ["#232329", "#191920"],   // LIFTED plane
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPE RAMP — editorial scale contrast.
//
// The luxury move is the JUMP: a 10px tracked label sitting directly above a 34px
// serif headline. That ratio is confidence — a page that assumes it already has
// your attention. v3 had everything clustered at 13–17px, which is why it read as
// a form. Do not close the gap.
// ─────────────────────────────────────────────────────────────────────────────
export const TR = {
  display:  { size: 34, line: 39, track: -0.3 },   // serif — the verdict
  title:    { size: 30, line: 35, track: -0.3 },   // serif
  headline: { size: 22, line: 28, track: -0.2 },   // serif
  body:     { size: 16, line: 27, track: 0 },      // Inter, generous leading
  callout:  { size: 15, line: 20, track: 0 },      // Inter medium — row titles
  sub:      { size: 13, line: 19, track: 0 },      // Inter — meta
  caption:  { size: 11, line: 15, track: 0.2 },    // Inter — timestamps
  label:    { size: 10, line: 13, track: 2.6 },    // Inter — SMALL AND WIDE
  measured: { size: 11, line: 15, track: 1.0 },    // MONO ONLY. See the type rule.
};

export const ramp = (key) => {
  const r = TR[key] || TR.body;
  return { fontSize: r.size, lineHeight: r.line, letterSpacing: r.track };
};

export const TS = {
  greetingH:   34,
  greetingSub: 15,
  sectionLabel:10,
  nextUpTitle: 34,
  nextUpSub:   13,
  nextUpRoute: 13,
  nextUpMeta:  13,
  tripDate:    10,
  tripName:    16,
  tripSub:     12,
  headerMark:  26,
  headerBrand: 10,
  alertLabel:  10,
  alertTitle:  30,
  alertBody:   14,
  btnLabel:    15,
  btnSub:      13,
  statusBadge: 10,
};
