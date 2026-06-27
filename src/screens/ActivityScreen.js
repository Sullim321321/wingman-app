import React, { useState, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  ActivityIndicator, RefreshControl, Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { C } from "../theme";
import { g } from "../components";
import { getActivity } from "../api";

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TYPE_META = {
  disruption:  { ic: "⚠️", color: C.coral,   actionable: true },
  delay:       { ic: "⏱",  color: C.amber,   actionable: true },
  recovery:    { ic: "✅", color: C.teal,    actionable: false },
  departed:    { ic: "🛫", color: C.accent,  actionable: false },
  landed:      { ic: "🛬", color: "#818CF8", actionable: false },
  status:      { ic: "ℹ️", color: C.mut,     actionable: false },
  import:      { ic: "📥", color: C.teal,    actionable: false },
  trip:        { ic: "🧭", color: C.accent,  actionable: false },
  weather:     { ic: "🌨️", color: C.amber,   actionable: true },
  seat_alert:  { ic: "🪑", color: C.teal,    actionable: false },
  hotel_email: { ic: "✉️", color: "#818CF8", actionable: false },
};

function EventItem({ event, isLast, onAction }) {
  const meta = TYPE_META[event.type] || TYPE_META.status;
  const isActionable = meta.actionable;

  return (
    <View style={s.item}>
      <View style={s.railWrap}>
        <View style={[s.dot, { backgroundColor: meta.color + "1A", borderColor: meta.color + "40" }]}>
          <Text style={{ fontSize: 14 }}>{meta.ic}</Text>
        </View>
        {!isLast && <View style={s.rail} />}
      </View>

      <View style={{ flex: 1, paddingBottom: 20 }}>
        <Text style={s.eventTitle}>{event.title}</Text>
        {event.body ? <Text style={s.eventBody}>{event.body}</Text> : null}

        <View style={s.metaRow}>
          {event.trip_title && (
            <View style={s.tripTag}>
              <Text style={s.tripTagT}>{event.trip_title}</Text>
            </View>
          )}
          <Text style={s.when}>{timeAgo(event.created_at)}</Text>
        </View>

        {/* Action button for disruptions and delays */}
        {isActionable && (
          <Pressable
            style={[s.actionBtn, { borderColor: meta.color + "40", backgroundColor: meta.color + "0D" }]}
            onPress={() => onAction(event)}
          >
            <Text style={[s.actionBtnT, { color: meta.color }]}>
              {event.type === "disruption" ? "See rescue options →" : "Review options →"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function ActivityScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getActivity();
      setEvents(data.events || []);
    } catch (e) {
      console.error("[activity]", e.message);
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Navigate to AlertScreen pre-loaded with the event's flight context
  const handleAction = (event) => {
    const flight = event.flight
      ? event.flight
      : {
          origin: event.origin || null,
          destination: event.destination || null,
          carrier: event.carrier || null,
          flight_number: event.flight_number || null,
          departs_at: event.departs_at || null,
          tripTitle: event.trip_title || null,
        };
    navigation.navigate("Alert", { flight });
  };

  const disruptionCount = events.filter(e => e.type === "disruption" || e.type === "delay" || e.type === "weather").length;

  return (
    <SafeAreaView style={s.app}>
      <View style={s.head}>
        <Text style={s.headT}>Activity</Text>
        {events.length > 0 && (
          <View style={s.countBadge}>
            <Text style={s.countT}>{events.length}</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[g.scroll, { paddingTop: 8 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.teal} />}
      >
        {loading ? (
          <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIc}>⚠️</Text>
            <Text style={s.emptyT}>Couldn't load activity</Text>
            <Text style={s.emptySub}>{error}</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIc}>📡</Text>
            <Text style={s.emptyT}>Nothing yet</Text>
            <Text style={s.emptySub}>
              Add a trip with upcoming flights and Wingman will monitor them every 15 minutes — delays, cancellations, and gate changes will appear here.
            </Text>
            <Pressable style={s.emptyBtn} onPress={() => navigation.navigate("AddTrip")}>
              <Text style={s.emptyBtnT}>+ Add a trip</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Disruption banner with CTA */}
            {disruptionCount > 0 && (
              <Pressable
                style={s.banner}
                onPress={() => {
                  const firstDisruption = events.find(e => e.type === "disruption" || e.type === "delay" || e.type === "weather");
                  if (firstDisruption) handleAction(firstDisruption);
                }}
              >
                <LinearGradient colors={["rgba(255,77,109,0.10)", "rgba(255,77,109,0.04)"]} style={s.bannerGrad}>
                  <Text style={{ fontSize: 20 }}>⚡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.bannerT}>
                      Wingman caught{" "}
                      <Text style={{ color: C.coral, fontWeight: "800" }}>
                        {disruptionCount} disruption{disruptionCount !== 1 ? "s" : ""}
                      </Text>
                      {" "}on your upcoming trips.
                    </Text>
                    <Text style={s.bannerSub}>Tap to review options →</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            )}

            <View style={s.feed}>
              {events.map((event, i) => (
                <EventItem
                  key={event.id || i}
                  event={event}
                  isLast={i === events.length - 1}
                  onAction={handleAction}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  headT: { color: C.ink, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  countBadge: { backgroundColor: "rgba(74,114,255,0.12)", borderWidth: 1, borderColor: "rgba(74,114,255,0.25)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  countT: { color: C.accent, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },

  // Disruption banner
  banner: { marginBottom: 20, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,77,109,0.2)" },
  bannerGrad: { flexDirection: "row", gap: 12, alignItems: "center", padding: 16 },
  bannerT: { color: C.ink, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  bannerSub: { color: C.coral, fontSize: 12, fontWeight: "600", marginTop: 3 },

  // Feed
  feed: { gap: 0 },
  item: { flexDirection: "row", gap: 14 },
  railWrap: { alignItems: "center", width: 36 },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  rail: { flex: 1, width: 1, backgroundColor: C.line, marginTop: 4, minHeight: 20, opacity: 0.4 },
  eventTitle: { color: C.ink, fontSize: 14, fontWeight: "600", lineHeight: 20, letterSpacing: 0.1 },
  eventBody: { color: C.mut, fontSize: 13, marginTop: 3, lineHeight: 19 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7 },
  tripTag: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  tripTagT: { color: C.mut, fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
  when: { color: C.mut, fontSize: 11, letterSpacing: 0.2 },

  // Action button
  actionBtn: { marginTop: 10, alignSelf: "flex-start", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7 },
  actionBtnT: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },

  // Empty state
  emptyCard: { alignItems: "center", padding: 44, backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line },
  emptyIc: { fontSize: 44, marginBottom: 14 },
  emptyT: { color: C.ink, fontSize: 19, fontWeight: "700", marginBottom: 8, letterSpacing: -0.3 },
  emptySub: { color: C.mut, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 24 },
  emptyBtn: { backgroundColor: C.accent, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 },
  emptyBtnT: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.2 },
});
