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

      {trips.map((t, i) => (
        <View key={"t" + i} style={s.card}>
          <Text style={s.dest}>{t.destination || "A trip"}</Text>
          <Text style={s.dates}>{span(t.arrive_by, t.depart_after)}</Text>
          <Text style={s.reason}>{t.reason}</Text>
          {(t.drivers || []).slice(0, 3).map((d, j) => (
            <Text key={j} style={s.driver}>· {d.title}</Text>
          ))}
          {onPlan ? (
            <Pressable style={s.cta} onPress={() => onPlan(t)} hitSlop={8}>
              <Text style={s.ctaT}>Plan this trip →</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      {asks.map((a, i) => (
        <View key={"a" + i} style={[s.card, s.ask]}>
          <Text style={s.askLabel}>ONE QUESTION</Text>
          <Text style={s.askQ}>{a.question}</Text>
          {onAnswer ? (
            <Pressable style={s.cta} onPress={() => onAnswer(a)} hitSlop={8}>
              <Text style={s.ctaT}>Answer →</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:   { marginTop: 24, marginBottom: 8 },
  kicker: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.4, color: C.gold },
  sub:    { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 13.5, color: C.mut, marginTop: 4 },

  card:   { marginTop: 14, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 16 },
  dest:   { fontFamily: T.serif, fontSize: 24, lineHeight: 28, color: C.ink },
  dates:  { fontFamily: T.sansM, fontSize: 13, color: C.teal, marginTop: 3 },
  reason: { fontFamily: T.sans, fontSize: 14, color: C.mut, marginTop: 8, lineHeight: 20 },
  driver: { fontFamily: T.sans, fontSize: 13, color: C.mut, marginTop: 4 },

  ask:    { borderColor: C.amber },
  askLabel:{ fontFamily: T.sansB, fontSize: 9, letterSpacing: 2, color: C.amber },
  askQ:   { fontFamily: T.serif, fontSize: 18, lineHeight: 24, color: C.ink, marginTop: 6 },

  cta:    { marginTop: 14 },
  ctaT:   { fontFamily: T.sansM, fontSize: 13.5, color: C.gold },
});
