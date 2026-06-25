import React, { useState, useEffect } from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { Btn, Opt, BackBar, useCountUp, success, g } from "../components";
import { getPrediction } from "../api";

const RESCUE_STEPS = [
  ["Booking private car to Aspen", "Premier Mountain Car · confirmed"],
  ["Cancelling UA 5821 (DEN → ASE)", "Releasing your seat"],
  ["Processing refund", "$214 back to your card"],
  ["Updating Hotel Jerome", "Noting later arrival"],
  ["Syncing calendar & wallet", "New itinerary saved"],
];

export default function AlertScreen({ navigation }) {
  const [pred, setPred] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | live | modeled | offline

  useEffect(() => {
    let alive = true;
    getPrediction({ dep: "DEN", arr: "ASE" })
      .then((p) => { if (!alive) return; setPred(p); setStatus(p.live ? "live" : "modeled"); })
      .catch(() => { if (!alive) return; setStatus("offline"); });
    return () => { alive = false; };
  }, []);

  const target = pred ? pred.risk : status === "offline" ? 78 : 0;
  const risk = useCountUp(target, pred != null || status === "offline");

  const statusText = {
    loading: "Analyzing live conditions…",
    live: "● Live conditions",
    modeled: "● Modeled — no live feed right now",
    offline: "Offline — showing a sample",
  }[status];

  const detail = pred
    ? `${pred.summary} ` + pred.factors.filter((f) => f.detail && f.impact !== "Low").map((f) => f.detail).join("; ")
    : "A snow band is moving into Denver around your 4:40p departure; based on radar, ATC flow and today's cancellations, your connection is at risk.";

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Disruption · live" />
        <LinearGradient colors={["#3A1B2A", "#241430"]} style={s.heroCard}>
          <Text style={{ fontSize: 28 }}>🌨️</Text>
          <Text style={s.heroH}>Your Aspen connection is at risk</Text>
          <Text style={s.heroP}>{detail}</Text>
          <View style={s.riskBar}><View style={[s.riskFill, { width: `${risk}%` }]} /></View>
          <View style={g.rowBetween}>
            <Text style={[s.riskLbl, status === "live" && { color: C.teal }]}>{statusText}</Text>
            <Text style={[s.riskLbl, { color: C.coral, fontWeight: "700" }]}>{risk}%</Text>
          </View>
        </LinearGradient>

        <Text style={s.whyLink} onPress={() => navigation.navigate("Reason", { prediction: pred })}>🧠  Why I think this →</Text>
        <Text style={g.sectionT}>PICK A BACKUP — I'LL HANDLE THE REST</Text>

        <Opt sel title="🚙 Private car to Aspen" badge="Recommended" sub="Skip the airport gamble. ~4 hr drive, arrives before check-in." meta={["Arrives 6:30p", "$420 · covered", "0% risk"]} />
        <Opt title="🚐 Shared mountain shuttle" sub="Scheduled van DEN → Aspen, leaves 5:15p." meta={["Arrives 9:45p", "$89"]} />
        <Opt title="✈️ Rebook tomorrow AM" sub="Overnight in Denver, fly out at 7:10a." meta={["Arrives tmrw 8:05a", "+1 night"]} />

        <View style={s.sticky}>
          <Text style={s.sum}>Confirm: book private car · refund UA 5821 · update hotel</Text>
          <Btn title="✓  Yes — handle it all" kind="accent" onPress={() => {
            success();
            navigation.navigate("Exec", { title: "Fixing your trip", steps: RESCUE_STEPS, doneRoute: "Done" });
          }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  heroCard: { borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,92,122,0.25)" },
  heroH: { color: C.ink, fontSize: 19, fontWeight: "700", marginTop: 8, marginBottom: 6 },
  heroP: { color: "#E6C2CC", fontSize: 13, lineHeight: 19 },
  riskBar: { height: 8, borderRadius: 99, backgroundColor: "#2A2036", marginTop: 14, overflow: "hidden" },
  riskFill: { height: "100%", borderRadius: 99, backgroundColor: C.coral },
  riskLbl: { color: C.mut, fontSize: 12, marginTop: 6 },
  whyLink: { color: C.accent, fontSize: 13, fontWeight: "600", textAlign: "center", marginVertical: 14 },
  sticky: { marginTop: 16, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  sum: { color: C.mut, fontSize: 12, textAlign: "center", marginBottom: 8 },
});
