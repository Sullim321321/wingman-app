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

export default function ConciergeScreen() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi — I'm your Wingman. I can answer questions about your trips, check disruption risk, and help you plan. What do you need?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

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
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerMark: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerT: { color: C.ink, fontSize: 19, fontWeight: "700" },
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  bubble: { marginBottom: 12, maxWidth: "85%" },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#4A6EFF", borderRadius: 18, borderBottomRightRadius: 4, padding: 14 },
  aiBubble: { alignSelf: "flex-start", backgroundColor: C.card, borderRadius: 18, borderBottomLeftRadius: 4, padding: 14, borderWidth: 1, borderColor: C.line },
  bubbleT: { color: C.ink, fontSize: 15, lineHeight: 22 },
  userBubbleT: { color: "#fff" },
  aiLabel: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  aiDot: { width: 8, height: 8, borderRadius: 4 },
  aiLabelT: { color: C.teal, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  quickChip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  quickChipT: { color: C.ink, fontSize: 13, fontWeight: "500" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line },
  textInput: { flex: 1, backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingVertical: 12, color: C.ink, fontSize: 15, maxHeight: 120 },
  sendBtn: { marginBottom: 2 },
  sendGrad: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
