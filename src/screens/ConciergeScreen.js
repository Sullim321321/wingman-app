import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView, View, Text, TextInput, Pressable, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { sendConciergeMessage } from "../api";

const QUICK = [
  "Is my flight on time?",
  "What's my next trip?",
  "Any weather risks?",
  "Dinner recommendations?",
];

export default function ConciergeScreen({ route }) {
  const prefill = route?.params?.prefill || null;
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi — I'm your Wingman. I can answer questions about your trips, check disruption risk, and help you plan. What do you need?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const prefillSent = useRef(false);

  // Auto-send prefill message from TripDetailScreen
  useEffect(() => {
    if (prefill && !prefillSent.current) {
      prefillSent.current = true;
      setTimeout(() => send(prefill), 400);
    }
  }, [prefill]);

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");
    const userMsg = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);
    try {
      const history = newMessages.slice(1).map(m => ({ role: m.role, content: m.content }));
      const data = await sendConciergeMessage(msg, history.slice(0, -1));
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't connect right now. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const isUser = item.role === "user";
    return (
      <View style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}>
        {!isUser && (
          <View style={s.aiLabel}>
            <LinearGradient colors={[C.accent, C.teal]} style={s.aiDot} />
            <Text style={s.aiLabelT}>WINGMAN</Text>
          </View>
        )}
        <Text style={[s.bubbleT, isUser && s.userBubbleT]}>{item.content}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.app}>
      <View style={s.header}>
        <LinearGradient colors={[C.accent, C.teal]} style={s.headerMark}><Text style={{ fontSize: 14 }}>✈</Text></LinearGradient>
        <Text style={s.headerT}>Concierge</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={loading ? (
            <View style={[s.bubble, s.aiBubble]}>
              <View style={s.aiLabel}>
                <LinearGradient colors={[C.accent, C.teal]} style={s.aiDot} />
                <Text style={s.aiLabelT}>WINGMAN</Text>
              </View>
              <ActivityIndicator color={C.teal} size="small" style={{ marginTop: 4 }} />
            </View>
          ) : null}
        />

        {messages.length <= 1 && (
          <View style={s.quickRow}>
            {QUICK.map(q => (
              <Pressable key={q} style={s.quickChip} onPress={() => send(q)}>
                <Text style={s.quickChipT}>{q}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={s.inputRow}>
          <TextInput
            style={s.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Message Wingman..."
            placeholderTextColor={C.mut}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => send()}
          />
          <Pressable style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]} onPress={() => send()} disabled={!input.trim() || loading}>
            <LinearGradient colors={[C.accent, C.teal]} style={s.sendGrad}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>↑</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  headerMark: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerT: { color: C.ink, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  list: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 },
  bubble: { marginBottom: 14, maxWidth: "86%" },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#2D4FCC", borderRadius: 20, borderBottomRightRadius: 5, padding: 14, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  aiBubble: { alignSelf: "flex-start", backgroundColor: C.card, borderRadius: 20, borderBottomLeftRadius: 5, padding: 16, borderWidth: 1, borderColor: C.line },
  bubbleT: { color: C.ink, fontSize: 15, lineHeight: 23 },
  userBubbleT: { color: "#fff" },
  aiLabel: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  aiDot: { width: 8, height: 8, borderRadius: 4 },
  aiLabelT: { color: C.teal, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  quickChip: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  quickChipT: { color: C.ink, fontSize: 13, fontWeight: "500", letterSpacing: 0.1 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.06)" },
  textInput: { flex: 1, backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, paddingHorizontal: 18, paddingVertical: 13, color: C.ink, fontSize: 15, maxHeight: 120, lineHeight: 21 },
  sendBtn: { marginBottom: 2 },
  sendGrad: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
});
