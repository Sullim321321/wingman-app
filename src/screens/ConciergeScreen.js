// ConciergeScreen — AI Travel Concierge with persistent thread memory
// Warm espresso palette + champagne gold + DM Sans

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  SafeAreaView, View, Text, TextInput, Pressable, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { C, T } from "../theme";
import { SerifText } from "../components";
import { sendConciergeMessage, getTrips, getConciergeThread, saveConciergeThread } from "../api";
import { LOCATION_OPT_IN_KEY } from "./SettingsScreen";

const WELCOME = "Good day. I'm watching your trips, tracking disruption risk, and ready to act the moment something changes. What can I do for you?";

function buildTripContext(trips) {
  if (!trips || trips.length === 0) return null;
  const lines = trips.slice(0, 5).map(trip => {
    const legs = (trip.legs || []).map(leg => {
      if (leg.type === "flight") {
        const parts = [
          leg.carrier && leg.flight_number ? `${leg.carrier}${leg.flight_number}` : null,
          leg.origin && leg.destination ? `${leg.origin}→${leg.destination}` : null,
          leg.departs_at ? new Date(leg.departs_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null,
        ].filter(Boolean);
        return `flight: ${parts.join(" ")}`;
      }
      if (leg.type === "hotel") return `hotel: ${leg.carrier || leg.destination || "unknown"}`;
      return null;
    }).filter(Boolean);
    return `Trip "${trip.title}": ${legs.join("; ") || "no legs"}`;
  });
  return lines.join("\n");
}

function findNextFlight(trips) {
  const now = Date.now();
  let best = null, bestTime = Infinity;
  for (const trip of trips) {
    for (const leg of (trip.legs || [])) {
      if (leg.type !== "flight" || !leg.departs_at) continue;
      const t = new Date(leg.departs_at).getTime();
      if (t > now && t < bestTime) { bestTime = t; best = { ...leg, tripTitle: trip.title }; }
    }
  }
  return best;
}

function buildQuickChips(trips) {
  const next = findNextFlight(trips);
  const chips = [];
  if (next?.origin && next?.destination) {
    chips.push(`Weather risk for ${next.origin} → ${next.destination}?`);
    if (next.carrier && next.flight_number) chips.push(`Is ${next.carrier}${next.flight_number} on time?`);
  }
  if (trips.length > 0) chips.push("What's my next trip?");
  const fallbacks = ["Any disruption risks?", "Dinner recommendations?", "Best airport lounge here?", "What should I know before I fly?"];
  for (const f of fallbacks) {
    if (chips.length >= 4) break;
    if (!chips.includes(f)) chips.push(f);
  }
  return chips.slice(0, 4);
}

export default function ConciergeScreen({ route }) {
  const prefill    = route?.params?.prefill || null;
  const routeTripId = route?.params?.tripId ? Number(route.params.tripId) : null;

  const [trips, setTrips]           = useState([]);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [activeTripId, setActiveTripId] = useState(routeTripId); // null = general thread
  const [messages, setMessages]     = useState([{ role: "assistant", content: WELCOME }]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const listRef     = useRef(null);
  const prefillSent = useRef(false);
  const saveTimer   = useRef(null);

  // Load trips on focus; also refresh location opt-in
  useFocusEffect(useCallback(() => {
    getTrips()
      .then(data => { setTrips(data.trips || []); setTripsLoaded(true); })
      .catch(() => setTripsLoaded(true));
    // Silently fetch location if user has opted in
    AsyncStorage.getItem(LOCATION_OPT_IN_KEY).then(async (v) => {
      if (v !== "true") { setUserLocation(null); return; }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch { setUserLocation(null); }
    }).catch(() => {});
  }, []));

  // Load thread when activeTripId changes or trips load
  useEffect(() => {
    if (!tripsLoaded) return;
    loadThread(activeTripId);
  }, [activeTripId, tripsLoaded]);

  // Auto-send prefill after thread loads
  useEffect(() => {
    if (prefill && !prefillSent.current && tripsLoaded) {
      prefillSent.current = true;
      setTimeout(() => send(prefill), 600);
    }
  }, [prefill, tripsLoaded]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  async function loadThread(tripId) {
    setThreadLoading(true);
    try {
      const data = await getConciergeThread(tripId);
      const saved = data.messages || [];
      if (saved.length > 0) {
        setMessages([{ role: "assistant", content: WELCOME }, ...saved]);
      } else {
        setMessages([{ role: "assistant", content: WELCOME }]);
      }
    } catch {
      setMessages([{ role: "assistant", content: WELCOME }]);
    } finally {
      setThreadLoading(false);
    }
  }

  function scheduleSave(msgs, tripId) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const toSave = msgs.filter(m => m.role !== "assistant" || msgs.indexOf(m) > 0);
      saveConciergeThread(toSave, tripId).catch(() => {});
    }, 1500);
  }

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
      const tripContext = buildTripContext(trips);
      const isFirstUserMsg = newMessages.filter(m => m.role === "user").length === 1;
      const enrichedMsg = (isFirstUserMsg && tripContext) ? `[User's trips:\n${tripContext}]\n\n${msg}` : msg;
      const data = await sendConciergeMessage(enrichedMsg, history.slice(0, -1), userLocation);
      const updated = [...newMessages, { role: "assistant", content: data.reply }];
      setMessages(updated);
      scheduleSave(updated.slice(1), activeTripId); // don't save the welcome message
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't connect right now. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  const quickChips = buildQuickChips(trips);
  const upcomingTrips = trips.filter(t => t.status === "upcoming" || t.status === "active").slice(0, 5);

  const renderItem = ({ item }) => {
    const isUser = item.role === "user";
    return (
      <View style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}>
        {!isUser && (
          <View style={s.aiLabel}>
            <View style={s.aiDot} />
            <Text style={s.aiLabelT}>WINGMAN</Text>
          </View>
        )}
        <Text style={[s.bubbleT, isUser && s.userBubbleT]}>{item.content}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.app}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerMark}>
          <SerifText bold style={{ color: C.gold, fontSize: 16 }}>W</SerifText>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerT}>CONCIERGE</Text>
          {trips.length > 0 && (
            <Text style={s.headerSub}>Watching {trips.length} trip{trips.length !== 1 ? "s" : ""}</Text>
          )}
        </View>
      </View>

      {/* Thread selector — General + per-trip threads */}
      {upcomingTrips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.threadRow}>
          <Pressable
            style={[s.threadChip, activeTripId === null && s.threadChipActive]}
            onPress={() => setActiveTripId(null)}
          >
            <Text style={[s.threadChipT, activeTripId === null && s.threadChipTActive]}>General</Text>
          </Pressable>
          {upcomingTrips.map(t => (
            <Pressable
              key={t.id}
              style={[s.threadChip, activeTripId === t.id && s.threadChipActive]}
              onPress={() => setActiveTripId(t.id)}
            >
              <Text style={[s.threadChipT, activeTripId === t.id && s.threadChipTActive]} numberOfLines={1}>{t.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {threadLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={C.gold} />
          </View>
        ) : (
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
                  <View style={s.aiDot} />
                  <Text style={s.aiLabelT}>WINGMAN</Text>
                </View>
                <ActivityIndicator color={C.gold} size="small" style={{ marginTop: 4 }} />
              </View>
            ) : null}
          />
        )}

        {/* Quick chips — shown until first user message */}
        {messages.length <= 1 && !threadLoading && (
          <View style={s.quickRow}>
            {quickChips.map(q => (
              <Pressable key={q} style={s.quickChip} onPress={() => send(q)}>
                <Text style={s.quickChipT}>{q}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Input row */}
        <View style={s.inputRow}>
          <TextInput
            style={s.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Message Wingman…"
            placeholderTextColor={C.mut}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => send()}
            autoCorrect
            spellCheck
            autoCapitalize="sentences"
          />
          <Pressable
            style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.35 }]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
          >
            <LinearGradient colors={[C.gold, C.goldD]} style={s.sendGrad}>
              <Text style={{ color: C.inkD, fontSize: 16, fontFamily: T.sansB }}>↑</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:    { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerMark: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: C.gold + "55", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(201,169,110,0.06)" },
  headerT:    { color: C.ink, fontSize: 11, fontFamily: T.sansB, letterSpacing: T.trackWide },
  headerSub:  { color: C.gold, fontSize: 10, fontFamily: T.sansM, letterSpacing: 0.5, marginTop: 2 },

  threadRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, flexDirection: "row" },
  threadChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  threadChipActive: { borderColor: C.gold, backgroundColor: C.gold + "18" },
  threadChipT: { color: C.mut, fontSize: 12, fontFamily: T.sansM },
  threadChipTActive: { color: C.gold },

  list: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 },

  bubble:     { marginBottom: 14, maxWidth: "86%" },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(201,169,110,0.14)",
    borderRadius: 18, borderBottomRightRadius: 4,
    padding: 14,
    borderWidth: 1, borderColor: "rgba(201,169,110,0.45)",
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(34,30,26,0.95)",
    borderRadius: 18, borderBottomLeftRadius: 4,
    padding: 16,
    borderWidth: 1, borderColor: "rgba(201,169,110,0.12)",
  },
  bubbleT:     { color: C.ink, fontSize: 15, fontFamily: T.sans, lineHeight: 24 },
  userBubbleT: { color: C.ink },

  aiLabel:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  aiDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold },
  aiLabelT: { color: C.gold, fontSize: 9, fontFamily: T.sansB, letterSpacing: T.trackWide },

  quickRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  quickChip: {
    backgroundColor: "rgba(201,169,110,0.08)", borderWidth: 1,
    borderColor: "rgba(201,169,110,0.3)", borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  quickChipT: { color: C.gold, fontSize: 13, fontFamily: T.sansM, letterSpacing: 0.1 },

  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingBottom: 20, paddingTop: 12,
    borderTopWidth: 0.5, borderTopColor: "rgba(201,169,110,0.12)",
    backgroundColor: C.bg,
  },
  textInput: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(201,169,110,0.18)", paddingHorizontal: 16, paddingVertical: 14,
    color: C.ink, fontSize: 15, fontFamily: T.sans, maxHeight: 120, lineHeight: 22,
  },
  sendBtn:  { marginBottom: 2 },
  sendGrad: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
