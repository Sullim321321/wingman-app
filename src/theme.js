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
  // ─── QUIET LUXURY (v5) — ivory paper · deep ink · one bronze · sage for "known" ──
  // The whole app is rethemed by these values alone; names are unchanged so every
  // existing call site keeps working. The important moves are the INVERSIONS:
  // `parch`/`inkD` were the cream CTA plane + its dark text; on ivory they flip to an
  // ink fill with paper text, so cream-on-dark CTAs become ink-on-paper CTAs for free.

  // ─── Grounds ──────────────────────────────────────────────────────────────────
  bg:    "#F5F2EC",   // THE GROUND — warm ivory paper. Type sits here.
  card:  "#FCFAF5",   // RAISED — facts, ledger rows, resting cards (near-white)
  card2: "#FFFFFF",   // LIFTED — the thing that needs you; inputs; pressed states
  card3: "#EFEBE2",   // Tertiary — skeleton shimmer, hover, pressed
  parch: "#211E1A",   // THE INVERTED PLANE — deep ink (primary CTA, "Next Up" card)
  parch2:"#2C2A24",   // Deeper ink for inner elements / gradient end

  // ─── Structure ──────────────────────────────────────────────────────────────
  line:  "rgba(33,30,26,0.10)",     // The standard hairline on ivory.
  lineP: "rgba(255,255,255,0.14)",  // Hairline on the inverted (ink) plane
  lineHi:"rgba(0,0,0,0.03)",         // Faint top edge on light cards
  lineSh:"rgba(0,0,0,0.10)",         // Soft shadow beneath

  // ─── Ink ────────────────────────────────────────────────────────────────────
  ink:   "#211E1A",   // Deep warm ink — the reading colour on paper.
  inkD:  "#F5F2EC",   // Ink on the inverted (ink) plane → paper
  mut:   "#6B655C",   // Secondary — fully readable on ivory
  mutD:  "#9A948A",   // Tertiary — quiet, structural

  // ─── The accent — one bronze ────────────────────────────────────────────────
  // On a black page the accent was the brightest thing (cream). On ivory the accent
  // is the one warm, saturated thing: bronze. Same role, repointed value.
  gold:  "#96754A",   // → bronze. The accent. (Kept as `gold` so all sites work.)
  accent:"#96754A",
  goldD: "#7C5F3B",   // pressed
  goldL: "#A98C57",   // gradient start / lighter bronze
  goldBtn:"#96754A",
  goldGlass: "#96754A14",

  brass:  "#96754A",
  brassD: "#7C5F3B",
  brassL: "#B08E5A",

  // ─── Status ─────────────────────────────────────────────────────────────────
  teal:   "#5E7A63",   // HOLDS / handled. Sage.
  coral:  "#B0433A",   // WON'T SURVIVE. The signal, deepened for contrast on ivory.
  amber:  "#96754A",   // TIGHT. Bronze doubles as caution.
  indigo: "#5E6B85",   // Premium / landed — slate.

  ok:    "#5E7A63",
  warn:  "#96754A",
  risk:  "#B0433A",

  // ─── Codified semantics (same contract) ─────────────────────────────────────
  action:     "#96754A",   // the primary accent affordance → bronze
  confirmed:  "#5E7A63",
  attention:  "#B0433A",
  attentionM: "#96754A",
  premium:    "#5E6B85",
  neutral:    "#6B655C",
  actionFill:    "#96754A12",
  confirmedFill: "#5E7A6318",
  attentionFill: "#B0433A1C",

  // ─── Glass (light) ──────────────────────────────────────────────────────────
  glassTab:  "rgba(245,242,236,0.94)",
  glassBg:   "rgba(245,242,236,0.96)",
  glassCard: "rgba(252,250,245,0.90)",
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
  // On ivory, depth comes from a soft shadow beneath, not a lit top edge. Borders
  // are faint dark hairlines rather than the dark-theme white-top/black-bottom trick.
  card: {
    borderTopColor:    "rgba(0,0,0,0.03)",
    borderBottomColor: "rgba(0,0,0,0.08)",
    borderLeftColor:   "rgba(0,0,0,0.03)",
    borderRightColor:  "rgba(0,0,0,0.05)",
  },
  modal: {
    borderTopColor:    "rgba(0,0,0,0.04)",
    borderBottomColor: "rgba(0,0,0,0.10)",
    borderLeftColor:   "rgba(0,0,0,0.04)",
    borderRightColor:  "rgba(0,0,0,0.06)",
  },
};

// SHADOW.soft   → RAISED. A fact at rest.
// SHADOW.sheet  → LIFTED. The thing that needs you, and modals.
// Pair either with `litEdge`: the top-edge highlight is what makes a rectangle
// read as a lit surface rather than a coloured hole. It is the single cheapest
// thing in this file and it does more work than any colour in it.
export const SHADOW = {
  soft: {
    shadowColor: "#3A2E1C",
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sheet: {
    shadowColor: "#3A2E1C",
    shadowOpacity: 0.16,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
};

export const litEdge = { borderTopColor: "rgba(0,0,0,0.03)" };

// Gradients — subtle, top-lit, 168°. A surface catching light from above, never a
// decorative sweep. If a gradient is visible AS a gradient, it is wrong.
export const GRAD = {
  // On ivory the CTA is INK (dark on light), and the "dark" planes become light.
  gold:    ["#2C2A24", "#211E1A", "#1A1815"],   // primary CTA → ink
  goldSub: ["#2C2A24", "#211E1A"],
  brass:   ["#B08E5A", "#96754A", "#7C5F3B"],   // monogram — bronze
  teal:    ["#6E8B74", "#5E7A63", "#4C6551"],   // sage
  dark:    ["#FCFAF5", "#EFEBE2"],              // was a dark plane → light card
  parch:   ["#2C2A24", "#211E1A"],              // the inverted plane → ink
  goldBtn: ["#211E1A", "#1A1815"],              // the CTA is ink
  raised:  ["#FFFFFF", "#FCFAF5"],              // RAISED plane
  lifted:  ["#FFFFFF", "#F7F4EE"],              // LIFTED plane
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
