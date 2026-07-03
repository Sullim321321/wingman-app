// ActivityScreen — Live Monitoring Feed
// Warm espresso palette + champagne gold + DM Sans

import React, { useState, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  ActivityIndicator, RefreshControl, Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, T } from "../theme";
import { SerifText, g } from "../components";
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

// Hairline Unicode chars instead of emoji
const TYPE_META = {
  disruption:  { ic: "!",  color: C.coral,  actionable: true  },
  delay:       { ic: "~",  color: C.amber,  actionable: true  },
  recovery:    { ic: "+",  color: C.teal,   actionable: false },
  departed:    { ic: ">",  color: C.gold,   actionable: false },
  landed:      { ic: "v",  color: C.teal,   actionable: false },
  status:      { ic: "i",  color: C.mut,    actionable: false },
  import:      { ic: "@",  color: C.teal,   actionable: false },
  trip:        { ic: "#",  color: C.gold,   actionable: false },
  weather:     { ic: "~",  color: C.amber,  actionable: true  },
  seat_alert:  { ic: "S",  color: C.teal,   actionable: false },
  hotel_email: { ic: "H",  color: C.gold,   actionable: false },
};

function EventItem({ event, isLast, onAction }) {
  const meta = TYPE_META[event.type] || TYPE_META.status;

  return (
    <View style={s.item}>
      <View style={s.railWrap}>
        <View style={[s.dot, { backgroundColor: meta.color + "18", borderColor: meta.color + "35" }]}>
          <Text style={{ fontSize: 13, color: meta.color, fontFamily: T.sansB }}>{meta.ic}</Text>
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

        {meta.actionable && (
          <Pressable
            style={[s.actionBtn, { borderColor: meta.color + "35", backgroundColor: meta.color + "0C" }]}
            onPress={() => onAction(event)}
          >
            <Text style={[s.actionBtnT, { color: meta.color }]}>
              {event.type === "disruption" ? "See rescue options  ›" : "Review options  ›"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function ActivityScreen({ navigation }) {
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState(null);

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

  const handleAction = (event) => {
    const flight = event.flight
      ? event.flight
      : {
          origin:        event.origin        || null,
          destination:   event.destination   || null,
          carrier:       event.carrier       || null,
          flight_number: event.flight_number || null,
          departs_at:    event.departs_at    || null,
          tripTitle:     event.trip_title    || null,
        };
    navigation.navigate("Alert", { flight });
  };

  const disruptionCount = events.filter(e => e.type === "disruption" || e.type === "delay" || e.type === "weather").length;

  return (
    <SafeAreaView style={s.app}>
      {/* Header */}
      <View style={s.head}>
        <Text style={s.headT}>ALERTS</Text>
        {events.length > 0 && (
          <View style={s.countBadge}>
            <Text style={s.countT}>{events.length}</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[g.scroll, { paddingTop: 8 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.gold}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={s.emptyCard}>
            <View style={s.emptyIcon}>
              <Text style={{ color: C.coral, fontSize: 16, fontFamily: T.sansB }}>!</Text>
            </View>
            <SerifText style={s.emptyT}>Couldn't load activity</SerifText>
            <Text style={s.emptySub}>{error}</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={s.emptyCard}>
            <View style={s.emptyIcon}>
              <Text style={{ color: C.gold, fontSize: 18, fontFamily: T.sansB }}>◈</Text>
            </View>
            <SerifText style={s.emptyT}>All clear.</SerifText>
            <Text style={s.emptySub}>
              Wingman is watching your trips. Disruptions, delays, and gate changes will surface here the moment they happen — with rescue options ready.
            </Text>
            <Pressable style={s.emptyBtn} onPress={() => navigation.navigate("AddTrip")}>
              <Text style={s.emptyBtnT}>Add a trip</Text>
            </Pressable>
            <Pressable style={s.emptyBtnGhost} onPress={() => navigation.navigate("Connections")}>
              <Text style={s.emptyBtnGhostT}>Import from email →</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Disruption banner */}
            {disruptionCount > 0 && (
              <Pressable
                style={s.banner}
                onPress={() => {
                  const first = events.find(e => e.type === "disruption" || e.type === "delay" || e.type === "weather");
                  if (first) handleAction(first);
                }}
              >
                <View style={s.bannerInner}>
                  <View style={[s.dot, { backgroundColor: C.coral + "18", borderColor: C.coral + "35", marginTop: 0 }]}>
                    <Text style={{ color: C.coral, fontSize: 13, fontFamily: T.sansB }}>!</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.bannerT}>
                      Wingman caught{" "}
                      <Text style={{ color: C.coral, fontFamily: T.sansB }}>
                        {disruptionCount} disruption{disruptionCount !== 1 ? "s" : ""}
                      </Text>
                      {" "}on your upcoming trips.
                    </Text>
                    <Text style={s.bannerSub}>Tap to review options  ›</Text>
                  </View>
                </View>
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
  app:  { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  headT: { color: C.ink, fontSize: 11, fontFamily: T.sansB, letterSpacing: T.trackWide },
  countBadge: { backgroundColor: C.gold + "15", borderWidth: 1, borderColor: C.gold + "35", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  countT: { color: C.gold, fontSize: 10, fontFamily: T.sansB, letterSpacing: T.trackMed },

  // Disruption banner
  banner:      { marginBottom: 20, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.coral + "30" },
  bannerInner: { flexDirection: "row", gap: 12, alignItems: "center", padding: 16, backgroundColor: C.coral + "08" },
  bannerT:     { color: C.ink, fontSize: 14, fontFamily: T.sansM, lineHeight: 20 },
  bannerSub:   { color: C.coral, fontSize: 12, fontFamily: T.sansM, marginTop: 3 },

  // Feed
  feed:     { gap: 0 },
  item:     { flexDirection: "row", gap: 14 },
  railWrap: { alignItems: "center", width: 36 },
  dot:      { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  rail:     { flex: 1, width: 0.5, backgroundColor: C.line, marginTop: 4, minHeight: 20 },

  eventTitle: { color: C.ink, fontSize: 14, fontFamily: T.sansM, lineHeight: 20, letterSpacing: 0.1 },
  eventBody:  { color: C.mut, fontSize: 13, fontFamily: T.sans, marginTop: 3, lineHeight: 19 },
  metaRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7 },
  tripTag:    { backgroundColor: C.card2, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.line },
  tripTagT:   { color: C.mut, fontSize: 10, fontFamily: T.sansM, letterSpacing: 0.3 },
  when:       { color: C.mut, fontSize: 10, fontFamily: T.sans, letterSpacing: 0.2 },

  // Action button
  actionBtn:  { marginTop: 10, alignSelf: "flex-start", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  actionBtnT: { fontSize: 12, fontFamily: T.sansB, letterSpacing: 0.3 },

  // Empty state
  emptyCard: { alignItems: "center", padding: 44, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: C.gold + "40", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyT:    { color: C.ink, fontSize: 22, fontFamily: T.serifB, letterSpacing: T.trackTight, marginBottom: 8 },
  emptySub:  { color: C.mut, fontSize: 14, fontFamily: T.sans, textAlign: "center", lineHeight: 21, marginBottom: 24 },
  emptyBtn:  { backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
  emptyBtnT: { color: C.inkD, fontSize: 14, fontFamily: T.sansB, letterSpacing: 0.3 },
  emptyBtnGhost: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 },
  emptyBtnGhostT: { color: C.gold, fontSize: 13, fontFamily: T.sansM, letterSpacing: 0.2 },
});
