// LoungeCardsScreen — Build 87
// Lets users select their travel credit cards and lounge memberships
// Saved to preferences.lounge_cards[] via PATCH /profile
// AirportNavigationScreen reads this to show personalised lounge access
import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable,
  StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { C, T, GRAD } from "../theme";
import { SerifText, tap } from "../components";
import { getProfile, updateProfile } from "../api";

// ── Card catalog ────────────────────────────────────────────────────────────
const CARD_CATALOG = [
  {
    category: "PREMIUM CREDIT CARDS",
    cards: [
      {
        id: "amex_platinum",
        name: "Amex Platinum",
        issuer: "American Express",
        color: "#B8A0D0",
        icon: "◈",
        lounges: ["Centurion Lounge", "Priority Pass (unlimited)", "Delta Sky Club (on Delta flights)", "Lufthansa Business Lounge"],
        annual_fee: "$695",
      },
      {
        id: "amex_centurion",
        name: "Amex Centurion (Black)",
        issuer: "American Express",
        color: "#1A1A1A",
        icon: "◈",
        lounges: ["Centurion Lounge (unlimited guests)", "Priority Pass (unlimited)", "All Amex Platinum benefits"],
        annual_fee: "$5,000",
      },
      {
        id: "chase_sapphire_reserve",
        name: "Chase Sapphire Reserve",
        issuer: "Chase",
        color: "#4A6FA5",
        icon: "◆",
        lounges: ["Priority Pass (unlimited)", "Chase Sapphire Lounge by The Club"],
        annual_fee: "$550",
      },
      {
        id: "citi_prestige",
        name: "Citi Prestige",
        issuer: "Citi",
        color: "#1A6B8A",
        icon: "◇",
        lounges: ["Priority Pass (unlimited)"],
        annual_fee: "$495",
      },
      {
        id: "capital_one_venture_x",
        name: "Capital One Venture X",
        issuer: "Capital One",
        color: "#C9A96E",
        icon: "✦",
        lounges: ["Capital One Lounge", "Priority Pass (unlimited)", "Plaza Premium"],
        annual_fee: "$395",
      },
      {
        id: "us_bank_altitude_reserve",
        name: "US Bank Altitude Reserve",
        issuer: "US Bank",
        color: "#8B4513",
        icon: "▲",
        lounges: ["Priority Pass (4 visits/year)"],
        annual_fee: "$400",
      },
    ],
  },
  {
    category: "AIRLINE CARDS",
    cards: [
      {
        id: "delta_reserve",
        name: "Delta SkyMiles Reserve",
        issuer: "American Express",
        color: "#C41E3A",
        icon: "△",
        lounges: ["Delta Sky Club (on Delta flights)", "Centurion Lounge (on Delta flights)"],
        annual_fee: "$650",
      },
      {
        id: "united_club_infinite",
        name: "United Club Infinite",
        issuer: "Chase",
        color: "#1B4F8A",
        icon: "◯",
        lounges: ["United Club (unlimited)", "Star Alliance partner lounges"],
        annual_fee: "$525",
      },
      {
        id: "aa_executive",
        name: "Citi® / AAdvantage® Executive",
        issuer: "Citi",
        color: "#0078D2",
        icon: "◎",
        lounges: ["Admirals Club (unlimited + guests)"],
        annual_fee: "$595",
      },
    ],
  },
  {
    category: "LOUNGE MEMBERSHIPS",
    cards: [
      {
        id: "priority_pass",
        name: "Priority Pass",
        issuer: "Collinson Group",
        color: "C.teal",
        icon: "✓",
        lounges: ["1,400+ lounges in 148 countries"],
        annual_fee: "$99–$429/yr",
      },
      {
        id: "lounge_key",
        name: "LoungeKey",
        issuer: "Mastercard",
        color: "#EB001B",
        icon: "⬡",
        lounges: ["1,000+ lounges worldwide"],
        annual_fee: "Varies by card",
      },
      {
        id: "plaza_premium",
        name: "Plaza Premium",
        issuer: "Plaza Premium Group",
        color: "#8B6914",
        icon: "◈",
        lounges: ["Plaza Premium lounges at 200+ airports"],
        annual_fee: "$299/yr",
      },
    ],
  },
];

