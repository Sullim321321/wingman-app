import React from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from "react-native";
import { C } from "../theme";
import { g } from "../components";

const FEED = [
  { c: C.teal, ic: "✓", t: "Rerouted to Aspen by private car", s: "Rebooked, refunded $214, updated hotel & calendar.", w: "Just now" },
  { c: C.amber, ic: "⚠️", t: "Predicted UA 5821 cancellation", s: "Flagged 78% risk ~3 hrs before the airline announced.", w: "2 min ago" },
  { c: C.accent, ic: "🌨️", t: "Weather watch started for Denver", s: "Snow band detected on inbound radar.", w: "11 min ago" },
  { c: C.accent, ic: "🛫", t: "JFK → DEN confirmed on time", s: "Monitoring your connection.", w: "Today 6:02a" },
  { c: C.teal, ic: "📥", t: "Imported Aspen trip from inbox", s: "3 bookings linked automatically.", w: "Jun 2" },
];

export default function ActivityScreen() {
  return (
    <SafeAreaView style={s.app}>
      <View style={s.head}><Text style={s.headT}>Activity</Text></View>
      <ScrollView contentContainerStyle={g.scroll}>
        <View style={s.banner}>
          <Text style={{ fontSize: 20 }}>💸</Text>
          <Text style={s.bannerT}>Wingman has saved you <Text style={{ color: C.teal, fontWeight: "700" }}>$214 and ~5 hours</Text> on this trip so far.</Text>
        </View>
        {FEED.map((f, i) => (
          <View key={i} style={s.item}>
            <View style={s.railWrap}>
              <View style={[s.fi, { backgroundColor: f.c + "26" }]}><Text style={{ fontSize: 13 }}>{f.ic}</Text></View>
              {i < FEED.length - 1 ? <View style={s.rail} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 18 }}>
              <Text style={s.ft}>{f.t}</Text>
              <Text style={s.fs}>{f.s}</Text>
              <Text style={s.fw}>{f.w}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  head: { paddingHorizontal: 18, paddingVertical: 12 },
  headT: { color: C.ink, fontSize: 18, fontWeight: "700" },
  banner: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "rgba(34,211,166,0.08)", borderWidth: 1, borderColor: "rgba(34,211,166,0.25)", borderRadius: 14, padding: 13, marginBottom: 16 },
  bannerT: { flex: 1, color: C.ink, fontSize: 13, lineHeight: 18 },
  item: { flexDirection: "row", gap: 13 },
  railWrap: { alignItems: "center", width: 30 },
  fi: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line },
  rail: { flex: 1, width: 2, backgroundColor: C.line, marginTop: 2 },
  ft: { color: C.ink, fontSize: 13.5, fontWeight: "600" },
  fs: { color: C.mut, fontSize: 12, marginTop: 2, lineHeight: 16 },
  fw: { color: C.mut, fontSize: 11, marginTop: 3 },
});
