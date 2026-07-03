// ConciergeScreen — AI Travel Concierge with persistent thread memory
// Warm espresso palette + champagne gold + DM Sans
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  SafeAreaView, View, Text, TextInput, Pressable, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
  Alert, Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { C, T } from "../theme";
import { SerifText } from "../components";
import { sendConciergeMessage, getTrips, getConciergeThread, saveConciergeThread, clearConciergeThread } from "../api";
import { LOCATION_OPT_IN_KEY } from "./SettingsScreen";

// WELCOME is now dynamically generated based on trip context — see buildWelcome()
const WELCOME_DEFAULT = "Good day. I'm watching your trips, tracking disruption risk, and ready to act the moment something changes. What can I do for you?";

function buildWelcome(trips) {
  const next = findNextFlight(trips);
  if (!next) return WELCOME_DEFAULT;
  const diff = new Date(next.departs_at).getTime() - Date.now();
  if (diff <= 0) return WELCOME_DEFAULT;
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  let timeStr;
  if (hours < 1)        timeStr = `in ${Math.round(diff / 60000)}m`;
  else if (hours < 24)  timeStr = `in ${hours}h`;
  else if (days === 1)  timeStr = "tomorrow";
  else                  timeStr = `in ${days} days`;
  const route = (next.origin && next.destination) ? `${next.origin} → ${next.destination}` : null;
  const ident = (next.carrier && next.flight_number) ? `${next.carrier}${next.flight_number}` : null;
  const parts = [route, ident].filter(Boolean).join(" · ");
  return `Good day. Your next flight${parts ? ` (${parts})` : ""} departs ${timeStr}. I'm monitoring it now — what can I do for you?`;
}

// Context helpers
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

function buildInitialChips(trips) {
  const next = findNextFlight(trips);
  const chips = [];
  if (next?.origin && next?.destination) {
    chips.push(`Weather risk for ${next.origin} → ${next.destination}?`);
    if (next.carrier && next.flight_number) chips.push(`Is ${next.carrier}${next.flight_number} on time?`);
  }
  if (trips.length > 0) chips.push("What's my next trip?");
  const fallbacks = [
    "Any disruption risks?",
    "Dinner recommendations?",
    "Best airport lounge here?",
    "What should I know before I fly?",
    "Upgrade options on my next flight?",
    "How do I earn more points?",
  ];
  for (const f of fallbacks) {
    if (chips.length >= 4) break;
    if (!chips.includes(f)) chips.push(f);
  }
  return chips.slice(0, 4);
}

function buildFollowUpChips(lastReply, trips) {
  if (!lastReply) return [];
  const chips = [];
  const r = lastReply.toLowerCase();
  if (r.includes("bus") || r.includes("metro") || r.includes("train") || r.includes("tram") || r.includes("tube") || r.includes("transit")) {
    chips.push("How do I pay for the bus?");
    chips.push("Does Apple Pay work here?");
  }
  if (r.includes("flight") || r.includes("gate") || r.includes("delay") || r.includes("cancel") || r.includes("depart")) {
    chips.push("What are my rebooking options?");
    chips.push("Can I get an upgrade?");
  }
  if (r.includes("weather") || r.includes("rain") || r.includes("storm") || r.includes("fog") || r.includes("wind")) {
    chips.push("How likely is a delay?");
    chips.push("What's the forecast for my arrival?");
  }
  if (r.includes("hotel") || r.includes("check-in") || r.includes("room") || r.includes("accommodation")) {
    chips.push("Can you upgrade my room?");
    chips.push("What's the cancellation policy?");
  }
  if (r.includes("lounge") || r.includes("airport") || r.includes("terminal") || r.includes("gate")) {
    chips.push("Which lounges can I access?");
    chips.push("How far is my gate?");
  }
  if (r.includes("restaurant") || r.includes("dinner") || r.includes("lunch") || r.includes("eat") || r.includes("dining")) {
    chips.push("Book a table for tonight?");
    chips.push("Any Michelin-starred options?");
  }
  if (r.includes("points") || r.includes("miles") || r.includes("loyalty") || r.includes("status")) {
    chips.push("How many points do I have?");
    chips.push("Best way to earn more?");
  }
  if (r.includes("city") || r.includes("neighbourhood") || r.includes("neighborhood") || r.includes("area") || r.includes("visit")) {
    chips.push("What's on this week?");
    chips.push("Best areas to stay?");
  }
  const fallbacks = ["Tell me more.", "Any disruption risks?", "What else should I know?", "Upgrade options on my next flight?"];
  for (const f of fallbacks) {
    if (chips.length >= 4) break;
    if (!chips.includes(f)) chips.push(f);
  }
  return chips.slice(0, 4);
}

