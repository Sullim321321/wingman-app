import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Linking,
  ActivityIndicator, Share,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { req } from "../api";
import { C as _C, T } from "../theme";

// Extend shared theme with screen-specific aliases
const C = {
  ..._C,
  border: _C.line,   // hairline border
  text:   _C.ink,    // primary text
  green:  _C.teal,   // on-time / positive
  red:    _C.coral,  // alert / negative
};

const TYPE_ICON = {
  train: "🚆", metro: "🚇", tube: "🚇", subway: "🚇",
  bus: "🚌", taxi: "🚕", rideshare: "📱", ferry: "⛴️",
};

const TYPE_COLOR = {
  train: C.teal, metro: C.teal, tube: C.teal, subway: C.teal,
  bus: "#4F8EF7", taxi: C.amber, rideshare: C.gold,
};

const COMPLEXITY_LABEL = { easy: "Easy", moderate: "Moderate", complex: "Complex" };
const COMPLEXITY_COLOR = { easy: C.green, moderate: C.amber, complex: C.red };

export default function GroundTransportScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { iata, city, destination, tripId } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [directionsLoading, setDirectionsLoading] = useState(null);
  const [directions, setDirections] = useState({});

  useEffect(() => {
    loadTransport();
  }, [iata]);

  async function loadTransport() {
    setLoading(true);
    setError(null);
    try {
      const params = destination ? `?destination=${encodeURIComponent(destination)}` : "";
      const result = await req(`/airports/${iata}/ground-transport${params}`);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDirections(optionId) {
    if (directions[optionId]) {
      setExpanded(expanded === optionId ? null : optionId);
      return;
    }
    setDirectionsLoading(optionId);
    try {
      const result = await req(`/airports/${iata}/ground-transport/${optionId}/directions`);
      setDirections(prev => ({ ...prev, [optionId]: result }));
      setExpanded(optionId);
    } catch (e) {
      console.warn("Directions load failed:", e.message);
    } finally {
      setDirectionsLoading(null);
    }
  }

  function formatPrice(opt) {
    const currency = data?.local_currency || "USD";
    const symbols = { USD: "$", GBP: "£", EUR: "€", JPY: "¥", AED: "د.إ", SGD: "S$", AUD: "A$", CAD: "C$" };
    const sym = symbols[currency] || currency + " ";
    if (!opt.price_from) return "Varies";
    if (opt.price_from === opt.price_to || !opt.price_to) return `${sym}${opt.price_from}`;
    return `${sym}${opt.price_from}–${sym}${opt.price_to}`;
  }

  function formatDuration(min) {
    if (!min) return "Varies";
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={C.gold} size="large" />
        <Text style={[s.mut, { marginTop: 16 }]}>Loading transport options for {iata}…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center", padding: 32 }]}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>✈️</Text>
        <Text style={s.mut}>Couldn't load transport options.</Text>
        <Pressable style={s.retryBtn} onPress={loadTransport}>
          <Text style={s.retryBtnT}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnT}>‹</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{iata} Ground Transport</Text>
          {data?.city && <Text style={s.headerSub}>{data.city}{data.country ? `, ${data.country}` : ""}</Text>}
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Destination context */}
        {destination && (
          <View style={s.destinationBanner}>
            <Text style={s.destinationBannerT}>📍 Heading to: {destination}</Text>
          </View>
        )}

        {/* AI Recommendation */}
        {data?.recommendation && (
          <View style={s.recommendCard}>
            <Text style={s.recommendLabel}>✦ WINGMAN RECOMMENDS</Text>
            <Text style={s.recommendText}>{data.recommendation}</Text>
          </View>
        )}

        {/* Data source note */}
        {data?.data_source === "generic" && (
          <View style={s.genericNote}>
            <Text style={s.genericNoteT}>ℹ️ Showing general transport options — detailed local data for {iata} coming soon.</Text>
          </View>
        )}

        {/* Transport options */}
        <Text style={s.sectionLabel}>ALL OPTIONS</Text>
        {(data?.options || []).map((opt, i) => (
          <View key={opt.id} style={s.optionCard}>
            {/* Option header */}
            <View style={s.optionHeader}>
              <View style={[s.typeTag, { backgroundColor: (TYPE_COLOR[opt.type] || C.mut) + "22" }]}>
                <Text style={s.typeIcon}>{TYPE_ICON[opt.type] || "🚌"}</Text>
                <Text style={[s.typeLabel, { color: TYPE_COLOR[opt.type] || C.mut }]}>
                  {opt.type.toUpperCase()}
                </Text>
              </View>
              {i === 0 && <View style={s.bestBadge}><Text style={s.bestBadgeT}>BEST</Text></View>}
              <View style={[s.complexityBadge, { backgroundColor: (COMPLEXITY_COLOR[opt.complexity] || C.mut) + "22" }]}>
                <Text style={[s.complexityT, { color: COMPLEXITY_COLOR[opt.complexity] || C.mut }]}>
                  {COMPLEXITY_LABEL[opt.complexity] || opt.complexity}
                </Text>
              </View>
            </View>

            {/* Option name and description */}
            <Text style={s.optionName}>{opt.name}</Text>
            <Text style={s.optionDesc}>{opt.description}</Text>

            {/* Key stats */}
            <View style={s.statsRow}>
              <View style={s.stat}>
                <Text style={s.statLabel}>PRICE</Text>
                <Text style={s.statValue}>{formatPrice(opt)}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.stat}>
                <Text style={s.statLabel}>TIME</Text>
                <Text style={s.statValue}>{formatDuration(opt.duration_min)}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.stat}>
                <Text style={s.statLabel}>HOURS</Text>
                <Text style={s.statValue}>{opt.hours || "24h"}</Text>
              </View>
              {opt.frequency_min > 0 && (
                <>
                  <View style={s.statDivider} />
                  <View style={s.stat}>
                    <Text style={s.statLabel}>EVERY</Text>
                    <Text style={s.statValue}>{opt.frequency_min}m</Text>
                  </View>
                </>
              )}
            </View>

            {/* Tip */}
            {opt.tip && (
              <View style={s.tipRow}>
                <Text style={s.tipIcon}>💡</Text>
                <Text style={s.tipText}>{opt.tip}</Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={s.optionActions}>
              <Pressable
                style={s.directionsBtn}
                onPress={() => loadDirections(opt.id)}
              >
                {directionsLoading === opt.id
                  ? <ActivityIndicator color={C.gold} size="small" />
                  : <Text style={s.directionsBtnT}>
                      {expanded === opt.id ? "▲ Hide steps" : "▼ Step-by-step"}
                    </Text>
                }
              </Pressable>
              {opt.ticket_url && (
                <Pressable
                  style={s.ticketBtn}
                  onPress={() => Linking.openURL(opt.ticket_url)}
                >
                  <Text style={s.ticketBtnT}>🎟 Buy ticket</Text>
                </Pressable>
              )}
              {opt.map_url && (
                <Pressable
                  style={s.mapBtn}
                  onPress={() => Linking.openURL(opt.map_url)}
                >
                  <Text style={s.mapBtnT}>🗺 Map</Text>
                </Pressable>
              )}
            </View>

            {/* Expanded step-by-step directions */}
            {expanded === opt.id && directions[opt.id] && (
              <View style={s.stepsContainer}>
                <View style={s.stepsDivider} />
                {(directions[opt.id].steps || []).map((step, si) => (
                  <View key={si} style={s.stepRow}>
                    <View style={s.stepNum}>
                      <Text style={s.stepNumT}>{si + 1}</Text>
                    </View>
                    <Text style={s.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Ask Concierge CTA */}
        <Pressable
          style={s.conciergeCta}
          onPress={() => navigation.navigate("Concierge", {
            prefill: `I just landed at ${iata}${destination ? ` and I'm heading to ${destination}` : ""}. What's the best way to get there and what should I know?`,
            tripId,
          })}
        >
          <Text style={s.conciergeCtaT}>✦ Ask Wingman for local advice</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },

  // Header
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 0, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  backBtnT: { color: C.gold, fontSize: 28, lineHeight: 32 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: C.text, fontSize: 17, fontFamily: T.sansB },
  headerSub: { color: C.mut, fontSize: 13, marginTop: 2 },

  // Destination banner
  destinationBanner: { margin: 16, marginBottom: 0, backgroundColor: C.card2, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border },
  destinationBannerT: { color: C.text, fontSize: 14 },

  // Recommendation card
  recommendCard: { margin: 16, marginBottom: 8, backgroundColor: "rgba(201,169,110,0.08)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(201,169,110,0.3)" },
  recommendLabel: { color: C.gold, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1, marginBottom: 8 },
  recommendText: { color: C.text, fontSize: 14, lineHeight: 21 },

  // Generic note
  genericNote: { marginHorizontal: 16, marginBottom: 8, backgroundColor: C.card2, borderRadius: 10, padding: 12 },
  genericNoteT: { color: C.mut, fontSize: 13, lineHeight: 19 },

  // Section label
  sectionLabel: { color: C.mut, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1.5, marginHorizontal: 20, marginTop: 16, marginBottom: 8 },

  // Option card
  optionCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  optionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  typeTag: { flexDirection: "row", alignItems: "center", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  typeIcon: { fontSize: 14 },
  typeLabel: { fontSize: 11, fontFamily: T.sansB, letterSpacing: 0.5 },
  bestBadge: { backgroundColor: "rgba(201,169,110,0.2)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  bestBadgeT: { color: C.gold, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1 },
  complexityBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  complexityT: { fontSize: 10, fontFamily: T.sansB, letterSpacing: 0.5 },

  optionName: { color: C.text, fontSize: 16, fontFamily: T.sansB, marginBottom: 4 },
  optionDesc: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 12 },

  // Stats row
  statsRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.card2, borderRadius: 10, padding: 12, marginBottom: 12 },
  stat: { flex: 1, alignItems: "center" },
  statLabel: { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 0.8, marginBottom: 3 },
  statValue: { color: C.text, fontSize: 14, fontFamily: T.sansB },
  statDivider: { width: 1, height: 28, backgroundColor: C.border },

  // Tip
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12, backgroundColor: "rgba(255,193,7,0.06)", borderRadius: 8, padding: 10 },
  tipIcon: { fontSize: 14, marginTop: 1 },
  tipText: { flex: 1, color: "#FFC107", fontSize: 13, lineHeight: 19 },

  // Action buttons
  optionActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  directionsBtn: { backgroundColor: C.card2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  directionsBtnT: { color: C.gold, fontSize: 13, fontFamily: T.sansM },
  ticketBtn: { backgroundColor: "rgba(78,205,196,0.1)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(78,205,196,0.3)" },
  ticketBtnT: { color: C.teal, fontSize: 13, fontFamily: T.sansM },
  mapBtn: { backgroundColor: C.card2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  mapBtnT: { color: C.text, fontSize: 13, fontFamily: T.sansM },

  // Steps
  stepsContainer: { marginTop: 12 },
  stepsDivider: { height: 1, backgroundColor: C.border, marginBottom: 12 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.gold, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  stepNumT: { color: C.inkD, fontSize: 12, fontFamily: T.sansB },
  stepText: { flex: 1, color: C.text, fontSize: 14, lineHeight: 20 },

  // Concierge CTA
  conciergeCta: { margin: 16, backgroundColor: "rgba(201,169,110,0.1)", borderRadius: 14, padding: 18, alignItems: "center", borderWidth: 1, borderColor: "rgba(201,169,110,0.3)" },
  conciergeCtaT: { color: C.gold, fontSize: 15, fontFamily: T.sansB },

  // Misc
  mut: { color: C.mut, fontSize: 14 },
  retryBtn: { marginTop: 16, backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnT: { color: C.gold, fontSize: 15, fontFamily: T.sansM },
});
