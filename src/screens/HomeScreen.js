import React from "react";
import { SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { Btn, Leg, g } from "../components";
import { scheduleDisruption } from "../notify";

export default function HomeScreen({ navigation }) {
  const onSimulate = async () => {
    await scheduleDisruption();
    setTimeout(() => navigation.navigate("Alert"), 3500); // fallback for simulator
  };
  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <View style={s.appH}>
          <View style={s.logoRow}>
            <LinearGradient colors={[C.accent, C.teal]} style={s.mark}><Text style={{ fontSize: 14 }}>✈</Text></LinearGradient>
            <Text style={s.logo}>Wingman</Text>
          </View>
          <Pressable style={s.avatar} onPress={() => navigation.navigate("Settings")}><Text style={{ color: "#fff", fontWeight: "700" }}>M</Text></Pressable>
        </View>

        <LinearGradient colors={["#1D2A52", "#141D38"]} style={s.tripCard}>
          <View style={g.rowBetween}>
            <View>
              <Text style={s.dest}>Aspen trip</Text>
              <Text style={s.when}>Today · in 6 hrs</Text>
            </View>
            <View style={s.pillLive}><Text style={s.pillLiveT}>● Monitoring</Text></View>
          </View>
          <Leg ic="🛫" t="JFK → DEN" sub="UA 412 · 11:05a · on time" tag="On time" tagColor={C.teal} />
          <Leg ic="🔗" t="DEN → ASE" sub="UA 5821 · 4:40p · connection" tag="Watching" tagColor={C.amber} />
          <Leg ic="🏨" t="Hotel Jerome" sub="Check-in 7:00p · Aspen" tag="Booked" tagColor={C.teal} />
        </LinearGradient>

        <Text style={g.sectionT}>LIVE MONITORING</Text>
        <Pressable style={s.monitor} onPress={() => navigation.navigate("Track")}>
          <View style={s.radarMini}><View style={s.radarMiniSweep} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.mt}>Watching 14 signals</Text>
            <Text style={s.ms}>88% hit rate · tap for track record →</Text>
          </View>
        </Pressable>

        <Text style={g.sectionT}>CONNECTED CHANNELS</Text>
        <Pressable style={s.monitor} onPress={() => navigation.navigate("Connections")}>
          <View style={s.chIc}><Text style={{ fontSize: 16 }}>📡</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.mt}>Email · Calendar connected</Text>
            <Text style={s.ms}>Tap to add WhatsApp & Messages →</Text>
          </View>
        </Pressable>

        <Text style={g.sectionT}>WHEN TRAVEL BREAKS</Text>
        <Btn title="⚡  Simulate a disruption" onPress={onSimulate} />
        <Text style={s.hint}>Schedules a real push in a few seconds — tap it to see the rescue.</Text>

        <Text style={g.sectionT}>WHEN YOU'RE PLANNING</Text>
        <Btn title="🗺️  Plan a trip — Stockholm" kind="ghost" onPress={() => navigation.navigate("Plan")} style={{ marginBottom: 8 }} />
        <Btn title="📡  Catch a trip from my messages" kind="ghost" onPress={() => navigation.navigate("Signal")} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  appH: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mark: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  logo: { color: C.ink, fontSize: 19, fontWeight: "700" },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#3A4A7A", alignItems: "center", justifyContent: "center" },
  tripCard: { borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.line },
  dest: { color: C.ink, fontSize: 20, fontWeight: "700" },
  when: { color: C.mut, fontSize: 13, marginTop: 2 },
  pillLive: { backgroundColor: "rgba(34,211,166,0.14)", borderColor: "rgba(34,211,166,0.3)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillLiveT: { color: C.teal, fontSize: 11, fontWeight: "700" },
  monitor: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 12 },
  radarMini: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: "rgba(91,140,255,0.25)", overflow: "hidden" },
  radarMiniSweep: { position: "absolute", top: -2, left: 14, width: 2, height: 19, backgroundColor: C.accent },
  chIc: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(34,211,166,0.12)", alignItems: "center", justifyContent: "center" },
  mt: { color: C.ink, fontSize: 13, fontWeight: "600" },
  ms: { color: C.mut, fontSize: 12 },
  hint: { color: C.mut, fontSize: 12, textAlign: "center", marginTop: 10 },
});
