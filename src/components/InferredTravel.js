// InferredTravel — what the calendar implies, before you ask.
//
// Home reads your week and your location and shows the ONE thing worth deciding:
// "Chicago, Wed–Thu — two meetings. Plan it?" plus any honest questions it refuses
// to guess ("Dallas: in person or remote?"). Nothing here is booked or certain —
// it's inference, and it says so. Self-contained so it can render, or not, without
// touching the rest of Home.

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { C, T } from "../theme";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function when(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${DOW[d.getDay()]} ${h}${m ? ":" + String(m).padStart(2, "0") : ""}${ap}`;
}
function span(a, b) {
  const s = when(a), e = when(b);
  const sameDay = new Date(a).toDateString() === new Date(b).toDateString();
  return sameDay ? s : `${s} – ${e}`;
}

export function InferredTravel({ trips = [], asks = [], from, onPlan, onAnswer }) {
  if (!trips.length && !asks.length) return null;

  return (
    <View style={s.wrap}>
      <Text style={s.kicker}>WHAT YOUR CALENDAR IMPLIES</Text>
      {from?.city ? <Text style={s.sub}>Reading from {from.city}.</Text> : null}

      {trips.length ? (
        <View style={s.group}>
          {trips.map((t, i) => {
            const it = t.itinerary;
            const route = it && it.flight_in?.from && it.flight_in?.to
              ? `${it.flight_in.from}→${it.flight_in.to}${it.nights > 0 ? ` · ${it.nights}n` : ""}`
              : null;
            return (
              <Pressable
                key={"t" + i}
                style={[s.row, i > 0 && s.rowDiv]}
                onPress={() => onPlan && onPlan(t)}
                hitSlop={6}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={s.dest}>{t.destination || "A trip"}</Text>
                  <Text style={s.meta}>{[when(t.arrive_by), route].filter(Boolean).join("  ·  ")}</Text>
                </View>
                <Text style={s.plan}>Plan →</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {asks.map((a, i) => (
        <Pressable
          key={"a" + i}
          style={s.askRow}
          onPress={() => onAnswer && onAnswer(a)}
          hitSlop={6}
        >
          <View style={s.askDot} />
          <Text style={s.askQ} numberOfLines={2}>{a.question}</Text>
          <Text style={s.plan}>Answer →</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:   { marginTop: 24, marginBottom: 8 },
  kicker: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.4, color: C.gold },
  sub:    { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 13.5, color: C.mut, marginTop: 4, marginBottom: 12 },

  // Trips: one tight tappable row each, grouped in a single bordered container.
  // The full itinerary lives on the plan screen — Home is a glance, not a form.
  group:  { borderWidth: 1, borderColor: C.line, borderRadius: 14, overflow: "hidden" },
  row:    { flexDirection: "row", alignItems: "center", paddingVertical: 15, paddingHorizontal: 16 },
  rowDiv: { borderTopWidth: 1, borderTopColor: C.line },
  dest:   { fontFamily: T.serif, fontSize: 19, lineHeight: 23, color: C.ink },
  meta:   { fontFamily: T.sansM, fontSize: 12.5, color: C.mut, marginTop: 3 },
  plan:   { fontFamily: T.sansM, fontSize: 12.5, color: C.gold, marginLeft: 8 },

  // A question is one quiet line with an amber tick, not a full card.
  askRow: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingVertical: 13, paddingHorizontal: 15,
            borderWidth: 1, borderColor: C.amber, borderRadius: 12 },
  askDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.amber, marginRight: 10 },
  askQ:   { flex: 1, fontFamily: T.sans, fontSize: 13.5, lineHeight: 18, color: C.ink, paddingRight: 8 },
});
