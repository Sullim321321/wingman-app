import React from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from "react-native";
import { C } from "../theme";
import { Btn, BackBar, Chip, g } from "../components";

export default function SignalScreen({ navigation }) {
  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Ambient catch" />
        <Text style={g.sectionT}>CAUGHT IN YOUR MESSAGES</Text>

        <View style={s.src}>
          <Text style={s.srcH}>💬 WhatsApp · Family group</Text>
          <Text style={s.srcT}>“omg can't wait for <Text style={{ fontWeight: "700", color: C.ink }}>Stockholm next week</Text> 🇸🇪 where should we eat??”</Text>
        </View>

        <View style={s.bot}>
          <Text style={s.botH}>✦ WINGMAN</Text>
          <Text style={s.botT}>I spotted a Stockholm trip forming. I can plan the flights, a hotel-aware schedule and dinner — and find you a stop on the way. Want me to draft it?</Text>
        </View>

        <Text style={g.sectionT}>ALREADY LINKED</Text>
        <View style={[g.group, { paddingVertical: 4 }]}>
          <View style={s.linked}>
            <View style={s.linkedIc}><Text style={{ fontSize: 15 }}>📧</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.linkedT}>From your inbox</Text>
              <Text style={s.linkedS}>Hotel Ett Hem booking — added to the trip</Text>
            </View>
            <Chip color={C.teal}>Linked</Chip>
          </View>
        </View>

        <View style={s.sticky}>
          <Text style={s.sum}>Drafts flights · a 24h detour · dinner — you approve before anything books</Text>
          <Btn title="✓  Yes — draft my Stockholm trip" kind="accent" onPress={() => navigation.navigate("Plan")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  src: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 13, marginBottom: 12 },
  srcH: { color: "#25D366", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  srcT: { color: C.ink, fontSize: 13.5, lineHeight: 20 },
  bot: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, borderBottomLeftRadius: 5, padding: 12, alignSelf: "flex-start", maxWidth: "92%" },
  botH: { color: C.teal, fontSize: 10, fontWeight: "700", marginBottom: 4 },
  botT: { color: C.ink, fontSize: 13.5, lineHeight: 19 },
  linked: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  linkedIc: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#0E1530", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  linkedT: { color: C.ink, fontSize: 14, fontWeight: "600" },
  linkedS: { color: C.mut, fontSize: 12, marginTop: 1 },
  sticky: { marginTop: 18, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  sum: { color: C.mut, fontSize: 12, textAlign: "center", marginBottom: 8 },
});
