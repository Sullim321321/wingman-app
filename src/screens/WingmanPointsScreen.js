// WingmanPointsScreen — Build 87
// Tier progress, balance, earn checklist, redemption catalog
import React, { useState, useCallback } from "react";
import {
  SafeAreaView, View, Text, ScrollView, Pressable,
  StyleSheet, ActivityIndicator, Alert, Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { C, T, GRAD } from "../theme";
import { SerifText, tap } from "../components";
import { getPoints, redeemPoints } from "../api";

const TIER_COLORS = {
  explorer:  { bg: C.card,    accent: C.mut,     label: "EXPLORER"  },
  flyer:     { bg: "#1A1F2E", accent: "#5B8CFF", label: "FLYER"     },
  navigator: { bg: "#1E1A10", accent: C.gold,    label: "NAVIGATOR" },
  elite:     { bg: "#1A0F0A", accent: "#FF9F43", label: "ELITE"     },
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

const REDEEMABLE_PERKS = [
  { id: "priority_support", cost: 300, label: "Priority Support",   icon: "⚡", desc: "Jump to the front of the support queue for your next issue.", color: "#5B8CFF" },
  { id: "upgrade_boost",    cost: 400, label: "Upgrade Bid Boost",  icon: "🚀", desc: "2× points on your next upgrade bid — doubles your chances.", color: C.gold },
  { id: "free_month",       cost: 500, label: "1 Month Free",       icon: "✦",  desc: "One full month of Wingman Premium at no charge.", color: "#FF9F43" },
  { id: "lounge_day_pass",  cost: 600, label: "Lounge Day Pass",    icon: "◈",  desc: "One-day Priority Pass lounge access at any participating airport.", color: "#2A9D8F" },
  { id: "concierge_call",   cost: 800, label: "Concierge Call",     icon: "◆",  desc: "30-minute call with a Wingman travel expert — your personal fixer.", color: C.gold },
];

function RedeemModal({ perk, balance, onConfirm, onCancel, redeeming }) {
  const canAfford = balance >= perk.cost;
  return (
    <Modal transparent animationType="fade" visible>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <LinearGradient colors={["#1A1610", C.inkD]} style={StyleSheet.absoluteFill} />
          <View style={[m.perkIcon, { backgroundColor: perk.color + "20", borderColor: perk.color + "40" }]}>
            <Text style={[m.perkIconT, { color: perk.color }]}>{perk.icon}</Text>
          </View>
          <Text style={m.title}>{perk.label}</Text>
          <Text style={m.desc}>{perk.desc}</Text>
          <View style={m.costRow}>
            <Text style={m.costLabel}>Cost</Text>
            <LinearGradient colors={GRAD.gold} style={m.costBadge}>
              <Text style={m.costBadgeT}>{perk.cost.toLocaleString()} pts</Text>
            </LinearGradient>
          </View>
          {!canAfford && (
            <View style={m.insufficientBanner}>
              <Text style={m.insufficientT}>
                You need {(perk.cost - balance).toLocaleString()} more points to redeem this perk.
              </Text>
            </View>
          )}
          <View style={m.btnRow}>
            <Pressable style={m.cancelBtn} onPress={onCancel} disabled={redeeming}>
              <Text style={m.cancelBtnT}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[m.confirmBtn, !canAfford && m.confirmBtnDisabled]}
              onPress={canAfford ? onConfirm : undefined}
              disabled={!canAfford || redeeming}
            >
              {redeeming
                ? <ActivityIndicator color={C.inkD} size="small" />
                : <Text style={m.confirmBtnT}>Redeem →</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function WingmanPointsScreen({ navigation }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [selectedPerk, setSelectedPerk] = useState(null);
  const [redeeming, setRedeeming] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getPoints()
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRedeem = async () => {
    if (!selectedPerk) return;
    setRedeeming(true);
    try {
      const r = await redeemPoints(selectedPerk.id);
      setSelectedPerk(null);
      // Refresh balance
      const updated = await getPoints();
      setData(updated);
      Alert.alert(
        "Redeemed! ✦",
        `${selectedPerk.label} has been applied to your account. New balance: ${r.new_balance.toLocaleString()} pts.`,
        [{ text: "Done", style: "default" }]
      );
    } catch (e) {
      setSelectedPerk(null);
      const msg = e?.message || "";
      if (msg.includes("insufficient")) {
        Alert.alert("Not enough points", "Earn more points to unlock this perk.");
      } else {
        Alert.alert("Couldn't redeem", msg || "Please try again.");
      }
    } finally { setRedeeming(false); }
  };

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
      <LinearGradient colors={[C.inkD, "#1A1610", C.inkD]} style={StyleSheet.absoluteFill} />

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

        {/* Redemption catalog */}
        <Text style={s.sectionT}>REDEEM POINTS</Text>
        <View style={s.redeemGrid}>
          {REDEEMABLE_PERKS.map(perk => {
            const canAfford = balance >= perk.cost;
            return (
              <Pressable
                key={perk.id}
                style={[s.redeemCard, !canAfford && s.redeemCardLocked]}
                onPress={() => { tap(); setSelectedPerk(perk); }}
              >
                <LinearGradient
                  colors={canAfford ? [perk.color + "18", "transparent"] : ["transparent", "transparent"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[s.redeemIcon, { backgroundColor: perk.color + "20", borderColor: perk.color + "30" }]}>
                  <Text style={[s.redeemIconT, { color: canAfford ? perk.color : C.mut }]}>{perk.icon}</Text>
                </View>
                <Text style={[s.redeemLabel, !canAfford && { color: C.mut }]}>{perk.label}</Text>
                <View style={s.redeemCostRow}>
                  <Text style={[s.redeemCost, canAfford ? { color: C.gold } : { color: C.mut }]}>
                    {perk.cost.toLocaleString()} pts
                  </Text>
                  {!canAfford && <Ionicons name="lock-closed" size={11} color={C.mut} style={s.lockIcon} />}
                </View>
              </Pressable>
            );
          })}
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
              {events.slice(0, 10).map((ev, i) => (
                <View key={i} style={[s.earnRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.earnLabel}>{ev.description}</Text>
                    <Text style={s.earnDate}>
                      {new Date(ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Text>
                  </View>
                  <Text style={[s.earnPts, { color: ev.points < 0 ? C.coral : C.gold }]}>
                    {ev.points < 0 ? ev.points.toLocaleString() : `+${ev.points}`}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Redemption modal */}
      {selectedPerk && (
        <RedeemModal
          perk={selectedPerk}
          balance={balance}
          onConfirm={handleRedeem}
          onCancel={() => setSelectedPerk(null)}
          redeeming={redeeming}
        />
      )}
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
  redeemGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  redeemCard: { width: "47%", borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14, overflow: "hidden", backgroundColor: C.card, gap: 8 },
  redeemCardLocked: { opacity: 0.6 },
  redeemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  redeemIconT:{ fontSize: 18 },
  redeemLabel:{ color: C.ink, fontSize: 13, fontFamily: T.sansM, lineHeight: 18 },
  redeemCostRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  redeemCost: { fontSize: 12, fontFamily: T.sansB },
  lockIcon:   { fontSize: 11 },
  earnCard:  { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, marginBottom: 24, overflow: "hidden" },
  earnRow:   { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  earnIcon:  { width: 32, height: 32, borderRadius: 8, backgroundColor: C.card2, alignItems: "center", justifyContent: "center" },
  earnIconT: { color: C.mut, fontSize: 14 },
  earnLabel: { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  earnDate:  { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2 },
  earnPts:   { color: C.gold, fontSize: 13, fontFamily: T.sansB },
  coral:     { color: C.coral },
});

const m = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "flex-end" },
  sheet:    { width: "100%", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 44, alignItems: "center", overflow: "hidden", borderTopWidth: 1, borderColor: C.line },
  perkIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: 16 },
  perkIconT:{ fontSize: 28 },
  title:    { color: C.ink, fontSize: 22, fontFamily: T.serifB, marginBottom: 8, textAlign: "center" },
  desc:     { color: C.mut, fontSize: 14, fontFamily: T.sans, lineHeight: 21, textAlign: "center", marginBottom: 20 },
  costRow:  { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  costLabel:{ color: C.mut, fontSize: 14, fontFamily: T.sans },
  costBadge:{ borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  costBadgeT:{ color: C.inkD, fontSize: 14, fontFamily: T.sansB },
  insufficientBanner: { backgroundColor: C.coral + "18", borderRadius: 12, padding: 12, marginBottom: 16, width: "100%" },
  insufficientT: { color: C.coral, fontSize: 13, fontFamily: T.sansM, textAlign: "center" },
  btnRow:   { flexDirection: "row", gap: 12, width: "100%" },
  cancelBtn:{ flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  cancelBtnT:{ color: C.mut, fontSize: 15, fontFamily: T.sansM },
  confirmBtn:{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", overflow: "hidden", backgroundColor: C.gold },
  confirmBtnDisabled: { backgroundColor: C.card2 },
  confirmBtnT:{ color: C.inkD, fontSize: 15, fontFamily: T.sansB },
});
