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
    "On Time":   { bg: "rgba(20,201,153,0.12)", border: "rgba(20,201,153,0.25)", text: C.teal },
    "Delayed":   { bg: "rgba(255,176,46,0.12)",  border: "rgba(255,176,46,0.25)",  text: C.amber },
    "Cancelled": { bg: "rgba(255,77,109,0.12)",  border: "rgba(255,77,109,0.25)",  text: C.coral },
    "Landed":    { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.25)",  text: "#818CF8" },
    "Scheduled": { bg: "rgba(134,144,166,0.10)", border: "rgba(134,144,166,0.2)",  text: C.mut },
    "In Air":    { bg: "rgba(74,114,255,0.12)",  border: "rgba(74,114,255,0.25)",  text: C.accent },
    "Booked":    { bg: "rgba(134,144,166,0.10)", border: "rgba(134,144,166,0.2)",  text: C.mut },
  };
  const st = map[status] || map["Scheduled"];
  return (
    <View style={{ backgroundColor: st.bg, borderColor: st.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: st.text, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 }}>{status}</Text>
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
    <Pressable onPress={() => navigation.navigate("TripDetail", { trip })} style={{ marginBottom: 14 }}>
    <LinearGradient colors={["#111827", "#0D1120"]} style={[s.tripCard, { marginBottom: 0 }]}>
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
          <Pressable style={s.avatar} onPress={() => navigation.navigate("Settings")}>
            <LinearGradient colors={[C.accent + "80", C.teal + "80"]} style={s.avatarGrad}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>M</Text>
            </LinearGradient>
          </Pressable>
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
          <View style={s.radarMini}>
            <View style={s.radarMiniRing} />
            <View style={s.radarMiniSweep} />
            <View style={s.radarMiniDot} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.mt}>Watching {trips.length} trip{trips.length !== 1 ? "s" : ""}</Text>
            <Text style={s.ms}>Tap for track record →</Text>
          </View>
          <Text style={{ color: C.mut, fontSize: 18, opacity: 0.5 }}>›</Text>
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
  appH: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  logo: { color: C.ink, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  avatar: { width: 34, height: 34, borderRadius: 17, overflow: "hidden" },
  avatarGrad: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  tripCard: { borderRadius: 22, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 0 },
  dest: { color: C.ink, fontSize: 21, fontWeight: "700", letterSpacing: -0.5 },
  when: { color: C.mut, fontSize: 13, marginTop: 3 },
  pillLive: { backgroundColor: "rgba(20,201,153,0.10)", borderColor: "rgba(20,201,153,0.22)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillLiveT: { color: C.teal, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  leg: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  legIc: { fontSize: 16 },
  legT: { color: C.ink, fontSize: 14, fontWeight: "600", letterSpacing: 0.1 },
  legS: { color: C.mut, fontSize: 12, marginTop: 2 },
  emptyCard: { alignItems: "center", padding: 44, backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, marginBottom: 14 },
  emptyIc: { fontSize: 44, marginBottom: 14 },
  emptyT: { color: C.ink, fontSize: 19, fontWeight: "700", marginBottom: 8, letterSpacing: -0.3 },
  emptyS: { color: C.mut, fontSize: 14, textAlign: "center", lineHeight: 21 },
  monitor: { flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 16 },
  radarMini: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: "rgba(74,114,255,0.2)", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  radarMiniRing: { position: "absolute", width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "rgba(74,114,255,0.15)" },
  radarMiniSweep: { position: "absolute", top: 0, left: 18, width: 1.5, height: 19, backgroundColor: C.accent, opacity: 0.8 },
  radarMiniDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.teal, position: "absolute", top: 10, left: 22 },
  mt: { color: C.ink, fontSize: 14, fontWeight: "600", letterSpacing: 0.1 },
  ms: { color: C.mut, fontSize: 13, marginTop: 2 },
  hint: { color: C.mut, fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 18 },
  tapHint: { color: C.mut, fontSize: 11, textAlign: "right", marginTop: 12, opacity: 0.5 },
});
