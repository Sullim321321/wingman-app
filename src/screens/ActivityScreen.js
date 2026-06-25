import React, { useState, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  ActivityIndicator, RefreshControl, Pressable,
} from "react-native";
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
  disruption:  { ic: "⚠️", color: C.coral },
  delay:       { ic: "⏱",  color: C.amber },
  recovery:    { ic: "✅", color: C.teal },
  departed:    { ic: "🛫", color: C.accent },
  landed:      { ic: "🛬", color: "#818CF8" },
  status:      { ic: "ℹ️", color: C.mut },
  import:      { ic: "📥", color: C.teal },
  trip:        { ic: "🧭", color: C.accent },
  weather:     { ic: "🌨️", color: C.accent },
  seat_alert:  { ic: "🪑", color: C.teal },
  hotel_email: { ic: "✉️", color: "#818CF8" },
};

function EventItem({ event, isLast }) {
  const meta = TYPE_META[event.type] || TYPE_META.status;
  return (
    <View style={s.item}>
      <View style={s.railWrap}>
        <View style={[s.dot, { backgroundColor: meta.color + "26", borderColor: meta.color + "50" }]}>
          <Text style={{ fontSize: 13 }}>{meta.ic}</Text>
        </View>
        {!isLast && <View style={s.rail} />}
      </View>
      <View style={{ flex: 1, paddingBottom: 18 }}>
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

  const disruptionCount = events.filter(e => e.type === "disruption" || e.type === "delay").length;

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
            <Text style={s.emptyT}>No activity yet</Text>
            <Text style={s.emptySub}>
              Add a trip with upcoming flights and Wingman will monitor them every 15 minutes — delays, cancellations, and gate changes will appear here.
            </Text>
            <Pressable style={s.emptyBtn} onPress={() => navigation.navigate("AddTrip")}>
              <Text style={s.emptyBtnT}>+ Add a trip</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {disruptionCount > 0 && (
              <View style={s.banner}>
                <Text style={{ fontSize: 18 }}>⚡</Text>
                <Text style={s.bannerT}>
                  Wingman caught <Text style={{ color: C.coral, fontWeight: "700" }}>{disruptionCount} disruption{disruptionCount !== 1 ? "s" : ""}</Text> on your upcoming trips.
                </Text>
              </View>
            )}
            <View style={s.feed}>
              {events.map((event, i) => (
                <EventItem key={event.id} event={event} isLast={i === events.length - 1} />
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
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 4 },
  headT: { color: C.ink, fontSize: 18, fontWeight: "700" },
  countBadge: { backgroundColor: C.accent + "22", borderWidth: 1, borderColor: C.accent + "44", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countT: { color: C.accent, fontSize: 11, fontWeight: "700" },
  banner: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "rgba(255,92,122,0.08)", borderWidth: 1, borderColor: "rgba(255,92,122,0.25)", borderRadius: 14, padding: 13, marginBottom: 16 },
  bannerT: { flex: 1, color: C.ink, fontSize: 13, lineHeight: 18 },
  feed: { gap: 0 },
  item: { flexDirection: "row", gap: 13 },
  railWrap: { alignItems: "center", width: 32 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  rail: { flex: 1, width: 2, backgroundColor: C.line, marginTop: 3, minHeight: 16 },
  eventTitle: { color: C.ink, fontSize: 13.5, fontWeight: "600", lineHeight: 19 },
  eventBody: { color: C.mut, fontSize: 12, marginTop: 2, lineHeight: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
  tripTag: { backgroundColor: C.card2, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tripTagT: { color: C.mut, fontSize: 11, fontWeight: "600" },
  when: { color: C.mut, fontSize: 11 },
  emptyCard: { alignItems: "center", padding: 40, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line },
  emptyIc: { fontSize: 40, marginBottom: 12 },
  emptyT: { color: C.ink, fontSize: 17, fontWeight: "700", marginBottom: 6 },
  emptySub: { color: C.mut, fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: 20 },
  emptyBtn: { backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnT: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
