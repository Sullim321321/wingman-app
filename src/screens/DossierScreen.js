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
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { C, T } from "../theme";
import { BackBar, SerifText, FadeRise, tap } from "../components";
import { Leg, RideCount } from "../tripdoc";
import { getDossier, deleteLeg } from "../api";

const CHAPTERS = [
  { key: "in_motion", label: "IN MOTION", blurb: "Happening now." },
  { key: "prepare",   label: "PREPARE",   blurb: "Booked and ahead of you." },
  { key: "plan",      label: "THE SHAPE", blurb: "Still being decided." },
  { key: "after",     label: "AFTER",     blurb: "Done." },
];

// `when`, `slackTone` and the Leg card now live in ../tripdoc, shared with Home.
// A booking that renders one way here and another way on Home is two objects in the
// user's head, whatever the database says.

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

  // A sketch is a suggestion Wingman made; dismissing it removes a proposal, never a
  // booking. The Leg card only offers this on sketches, and we confirm anyway — then
  // reload so the document reflects the truth immediately.
  const dismissSketch = useCallback((leg) => {
    const name = leg.display_name || leg.destination || leg.type || "this item";
    const isSketch = leg.state === "proposed" || !leg.departs_at;
    const title = isSketch ? "Dismiss suggestion?" : "Remove booking?";
    const body = isSketch
      ? `Remove "${name}"? This only clears a proposal — nothing you booked.`
      : `Remove "${name}" from this trip? This deletes the booking from Wingman (it won't cancel anything with the airline or hotel).`;
    Alert.alert(title, body, [
      { text: "Keep", style: "cancel" },
      { text: isSketch ? "Dismiss" : "Remove", style: "destructive", onPress: async () => {
        try { await deleteLeg(tripId, leg.id); load(); }
        catch (e) { Alert.alert("Couldn't remove", e?.message || "Try again in a moment."); }
      } },
    ]);
  }, [tripId, load]);

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
            {/* Pass tripId, NOT the trip object. The dossier's `trip` has no legs
                joined onto it, so handing it over made TripDetail show "No bookings
                yet" and hid every delete control. tripId makes it fetch the full trip. */}
            <Pressable onPress={() => { tap(); navigation.navigate("TripDetail", { tripId: data.trip.id }); }} hitSlop={8}>
              <Text style={s.edit}>Edit</Text>
            </Pressable>
          </View>
          {/* ── SAY IT, DON'T IMPLY IT ───────────────────────────────────────
              A trip with nothing committed is an idea Wingman had, not a plan you
              made. The legs were always drawn as sketches — but a dashed border is
              a hint, and the title above is an assertion, and the assertion wins.
              So the trip states its own status in words before anything else. */}
          {data?.certainty === "idea" ? (
            <Text style={s.idea}>NOTHING HERE IS BOOKED — THIS IS AN IDEA</Text>
          ) : data?.in_motion ? (
            <Text style={s.live}>● IN MOTION</Text>
          ) : null}
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
                {legs.map((l) => <Leg key={l.id} leg={l} onDismiss={dismissSketch} />)}
                {/* Rides, counted rather than listed. An eight-minute taxi isn't something
                    a chief of staff briefs you on — but pretending it didn't happen would
                    be its own lie, so it gets one quiet line. */}
                <RideCount n={data?.rides?.[ch.key] || 0} />
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



  spineBtn:  { marginTop: 24, borderWidth: 1, borderColor: C.line, borderRadius: 12,
               paddingVertical: 14, alignItems: "center" },
  spineBtnT: { fontFamily: T.sansM, fontSize: 13.5, color: C.gold },

  idea: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 1.8, color: C.amber, marginTop: 8, marginBottom: 4 },
  empty: { fontFamily: T.sans, fontSize: 14.5, color: C.mut, marginTop: 20, lineHeight: 22 },
  err:   { fontFamily: T.sans, fontSize: 14, color: C.coral, marginTop: 16 },
});
