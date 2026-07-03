import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, Linking,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAirportNavigation } from "../api";
import { C as _C, T } from "../theme";

// Extend shared theme with screen-specific aliases
const C = {
  ..._C,
  border: _C.line,   // hairline border
  text:   _C.ink,    // primary text
  green:  _C.teal,   // on-time / positive
  red:    _C.coral,  // alert / negative
};

const LOUNGE_ACCESS_COLOR = {
  "first class": C.gold,
  "business class": "#B8A0D0",
  "priority pass": C.teal,
  "paid access": C.mut,
  "elite": C.amber,
};

function getLoungeColor(access) {
  const al = access.toLowerCase();
  for (const [key, color] of Object.entries(LOUNGE_ACCESS_COLOR)) {
    if (al.includes(key)) return color;
  }
  return C.mut;
}

export default function AirportNavigationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { iata = "JFK", gate = null, flightInfo = null } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview"); // overview | lounges | transport

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getAirportNavigation(iata, gate);
      setData(res);
    } catch (e) {
      setError(e.message || "Could not load airport navigation");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [iata, gate]);

  useEffect(() => { load(); }, [load]);

  const openMaps = () => {
    const query = encodeURIComponent(`${iata} airport terminal map`);
    Linking.openURL(`https://maps.apple.com/?q=${query}`);
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnT}>‹</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{iata} Navigation</Text>
          {flightInfo ? (
            <Text style={s.headerSub}>{flightInfo}</Text>
          ) : gate ? (
            <Text style={s.headerSub}>Gate {gate}</Text>
          ) : null}
        </View>
        <Pressable style={s.mapBtn} onPress={openMaps}>
          <Text style={s.mapBtnT}>↗</Text>
        </Pressable>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {[
          { key: "overview",  label: "Overview" },
          { key: "lounges",   label: "Lounges" },
          { key: "transport", label: "Transport" },
        ].map(tab => (
          <Pressable
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[s.tabT, activeTab === tab.key && s.tabTActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.gold} />}
      >
        {/* Loading */}
        {loading && (
          <View style={s.center}>
            <ActivityIndicator color={C.gold} size="large" />
            <Text style={s.loadingText}>Loading {iata} airport intel…</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <View style={s.center}>
            <Text style={s.errorIcon}>✦</Text>
            <Text style={s.errorText}>{error}</Text>
            <Pressable style={s.retryBtn} onPress={() => load()}>
              <Text style={s.retryBtnT}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {/* OVERVIEW TAB */}
        {!loading && !error && data && activeTab === "overview" && (
          <>
            {/* Gate walk time */}
            <View style={s.statsBanner}>
              <View style={s.statItem}>
                <Text style={s.statValue}>{data.gate_walk_avg_min ?? "—"}</Text>
                <Text style={s.statLabel}>MIN AVG GATE WALK</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{data.terminals?.length ?? "—"}</Text>
                <Text style={s.statLabel}>TERMINALS</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{data.accessible_lounges?.length ?? 0}</Text>
                <Text style={s.statLabel}>YOUR LOUNGES</Text>
              </View>
            </View>

            {/* Gate info */}
            {gate && (
              <View style={s.gateCard}>
                <Text style={s.sectionLabel}>YOUR GATE</Text>
                <View style={s.gateDisplay}>
                  <Text style={s.gateNumber}>{gate}</Text>
                  <View style={s.gateInfo}>
                    <Text style={s.gateInfoText}>Allow {data.gate_walk_avg_min ?? 10}+ min from security</Text>
                    <Text style={s.gateInfoSub}>Check departure board for any gate changes</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Terminals */}
            {data.terminals?.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>TERMINALS</Text>
                <View style={s.terminalGrid}>
                  {data.terminals.map((t, i) => (
                    <View key={i} style={s.terminalBox}>
                      <Text style={s.terminalBoxT}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Security tips */}
            {data.security_tips && (
              <View style={s.securityCard}>
                <Text style={s.sectionLabel}>SECURITY</Text>
                <View style={s.tipRow}>
                  <Text style={s.tipIcon}>🛡️</Text>
                  <Text style={s.tipText}>{data.security_tips}</Text>
                </View>
              </View>
            )}

            {/* Quick actions */}
            <View style={s.actionsRow}>
              <Pressable style={s.actionBtn} onPress={() => setActiveTab("lounges")}>
                <Text style={s.actionIcon}>🛋️</Text>
                <Text style={s.actionLabel}>Lounges</Text>
              </Pressable>
              <Pressable style={s.actionBtn} onPress={() => setActiveTab("transport")}>
                <Text style={s.actionIcon}>🚆</Text>
                <Text style={s.actionLabel}>Transport</Text>
              </Pressable>
              <Pressable style={s.actionBtn} onPress={openMaps}>
                <Text style={s.actionIcon}>↗</Text>
                <Text style={s.actionLabel}>Map</Text>
              </Pressable>
              <Pressable
                style={s.actionBtn}
                onPress={() => navigation.navigate("AirportDining", { iata, flightInfo })}
              >
                <Text style={s.actionIcon}>◈</Text>
                <Text style={s.actionLabel}>Dining</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* LOUNGES TAB */}
        {!loading && !error && data && activeTab === "lounges" && (
          <>
            {/* Accessible lounges (user qualifies) */}
            {data.accessible_lounges?.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeaderRow}>
                  <Text style={s.sectionLabel}>YOU HAVE ACCESS</Text>
                  <View style={s.accessBadge}>
                    <Text style={s.accessBadgeT}>{data.accessible_lounges.length} lounge{data.accessible_lounges.length !== 1 ? "s" : ""}</Text>
                  </View>
                </View>
                {data.accessible_lounges.map((lounge, i) => (
                  <LoungeCard key={i} lounge={lounge} highlighted />
                ))}
              </View>
            )}

            {/* All lounges */}
            {data.lounges?.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>ALL LOUNGES AT {iata}</Text>
                {data.lounges.map((lounge, i) => (
                  <LoungeCard key={i} lounge={lounge} />
                ))}
              </View>
            )}

            {!data.lounges?.length && (
              <View style={s.center}>
                <Text style={s.errorIcon}>🛋️</Text>
                <Text style={s.errorText}>No lounge data available for {iata}.</Text>
              </View>
            )}

            {/* Priority Pass tip */}
            <View style={s.wingmanTip}>
              <Text style={s.wingmanTipLabel}>WINGMAN TIP</Text>
              <Text style={s.wingmanTipText}>
                Priority Pass gives access to 1,400+ lounges worldwide. Many credit cards (Amex Platinum, Chase Sapphire Reserve) include it free.
              </Text>
            </View>
          </>
        )}

        {/* TRANSPORT TAB */}
        {!loading && !error && data && activeTab === "transport" && (
          <>
            {/* AirTrain */}
            {data.airtrain && (
              <View style={s.transportCard}>
                <View style={s.transportHeader}>
                  <Text style={s.transportIcon}>🚆</Text>
                  <View style={s.transportMeta}>
                    <Text style={s.transportName}>AirTrain / Rail Link</Text>
                    <View style={s.transportBadge}>
                      <Text style={s.transportBadgeT}>AVAILABLE</Text>
                    </View>
                  </View>
                </View>
                {data.airtrain_tip && (
                  <View style={s.tipRow}>
                    <Text style={s.tipIcon}>💡</Text>
                    <Text style={s.tipText}>{data.airtrain_tip}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Inter-terminal bus */}
            {data.inter_terminal_bus && (
              <View style={s.transportCard}>
                <View style={s.transportHeader}>
                  <Text style={s.transportIcon}>≡</Text>
                  <View style={s.transportMeta}>
                    <Text style={s.transportName}>Inter-Terminal Bus</Text>
                    <View style={[s.transportBadge, { backgroundColor: "rgba(78,205,196,0.15)" }]}>
                      <Text style={[s.transportBadgeT, { color: C.teal }]}>FREE</Text>
                    </View>
                  </View>
                </View>
                {data.inter_terminal_tip && (
                  <View style={s.tipRow}>
                    <Text style={s.tipIcon}>💡</Text>
                    <Text style={s.tipText}>{data.inter_terminal_tip}</Text>
                  </View>
                )}
              </View>
            )}

            {/* No transport data */}
            {!data.airtrain && !data.inter_terminal_bus && (
              <View style={s.center}>
                <Text style={s.errorIcon}>≡</Text>
                <Text style={s.errorText}>Check your airline's app for the latest terminal shuttle information.</Text>
              </View>
            )}

            {/* City transport CTA */}
            <Pressable
              style={s.cityTransportCta}
              onPress={() => navigation.navigate("GroundTransport", { iata })}
            >
              <Text style={s.cityTransportCtaIcon}>🏙️</Text>
              <View style={s.cityTransportCtaMeta}>
                <Text style={s.cityTransportCtaTitle}>Getting to the City</Text>
                <Text style={s.cityTransportCtaSub}>Taxis, trains, rideshare & more →</Text>
              </View>
            </Pressable>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function LoungeCard({ lounge, highlighted }) {
  return (
    <View style={[s.loungeCard, highlighted && s.loungeCardHighlighted]}>
      <View style={s.loungeHeader}>
        <Text style={s.loungeName}>{lounge.name}</Text>
        {lounge.terminal && (
          <View style={s.loungeterminalBadge}>
            <Text style={s.loungeTerminalT}>T{lounge.terminal}</Text>
          </View>
        )}
      </View>
      {lounge.hours && (
        <View style={s.loungeHoursRow}>
          <Text style={s.loungeHoursIcon}>🕐</Text>
          <Text style={s.loungeHoursText}>{lounge.hours}</Text>
        </View>
      )}
      <View style={s.loungeAccessRow}>
        {(lounge.access || []).map((a, i) => (
          <View key={i} style={[s.loungeAccessTag, { backgroundColor: getLoungeColor(a) + "22", borderColor: getLoungeColor(a) + "55" }]}>
            <Text style={[s.loungeAccessTagT, { color: getLoungeColor(a) }]}>{a}</Text>
          </View>
        ))}
      </View>
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
  mapBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  mapBtnT: { fontSize: 20 },
  // Tab bar
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.gold },
  tabT: { color: C.mut, fontSize: 14, fontFamily: T.sansM },
  tabTActive: { color: C.gold },
  // Loading / error
  center: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  loadingText: { color: C.mut, fontSize: 14, marginTop: 16, textAlign: "center" },
  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorText: { color: C.mut, fontSize: 15, textAlign: "center", lineHeight: 22 },
  retryBtn: { marginTop: 20, backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnT: { color: C.gold, fontSize: 15, fontFamily: T.sansM },
  // Stats banner
  statsBanner: { flexDirection: "row", margin: 16, backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.line },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { color: C.gold, fontSize: 28, fontFamily: T.sansB },
  statLabel: { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 0.8, marginTop: 4, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: C.line },
  // Gate card
  gateCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "rgba(201,169,110,0.08)", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "rgba(201,169,110,0.3)" },
  gateDisplay: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  gateNumber: { color: C.gold, fontSize: 48, fontFamily: T.sansB, lineHeight: 56 },
  gateInfo: { flex: 1 },
  gateInfoText: { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  gateInfoSub: { color: C.mut, fontSize: 12, marginTop: 4 },
  // Section
  section: { marginBottom: 8 },
  sectionLabel: { color: C.mut, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1.5, marginHorizontal: 20, marginTop: 16, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 16, marginBottom: 10 },
  accessBadge: { marginLeft: 8, backgroundColor: "rgba(76,175,80,0.15)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  accessBadgeT: { color: C.green, fontSize: 11, fontFamily: T.sansB },
  // Terminal grid
  terminalGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8 },
  terminalBox: { backgroundColor: C.card2, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: C.line },
  terminalBoxT: { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  // Security
  securityCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.line },
  // Tips
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(255,193,7,0.06)", borderRadius: 8, padding: 10, marginTop: 8 },
  tipIcon: { fontSize: 14, marginTop: 1 },
  tipText: { flex: 1, color: "#FFC107", fontSize: 13, lineHeight: 19 },
  // Quick actions
  actionsRow: { flexDirection: "row", marginHorizontal: 16, marginTop: 8, marginBottom: 12, gap: 10 },
  actionBtn: { flex: 1, backgroundColor: C.card, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: C.line },
  actionIcon: { fontSize: 22, marginBottom: 4 },
  actionLabel: { color: C.mut, fontSize: 11, fontFamily: T.sansM },
  // Lounge card
  loungeCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line },
  loungeCardHighlighted: { backgroundColor: "rgba(201,169,110,0.06)", borderColor: "rgba(201,169,110,0.3)" },
  loungeHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  loungeName: { color: C.ink, fontSize: 15, fontFamily: T.sansB, flex: 1, marginRight: 8 },
  loungeterminalBadge: { backgroundColor: "rgba(201,169,110,0.15)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  loungeTerminalT: { color: C.gold, fontSize: 11, fontFamily: T.sansB },
  loungeHoursRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  loungeHoursIcon: { fontSize: 12 },
  loungeHoursText: { color: C.mut, fontSize: 12 },
  loungeAccessRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  loungeAccessTag: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  loungeAccessTagT: { fontSize: 11, fontFamily: T.sansM },
  // Transport card
  transportCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.line },
  transportHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  transportIcon: { fontSize: 28 },
  transportMeta: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  transportName: { color: C.ink, fontSize: 16, fontFamily: T.sansB },
  transportBadge: { backgroundColor: "rgba(201,169,110,0.15)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  transportBadgeT: { color: C.gold, fontSize: 11, fontFamily: T.sansB },
  // City transport CTA
  cityTransportCta: { marginHorizontal: 16, marginTop: 8, marginBottom: 12, backgroundColor: C.card2, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: C.line },
  cityTransportCtaIcon: { fontSize: 32 },
  cityTransportCtaMeta: { flex: 1 },
  cityTransportCtaTitle: { color: C.ink, fontSize: 16, fontFamily: T.sansB },
  cityTransportCtaSub: { color: C.gold, fontSize: 13, marginTop: 2 },
  // Wingman tip
  wingmanTip: { marginHorizontal: 16, marginTop: 4, marginBottom: 8, backgroundColor: "rgba(201,169,110,0.06)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)" },
  wingmanTipLabel: { color: C.gold, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 6 },
  wingmanTipText: { color: C.mut, fontSize: 13, lineHeight: 19 },
});
