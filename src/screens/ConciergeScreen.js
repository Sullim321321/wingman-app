import React, { useState, useRef } from "react";
import { SafeAreaView, KeyboardAvoidingView, ScrollView, View, Text, TextInput, Pressable, Platform, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { tap } from "../components";

const REPLIES = {
  "Is my flight on time?": "Your JFK → DEN leg (UA 412) is on time. But I'm flagging the DEN → Aspen connection — 78% cancellation risk from incoming snow. Want to see backup options?",
  "Dinner in Aspen?": "Booked-out tonight, but I can hold an 8:30p table at Steakhouse No. 316, 4 min from Hotel Jerome. Want me to reserve it?",
  "Can I get an earlier flight?": "There's a 2:15p DEN → ASE with 2 seats — same weather risk though. If you want a guaranteed arrival, the private car is the safer bet today.",
};
const SUGGEST = Object.keys(REPLIES);

export default function ConciergeScreen() {
  const [msgs, setMsgs] = useState([
    { who: "bot", text: "Hi Maddie — I'm watching your Aspen trip. Ask me anything, or tell me what you'd like changed." },
  ]);
  const [val, setVal] = useState("");
  const scRef = useRef(null);

  const send = (text) => {
    const t = text.trim();
    if (!t) return;
    tap();
    setMsgs((m) => [...m, { who: "me", text: t }]);
    setVal("");
    setTimeout(() => {
      setMsgs((m) => [...m, { who: "bot", text: REPLIES[t] || "On it — I'll watch that and push you an update the moment anything changes." }]);
      scRef.current?.scrollToEnd({ animated: true });
    }, 700);
    setTimeout(() => scRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <SafeAreaView style={s.app}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.head}>
          <LinearGradient colors={[C.accent, C.teal]} style={s.mark}><Text style={{ fontSize: 13 }}>✈</Text></LinearGradient>
          <Text style={s.headT}>Concierge</Text>
        </View>
        <ScrollView ref={scRef} contentContainerStyle={s.scroll} onContentSizeChange={() => scRef.current?.scrollToEnd({ animated: true })}>
          {msgs.map((m, i) => (
            <View key={i} style={[s.msg, m.who === "me" ? s.me : s.bot]}>
              {m.who === "bot" ? <Text style={s.botH}>✦ WINGMAN</Text> : null}
              <Text style={[s.msgT, m.who === "me" && { color: "#fff" }]}>{m.text}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={s.suggest}>
          {SUGGEST.map((q, i) => (
            <Pressable key={i} style={s.sg} onPress={() => send(q)}><Text style={s.sgT}>{q}</Text></Pressable>
          ))}
        </View>
        <View style={s.inputRow}>
          <TextInput
            style={s.input} placeholder="Message Wingman…" placeholderTextColor={C.mut}
            value={val} onChangeText={setVal} onSubmitEditing={() => send(val)} returnKeyType="send"
          />
          <Pressable style={s.sendBtn} onPress={() => send(val)}>
            <LinearGradient colors={[C.accent, C.teal]} style={s.sendGrad}><Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>↑</Text></LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 12 },
  mark: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headT: { color: C.ink, fontSize: 18, fontWeight: "700" },
  scroll: { padding: 16, gap: 10 },
  msg: { maxWidth: "82%", padding: 11, borderRadius: 16 },
  bot: { alignSelf: "flex-start", backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 5 },
  me: { alignSelf: "flex-end", backgroundColor: C.accent, borderBottomRightRadius: 5 },
  botH: { color: C.teal, fontSize: 10, fontWeight: "700", marginBottom: 4 },
  msgT: { color: C.ink, fontSize: 13.5, lineHeight: 19 },
  suggest: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingHorizontal: 16, paddingBottom: 8 },
  sg: { backgroundColor: "#0E1530", borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  sgT: { color: C.accent, fontSize: 12 },
  inputRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, alignItems: "center" },
  input: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 15, paddingVertical: 11, color: C.ink, fontSize: 13.5 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, overflow: "hidden" },
  sendGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
});
