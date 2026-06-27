import React from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from "react-native";
import { C } from "../theme";
import { Btn, Leg, BackBar, g } from "../components";

export default function PlanScreen({ navigation }) {
  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Plan a trip" />

        <View style={s.me}>
          <Text style={s.meT}>Going to Stockholm Wed, staying at Hotel Ett Hem. Book my flights and find + book dinner. I have 24h from London on the way — send me somewhere interesting.</Text>
        </View>

        <View style={s.bot}>
          <Text style={s.botH}>✦ WINGMAN</Text>
          <Text style={s.botT}>Love it. Here's the plan: fly London → a 24-hour stop in Copenhagen → Stockholm Wed. Flights, timing around your hotel, and dinner booked. Review below.</Text>
        </View>

        <View style={s.draft}>
          <Text style={s.draftT}>DRAFT TRIP</Text>
          <Leg ic="🛫" t="LHR → CPH" sub="Tue 9:05a" />
          <Leg ic="🌆" t="24h in Copenhagen" sub="1 night detour" />
          <Leg ic="🛫" t="CPH → ARN" sub="Wed 4:10p" />
          <Leg ic="🏨" t="Hotel Ett Hem, Stockholm" sub="3 nights" />
        </View>

        <Btn title="See the detour pick →" onPress={() => navigation.navigate("Detour")} style={{ marginTop: 18 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  me: { alignSelf: "flex-end", maxWidth: "85%", backgroundColor: C.gold, borderRadius: 16, borderBottomRightRadius: 5, padding: 12, marginBottom: 10 },
  meT: { color: "#fff", fontSize: 13.5, lineHeight: 19 },
  bot: { alignSelf: "flex-start", maxWidth: "90%", backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, borderBottomLeftRadius: 5, padding: 12, marginBottom: 14 },
  botH: { color: C.teal, fontSize: 10, fontWeight: "700", marginBottom: 4 },
  botT: { color: C.ink, fontSize: 13.5, lineHeight: 19 },
  draft: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14 },
  draftT: { fontSize: 11, color: C.mut, letterSpacing: 1, marginBottom: 2 },
});
