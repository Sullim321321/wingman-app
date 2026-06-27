import React from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { Btn, Leg, Chip, BackBar, success, g } from "../components";

const PLAN_STEPS = [
  ["Booking LHR → CPH", "Tue 9:05a"],
  ["Holding Coco Hotel, Copenhagen", "1 night"],
  ["Booking CPH → ARN", "Wed 4:10p"],
  ["Reserving dinner at Ekstedt", "Wed 8:30p · table for 2"],
  ["Charging card ••42 · syncing", "$1,180 total"],
];

export default function DetourScreen({ navigation }) {
  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Your 24h from London" />
        <LinearGradient colors={["#13312B", "#10241F"]} style={s.hero}>
          <Text style={{ fontSize: 26 }}>📍</Text>
          <Text style={s.heroH}>Copenhagen — my pick</Text>
          <Text style={s.heroP}>Quick hop, endlessly walkable, peak design season — the perfect warm-up for your Stockholm trip.</Text>
        </LinearGradient>

        <Text style={g.sectionT}>YOUR 24 HOURS</Text>
        <Leg ic="✈️" t="Land CPH 11:40a" sub="drop bags, straight into the city" />
        <Leg ic="🚲" t="Nyhavn + a canal ride" sub="bike the old town" />
        <Leg ic="🍽️" t="Dinner: Reffen or Alouette" sub="street food or a star — your call" />
        <Leg ic="🛏️" t="1 night: Coco Hotel" sub="design hotel, held for you" />
        <Leg ic="✈️" t="Depart 2:10p Wed → Stockholm" sub="rested, in time for dinner" />

        <Text style={g.sectionT}>PREFER SOMEWHERE ELSE?</Text>
        <View style={g.metaRow}>
          {["Gothenburg", "Hamburg", "Oslo", "Bruges"].map((x, i) => <Chip key={i} color={C.gold}>{x}</Chip>)}
        </View>

        <View style={s.sticky}>
          <Text style={s.sum}>Books flights + Copenhagen hotel + holds Stockholm dinner</Text>
          <Btn title="✓  Book this detour" kind="accent" onPress={() => {
            success();
            navigation.navigate("Exec", { title: "Booking your trip", steps: PLAN_STEPS, doneRoute: "PlanDone" });
          }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  hero: { borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(34,211,166,0.35)" },
  heroH: { color: C.ink, fontSize: 19, fontWeight: "700", marginTop: 8, marginBottom: 6 },
  heroP: { color: "#CDEFE6", fontSize: 13, lineHeight: 19 },
  sticky: { marginTop: 16, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  sum: { color: C.mut, fontSize: 12, textAlign: "center", marginBottom: 8 },
});
