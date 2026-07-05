// DestinationScreen — AI-powered destination intelligence hub
// Shows: headline, weather, neighborhoods, hotels, restaurants, activities,
// local tips, and Concierge deep-link prompts
// Accessible from: TripDetailScreen, HomeScreen tracker, Concierge

import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator,
} from "react-native";
import { C, T } from "../theme";
import { SerifText, tap } from "../components";
import { getDestinationIntel } from "../api";

// ─── Category type → accent color ────────────────────────────────────────────
const TYPE_COLOR = {
  culture:   "#9B8FFF",
  outdoor:   C.teal,
  food:      C.amber,
  nightlife: "#FF6B9D",
  wellness:  "#7BC67E",
};

const TIER_LABEL = { luxury: "LUXURY", boutique: "BOUTIQUE", value: "VALUE" };
const TIER_COLOR = { luxury: C.gold, boutique: "#9B8FFF", value: C.teal };

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHead({ title }) {
  return (
    <Text style={s.sectionHead}>{title}</Text>
  );
}

// ─── Pill badge ───────────────────────────────────────────────────────────────
function Pill({ label, color }) {
  return (
    <View style={[s.pill, { borderColor: color + "50", backgroundColor: color + "15" }]}>
      <Text style={[s.pillT, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Hotel card ───────────────────────────────────────────────────────────────
function HotelCard({ hotel }) {
  const accent = TIER_COLOR[hotel.tier] || C.gold;
  return (
    <View style={s.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Text style={s.cardTitle}>{hotel.name}</Text>
        <Pill label={TIER_LABEL[hotel.tier] || hotel.tier?.toUpperCase()} color={accent} />
      </View>
      <Text style={s.cardBody}>{hotel.why}</Text>
    </View>
  );
}

// ─── Restaurant card ──────────────────────────────────────────────────────────
function RestaurantCard({ r }) {
  return (
    <View style={s.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Text style={s.cardTitle}>{r.name}</Text>
        <Pill label={r.cuisine} color={C.amber} />
      </View>
      <Text style={s.cardBody}>{r.vibe}</Text>
      {r.must_order && (
        <Text style={s.mustOrder}>Order: {r.must_order}</Text>
      )}
    </View>
  );
}

// ─── Activity card ────────────────────────────────────────────────────────────
function ActivityCard({ a }) {
  const accent = TYPE_COLOR[a.type] || C.gold;
  return (
    <View style={s.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Text style={s.cardTitle}>{a.name}</Text>
        <Pill label={a.type?.toUpperCase()} color={accent} />
      </View>
      <Text style={s.cardBody}>{a.why}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function DestinationScreen({ route, navigation }) {
  const { iata, city, trip_id, tripTitle } = route.params || {};
  const label = city || iata || "Destination";

  const [intel, setIntel]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true);
    getDestinationIntel({ iata, city, trip_id })
      .then(d => {
        if (d?.intel) setIntel(d.intel);
        else setError("Couldn't load destination intel.");
      })
      .catch(() => setError("Couldn't load destination intel."))
      .finally(() => setLoading(false));
  }, [iata, city, trip_id]);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backT}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <SerifText bold style={s.headerCity}>{label}</SerifText>
          {tripTitle && <Text style={s.headerTrip}>{tripTitle}</Text>}
        </View>
      </View>

      {loading && (
        <View style={s.center}>
          <ActivityIndicator color={C.gold} size="large" />
          <Text style={s.loadingT}>Building your destination brief…</Text>
        </View>
      )}

      {error && !loading && (
        <View style={s.center}>
          <Text style={s.errorT}>{error}</Text>
          <Pressable onPress={() => {
            setError(null); setLoading(true);
            getDestinationIntel({ iata, city, trip_id })
              .then(d => { if (d?.intel) setIntel(d.intel); else setError("Couldn't load."); })
              .catch(() => setError("Couldn't load."))
              .finally(() => setLoading(false));
          }}>
            <Text style={s.retry}>Try again</Text>
          </Pressable>
        </View>
      )}

      {intel && !loading && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Headline */}
          <SerifText italic style={s.headline}>{intel.headline}</SerifText>

          {/* Weather */}
          {intel.weather?.summary && (
            <View style={s.weatherCard}>
              <Text style={s.weatherLabel}>WHEN TO GO</Text>
              <Text style={s.weatherBody}>{intel.weather.summary}</Text>
              {intel.weather.best_months && (
                <Text style={s.weatherBest}>Best months: {intel.weather.best_months}</Text>
              )}
            </View>
          )}

          {/* Neighborhoods */}
          {intel.neighborhoods?.length > 0 && (
            <>
              <SectionHead title="NEIGHBORHOODS" />
              {intel.neighborhoods.map((n, i) => (
                <View key={i} style={s.neighborhoodRow}>
                  <Text style={s.neighborhoodName}>{n.name}</Text>
                  <Text style={s.neighborhoodVibe}>{n.vibe}</Text>
                </View>
              ))}
            </>
          )}

          {/* Hotels */}
          {intel.hotels?.length > 0 && (
            <>
              <SectionHead title="WHERE TO STAY" />
              {intel.hotels.map((h, i) => <HotelCard key={i} hotel={h} />)}
            </>
          )}

          {/* Restaurants */}
          {intel.restaurants?.length > 0 && (
            <>
              <SectionHead title="WHERE TO EAT" />
              {intel.restaurants.map((r, i) => <RestaurantCard key={i} r={r} />)}
            </>
          )}

          {/* Activities */}
          {intel.activities?.length > 0 && (
            <>
              <SectionHead title="WHAT TO DO" />
              {intel.activities.map((a, i) => <ActivityCard key={i} a={a} />)}
            </>
          )}

          {/* Local tips */}
          {intel.local_tips?.length > 0 && (
            <>
              <SectionHead title="LOCAL TIPS" />
              <View style={s.tipsCard}>
                {intel.local_tips.map((tip, i) => (
                  <View key={i} style={[s.tipRow, i < intel.local_tips.length - 1 && s.tipBorder]}>
                    <Text style={s.tipBullet}>›</Text>
                    <Text style={s.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Concierge deep-link prompts */}
          {intel.concierge_prompts?.length > 0 && (
            <>
              <SectionHead title="ASK WINGMAN" />
              <Text style={s.conciergeHint}>Tap a question to open it in Concierge</Text>
              {intel.concierge_prompts.map((prompt, i) => (
                <Pressable
                  key={i}
                  style={s.conciergePrompt}
                  onPress={() => { tap(); navigation.navigate("Concierge", { prefill: prompt }); }}
                >
                  <Text style={s.conciergePromptT}>{prompt}</Text>
                  <Text style={s.conciergeArrow}>›</Text>
                </Pressable>
              ))}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: C.line },
  back:           { marginRight: 14, paddingVertical: 4 },
  backT:          { color: C.gold, fontSize: 28, lineHeight: 32 },
  headerCity:     { fontSize: 26, color: C.ink },
  headerTrip:     { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 2 },
  center:         { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingT:       { color: C.mut, fontSize: 13, fontFamily: T.sans, marginTop: 16, textAlign: "center" },
  errorT:         { color: C.coral, fontSize: 14, fontFamily: T.sans, textAlign: "center", marginBottom: 16 },
  retry:          { color: C.gold, fontSize: 14, fontFamily: T.sansB },
  scroll:         { paddingHorizontal: 20, paddingTop: 20 },
  headline:       { fontSize: 20, color: C.ink, lineHeight: 28, marginBottom: 20 },
  sectionHead:    { fontSize: 10, fontFamily: T.sansB, color: C.mut, letterSpacing: 1.4, marginTop: 24, marginBottom: 12 },
  // Weather
  weatherCard:    { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.line, marginBottom: 4 },
  weatherLabel:   { fontSize: 10, fontFamily: T.sansB, color: C.gold, letterSpacing: 1.2, marginBottom: 8 },
  weatherBody:    { color: C.ink, fontSize: 14, fontFamily: T.sans, lineHeight: 20 },
  weatherBest:    { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 6 },
  // Neighborhoods
  neighborhoodRow:{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.line },
  neighborhoodName:{ color: C.ink, fontSize: 15, fontFamily: T.sansB, marginBottom: 3 },
  neighborhoodVibe:{ color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 18 },
  // Cards (hotels, restaurants, activities)
  card:           { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, marginBottom: 10 },
  cardTitle:      { color: C.ink, fontSize: 15, fontFamily: T.sansB, flex: 1 },
  cardBody:       { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 19 },
  mustOrder:      { color: C.gold, fontSize: 12, fontFamily: T.sansM, marginTop: 8 },
  // Pill
  pill:           { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  pillT:          { fontSize: 9, fontFamily: T.sansB, letterSpacing: 0.8 },
  // Tips
  tipsCard:       { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, overflow: "hidden", marginBottom: 4 },
  tipRow:         { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14 },
  tipBorder:      { borderBottomWidth: 0.5, borderBottomColor: C.line },
  tipBullet:      { color: C.gold, fontSize: 16, lineHeight: 20 },
  tipText:        { flex: 1, color: C.ink, fontSize: 13, fontFamily: T.sans, lineHeight: 19 },
  // Concierge prompts
  conciergeHint:  { color: C.mut, fontSize: 12, fontFamily: T.sans, marginBottom: 10 },
  conciergePrompt:{ backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.gold + "30", marginBottom: 8, flexDirection: "row", alignItems: "center" },
  conciergePromptT:{ flex: 1, color: C.ink, fontSize: 13, fontFamily: T.sans, lineHeight: 19 },
  conciergeArrow: { color: C.gold, fontSize: 18, marginLeft: 8 },
});
