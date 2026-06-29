// WingmanPointsScreen — gamification hub
// Tier progress bar, balance, earn history, action checklist
import React, { useState, useCallback } from "react";
import {
  SafeAreaView, View, Text, ScrollView, Pressable,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { C, T } from "../theme";
import { SerifText } from "../components";
import { getPoints } from "../api";

const TIER_COLORS = {
  explorer:  { bg: C.card,   accent: C.mut,  label: "EXPLORER"  },
  flyer:     { bg: "#1A1F2E", accent: "#5B8CFF", label: "FLYER"  },
  navigator: { bg: "#1E1A10", accent: C.gold,   label: "NAVIGATOR" },
  elite:     { bg: "#1A0F0A", accent: "#FF9F43", label: "ELITE"    },
};

const EARN_ACTIONS = [
  { action: "signup",            pts: 200, label: "Join Wingman",              icon: "✦" },
  { action: "gmail_connected",   pts: 300, label: "Connect Gmail",             icon: "✉" },
  { action: "trip_added",        pts: 100, label: "Add your first trip",       icon: "✈" },
  { action: "profile_complete",  pts: 150, label: "Complete your profile",     icon: "◎" },
  { action: "push_enabled",      pts: 100, label: "Enable push notifications", icon: "🔔" },
  { action: "concierge_first",   pts: 50,  label: "Ask Wingman anything",      icon: "◆" },
  { action: "loyalty_connected", pts: 150, label: "Connect a loyalty account", icon: "★" },
  { action: "trip_completed",    pts: 75,  label: "Complete a trip",           icon: "✓" },
  { action: "gmail_trip_import", pts: 125, label: "Import a trip from Gmail",  icon: "⟳" },
];

const TIER_PERKS = {
  explorer:  ["Live flight tracking", "Disruption alerts", "AI concierge"],
  flyer:     ["Priority disruption alerts", "Seat upgrade tips", "Lounge finder"],
  navigator: ["Autonomous rebooking", "Hotel pre-arrival preferences", "Fare drop alerts"],
  elite:     ["White-glove rescue", "Points transfer advice", "Dedicated concierge mode"],
};

export default function WingmanPointsScreen({ navigation }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    getPoints()
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []));

  if (loading) {
    return (
      <SafeAreaView style={s.app}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.gold} />
        </View>
      </SafeAreaView>
    );
  }

  const balance    = data?.balance || 0;
  const tier       = data?.tier    || "explorer";
  const nextTier   = data?.next_tier;
  const toNext     = data?.points_to_next || 0;
  const pct        = data?.progress_pct || 0;
  const events     = data?.events || [];
  const tc         = TIER_COLORS[tier] || TIER_COLORS.explorer;
  const earnedKeys = new Set(events.map(e => e.action));
  const perks      = TIER_PERKS[tier] || [];

  return (
    <SafeAreaView style={s.app}>
      <LinearGradient colors={["#0F0D0A", "#1A1610", "#0F0D0A"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnT}>←</Text>
        </Pressable>
        <View>
          <Text style={s.headerT}>WINGMAN POINTS</Text>
          <Text style={s.headerSub}>Earn more, fly better</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Tier card */}
        <LinearGradient
          colors={[tc.bg, C.bg]}
          style={[s.tierCard, { borderColor: tc.accent + "40" }]}
        >
          <View style={s.tierRow}>
            <View>
              <Text style={[s.tierLabel, { color: tc.accent }]}>{tc.label}</Text>
              <SerifText bold style={s.balanceText}>{balance.toLocaleString()}</SerifText>
              <Text style={s.balanceSub}>Wingman Points</Text>
            </View>
            <View style={[s.tierBadge, { borderColor: tc.accent + "60", backgroundColor: tc.accent + "15" }]}>
              <Text style={[s.tierBadgeT, { color: tc.accent }]}>{tc.label}</Text>
            </View>
          </View>

          {/* Progress bar */}
          {nextTier && (
            <View style={s.progressWrap}>
              <View style={s.progressBar}>
                <LinearGradient
                  colors={[tc.accent, tc.accent + "80"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[s.progressFill, { width: `${pct}%` }]}
                />
              </View>
              <Text style={s.progressLabel}>
                {toNext.toLocaleString()} pts to {nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}
              </Text>
            </View>
          )}
          {!nextTier && (
            <Text style={[s.progressLabel, { color: tc.accent, marginTop: 8 }]}>
              Maximum tier achieved ✦
            </Text>
          )}
        </LinearGradient>

        {/* Tier perks */}
        <Text style={s.sectionT}>YOUR PERKS</Text>
        <View style={s.perksCard}>
          {perks.map((perk, i) => (
            <View key={perk} style={[s.perkRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
              <Text style={[s.perkDot, { color: tc.accent }]}>✦</Text>
              <Text style={s.perkT}>{perk}</Text>
            </View>
          ))}
        </View>

        {/* Earn checklist */}
        <Text style={s.sectionT}>EARN POINTS</Text>
        <View style={s.earnCard}>
          {EARN_ACTIONS.map((item, i) => {
            const done = earnedKeys.has(item.action);
            return (
              <View key={item.action} style={[s.earnRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                <View style={[s.earnIcon, done && { backgroundColor: C.gold + "20" }]}>
                  <Text style={[s.earnIconT, done && { color: C.gold }]}>{done ? "✓" : item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.earnLabel, done && { color: C.mut, textDecorationLine: "line-through" }]}>
                    {item.label}
                  </Text>
                </View>
                <Text style={[s.earnPts, done && { color: C.mut }]}>
                  {done ? "earned" : `+${item.pts}`}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Recent activity */}
        {events.length > 0 && (
          <>
            <Text style={s.sectionT}>RECENT ACTIVITY</Text>
            <View style={s.earnCard}>
              {events.slice(0, 8).map((ev, i) => (
                <View key={i} style={[s.earnRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.earnLabel}>{ev.description}</Text>
                    <Text style={s.earnDate}>
                      {new Date(ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Text>
                  </View>
                  <Text style={[s.earnPts, { color: C.gold }]}>+{ev.points}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:    { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  backBtn:  { width: 36, height: 36, borderRadius: 10, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  backBtnT: { color: C.ink, fontSize: 18 },
  headerT:   { color: C.ink, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1.2 },
  headerSub: { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 2 },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  tierCard: { borderRadius: 20, padding: 20, borderWidth: 1, marginBottom: 24 },
  tierRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tierLabel:  { fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 4 },
  balanceText:{ fontSize: 40, color: C.ink },
  balanceSub: { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 2 },
  tierBadge:  { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  tierBadgeT: { fontSize: 11, fontFamily: T.sansB, letterSpacing: 1 },
  progressWrap: { marginTop: 16 },
  progressBar:  { height: 4, backgroundColor: C.line, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  progressLabel:{ color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 6 },
  sectionT: { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },
  perksCard: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, marginBottom: 24, overflow: "hidden" },
  perkRow:   { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  perkDot:   { fontSize: 10 },
  perkT:     { color: C.ink, fontSize: 14, fontFamily: T.sansM, flex: 1 },
  earnCard:  { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, marginBottom: 24, overflow: "hidden" },
  earnRow:   { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  earnIcon:  { width: 32, height: 32, borderRadius: 8, backgroundColor: C.card2, alignItems: "center", justifyContent: "center" },
  earnIconT: { color: C.mut, fontSize: 14 },
  earnLabel: { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  earnDate:  { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2 },
  earnPts:   { color: C.gold, fontSize: 13, fontFamily: T.sansB },
});
