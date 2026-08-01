// atelier.js — the v6 identity, as composable pieces.
//
// ─────────────────────────────────────────────────────────────────────────────
// The Atelier system is a set of moves, not a skin: a quiet dateline + folio on a
// hairline with a single bronze tick; a verdict that drops from a small roman lead
// into an oversized Fraunces italic; facts set on open space with a rule instead of a
// box; and a faint monogram watermark. Screens COMPOSE these — they don't re-style —
// so the identity can't drift, and one change here changes it everywhere.
//
// Reserve the display face (Fraunces) for these components. If a screen sets Fraunces
// by hand somewhere else, that's the drift this module exists to prevent.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { C, T, SP, ATELIER } from "./theme";
import { useThemedStyles } from "./ThemeContext";

// A hairline. With `tick`, the bronze mark that signs the masthead rule.
export function Rule({ tick = false, style }) {
  const a = useThemedStyles(makeA);
  return <View style={[a.rule, style]}>{tick ? <View style={a.tick} /> : null}</View>;
}

// MASTHEAD — the quiet dateline + folio number on a ticked hairline. No nameplate,
// no double rules; the headline below is what leads. `right` overrides the dateline
// (e.g. a city · status). Pass `folio` like "No. 03".
export function Masthead({ dateline, folio, right }) {
  const a = useThemedStyles(makeA);
  return (
    <View>
      <View style={a.mastRow}>
        {folio ? <Text style={a.folio}>{folio}</Text> : <View />}
        <Text style={a.eyebrow}>{right || dateline}</Text>
      </View>
      <Rule tick style={{ marginTop: SP.md }} />
    </View>
  );
}

// VERDICT — the day's answer. A small roman lead ("You're in") dropping into an
// oversized Fraunces italic subject ("Nashville."), then the reason in serif italic.
export function Verdict({ lead, subject, reason, size = 52, style }) {
  const a = useThemedStyles(makeA);
  return (
    <View style={style}>
      {lead ? <Text style={a.vLead}>{lead}</Text> : null}
      <Text style={[a.vSubject, { fontSize: size, lineHeight: Math.round(size * 0.96) }]}>{subject}</Text>
      {reason ? <Text style={a.vReason}>{reason}</Text> : null}
    </View>
  );
}

// EDITORIAL STAT — a fact without a card: eyebrow label, big display value, a hairline,
// then the reason in italic. The "when to leave" block, and anything like it.
export function EditorialStat({ label, value, reason, valueSize = 40, style }) {
  const a = useThemedStyles(makeA);
  return (
    <View style={style}>
      <Text style={a.eyebrow}>{label}</Text>
      <Text style={[a.esVal, { fontSize: valueSize }]}>{value}</Text>
      <Rule style={{ marginVertical: SP.md }} />
      {reason ? <Text style={a.vReason}>{reason}</Text> : null}
    </View>
  );
}

// WATERMARK — the faint Fraunces monogram behind a page. Absolutely positioned;
// give its parent `overflow: "hidden"` and `position: "relative"`.
export function Watermark({ char = "W", size = 200, style }) {
  const a = useThemedStyles(makeA);
  return <Text pointerEvents="none" allowFontScaling={false} style={[a.wm, { fontSize: size }, style]}>{char}</Text>;
}

const makeA = (C) => ({
  rule: { height: 1, backgroundColor: C.line, position: "relative" },
  tick: { position: "absolute", left: 0, top: -1, width: ATELIER.tickW, height: 2, backgroundColor: C.gold },
  mastRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  folio: ATELIER.folio,
  eyebrow: ATELIER.eyebrow,
  vLead: { fontFamily: T.displayL, fontSize: 22, color: C.ink },
  vSubject: { fontFamily: T.displayI, color: C.ink, letterSpacing: -0.5, marginTop: 2 },
  vReason: { fontFamily: T.serifI, fontSize: 15, color: C.mut, lineHeight: 23, marginTop: 12 },
  esVal: { fontFamily: T.displayL, color: C.ink, letterSpacing: -0.5, marginTop: 4 },
  wm: { position: "absolute", right: -18, bottom: -30, fontFamily: T.displayI, color: ATELIER.watermark },
});
