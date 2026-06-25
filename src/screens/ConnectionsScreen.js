import React, { useState } from "react";
import { SafeAreaView, ScrollView, View, Text, Switch, StyleSheet } from "react-native";
import { C } from "../theme";
import { BackBar, SetRow, g } from "../components";

export default function ConnectionsScreen({ navigation }) {
  const [email, setEmail] = useState(true);
  const [cal, setCal] = useState(true);
  const [wa, setWa] = useState(false);
  const [sms, setSms] = useState(false);
  const sw = (v, set) => (
    <Switch value={v} onValueChange={set} trackColor={{ true: C.teal, false: "#2A3354" }} thumbColor="#fff" ios_backgroundColor="#2A3354" />
  );
  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Connections" />

        <View style={g.trustNote}>
          <Text style={g.trustNoteT}>Wingman connects through <Text style={{ color: C.teal, fontWeight: "700" }}>official APIs</Text> and reads only travel-relevant details — encrypted, scoped, and revocable anytime.</Text>
        </View>

        <Text style={g.sectionT}>YOUR CHANNELS</Text>
        <View style={g.group}>
          <SetRow ic="✉️" iconColor="#FF6B5E" t="Email" sub="Flight & hotel confirmations" right={sw(email, setEmail)} />
          <SetRow ic="📅" iconColor={C.accent} t="Calendar" sub="Trip dates & meetings" right={sw(cal, setCal)} />
          <SetRow ic="💬" iconColor="#25D366" t="WhatsApp" sub="The group-chat trip plans" right={sw(wa, setWa)} />
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic="📱" iconColor={C.teal} t="Messages / SMS" sub="“We're delayed” texts & plans" right={sw(sms, setSms)} />
          </View>
        </View>

        <Text style={g.sectionT}>WHAT WINGMAN READS</Text>
        <View style={[g.group, { paddingVertical: 12 }]}>
          <Feat ic="✈️" t="Booking & flight confirmations" />
          <Feat ic="📆" t="Dates, times & destinations" />
          <Feat ic="💬" t="Travel plans & “we're delayed” mentions" />
          <Feat ic="⦸" color={C.coral} t="Nothing personal or off-topic — ever." />
        </View>
        <Text style={s.note}>Revoke any connection in one tap. Your data is never sold.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Feat({ ic, t, color }) {
  return (
    <View style={g.feat}>
      <Text style={{ color: color || C.teal, fontSize: 14 }}>{ic}</Text>
      <Text style={{ color: C.ink, fontSize: 13, flex: 1, lineHeight: 18 }}>{t}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  note: { color: C.mut, fontSize: 12, textAlign: "center", marginTop: 10 },
});
