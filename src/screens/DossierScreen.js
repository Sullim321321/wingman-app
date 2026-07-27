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
import { T } from "../theme";
import { useTheme, useThemedStyles } from "../ThemeContext";
import { BackBar, SerifText, FadeRise, tap } from "../components";
import { Leg, RideCount } from "../tripdoc";
import { getDossier, deleteLeg, getDepartures } from "../api";

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
  const { C } = useTheme();                    // active palette (light or dark)
  const s = useThemedStyles(makeStyles);       // stylesheet rebuilt on theme change
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr]   = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [departures, setDepartures] = useState(null);

  const load = useCallback(async () => {
    try { setData(await getDossier(tripId)); setErr(null); }
    catch (e) { setErr(e?.message || "Couldn't open this trip."); }
    finally { setBusy(false); setRefreshing(false); }
    // "When to leave" — best-effort, never blocks the document. Guardian computes the
    // door time from real travel time; we only surface entries it could actually work out.
    try { const d = await getDepartures(tripId); setDepartures(d?.departures || []); } catch { setDepartures([]); }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);
  // Refetch whenever the screen regains focus. Loading only on mount meant that
  // navigating back to an already-open trip showed whatever it fetched the first time —
  // so a server-side fix (a collapsed ride, a corrected name) never appeared until a
  // full app restart. Focus is the moment the user is looking again; pull fresh then.
  useEffect(() => navigation.addListener("focus", load), [navigation, load]);

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

  // ── THE SPINE ────────────────────────────────────────────────────────────────
  // A trip is read at a glance as an arc: fly in, where you're staying, fly out. That
  // shape leads; the stop-by-stop detail (and the ride counts) collapse underneath,
  // one tap away. Anything unbooked is promoted above the arc — it's the one thing that
  // actually needs you.
  const allLegs = Object.values(chapters).flat();
  // A leg named only after its city ("New York") is a sketch that lost its real name —
  // not a stay, not a route. And a flight with no origin, no destination, and no number
  // is the "? → ?" ghost: a shape with nothing in it. Neither belongs in the spine or in
  // "needs you"; they read as junk the moment the background goes dark.
  const isCityName = (l) => {
    const n = String(l.property_name || l.display_name || "").trim().toLowerCase();
    const city = String(l.destination_city || l.destination || "").trim().toLowerCase();
    return !!n && !!city && n === city;
  };
  const flightHasSubstance = (l) => !!(l.origin || l.destination || l.flight_number);
  const legHasSubstance = (l) => {
    if (l.type === "flight") return flightHasSubstance(l);
    const named = !!l.property_name && !isCityName(l);
    return named || !!l.confirmation || (!!l.origin && !!l.destination);
  };
  const flights = allLegs
    .filter((l) => l.type === "flight" && flightHasSubstance(l))
    .sort((a, b) => new Date(a.departs_at || 0) - new Date(b.departs_at || 0));
  const stays = allLegs.filter((l) =>
    (l.type === "hotel" || l.type === "airbnb") && !(l.state === "proposed" && isCityName(l)));
  const needsYou = allLegs.filter((l) => l.state === "proposed" && legHasSubstance(l));
  const hasSpine = flights.length + stays.length > 0;
  const fmtDay = (iso) => {
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };
  const shortDay = (ms) => {
    const dt = new Date(ms);
    return Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const fmtRange = (a, b) => {
    const s1 = shortDay(a), s2 = shortDay(b);
    return s1 && s2 && s1 !== s2 ? `${s1} – ${s2}` : (s1 || s2);
  };

  // Consolidate stays into spans. Multiple reservations at one hotel are one stay to a
  // reader — "Kimpton · Jul 17–24 · 7 nights", not four cards. A stay whose name is just
  // the city lost its hotel name on import; if it sits inside a named stay in the same
  // city, absorb it into that span rather than showing a nameless "Nashville" line.
  const normHotel = (name) => String(name || "").toLowerCase()
    .replace(/\bby ihg\b|\bhotel\b|\bthe\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const cityOf = (l) => String(l.destination_city || l.destination || "").trim().toLowerCase();
  const isCityOnly = (l) => {
    const n = String(l.property_name || l.display_name || "").trim().toLowerCase();
    return !!cityOf(l) && n === cityOf(l);
  };
  const nightsOf = (s) => {
    if (Number(s.nights) > 0) return Number(s.nights);
    const n = Math.round((s._end - s._start) / 86400000);
    return n > 0 ? n : 1;
  };
  const staySpans = (() => {
    const withT = stays
      .map((s) => ({ ...s, _start: new Date(s.departs_at || 0).getTime(), _end: new Date(s.arrives_at || s.departs_at || 0).getTime() }))
      .sort((a, b) => a._start - b._start);
    const groups = [];
    for (const s of withT) {
      const key = normHotel(s.property_name || s.display_name);
      const cityOnly = isCityOnly(s);
      const prev = groups[groups.length - 1];
      const sameCity = prev && prev.city === cityOf(s);
      const contiguous = prev && s._start <= prev.end + 2 * 86400000;
      const samePlace = prev && key && prev.key === key;
      if (prev && sameCity && contiguous && (samePlace || cityOnly || prev.cityOnly)) {
        prev.end = Math.max(prev.end, s._end);
        prev.nights += nightsOf(s);
        if (!prev.key && key) { prev.key = key; prev.name = s.display_name || s.property_name; prev.cityOnly = false; }
        prev.legs.push(s);
      } else {
        groups.push({ key, name: s.display_name || s.property_name || "Stay", city: cityOf(s),
          cityLabel: s.destination_city || s.destination, cityOnly, start: s._start, end: s._end, nights: nightsOf(s), legs: [s] });
      }
    }
    return groups;
  })();

  // Fold a chapter's legs for the detail list: same-hotel nights become ONE row with the
  // full span, the way THE ARC reads it — four "Kimpton Aertson Hotel" cards on four
  // dates was the same stay shown four times. Non-hotel legs pass through untouched and
  // in order; hotels of one stay collapse to their first appearance.
  const foldChapter = (legs) => {
    const out = [];
    const groups = new Map();
    for (const l of legs) {
      const t = String(l.type || "").toLowerCase();
      if (t !== "hotel" && t !== "airbnb") { out.push({ kind: "leg", leg: l }); continue; }
      const start = new Date(l.departs_at || 0).getTime();
      const end = new Date(l.arrives_at || l.departs_at || 0).getTime();
      const key = normHotel(l.property_name || l.display_name) || cityOf(l) || String(l.id);
      let g = groups.get(key);
      if (!g) {
        g = { kind: "stay", key, id: l.id, name: l.display_name || l.property_name || "Stay",
              cityOnly: isCityOnly(l), cityLabel: l.destination_city || l.destination, start, end, nights: 0 };
        groups.set(key, g);
        out.push(g);
      }
      g.start = Math.min(g.start, start);
      g.end = Math.max(g.end, end);
      g.nights += nightsOf({ ...l, _start: start, _end: end });
    }
    return out;
  };

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

        {/* Anything unbooked is the one thing that needs you — promoted above the arc. */}
        {needsYou.length ? (
          <FadeRise delay={40}>
            <View style={s.needsCard}>
              <Text style={s.needsLabel}>NEEDS YOU</Text>
              {needsYou.slice(0, 3).map((l) => (
                <Text key={"n" + l.id} style={s.needsItem}>
                  {(l.display_name || l.destination || l.type)} — not booked yet
                </Text>
              ))}
            </View>
          </FadeRise>
        ) : null}

        {/* THE ARC — the shape of the trip, read at a glance. */}
        {hasSpine ? (
          <FadeRise delay={60}>
            <View style={s.arc}>
              <Text style={s.arcLabel}>THE ARC</Text>
              {flights.map((f) => (
                <View key={"f" + f.id} style={s.arcRow}>
                  <Text style={s.arcName}>{f.display_name || `${f.origin || "?"} → ${f.destination || "?"}`}</Text>
                  <Text style={s.arcMeta}>{[f.origin && f.destination ? `${f.origin} → ${f.destination}` : null, fmtDay(f.departs_at)].filter(Boolean).join("  ·  ")}</Text>
                </View>
              ))}
              {staySpans.map((g, i) => (
                <View key={"h" + i} style={s.arcRow}>
                  <Text style={s.arcName}>{g.cityOnly ? `Stay in ${g.cityLabel || "town"}` : g.name}</Text>
                  <Text style={s.arcMeta}>{[g.cityLabel, fmtRange(g.start, g.end), `${g.nights} ${g.nights === 1 ? "night" : "nights"}`].filter(Boolean).join("  ·  ")}</Text>
                </View>
              ))}
            </View>
          </FadeRise>
        ) : null}

        {/* WHEN TO LEAVE — the Guardian's door time, from real travel time + a stated
            buffer. Only entries it could actually route are shown; it never guesses. */}
        {Array.isArray(departures) && departures.some((d) => d.leave_by) ? (
          <FadeRise delay={70}>
            <View style={s.leaveCard}>
              <Text style={s.arcLabel}>WHEN TO LEAVE</Text>
              {departures.filter((d) => d.leave_by).slice(0, 4).map((d, i) => (
                <View key={"lv" + i} style={[s.leaveRow, i > 0 && s.leaveDiv]}>
                  <Text style={s.leaveTime}>Leave by {new Date(d.leave_by).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Text>
                  <Text style={s.leaveWhat}>{d.what}</Text>
                  {d.why ? <Text style={s.leaveWhy}>{d.why}</Text> : null}
                </View>
              ))}
            </View>
          </FadeRise>
        ) : null}

        {/* Every stop, collapsed by default — the granular detail is one tap away. */}
        {total > 0 ? (
          <Pressable style={s.toggle} onPress={() => { tap(); setShowAll((v) => !v); }} hitSlop={8}>
            <Text style={s.toggleT}>{showAll ? "Hide the detail" : `Show every stop (${total})`}</Text>
          </Pressable>
        ) : null}

        {showAll && CHAPTERS.map((ch, ci) => {
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
                {foldChapter(legs).map((it) => it.kind === "leg" ? (
                  <Leg key={it.leg.id} leg={it.leg} onDismiss={dismissSketch} />
                ) : (
                  <View key={"stay" + it.id} style={s.stayRow}>
                    <Text style={s.stayName}>{it.cityOnly ? `Stay in ${it.cityLabel || "town"}` : it.name}</Text>
                    <Text style={s.stayMeta}>{[fmtRange(it.start, it.end), `${it.nights} ${it.nights === 1 ? "night" : "nights"}`].filter(Boolean).join("  ·  ")}</Text>
                  </View>
                ))}
                {/* Rides, counted rather than listed. An eight-minute taxi isn't something
                    a chief of staff briefs you on — but pretending it didn't happen would
                    be its own lie, so it gets one quiet line. */}
                <RideCount n={data?.rides?.[ch.key] || 0} />
              </View>
            </FadeRise>
          );
        })}

        {/* A PROPOSED flight is one you haven't booked — offer to price and hold it.
            This is the flight-picker on-ramp from inside a trip, independent of Home. */}
        {(chapters.plan || []).some((l) => l.type === "flight") ? (
          <FadeRise delay={260}>
            <Pressable
              style={s.bookBtn}
              onPress={() => {
                const f = (chapters.plan || []).find((l) => l.type === "flight");
                if (f) { tap(); navigation.navigate("BookLeg", { legId: f.id }); }
              }}
            >
              <Text style={s.bookBtnT}>Book this flight →</Text>
            </Pressable>
          </FadeRise>
        ) : null}

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

const makeStyles = (C) => ({
  app:    { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 },
  h1:   { fontFamily: T.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.5, color: C.ink, flex: 1, paddingRight: 12 },
  edit: { fontFamily: T.sansM, fontSize: 13, color: C.gold, paddingBottom: 4 },
  live: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2, color: C.teal, marginTop: 8, marginBottom: 4 },

  needsCard:  { backgroundColor: C.attentionFill, borderWidth: 1, borderColor: C.coral, borderRadius: 14, padding: 15, marginTop: 18 },
  needsLabel: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.4, color: C.coral, marginBottom: 8 },
  needsItem:  { fontFamily: T.sans, fontSize: 15, color: C.ink, lineHeight: 20 },

  arc:      { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 16, marginTop: 18 },
  arcLabel: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 3.4, color: C.gold, marginBottom: 12, textTransform: "uppercase" },
  arcRow:   { marginBottom: 12 },
  arcName:  { fontFamily: T.display, fontSize: 18, color: C.ink, letterSpacing: -0.3 },
  arcMeta:  { fontFamily: T.sansM, fontSize: 13, color: C.mut, marginTop: 3 },

  leaveCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 16, marginTop: 18 },
  leaveRow:  { marginBottom: 12 },
  leaveDiv:  { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 },
  leaveTime: { fontFamily: T.display, fontSize: 18, color: C.ink, letterSpacing: -0.3 },
  leaveWhat: { fontFamily: T.sansM, fontSize: 13, color: C.mut, marginTop: 2 },
  leaveWhy:  { fontFamily: T.sans, fontSize: 13, color: C.teal, marginTop: 3, lineHeight: 17 },

  toggle:   { alignSelf: "flex-start", marginTop: 18, paddingVertical: 6 },
  toggleT:  { fontFamily: T.sansM, fontSize: 13, color: C.gold },

  stayRow:  { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 16, marginBottom: 10 },
  stayName: { fontFamily: T.display, fontSize: 18, color: C.ink, letterSpacing: -0.3 },
  stayMeta: { fontFamily: T.sansM, fontSize: 13, color: C.mut, marginTop: 3 },

  chapter:      { marginTop: 26 },
  chapterHead:  { marginBottom: 12 },
  chapterLabel: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.6, color: C.gold },
  chapterBlurb: { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 15, color: C.mut, marginTop: 4 },



  spineBtn:  { marginTop: 24, borderWidth: 1, borderColor: C.line, borderRadius: 12,
               paddingVertical: 14, alignItems: "center" },
  spineBtnT: { fontFamily: T.sansM, fontSize: 13, color: C.gold },

  bookBtn:   { marginTop: 24, backgroundColor: C.gold, borderRadius: 12,
               paddingVertical: 15, alignItems: "center" },
  bookBtnT:  { fontFamily: T.sansB, fontSize: 15, color: C.bg, letterSpacing: 0.3 },

  idea: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 1.8, color: C.amber, marginTop: 8, marginBottom: 4 },
  empty: { fontFamily: T.sans, fontSize: 15, color: C.mut, marginTop: 20, lineHeight: 22 },
  err:   { fontFamily: T.sans, fontSize: 15, color: C.coral, marginTop: 16 },
});
