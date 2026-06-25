import React, { useState, useCallback, useEffect } from "react";
import { SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { C } from "../theme";
import { Btn, g } from "../components";
import { getTrips, deleteTrip, getFlightStatus } from "../api";
import { scheduleDisruption } from "../notify";

function formatDate(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return null; }
}

function formatTime(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return null; }
}

function StatusBadge({ status }) {
  if (!status) return null;
  const map = {
    "On Time":   { bg: "rgba(34,211,166,0.14)", border: "rgba(34,211,166,0.3)", text: C.teal },
    "Delayed":   { bg: "rgba(251,191,36,0.14)",  border: "rgba(251,191,36,0.3)",  text: "#FBBf24" },
    "Cancelled": { bg: "rgba(239,68,68,0.14)",   border: "rgba(239,68,68,0.3)",   text: "#EF4444" },
    "Landed":    { bg: "rgba(99,102,241,0.14)",  border: "rgba(99,102,241,0.3)",  text: "#818CF8" },
    "Scheduled": { bg: "rgba(148,163,184,0.14)", border: "rgba(148,163,184,0.3)", text: C.mut },
    "In Air":    { bg: "rgba(91,140,255,0.14)",  border: "rgba(91,140,255,0.3)",  text: C.accent },
    "Booked":    { bg: "rgba(148,163,184,0.14)", border: "rgba(148,163,184,0.3)", text: C.mut },
  };
  const style = map[status] || map["Scheduled"];
  return (
    <View style={{ backgroundColor: style.bg, borderColor: style.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
      <Text style={{ color: style.text, fontSize: 11, fontWeight: "700" }}>{status}</Text>
    </View>
  );
}

function FlightLeg({ leg }) {
  const [status, setStatus] = useState(leg.status || null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!leg.flight_number) return;
    const ident = (leg.carrier || "") + (leg.flight_number || "");
    if (!ident.trim()) return;
    setFetching(true);
    getFlightStatus(ident)
      .then(d => { if (d && d.status) setStatus(d.status); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [leg.flight_number, leg.carrier]);

  const title = (leg.origin || "?") + " → " + (leg.destination || "?");
  const sub = [
    leg.carrier && leg.flight_number ? (leg.carrier + " " + leg.flight_number) : null,
    formatTime(leg.departs_at),
  ].filter(Boolean).join(" · ");

  return (
    <View style={s.leg}>
      <Text style={s.legIc}>🛫</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.legT}>{title}</Text>
        {sub ? <Text style={s.legS}>{sub}</Text> : null}
      </View>
      {fetching
        ? <ActivityIndicator size="small" color={C.teal} />
        : <StatusBadge status={status || "Scheduled"} />
      }
    </View>
  );
}

function TripCard({ trip, onDelete, navigation }) {
  const legs = trip.legs || [];
  const firstFlight = legs.find(l => l.type === "flight");
  const hotel = legs.find(l => l.type === "hotel");
  const origin = firstFlight?.origin || "—";
  const dest = firstFlight?.destination || trip.title;
  const depDate = formatDate(firstFlight?.departs_at);

  return (
    <Pressable onPress={() => navigation.navigate("TripDetail", { trip })} style={{ marginBottom: 12 }}>
    <LinearGradient colors={["#1D2A52", "#141D38"]} style={[s.tripCard, { marginBottom: 0 }]}>
      <View style={g.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={s.dest}>{trip.title}</Text>
          {depDate && <Text style={s.when}>{depDate}</Text>}
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <View style={s.pillLive}><Text style={s.pillLiveT}>● Monitoring</Text></View>
          <Pressable onPress={() => Alert.alert("Delete trip?", trip.title, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => onDelete(trip.id) }
          ])}><Text style={{ color: C.mut, fontSize: 18 }}>×</Text></Pressable>
        </View>
      </View>
      {legs.map((leg, i) => {
        if (leg.type === "flight") {
          return <FlightLeg key={i} leg={leg} />;
        }
        const ic = leg.type === "hotel" ? "🏨" : "🚗";
        const title = leg.carrier || leg.destination || "Booking";
        const sub = formatDate(leg.departs_at || leg.check_in);
        return (
          <View key={i} style={s.leg}>
            <Text style={s.legIc}>{ic}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.legT}>{title}</Text>
              {sub ? <Text style={s.legS}>{sub}</Text> : null}
            </View>
            <StatusBadge status="Booked" />
          </View>
        );
      })}
      {legs.length === 0 && (
        <Text style={{ color: C.mut, fontSize: 13, marginTop: 8 }}>No legs added yet</Text>
      )}
      <Text style={s.tapHint}>Tap for details →</Text>
    </LinearGradient>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getTrips();
      setTrips(data.trips || []);
    } catch (e) {
      console.error("[trips]", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = async (id) => {
    try {
      await deleteTrip(id);
      setTrips(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const onSimulate = async () => {
    await scheduleDisruption();
    setTimeout(() => navigation.navigate("Alert"), 3500);
  };

  return (
    <SafeAreaView style={s.app}>
      <ScrollView
        contentContainerStyle={g.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.teal} />}
      >
        <View style={s.appH}>
          <View style={s.logoRow}>
            <LinearGradient colors={[C.accent, C.teal]} style={s.mark}><Text style={{ fontSize: 14 }}>✈</Text></LinearGradient>
            <Text style={s.logo}>Wingman</Text>
          </View>
          <Pressable style={s.avatar} onPress={() => navigation.navigate("Settings")}><Text style={{ color: "#fff", fontWeight: "700" }}>M</Text></Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />
        ) : trips.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIc}>✈️</Text>
            <Text style={s.emptyT}>No trips yet</Text>
            <Text style={s.emptyS}>Add a trip manually or connect your email to import bookings automatically.</Text>
          </View>
        ) : (
          trips.map(trip => (
            <TripCard key={trip.id} trip={trip} onDelete={handleDelete} navigation={navigation} />
          ))
        )}

        <Btn title="+ Add a trip" onPress={() => navigation.navigate("AddTrip")} style={{ marginTop: 12 }} />
        <Btn title="📧  Connect email to import trips" kind="ghost" onPress={() => navigation.navigate("Connections")} style={{ marginTop: 8 }} />

        <Text style={g.sectionT}>LIVE MONITORING</Text>
        <Pressable style={s.monitor} onPress={() => navigation.navigate("Track")}>
          <View style={s.radarMini}><View style={s.radarMiniSweep} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.mt}>Watching {trips.length} trip{trips.length !== 1 ? "s" : ""}</Text>
            <Text style={s.ms}>Tap for track record →</Text>
          </View>
        </Pressable>

        <Text style={g.sectionT}>WHEN TRAVEL BREAKS</Text>
        <Btn title="⚡  Simulate a disruption" onPress={onSimulate} />
        <Text style={s.hint}>Schedules a real push in a few seconds — tap it to see the rescue.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  appH: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mark: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  logo: { color: C.ink, fontSize: 19, fontWeight: "700" },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#3A4A7A", alignItems: "center", justifyContent: "center" },
  tripCard: { borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.line, marginBottom: 12 },
  dest: { color: C.ink, fontSize: 20, fontWeight: "700" },
  when: { color: C.mut, fontSize: 13, marginTop: 2 },
  pillLive: { backgroundColor: "rgba(34,211,166,0.14)", borderColor: "rgba(34,211,166,0.3)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillLiveT: { color: C.teal, fontSize: 11, fontWeight: "700" },
  leg: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  legIc: { fontSize: 16 },
  legT: { color: C.ink, fontSize: 14, fontWeight: "600" },
  legS: { color: C.mut, fontSize: 12, marginTop: 1 },
  emptyCard: { alignItems: "center", padding: 40, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, marginBottom: 12 },
  emptyIc: { fontSize: 40, marginBottom: 12 },
  emptyT: { color: C.ink, fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptyS: { color: C.mut, fontSize: 13, textAlign: "center", lineHeight: 19 },
  monitor: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 12 },
  radarMini: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: "rgba(91,140,255,0.25)", overflow: "hidden" },
  radarMiniSweep: { position: "absolute", top: -2, left: 14, width: 2, height: 19, backgroundColor: C.accent },
  mt: { color: C.ink, fontSize: 13, fontWeight: "600" },
  ms: { color: C.mut, fontSize: 12 },
  hint: { color: C.mut, fontSize: 12, textAlign: "center", marginTop: 10 },
  tapHint: { color: C.mut, fontSize: 11, textAlign: "right", marginTop: 10, opacity: 0.6 },
});
