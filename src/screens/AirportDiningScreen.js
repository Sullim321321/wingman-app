import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAirportDining } from "../api";
import { C as _C, T } from "../theme";

// Extend shared theme with screen-specific aliases
const C = {
  ..._C,
  border: _C.line,   // hairline border
  text:   _C.ink,    // primary text
  green:  _C.teal,   // on-time / positive
  red:    _C.coral,  // alert / negative
};

const DIETARY_FILTERS = [
  { key: "all",         label: "All",           emoji: "◈" },
  { key: "vegetarian",  label: "Vegetarian",    emoji: "🥗" },
  { key: "vegan",       label: "Vegan",         emoji: "🌱" },
  { key: "halal",       label: "Halal",         emoji: "☪️" },
  { key: "kosher",      label: "Kosher",        emoji: "✡️" },
  { key: "gluten-free", label: "Gluten-Free",   emoji: "🌾" },
  { key: "bar",         label: "Bar / Drinks",  emoji: "🍷" },
];

const PRICE_COLOR = { "$": C.green, "$$": C.amber, "$$$": C.gold };

export default function AirportDiningScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { iata = "JFK", terminal = null, flightInfo = null } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeTerminal, setActiveTerminal] = useState(terminal || "all");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getAirportDining(iata, activeTerminal !== "all" ? activeTerminal : null);
      setData(res);
    } catch (e) {
      setError(e.message || "Could not load dining options");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [iata, activeTerminal]);

  useEffect(() => { load(); }, [load]);

  const filteredPicks = (data?.picks || []).filter(pick => {
    if (activeFilter === "all") return true;
    if (activeFilter === "bar") {
      return (pick.cuisine || "").toLowerCase().includes("bar") ||
             (pick.best_for || "").toLowerCase().includes("drink") ||
             (pick.cuisine || "").toLowerCase().includes("lounge");
    }
    const tags = (pick.dietary_tags || []).map(t => t.toLowerCase());
    return tags.some(t => t.includes(activeFilter));
  });

  const terminals = data ? ["all", ...new Set((data.picks || []).map(p => p.terminal).filter(Boolean))] : ["all"];

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnT}>‹</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{iata} Dining</Text>
          {flightInfo && (
            <Text style={s.headerSub}>{flightInfo}</Text>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.gold} />}
      >
        {/* Overview banner */}
        {data?.terminal_overview && (
          <View style={s.overviewBanner}>
            <Text style={s.overviewLabel}>AIRPORT DINING INTEL</Text>
            <Text style={s.overviewText}>{data.terminal_overview}</Text>
            {data.food_prefs?.length > 0 && (
              <View style={s.prefRow}>
                <Text style={s.prefLabel}>Your preferences: </Text>
                <Text style={s.prefValue}>{data.food_prefs.join(" · ")}</Text>
              </View>
            )}
          </View>
        )}

        {/* Terminal filter chips */}
        {terminals.length > 2 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.terminalScroll} contentContainerStyle={s.terminalRow}>
            {terminals.map(t => (
              <Pressable
                key={t}
                style={[s.terminalChip, activeTerminal === t && s.terminalChipActive]}
                onPress={() => setActiveTerminal(t)}
              >
                <Text style={[s.terminalChipT, activeTerminal === t && s.terminalChipTActive]}>
                  {t === "all" ? "All Terminals" : `Terminal ${t}`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Dietary filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterRow}>
          {DIETARY_FILTERS.map(f => (
            <Pressable
              key={f.key}
              style={[s.filterChip, activeFilter === f.key && s.filterChipActive]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text style={s.filterEmoji}>{f.emoji}</Text>
              <Text style={[s.filterLabel, activeFilter === f.key && s.filterLabelActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Loading */}
        {loading && (
          <View style={s.center}>
            <ActivityIndicator color={C.gold} size="large" />
            <Text style={s.loadingText}>Finding the best spots at {iata}…</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <View style={s.center}>
            <Text style={s.errorIcon}>◈</Text>
            <Text style={s.errorText}>{error}</Text>
            <Pressable style={s.retryBtn} onPress={() => load()}>
              <Text style={s.retryBtnT}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {/* Empty filtered state */}
        {!loading && !error && filteredPicks.length === 0 && (
          <View style={s.center}>
            <Text style={s.errorIcon}>🔍</Text>
            <Text style={s.errorText}>No {activeFilter !== "all" ? activeFilter : ""} options found{activeTerminal !== "all" ? ` in Terminal ${activeTerminal}` : ""}.</Text>
            <Pressable style={s.retryBtn} onPress={() => { setActiveFilter("all"); setActiveTerminal("all"); }}>
              <Text style={s.retryBtnT}>Clear Filters</Text>
            </Pressable>
          </View>
        )}

        {/* Dining picks */}
        {!loading && !error && filteredPicks.map((pick, i) => (
          <View key={i} style={s.pickCard}>
            {/* Card header */}
            <View style={s.pickHeader}>
              <View style={s.pickMeta}>
                <View style={s.pickBadgeRow}>
                  {pick.terminal && (
                    <View style={s.terminalBadge}>
                      <Text style={s.terminalBadgeT}>T{pick.terminal}</Text>
                    </View>
                  )}
                  {pick.gate_area && (
                    <View style={s.gateBadge}>
                      <Text style={s.gateBadgeT}>{pick.gate_area}</Text>
                    </View>
                  )}
                  {pick.price_range && (
                    <View style={[s.priceBadge, { backgroundColor: (PRICE_COLOR[pick.price_range] || C.mut) + "22" }]}>
                      <Text style={[s.priceBadgeT, { color: PRICE_COLOR[pick.price_range] || C.mut }]}>{pick.price_range}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.pickName}>{pick.name}</Text>
                <Text style={s.pickCuisine}>{pick.cuisine}</Text>
              </View>
            </View>

            {/* Best for */}
            {pick.best_for && (
              <View style={s.bestForRow}>
                <Text style={s.bestForLabel}>BEST FOR  </Text>
                <Text style={s.bestForValue}>{pick.best_for}</Text>
              </View>
            )}

            {/* Must order */}
            {pick.must_order && (
              <View style={s.mustOrderRow}>
                <Text style={s.mustOrderIcon}>⭐</Text>
                <Text style={s.mustOrderText}>Must order: <Text style={s.mustOrderHighlight}>{pick.must_order}</Text></Text>
              </View>
            )}

            {/* Dietary tags */}
            {pick.dietary_tags?.length > 0 && (
              <View style={s.tagsRow}>
                {pick.dietary_tags.map((tag, ti) => (
                  <View key={ti} style={s.tag}>
                    <Text style={s.tagT}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Hours + tip */}
            <View style={s.pickFooter}>
              {pick.hours && (
                <View style={s.hoursRow}>
                  <Text style={s.hoursIcon}>🕐</Text>
                  <Text style={s.hoursText}>{pick.hours}</Text>
                </View>
              )}
              {pick.tip && (
                <View style={s.tipRow}>
                  <Text style={s.tipIcon}>💡</Text>
                  <Text style={s.tipText}>{pick.tip}</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        {/* Wingman tip */}
        {!loading && !error && filteredPicks.length > 0 && (
          <View style={s.wingmanTip}>
            <Text style={s.wingmanTipLabel}>WINGMAN TIP</Text>
            <Text style={s.wingmanTipText}>
              Arrive at your gate first, then backtrack to eat — most airport dining is pre-security or near the main terminal hub.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  // Header
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 0, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  backBtnT: { color: C.gold, fontSize: 28, lineHeight: 32 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: C.ink, fontSize: 11, fontFamily: T.sansB, letterSpacing: 2, textTransform: "uppercase" },
  headerSub: { color: C.mut, fontSize: 13, marginTop: 2 },
  // Overview
  overviewBanner: { margin: 16, backgroundColor: "rgba(201,169,110,0.08)", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "rgba(201,169,110,0.25)" },
  overviewLabel: { color: C.mutD, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 8 },
  overviewText: { color: C.ink, fontSize: 14, lineHeight: 21 },
  prefRow: { flexDirection: "row", marginTop: 10, flexWrap: "wrap" },
  prefLabel: { color: C.mut, fontSize: 12 },
  prefValue: { color: C.teal, fontSize: 12, fontFamily: T.sansM },
  // Terminal chips
  terminalScroll: { marginBottom: 4 },
  terminalRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  terminalChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  terminalChipActive: { backgroundColor: "rgba(201,169,110,0.15)", borderColor: C.gold },
  terminalChipT: { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  terminalChipTActive: { color: C.gold },
  // Dietary filter chips
  filterScroll: { marginBottom: 8 },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  filterChipActive: { backgroundColor: "rgba(78,205,196,0.12)", borderColor: C.teal },
  filterEmoji: { fontSize: 14 },
  filterLabel: { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  filterLabelActive: { color: C.teal },
  // Loading / error
  center: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  loadingText: { color: C.mut, fontSize: 14, marginTop: 16, textAlign: "center" },
  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorText: { color: C.mut, fontSize: 15, textAlign: "center", lineHeight: 22 },
  retryBtn: { marginTop: 20, backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnT: { color: C.gold, fontSize: 15, fontFamily: T.sansM },
  // Pick card
  pickCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line },
  pickHeader: { marginBottom: 10 },
  pickMeta: { flex: 1 },
  pickBadgeRow: { flexDirection: "row", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  terminalBadge: { backgroundColor: "rgba(201,169,110,0.15)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  terminalBadgeT: { color: C.gold, fontSize: 11, fontFamily: T.sansB },
  gateBadge: { backgroundColor: C.card2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  gateBadgeT: { color: C.mut, fontSize: 11 },
  priceBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  priceBadgeT: { fontSize: 11, fontFamily: T.sansB },
  pickName: { color: C.ink, fontSize: 17, fontFamily: T.sansB, marginBottom: 3 },
  pickCuisine: { color: C.mut, fontSize: 13 },
  // Best for
  bestForRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, backgroundColor: C.card2, borderRadius: 8, padding: 10 },
  bestForLabel: { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1 },
  bestForValue: { color: C.ink, fontSize: 13, flex: 1 },
  // Must order
  mustOrderRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  mustOrderIcon: { fontSize: 14, marginTop: 1 },
  mustOrderText: { color: C.mut, fontSize: 13, flex: 1, lineHeight: 19 },
  mustOrderHighlight: { color: C.ink, fontFamily: T.sansM },
  // Tags
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tag: { backgroundColor: "rgba(78,205,196,0.1)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(78,205,196,0.25)" },
  tagT: { color: C.teal, fontSize: 11, fontFamily: T.sansM },
  // Footer
  pickFooter: { gap: 6 },
  hoursRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hoursIcon: { fontSize: 12 },
  hoursText: { color: C.mut, fontSize: 12 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "rgba(255,193,7,0.06)", borderRadius: 8, padding: 8 },
  tipIcon: { fontSize: 12, marginTop: 1 },
  tipText: { color: "#FFC107", fontSize: 12, lineHeight: 18, flex: 1 },
  // Wingman tip
  wingmanTip: { marginHorizontal: 16, marginTop: 4, marginBottom: 8, backgroundColor: "rgba(201,169,110,0.06)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)" },
  wingmanTipLabel: { color: C.mutD, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 6 },
  wingmanTipText: { color: C.mut, fontSize: 13, lineHeight: 19 },
});