export default function ConciergeScreen({ route, navigation }) {
  const prefill     = route?.params?.prefill || null;
  const routeTripId = route?.params?.tripId ? Number(route.params.tripId) : null;
  const [trips, setTrips]               = useState([]);
  const [tripsLoaded, setTripsLoaded]   = useState(false);
  const [activeTripId, setActiveTripId] = useState(routeTripId);
  const [messages, setMessages]         = useState([{ role: "assistant", content: WELCOME_DEFAULT }]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const listRef      = useRef(null);
  const prefillSent  = useRef(false);
  const saveTimer    = useRef(null);
  const tripsRef     = useRef([]);  // always holds latest trips for use inside async callbacks

  useFocusEffect(useCallback(() => {
    getTrips()
      .then(data => {
        const loaded = data.trips || [];
        tripsRef.current = loaded;
        setTrips(loaded);
        setTripsLoaded(true);
        // Update the welcome message with trip context (only if thread hasn't been loaded yet)
        setMessages(prev => {
          if (prev.length === 1 && prev[0].role === "assistant") {
            return [{ role: "assistant", content: buildWelcome(loaded) }];
          }
          return prev;
        });
      })
      .catch(() => setTripsLoaded(true));
    AsyncStorage.getItem(LOCATION_OPT_IN_KEY).then(async (v) => {
      if (v !== "true") { setUserLocation(null); return; }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch { setUserLocation(null); }
    }).catch(() => {});
  }, []));

  useEffect(() => {
    if (!tripsLoaded) return;
    loadThread(activeTripId);
  }, [activeTripId, tripsLoaded]);

  useEffect(() => {
    if (prefill && !prefillSent.current && tripsLoaded) {
      prefillSent.current = true;
      setTimeout(() => send(prefill), 600);
    }
  }, [prefill, tripsLoaded]);

  function scrollToBottom(animated = true) {
    setTimeout(() => { listRef.current?.scrollToEnd({ animated }); }, 80);
  }
  useEffect(() => { if (messages.length > 0) scrollToBottom(); }, [messages]);

  async function loadThread(tripId) {
    setThreadLoading(true);
    try {
      const data = await getConciergeThread(tripId);
      // Filter out blank messages (null/empty content with no rich cards) to prevent blank bubbles
      const saved = (data.messages || []).filter(m =>
        m && (m.content || m.transit || m.places || m.action)
      );
      if (saved.length > 0) {
        setMessages([{ role: "assistant", content: buildWelcome(tripsRef.current) }, ...saved]);
      } else {
        setMessages([{ role: "assistant", content: buildWelcome(tripsRef.current) }]);
      }
    } catch {
      setMessages([{ role: "assistant", content: buildWelcome(tripsRef.current) }]);
    } finally {
      setThreadLoading(false);
    }
  }

  function confirmClearThread() {
    Alert.alert(
      "Clear Conversation",
      "This will permanently delete this conversation history. Wingman will start fresh.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try { await clearConciergeThread(activeTripId); } catch {}
            setMessages([{ role: "assistant", content: buildWelcome(tripsRef.current) }]);
          },
        },
      ]
    );
  }

  function scheduleSave(msgs, tripId) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const toSave = msgs.filter((m, i) => i > 0);
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
      const enrichedMsg = (isFirstUserMsg && tripContext)
        ? `[User's trips:\n${tripContext}]\n\n${msg}`
        : msg;
      const data = await sendConciergeMessage(enrichedMsg, history.slice(0, -1), userLocation);
      const aiMsg = {
        role: "assistant",
        content: data.reply,
        places: data.places || null,
        weather: data.weather || null,
        transit: data.transit || null,
        action: data.action || null,
      };
      const updated = [...newMessages, aiMsg];
      setMessages(updated);
      scheduleSave(updated.slice(1), activeTripId);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't connect right now. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  // Only show trips with real names and at least one leg in the tab row
  const CARRIER_ONLY_RE = /^(United Airlines|Delta Air Lines|American Airlines|British Airways|Lufthansa|Air France|Emirates|Qantas|Southwest Airlines|JetBlue|Alaska Airlines|Spirit Airlines|Frontier Airlines|Ryanair|easyJet|Wizz Air|Turkish Airlines|Singapore Airlines|Cathay Pacific|Air Canada|KLM|Iberia|Virgin Atlantic|Air New Zealand|Etihad Airways) Flight$/i;
  const upcomingTrips = trips
    .filter(t => {
      if (!t.title || t.title === "Unknown Trip" || t.title === "Unknown") return false;
      if (CARRIER_ONLY_RE.test(t.title.trim())) return false;
      const legs = t.legs || [];
      if (legs.length === 0) return false; // no legs — skip
      return true;
    })
    .slice(0, 5);
  const hasUserMessages = messages.some(m => m.role === "user");
  const isWelcomeMsg = (c) => !c || c.startsWith("Good day.");
  const lastAiReply = [...messages].reverse().find(m => m.role === "assistant" && !isWelcomeMsg(m.content))?.content || null;
  const chips = !hasUserMessages
    ? buildInitialChips(trips)
    : (!loading && lastAiReply ? buildFollowUpChips(lastAiReply, trips) : []);

  const renderItem = ({ item }) => {
    const isUser = item.role === "user";
    // Skip blank bubbles — no content and no rich cards
    if (!item.content && !item.transit && !item.places && !item.action) return null;
    return (
      <View style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}>
        {!isUser && (
          <View style={s.aiLabel}>
            <View style={s.aiDot} />
            <Text style={s.aiLabelT}>WINGMAN</Text>
          </View>
        )}
        <Text style={[s.bubbleT, isUser && s.userBubbleT]}>{item.content}</Text>

        {/* Transit route card */}
        {!isUser && item.transit && (
          <View style={s.transitCard}>
            <View style={s.transitHeader}>
              <Text style={s.transitIcon}>🚇</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.transitTitle}>Transit Route</Text>
                <Text style={s.transitMeta}>
                  {item.transit.total_duration}
                  {item.transit.total_distance ? ` · ${item.transit.total_distance}` : ""}
                  {item.transit.departure_time ? ` · Departs ${item.transit.departure_time}` : ""}
                </Text>
              </View>
            </View>
            {(item.transit.steps || []).slice(0, 5).map((step, i) => (
              <View key={i} style={s.transitStep}>
                <Text style={s.transitStepMode}>{step.mode === "TRANSIT" ? "≡" : step.mode === "WALKING" ? "→" : "•"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.transitStepText}>{step.instruction}</Text>
                  {step.transit && (
                    <Text style={s.transitStepDetail}>
                      {step.transit.vehicle ? `${step.transit.vehicle} ` : ""}{step.transit.line || ""}
                      {step.transit.departure_stop ? ` from ${step.transit.departure_stop}` : ""}
                      {step.transit.arrival_stop ? ` → ${step.transit.arrival_stop}` : ""}
                      {step.transit.num_stops ? ` (${step.transit.num_stops} stops)` : ""}
                    </Text>
                  )}
                  {step.duration && <Text style={s.transitStepDuration}>{step.duration}</Text>}
                </View>
              </View>
            ))}
            {item.transit.payment && (
              <View style={s.transitPayment}>
                <Text style={s.transitPaymentTitle}>HOW TO PAY</Text>
                <Text style={s.transitPaymentTip}>{item.transit.payment.tip}</Text>
                <Pressable
                  style={s.transitTicketBtn}
                  onPress={() => Linking.openURL(item.transit.payment.ticket_url)}
                >
                  <Text style={s.transitTicketBtnT}>Buy Tickets →</Text>
                </Pressable>
              </View>
            )}
            <Pressable
              style={s.transitMapsBtn}
              onPress={() => Linking.openURL(item.transit.maps_url)}
            >
              <LinearGradient colors={[C.gold, C.goldD || "#b8924a"]} style={s.transitMapsBtnGrad}>
                <Text style={s.transitMapsBtnT}>Open in Maps</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* Places cards */}
        {!isUser && item.places && item.places.length > 0 && (
          <View style={s.placesWrap}>
            {item.places.slice(0, 3).map((p, i) => (
              <Pressable
                key={i}
                style={s.placeCard}
                onPress={() => Linking.openURL(p.maps_url)}
              >
                <View style={s.placeCardRow}>
                  <Text style={s.placeName}>{p.name}</Text>
                  {p.open_now === true && <Text style={s.placeOpen}>Open</Text>}
                  {p.open_now === false && <Text style={s.placeClosed}>Closed</Text>}
                </View>
                {p.address ? <Text style={s.placeAddr}>{p.address}</Text> : null}
                <View style={s.placeCardRow}>
                  {p.rating ? <Text style={s.placeRating}>{p.rating}★  {p.user_ratings_total > 0 ? `(${p.user_ratings_total})` : ''}</Text> : null}
                  <Text style={s.placeMapLink}>Open in Maps →</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Action button */}
        {!isUser && item.action && item.action.url && (
          <Pressable
            style={s.actionBtn}
            onPress={() => Linking.openURL(item.action.url)}
          >
            <LinearGradient colors={[C.gold, C.goldD || "#b8924a"]} style={s.actionBtnGrad}>
              <Text style={s.actionBtnT}>{item.action.label || "Open"}</Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.app}>
      <View style={s.header}>
        <View style={s.headerMark}>
          <SerifText bold style={{ color: C.gold, fontSize: 16 }}>W</SerifText>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerT}>CONCIERGE</Text>
          {(() => {
            const next = findNextFlight(trips);
            if (next?.tripTitle && next.tripTitle !== "Unknown Trip") {
              const daysUntil = Math.ceil((new Date(next.departs_at).getTime() - Date.now()) / 86400000);
              const label = daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`;
              return <Text style={s.headerSub}>{next.tripTitle} · {label}</Text>;
            }
            if (trips.length > 0) return <Text style={s.headerSub}>Watching {trips.length} trip{trips.length !== 1 ? "s" : ""}</Text>;
            return null;
          })()}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {activeTripId && (
            <Pressable
              style={s.tripLinkBtn}
              onPress={() => navigation.navigate("TripDetail", { tripId: activeTripId })}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.tripLinkBtnT}>Trip ›</Text>
            </Pressable>
          )}
          {hasUserMessages && (
            <Pressable
              style={s.clearBtn}
              onPress={confirmClearThread}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.clearBtnT}>✕ Clear</Text>
            </Pressable>
          )}
        </View>
      </View>

      {upcomingTrips.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.threadRow}>
          {upcomingTrips.map(t => {
            const firstFlight = (t.legs || []).find(l => l.type === "flight");
            const route = firstFlight?.origin && firstFlight?.destination
              ? `${firstFlight.origin} → ${firstFlight.destination}`
              : null;
            const depDate = firstFlight?.departs_at
              ? new Date(firstFlight.departs_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : null;
            return (
              <Pressable
                key={t.id}
                style={[s.threadChip, activeTripId === t.id && s.threadChipActive]}
                onPress={() => setActiveTripId(t.id)}
              >
                <Text style={[s.threadChipT, activeTripId === t.id && s.threadChipTActive]} numberOfLines={1}>{t.title}</Text>
                {(route || depDate) && (
                  <Text style={[s.threadChipSub, activeTripId === t.id && s.threadChipSubActive]} numberOfLines={1}>
                    {route || depDate}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
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
            onContentSizeChange={() => scrollToBottom(true)}
            onLayout={() => scrollToBottom(false)}
            ListFooterComponent={
              <>
                {loading && (
                  <View style={[s.bubble, s.aiBubble]}>
                    <View style={s.aiLabel}>
                      <View style={s.aiDot} />
                      <Text style={s.aiLabelT}>WINGMAN</Text>
                    </View>
                    <ActivityIndicator color={C.gold} size="small" style={{ marginTop: 4 }} />
                  </View>
                )}
                {chips.length > 0 && !loading && (
                  <View style={s.chipsInline}>
                    {chips.map(q => (
                      <Pressable key={q} style={s.quickChip} onPress={() => send(q)}>
                        <Text style={s.quickChipT}>{q}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            }
          />
        )}

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
            autoCorrect={true}
            spellCheck={true}
            autoCapitalize="sentences"
            textContentType="none"
            keyboardType="default"
            enablesReturnKeyAutomatically={false}
            blurOnSubmit={false}
          />
          <Pressable
            style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.35 }]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
          >
            <LinearGradient colors={[C.gold, C.goldD || "#b8924a"]} style={s.sendGrad}>
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
  clearBtn:   { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.gold + "40", backgroundColor: C.gold + "0F" },
  clearBtnT:  { color: C.mut, fontSize: 11, fontFamily: T.sansM, letterSpacing: 0.5 },
  tripLinkBtn:  { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.gold + "60", backgroundColor: C.gold + "15" },
  tripLinkBtnT: { color: C.gold, fontSize: 11, fontFamily: T.sansB, letterSpacing: 0.5 },
  threadRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, flexDirection: "row" },
  threadChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  threadChipActive: { borderColor: C.gold, backgroundColor: C.gold + "18" },
  threadChipT: { color: C.mut, fontSize: 12, fontFamily: T.sansM },
  threadChipTActive: { color: C.gold },
  threadChipSub: { color: C.mut, fontSize: 10, fontFamily: T.sans, marginTop: 2, opacity: 0.7 },
  threadChipSubActive: { color: C.gold, opacity: 0.8 },
  list: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 },
  bubble:     { marginBottom: 14, maxWidth: "86%" },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: C.gold + "22",
    borderRadius: 18, borderBottomRightRadius: 4,
    padding: 14,
    borderWidth: 1, borderColor: C.gold + "66",
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: C.card,
    borderRadius: 18, borderBottomLeftRadius: 4,
    padding: 16,
    borderWidth: 1, borderColor: C.line,
  },
  bubbleT:     { color: C.ink, fontSize: 15, fontFamily: T.sans, lineHeight: 24 },
  userBubbleT: { color: C.ink },
  aiLabel:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  aiDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold },
  aiLabelT: { color: C.gold, fontSize: 9, fontFamily: T.sansB, letterSpacing: T.trackWide },
  chipsInline: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    marginTop: 4, marginBottom: 16, paddingHorizontal: 0,
  },
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
  placesWrap: { marginTop: 12, gap: 8 },
  placeCard: {
    backgroundColor: "rgba(201,169,110,0.07)",
    borderWidth: 1, borderColor: "rgba(201,169,110,0.25)",
    borderRadius: 12, padding: 12, gap: 4,
  },
  placeCardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  placeName:   { color: C.ink, fontSize: 14, fontFamily: T.sansB, flex: 1, marginRight: 8 },
  placeAddr:   { color: C.mut, fontSize: 12, fontFamily: T.sans },
  placeRating: { color: C.gold, fontSize: 12, fontFamily: T.sansM },
  placeOpen:   { color: C.teal, fontSize: 11, fontFamily: T.sansB, letterSpacing: 0.5 },
  placeClosed: { color: C.coral, fontSize: 11, fontFamily: T.sansB, letterSpacing: 0.5 },
  placeMapLink: { color: C.gold, fontSize: 12, fontFamily: T.sansM },
  actionBtn: { marginTop: 14, borderRadius: 12, overflow: "hidden" },
  actionBtnGrad: { paddingVertical: 13, paddingHorizontal: 18, alignItems: "center" },
  actionBtnT: { color: C.inkD, fontSize: 14, fontFamily: T.sansB, letterSpacing: 0.5 },
  transitCard: {
    marginTop: 14,
    backgroundColor: C.card2,
    borderWidth: 1, borderColor: C.gold + "4D",
    borderRadius: 14, padding: 14, gap: 10,
  },
  transitHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  transitIcon:   { fontSize: 20, marginTop: 2 },
  transitTitle:  { color: C.ink, fontSize: 14, fontFamily: T.sansB },
  transitMeta:   { color: C.gold, fontSize: 12, fontFamily: T.sansM, marginTop: 2 },
  transitStep:   { flexDirection: "row", gap: 8, paddingVertical: 4, borderTopWidth: 0.5, borderTopColor: "rgba(201,169,110,0.1)" },
  transitStepMode: { fontSize: 14, width: 22, textAlign: "center", marginTop: 2 },
  transitStepText: { color: C.ink, fontSize: 13, fontFamily: T.sans, lineHeight: 20 },
  transitStepDetail: { color: C.gold, fontSize: 12, fontFamily: T.sansM, marginTop: 2 },
  transitStepDuration: { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 1 },
  transitPayment: {
    backgroundColor: "rgba(201,169,110,0.07)",
    borderRadius: 10, padding: 12, gap: 6,
    borderWidth: 1, borderColor: "rgba(201,169,110,0.2)",
  },
  transitPaymentTitle: { color: C.gold, fontSize: 11, fontFamily: T.sansB, letterSpacing: T.trackWide },
  transitPaymentTip:   { color: C.ink, fontSize: 13, fontFamily: T.sans, lineHeight: 20 },
  transitTicketBtn: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.gold, marginTop: 4 },
  transitTicketBtnT: { color: C.gold, fontSize: 12, fontFamily: T.sansM },
  transitMapsBtn: { borderRadius: 10, overflow: "hidden", marginTop: 4 },
  transitMapsBtnGrad: { paddingVertical: 11, paddingHorizontal: 16, alignItems: "center" },
  transitMapsBtnT: { color: C.inkD, fontSize: 13, fontFamily: T.sansB, letterSpacing: 0.5 },
});