function CardRow({ card, selected, onToggle }) {
  return (
    <Pressable
      style={[s.cardRow, selected && s.cardRowSelected]}
      onPress={() => { tap(); onToggle(card.id); }}
    >
      <View style={[s.cardIcon, { backgroundColor: card.color + "22", borderColor: card.color + "44" }]}>
        <Text style={[s.cardIconText, { color: card.color }]}>{card.icon}</Text>
      </View>
      <View style={s.cardInfo}>
        <Text style={s.cardName}>{card.name}</Text>
        <Text style={s.cardIssuer}>{card.issuer} · {card.annual_fee}</Text>
        <Text style={s.cardLounges} numberOfLines={1}>{card.lounges.slice(0, 2).join(", ")}</Text>
      </View>
      <View style={[s.checkBox, selected && s.checkBoxOn]}>
        {selected && <Text style={s.checkMark}>✓</Text>}
      </View>
    </Pressable>
  );
}

export default function LoungeCardsScreen() {
  const navigation = useNavigation();
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    try {
      const profile = await getProfile();
      const cards = profile?.preferences?.lounge_cards || [];
      setSelected(new Set(cards));
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ preferences: { lounge_cards: Array.from(selected) } });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Couldn't save", e.message || "Please try again.");
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.app}>
        <View style={s.center}><ActivityIndicator color={C.gold} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <LinearGradient colors={["#0F0D0A", "#1A1610", "#0F0D0A"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => { tap(); navigation.goBack(); }}>
          <Text style={s.backBtnT}>‹</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <SerifText bold style={s.headerTitle}>Lounge Access</SerifText>
          <Text style={s.headerSub}>Select your cards & memberships</Text>
        </View>
        <Pressable style={s.saveBtn} onPress={save} disabled={saving}>
          {saving
            ? <ActivityIndicator color={C.gold} size="small" />
            : <Text style={s.saveBtnT}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Info banner */}
        <View style={s.infoBanner}>
          <LinearGradient colors={[C.gold + "14", "transparent"]} style={StyleSheet.absoluteFill} />
          <Text style={s.infoIcon}>✦</Text>
          <Text style={s.infoText}>
            Wingman uses this to show which lounges you can access at each airport — automatically, without you having to look it up.
          </Text>
        </View>

        {/* Selected count */}
        {selected.size > 0 && (
          <View style={s.selectedBadge}>
            <LinearGradient colors={GRAD.gold} style={s.selectedBadgeGrad}>
              <Text style={s.selectedBadgeT}>{selected.size} card{selected.size !== 1 ? "s" : ""} selected</Text>
            </LinearGradient>
          </View>
        )}

        {/* Card catalog */}
        {CARD_CATALOG.map(section => (
          <View key={section.category} style={s.section}>
            <Text style={s.sectionTitle}>{section.category}</Text>
            <View style={s.group}>
              {section.cards.map((card, i) => (
                <View key={card.id}>
                  {i > 0 && <View style={s.divider} />}
                  <CardRow card={card} selected={selected.has(card.id)} onToggle={toggle} />
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Footer note */}
        <Text style={s.footerNote}>
          Lounge access depends on your specific card tier, booking class, and airline. Always verify access directly with the lounge.
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:     { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, alignItems: "center", justifyContent: "center" },
  header:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: C.line },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backBtnT:{ color: C.ink, fontSize: 28, fontFamily: T.sans },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: C.ink, fontSize: 18 },
  headerSub:   { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2 },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.gold + "20", borderRadius: 10, borderWidth: 1, borderColor: C.gold + "40" },
  saveBtnT:{ color: C.gold, fontSize: 14, fontFamily: T.sansB },
  scroll:  { paddingHorizontal: 16, paddingTop: 16 },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: C.gold + "30", padding: 14, marginBottom: 20, overflow: "hidden" },
  infoIcon:   { color: C.gold, fontSize: 16, marginTop: 1 },
  infoText:   { flex: 1, color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 19 },
  selectedBadge: { alignItems: "center", marginBottom: 16 },
  selectedBadgeGrad: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  selectedBadgeT: { color: "#0F0D0A", fontSize: 13, fontFamily: T.sansB },
  section:    { marginBottom: 24 },
  sectionTitle: { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.2, marginBottom: 10, marginLeft: 4 },
  group:      { borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: "hidden", backgroundColor: C.card },
  divider:    { height: 0.5, backgroundColor: C.line, marginLeft: 68 },
  cardRow:    { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  cardRowSelected: { backgroundColor: C.gold + "08" },
  cardIcon:   { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cardIconText: { fontSize: 18 },
  cardInfo:   { flex: 1 },
  cardName:   { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  cardIssuer: { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2 },
  cardLounges:{ color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 3, fontStyle: "italic" },
  checkBox:   { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  checkBoxOn: { backgroundColor: C.gold, borderColor: C.gold },
  checkMark:  { color: "#0F0D0A", fontSize: 13, fontFamily: T.sansB },
  footerNote: { color: C.mut, fontSize: 11, fontFamily: T.sans, textAlign: "center", lineHeight: 17, paddingHorizontal: 20, marginTop: 4 },
});
