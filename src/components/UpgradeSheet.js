// UpgradeSheet — well-timed Pro upgrade moments (Roadmap 2, UI #10)
// Shown at the point of maximum value (turning on autonomy, exporting an expense
// report, etc.) rather than as a nagging banner. States the specific benefit the
// user was just reaching for — never a generic "go Pro" pitch.

import React from "react";
import { View, Text, Modal, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, T, SHADOW, litEdge } from "../theme";
import { tap, WMark } from "../components";

// The moments worth interrupting for, and what to say at each.
export const UPGRADE_MOMENTS = {
  standing_orders: {
    icon: "shield-checkmark-outline",
    title: "Let Wingman act for you.",
    body: "Standing orders let Wingman rebook you automatically — within limits you set — so a cancellation is handled before you've even seen it.",
    benefit: "Autonomous rebooking",
  },
  expenses: {
    icon: "receipt-outline",
    title: "Expense reports, done.",
    body: "Export a categorized expense report for any trip — straight into your reimbursement system, with every booking accounted for.",
    benefit: "Expense exports",
  },
  intel: {
    icon: "sparkles-outline",
    title: "Know the city before you land.",
    body: "AI-curated dining, neighbourhoods, and local intelligence for every destination on your itinerary.",
    benefit: "Destination intel",
  },
};

export function UpgradeSheet({ visible, moment = "standing_orders", onClose, onUpgrade }) {
  const m = UPGRADE_MOMENTS[moment] || UPGRADE_MOMENTS.standing_orders;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.grip} />

          <View style={s.head}>
            <WMark size={26} color={C.gold} />
            <Text style={s.kicker}>WINGMAN PRO</Text>
          </View>

          <View style={s.iconWrap}>
            <Ionicons name={m.icon} size={26} color={C.gold} />
          </View>

          <Text style={s.title}>{m.title}</Text>
          <Text style={s.body}>{m.body}</Text>

          <View style={s.benefits}>
            {Object.values(UPGRADE_MOMENTS).map(b => (
              <View key={b.benefit} style={s.benefitRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={b.benefit === m.benefit ? C.gold : C.mut}
                />
                <Text style={[s.benefitT, b.benefit === m.benefit && { color: C.ink }]}>
                  {b.benefit}
                </Text>
              </View>
            ))}
          </View>

          <Pressable style={s.cta} onPress={() => { tap(); onUpgrade && onUpgrade(); }}>
            <Text style={s.ctaT}>See Wingman Pro</Text>
          </Pressable>
          <Pressable style={s.later} onPress={() => { tap(); onClose && onClose(); }}>
            <Text style={s.laterT}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderColor: C.line, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 36,
    ...litEdge, ...SHADOW.sheet,
  },
  grip: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 18 },
  head: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 20 },
  kicker: { fontFamily: T.sansB, fontSize: 11, letterSpacing: 2.4, color: C.gold },
  iconWrap: {
    width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(201,169,110,0.10)", borderWidth: 1, borderColor: "rgba(201,169,110,0.30)",
    marginBottom: 16,
  },
  title: { fontFamily: T.garamondSI, fontSize: 28, color: C.ink, lineHeight: 34, marginBottom: 8 },
  body: { fontFamily: T.sans, fontSize: 14, lineHeight: 21, color: C.mut, marginBottom: 20 },
  benefits: { gap: 10, marginBottom: 24 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  benefitT: { fontFamily: T.sansM, fontSize: 14, color: C.mut },
  cta: { backgroundColor: C.gold, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  ctaT: { fontFamily: T.sansB, fontSize: 15, color: C.inkD },
  later: { alignItems: "center", paddingVertical: 14 },
  laterT: { fontFamily: T.sansM, fontSize: 14, color: C.mut },
});
