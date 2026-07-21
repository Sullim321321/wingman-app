// tripdoc.js — the leg card, once.
//
// ─────────────────────────────────────────────────────────────────────────────
// The Dossier and Home are two windows onto one document. The server already
// guarantees they agree about which chapter a leg belongs to (document.js). This is
// the other half of that promise: they must also LOOK the same, because a booking
// that renders one way on Home and another way in the Dossier is two objects in the
// user's head no matter what the database says.
//
// This file exists for the same reason document.js does. The palette lived in five
// places and drifted. The trip title lived in two functions and drifted. A card this
// central will drift too, unless there is only one of it.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { C, T } from "./theme";

export const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
    "  ·  " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

// Slack is a warning, and the colour is the warning. Under 45 minutes is the band
// where a delay eats the connection; under two hours is worth watching.
export const slackTone = (m) => (m == null ? C.mut : m < 45 ? C.coral : m < 120 ? C.amber : C.teal);

/**
 * One booking, with what it hangs on.
 *
 * `compact` is for Home, where the same card appears in a narrower window — it drops
 * the route line but NEVER the dependency line. That line is the product; if it only
 * appears in the archive, the product only exists in the archive.
 */
export function Leg({ leg, compact = false }) {
  const isSketch = leg.state === "proposed" || !leg.departs_at;
  return (
    <View style={[s.leg, isSketch && s.sketch]}>
      <View style={s.legTop}>
        <Text style={s.legName}>{leg.display_name || leg.destination || leg.type}</Text>
        {isSketch ? <Text style={s.sketchTag}>SKETCH</Text> : null}
      </View>

      {leg.departs_at ? (
        <Text style={s.legWhen}>
          {when(leg.departs_at)}
          {!compact && leg.origin && leg.destination ? `   ·   ${leg.origin} → ${leg.destination}` : ""}
        </Text>
      ) : leg.raw_data?.why ? (
        <Text style={s.legWhy}>{leg.raw_data.why}</Text>
      ) : null}

      {/* ── THE LINE THE INDUSTRY CAN'T PRINT ──
          What this booking hangs on, and how much slack. Measured slack is in mono,
          because it was measured. An inferred edge says so rather than posing as fact. */}
      {(leg.depends_on || []).map((dep, i) => (
        <View key={i} style={s.dep}>
          <View style={[s.depDot, { backgroundColor: slackTone(dep.slack_minutes) }]} />
          <Text style={s.depText}>
            Depends on {dep.on}
            {dep.slack_minutes != null ? (
              <Text style={[s.depSlack, { color: slackTone(dep.slack_minutes) }]}>
                {"  ·  "}{dep.slack_minutes} min slack
              </Text>
            ) : null}
            {!dep.certain ? <Text style={s.depGuess}>  · inferred</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * When does this trip actually start and end, and is it happening now?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The Trips list showed "Nashville · 16 MAY 2012 · ACTIVE · In progress" on a
 * 2026 trip. Three separate faults compounded:
 *
 *   1. It took `legs.find(l => l.type === "flight")` — the first flight in ARRAY
 *      order — as the trip's start. Array order is not chronological order.
 *   2. It ignored `state`, so a Smoky Mountains sketch dated tonight set the end.
 *   3. Nothing checked whether the resulting span was plausible. A stray 2012 leg
 *      and a proposal fourteen years apart satisfied `start <= now && end >= now`,
 *      so the trip declared itself live.
 *
 * A trip is "active" only if committed bookings put you inside it, and only if the
 * span is short enough to be a journey. Fourteen years is a data problem, and a
 * data problem must never render as a confident status.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const MAX_TRIP_DAYS = 30;

export function tripSpan(trip) {
  const legs = (trip?.legs || []).filter((l) => l && l.state !== "proposed" && l.departs_at);
  const starts = legs.map((l) => new Date(l.departs_at).getTime()).filter((n) => !Number.isNaN(n));
  const ends = legs
    .map((l) => new Date(l.arrives_at || l.departs_at).getTime())
    .filter((n) => !Number.isNaN(n));
  if (!starts.length) return { start: 0, end: 0, days: 0, plausible: false };
  const start = Math.min(...starts);
  const end = Math.max(...ends, start);
  const days = Math.round((end - start) / 86400000);
  return { start, end, days, plausible: days <= MAX_TRIP_DAYS };
}

export function statusForTrip(trip, nowMs = Date.now()) {
  const { start, end, plausible } = tripSpan(trip);
  if (!start) return "upcoming";
  if (end < nowMs - 86400000) return "past";
  // An implausible span cannot claim to be happening. It says "upcoming" rather
  // than "active" — wrong in the quiet direction instead of the loud one.
  if (plausible && start <= nowMs && end >= nowMs) return "active";
  return end < nowMs ? "past" : "upcoming";
}

/** "+ 3 rides" — counted, never listed. An eight-minute taxi isn't a briefing item. */
export function RideCount({ n }) {
  if (!n) return null;
  return <Text style={s.rides}>+ {n} {n === 1 ? "ride" : "rides"}</Text>;
}

const s = StyleSheet.create({
  leg:    { backgroundColor: C.card, borderRadius: 14, padding: 15, marginBottom: 10,
            borderWidth: 1, borderColor: C.line, borderTopColor: C.lineHi },
  sketch: { backgroundColor: "transparent", borderStyle: "dashed", borderColor: C.mutD, borderTopColor: C.mutD },
  legTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  legName:{ fontFamily: T.sansM, fontSize: 15.5, color: C.ink, flex: 1, paddingRight: 8 },
  sketchTag: { fontFamily: T.sansB, fontSize: 7.5, letterSpacing: 1.6, color: C.mutD, marginTop: 3 },
  legWhen:{ fontFamily: T.mono, fontSize: 11, color: C.mut, marginTop: 7, letterSpacing: 0.3 },
  legWhy: { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 14, color: C.mut, marginTop: 6, lineHeight: 20 },

  dep:     { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 11,
             paddingTop: 11, borderTopWidth: 1, borderTopColor: C.line },
  depDot:  { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  depText: { fontFamily: T.sans, fontSize: 12.5, color: C.mut, flex: 1, lineHeight: 18 },
  depSlack:{ fontFamily: T.monoM, fontSize: 11.5, letterSpacing: 0.3 },
  depGuess:{ fontFamily: T.sans, fontSize: 11, color: C.mutD, fontStyle: "italic" },

  rides: { fontFamily: T.sans, fontSize: 12.5, color: C.mutD, marginTop: 2, marginLeft: 2 },
});
