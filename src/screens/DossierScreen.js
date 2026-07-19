// DossierScreen — the trip as one document.
//
// ─────────────────────────────────────────────────────────────────────────────
// Trip detail is a database dump — cards inside cards, one per booking, chronological.
// The Dossier is the thing NO OTHER TRAVEL APP CAN SHOW, because no other app kept the
// graph: under every booking that hangs off a flight, in plain words, what it depends
// on and how much slack there is. "Depends on JL 623 · 40 minutes." That line is the
// whole product, made legible on a calm day instead of only in a crisis.
//
// Four chapters, because a trip has four phases that each want something different:
//   PLAN       still a sketch — undated, proposed. What you're still deciding.
//   PREPARE    booked, dated, ahead of you. What to get ready.
//   IN MOTION  happening now.
//   AFTER      done.
//
// The chapters come from the DATA, never from an assertion. A proposed leg cannot be
// "after"; an undated one cannot be "prepare." If it can't be placed, it's a sketch —
// which is the honest name for an unplaceable thing.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { C, T } from "../theme";
import { BackBar, SerifText, FadeRise, tap } from "../components";
import { getDossier } from "../api";

const CHAPTERS = [
  { key: "in_motion", label: "IN MOTION", blurb: "Happening now." },
  { key: "prepare",   label: "PREPARE",   blurb: "Booked and ahead of you." },
  { key: "plan",      label: "THE SHAPE", blurb: "Still being decided." },
  { key: "after",     label: "AFTER",     blurb: "Done." },
];

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
    "  ·  " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const slackTone = (m) => (m == null ? C.mut : m < 45 ? C.coral : m < 120 ? C.amber : C.teal);

function Leg({ leg }) {
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
          {leg.origin && leg.destination ? `   ·   ${leg.origin} → ${leg.destination}` : ""}
        </Text>
      ) : leg.raw_data?.why ? (
        <Text style={s.legWhy}>{leg.raw_data.why}</Text>
      ) : null}

      {/* ── THE LINE THE INDUSTRY CAN'T PRINT ──
          What this booking hangs on, and how much slack. Measured slack is in mono,
          because it was measured. An inferred edge says so rather than posing as fact. */}
      {(leg.depends_on || []).map((d, i) => (
        <View key={i} style={s.dep}>
          <View style={[s.depDot, { backgroundColor: slackTone(d.slack_minutes) }]} />
          <Text style={s.depText}>
            Depends on {d.on}
            {d.slack_minutes != null ? (
              <Text style={[s.depSlack, { color: slackTone(d.slack_minutes) }]}>
                {"  ·  "}{d.slack_minutes} min slack
              </Text>
            ) : null}
            {!d.certain ? <Text style={s.depGuess}>  · inferred</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function DossierScreen({ route, navigation }) {
  const { tripId } = route.params || {};
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr]   = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await getDossier(tripId)); setErr(null); }
    catch (e) { setErr(e?.message || "Couldn't open this trip."); }
    finally { setBusy(false); setRefreshing(false); }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  if (busy) {
    return <SafeAreaView style={s.app}><View style={s.center}><ActivityIndicator color={C.mut} /></View></SafeAreaView>;
  }

  const chapters = data?.chapters || {};
  const title = data?.trip?.title || "Trip";
  const total = Object.values(chapters).reduce((n, arr) => n + (arr?.length || 0), 0);

  return (
    <SafeAreaView style={s.app}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.mut} />}
      >
        <BackBar nav={navigation} label="Dossier" />

        <FadeRise>
          <View style={s.titleRow}>
            <SerifText style={s.h1}>{title}</SerifText>
            {/* Editing lives in the old TripDetail — kept as the back-room so the Dossier
                stays a document, not a form. One link, not a second primary screen. */}
            <Pressable onPress={() => { tap(); navigation.navigate("TripDetail", { trip: data.trip }); }} hitSlop={8}>
              <Text style={s.edit}>Edit</Text>
            </Pressable>
          </View>
          {data?.in_motion ? <Text style={s.live}>● IN MOTION</Text> : null}
        </FadeRise>

        {err ? <Text style={s.err}>{err}</Text> : null}

        {!err && total === 0 ? (
          <FadeRise delay={60}>
            <Text style={s.empty}>Nothing in this trip yet. Plan it, or forward a confirmation.</Text>
          </FadeRise>
        ) : null}

        {CHAPTERS.map((ch, ci) => {
          const legs = chapters[ch.key] || [];
          const rideCount = data?.rides?.[ch.key] || 0;
          if (!legs.length && !rideCount) return null;
          return (
            <FadeRise key={ch.key} delay={80 + ci * 40}>
              <View style={s.chapter}>
                <View style={s.chapterHead}>
                  <Text style={s.chapterLabel}>{ch.label}</Text>
                  <Text style={s.chapterBlurb}>{ch.blurb}</Text>
                </View>
                {legs.map((l) => <Leg key={l.id} leg={l} />)}
                {/* Rides, counted rather than listed. An eight-minute taxi isn't something
                    a chief of staff briefs you on — but pretending it didn't happen would
                    be its own lie, so it gets one quiet line. */}
                {(data?.rides?.[ch.key] || 0) > 0 ? (
                  <Text style={s.rides}>
                    + {data.rides[ch.key]} {data.rides[ch.key] === 1 ? "ride" : "rides"}
                  </Text>
                ) : null}
              </View>
            </FadeRise>
          );
        })}

        {/* A flight that's still ahead can be looked at through the cascade — "what
            hangs on this" — without waiting for it to break. */}
        {(chapters.prepare || []).some((l) => l.type === "flight") ? (
          <FadeRise delay={300}>
            <Pressable
              style={s.spineBtn}
              onPress={() => {
                const f = (chapters.prepare || []).find((l) => l.type === "flight");
                if (f) { tap(); navigation.navigate("Situation", { legId: f.id, delay: 0 }); }
              }}
            >
              <Text style={s.spineBtnT}>See what hangs on your flight →</Text>
            </Pressable>
          </FadeRise>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:    { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 },
  h1:   { fontFamily: T.serif, fontSize: 30, lineHeight: 36, color: C.ink, flex: 1, paddingRight: 12 },
  edit: { fontFamily: T.sansM, fontSize: 13, color: C.gold, paddingBottom: 4 },
  live: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2, color: C.teal, marginTop: 8, marginBottom: 4 },

  chapter:      { marginTop: 26 },
  chapterHead:  { marginBottom: 12 },
  chapterLabel: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.6, color: C.gold },
  chapterBlurb: { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 14, color: C.mut, marginTop: 4 },

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

  spineBtn:  { marginTop: 24, borderWidth: 1, borderColor: C.line, borderRadius: 12,
               paddingVertical: 14, alignItems: "center" },
  spineBtnT: { fontFamily: T.sansM, fontSize: 13.5, color: C.gold },

  rides: { fontFamily: T.sans, fontSize: 12.5, color: C.mutD, marginTop: 2, marginLeft: 2 },
  empty: { fontFamily: T.sans, fontSize: 14.5, color: C.mut, marginTop: 20, lineHeight: 22 },
  err:   { fontFamily: T.sans, fontSize: 14, color: C.coral, marginTop: 16 },
});
