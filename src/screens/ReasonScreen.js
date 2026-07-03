import React from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from "react-native";
import { C, T } from "../theme";
import { Radar, ContribRow, ReasonCard, Chip, Btn, BackBar, useCountUp, g } from "../components";

const STATIC_FACTORS = [
  { label: "Weather at DEN", points: 32, impact: "High impact", detail: "snow band 4:10–6:00p, visibility below minimums" },
  { label: "Weather at ASE", points: 24, impact: "High impact", detail: "short mountain runway with strict cutoffs" },
  { label: "ATC flow control", points: 14, impact: "Medium", detail: "ground-delay program, ~95 min average delay" },
  { label: "Seat scarcity", points: 8, impact: "Medium", detail: "few seats left on later flights" },
];

function iconFor(label) {
  const l = label.toLowerCase();
  if (l.includes("weather")) return "🌨️";
  if (l.includes("sensitiv") || l.includes("airport")) return "🛬";
  if (l.includes("atc") || l.includes("flow")) return "🛬";
  if (l.includes("seat") || l.includes("connection") || l.includes("baseline")) return "🪑";
  return "📊";
}

export default function ReasonScreen({ navigation, route }) {
  const pred = route.params?.prediction || null;
  const factors = (pred?.factors?.length ? pred.factors : STATIC_FACTORS);
  const riskVal = pred?.risk ?? 78;
  const risk = useCountUp(riskVal);
  const maxPts = Math.max(...factors.map((f) => f.points), 1);
  const sources = pred?.sources || ["NOAA radar", "FlightAware", "FAA NAS", "Seat map"];
  const live = pred?.live;

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Why I think this" />
        <Radar />
        <Text style={s.radarCap}>
          <Text style={{ color: live ? C.teal : C.mut }}>● {live ? "Live" : "Modeled"}</Text>
          {"  "}— {pred ? `${pred.dep} → ${pred.arr}, from current conditions` : "snow band crossing your DEN → ASE route"}
        </Text>
        <View style={s.conf}>
          <Text style={s.confBig}>{risk}%</Text>
          <Text style={s.confLbl}>PREDICTED DISRUPTION{pred ? ` · ${pred.dep} → ${pred.arr}` : " · UA 5821"}</Text>
        </View>

        <View style={s.contrib}>
          <Text style={s.contribT}>WHAT'S DRIVING THE {riskVal}%</Text>
          {factors.map((f, i) => (
            <ContribRow key={i} label={f.label.replace(/^Weather at /, "Wx ")} pct={Math.round((f.points / maxPts) * 100)} value={`+${f.points}`} low={f.impact === "Low"} />
          ))}
        </View>

        {factors.filter((f) => f.detail).map((f, i) => (
          <ReasonCard key={i} icon={iconFor(f.label)} t={f.label} w={f.impact} wColor={f.impact === "High impact" ? C.coral : C.teal} p={f.detail} />
        ))}

        <Text style={g.sectionT}>SOURCES CHECKED</Text>
        <View style={g.metaRow}>{sources.map((x, i) => <Chip key={i}>{x}</Chip>)}</View>

        <Text style={s.trackLink} onPress={() => navigation.navigate("Track")}>📈  See Wingman's track record →</Text>
        <Btn title="Got it — see my options" onPress={() => navigation.goBack()} style={{ marginTop: 6 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  radarCap: { textAlign: "center", fontSize: 11, color: C.mut, marginBottom: 14 },
  conf: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 12 },
  confBig: { fontSize: 40, fontFamily: T.sansB, color: C.coral },
  confLbl: { fontSize: 11, color: C.mut, letterSpacing: 1, marginTop: 2 },
  contrib: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 12 },
  contribT: { fontSize: 11, color: C.mut, letterSpacing: 1, marginBottom: 12 },
  trackLink: { color: C.gold, fontSize: 13, fontFamily: T.sansM, textAlign: "center", marginVertical: 16 },
});
