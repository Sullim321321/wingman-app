import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Animated, Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { C } from "../theme";
import { Btn, g } from "../components";
import { getTrips, deleteTrip, getFlightStatus, getPrediction, getGroundIntel } from "../api";
import { scheduleDisruption } from "../notify";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return null; }
}

function formatTime(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return null; }
}

function countdown(iso) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)}d away`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
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

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (!status) return null;
  const map = {
    "On Time":   { bg: "rgba(20,201,153,0.12)",  border: "rgba(20,201,153,0.25)",  text: C.teal },
    "Delayed":   { bg: "rgba(255,176,46,0.12)",   border: "rgba(255,176,46,0.25)",   text: C.amber },
    "Cancelled": { bg: "rgba(255,77,109,0.12)",   border: "rgba(255,77,109,0.25)",   text: C.coral },
    "Landed":    { bg: "rgba(99,102,241,0.12)",   border: "rgba(99,102,241,0.25)",   text: "#818CF8" },
    "Scheduled": { bg: "rgba(134,144,166,0.10)",  border: "rgba(134,144,166,0.2)",   text: C.mut },
    "In Air":    { bg: "rgba(74,114,255,0.12)",   border: "rgba(74,114,255,0.25)",   text: C.accent },
    "Booked":    { bg: "rgba(134,144,166,0.10)",  border: "rgba(134,144,166,0.2)",   text: C.mut },
  };
  const st = map[status] || map["Scheduled"];
  return (
    <View style={{ backgroundColor: st.bg, borderColor: st.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: st.text, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 }}>{status}</Text>
    </View>
  );
}

// ─── Risk Badge ──────────────────────────────────────────────────────────────

function RiskBadge({ risk }) {
  if (risk == null) return null;
  if (risk < 30) return null; // only show when meaningful
  const high = risk >= 60;
  return (
    <View style={{
      backgroundColor: high ? "rgba(255,77,109,0.12)" : "rgba(255,176,46,0.12)",
      borderColor: high ? "rgba(255,77,109,0.25)" : "rgba(255,176,46,0.25)",
      borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
      flexDirection: "row", alignItems: "center", gap: 4,
    }}>
      <Text style={{ color: high ? C.coral : C.amber, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 }}>
        {high ? "⚠️" : "~"} {risk}% risk
      </Text>
    </View>
  );
}

// ─── Next Up Card ─────────────────────────────────────────────────────────────

function NextUpCard({ flight, navigation }) {
  const [risk, setRisk] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [groundIntel, setGroundIntel] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Subtle pulse on the live dot
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (!flight?.origin || !flight?.destination) return;
    setRiskLoading(true);
    getPrediction({ dep: flight.origin, arr: flight.destination })
      .then(p => setRisk(p?.risk ?? null))
      .catch(() => {})
      .finally(() => setRiskLoading(false));
  }, [flight?.origin, flight?.destination]);

  useEffect(() => {
    if (!flight?.origin || !flight?.departs_at) return;
    // Only fetch ground intel if flight is within 6 hours
    const hoursUntil = (new Date(flight.departs_at).getTime() - Date.now()) / 3600000;
    if (hoursUntil > 6 || hoursUntil < 0) return;
    getGroundIntel({
      airport: flight.origin,
      departureTime: flight.departs_at,
      fromGate: flight.from_gate || null,
      toGate: flight.gate || null,
    })
      .then(intel => setGroundIntel(intel))
      .catch(() => {});
  }, [flight?.origin, flight?.departs_at]);

  if (!flight) return null;

  const cd = countdown(flight.departs_at);
  const flightLabel = [flight.carrier, flight.flight_number].filter(Boolean).join(" ");
  const riskColor = risk >= 60 ? C.coral : risk >= 30 ? C.amber : C.teal;
  const riskGradient = risk >= 60
    ? ["rgba(255,77,109,0.14)", "rgba(30,14,40,0.0)"]
    : risk >= 30
      ? ["rgba(255,176,46,0.10)", "rgba(30,14,40,0.0)"]
      : ["rgba(20,201,153,0.10)", "rgba(30,14,40,0.0)"];

  return (
    <Pressable onPress={() => navigation.navigate("Alert", { flight })} style={{ marginBottom: 20 }}>
      <LinearGradient colors={["#0E1420", "#0A0F1A"]} style={s.nextCard}>
        {/* Top row */}
        <View style={g.rowBetween}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Animated.View style={[s.liveDot, { opacity: pulseAnim }]} />
            <Text style={s.nextLabel}>NEXT FLIGHT</Text>
          </View>
          {cd && <Text style={s.nextCountdown}>{cd}</Text>}
        </View>

        {/* Route */}
        <View style={s.nextRouteRow}>
          <Text style={s.nextAirport}>{flight.origin || "—"}</Text>
          <View style={s.nextArrowWrap}>
            <View style={s.nextArrowLine} />
            <Text style={s.nextArrowIc}>✈</Text>
          </View>
          <Text style={s.nextAirport}>{flight.destination || "—"}</Text>
        </View>

        {/* Meta row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          {flightLabel ? <Text style={s.nextMeta}>{flightLabel}</Text> : null}
          {flight.departs_at ? <Text style={s.nextMeta}>· {formatTime(flight.departs_at)}</Text> : null}
          {flight.tripTitle ? <Text style={s.nextMeta}>· {flight.tripTitle}</Text> : null}
        </View>

        {/* Ground Intelligence timeline — shown within 6 hours of departure */}
        {groundIntel && groundIntel.timeline && groundIntel.timeline.length > 0 && (
          <View style={s.groundIntelWrap}>
            <Text style={s.groundIntelLabel}>GROUND TIMELINE</Text>
            {groundIntel.timeline.map((step, i) => (
              <View key={i} style={s.groundIntelRow}>
                <Text style={s.groundIntelIc}>{step.icon || '→'}</Text>
                <Text style={s.groundIntelStep}>{step.label}</Text>
                <Text style={[s.groundIntelTime, step.minutes > 30 ? { color: C.amber } : {}]}>
                  {step.minutes > 0 ? `${step.minutes}m` : 'Now'}
                </Text>
              </View>
            ))}
            {groundIntel.bufferMinutes != null && (
              <View style={[s.groundIntelVerdict, {
                backgroundColor: groundIntel.atRisk
                  ? 'rgba(255,77,109,0.08)'
                  : 'rgba(20,201,153,0.08)',
                borderColor: groundIntel.atRisk
                  ? 'rgba(255,77,109,0.2)'
                  : 'rgba(20,201,153,0.2)',
              }]}>
                <Text style={{ color: groundIntel.atRisk ? C.coral : C.teal, fontSize: 12, fontWeight: '700' }}>
                  {groundIntel.verdict === 'will_miss' ? '⚠️  At risk of missing flight'
                    : groundIntel.verdict === 'tight' ? `⏱  Tight — ${groundIntel.bufferMinutes}m buffer`
                    : groundIntel.verdict === 'on_track' ? `✓  On track — ${groundIntel.bufferMinutes}m to spare`
                    : `✓  Plenty of time — ${groundIntel.bufferMinutes}m buffer`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Risk strip */}
        <LinearGradient colors={riskGradient} style={s.nextRiskStrip}>
          {riskLoading ? (
            <ActivityIndicator size="small" color={C.mut} />
          ) : risk != null ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={[s.nextRiskT, { color: riskColor }]}>
                {risk >= 60 ? "⚠️  High disruption risk" : risk >= 30 ? "~  Moderate risk" : "✓  Conditions look good"}
              </Text>
              <Text style={[s.nextRiskPct, { color: riskColor }]}>{risk}%</Text>
            </View>
          ) : (
            <Text style={s.nextRiskT}>Tap to check conditions →</Text>
          )}
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

// ─── Flight Leg Row ──────────────────────────────────────────────────────────

function FlightLeg({ leg }) {
  const [status, setStatus] = useState(leg.status || null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!leg.flight_number) return;
    const ident = (leg.carrier || "") + (leg.flight_number || "");
    if (!ident.trim()) return;
    setFetching(true);
    getFlightStatus(ident)
      .then(d => { if (d?.status) setStatus(d.status); })
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

// ─── Trip Card ───────────────────────────────────────────────────────────────

function TripCard({ trip, onDelete, navigation }) {
  const [risk, setRisk] = useState(null);
  const legs = trip.legs || [];
  const firstFlight = legs.find(l => l.type === "flight");
  const depDate = formatDate(firstFlight?.departs_at);

  useEffect(() => {
    if (!firstFlight?.origin || !firstFlight?.destination) return;
    // Only fetch risk for upcoming trips
    const dep = firstFlight.departs_at ? new Date(firstFlight.departs_at).getTime() : 0;
    if (dep < Date.now()) return;
    getPrediction({ dep: firstFlight.origin, arr: firstFlight.destination })
      .then(p => setRisk(p?.risk ?? null))
      .catch(() => {});
  }, [firstFlight?.origin, firstFlight?.destination]);

  return (
    <Pressable onPress={() => navigation.navigate("TripDetail", { trip })} style={{ marginBottom: 14 }}>
      <LinearGradient colors={["#111827", "#0D1120"]} style={s.tripCard}>
        <View style={g.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={s.dest}>{trip.title}</Text>
            {depDate && <Text style={s.when}>{depDate}</Text>}
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {risk != null && <RiskBadge risk={risk} />}
            {risk == null && <View style={s.pillLive}><Text style={s.pillLiveT}>● Monitoring</Text></View>}
            <Pressable onPress={() => Alert.alert("Delete trip?", trip.title, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => onDelete(trip.id) }
            ])}><Text style={{ color: C.mut, fontSize: 18 }}>×</Text></Pressable>
          </View>
        </View>

        {legs.map((leg, i) => {
          if (leg.type === "flight") return <FlightLeg key={i} leg={leg} />;
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

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ navigation }) {
  return (
    <View style={s.emptyWrap}>
      <LinearGradient colors={["rgba(74,114,255,0.06)", "rgba(20,201,153,0.04)"]} style={s.emptyCard}>
        <Text style={s.emptyIc}>✈️</Text>
        <Text style={s.emptyT}>No trips yet</Text>
        <Text style={s.emptyS}>Add your first trip and Wingman will watch it around the clock.</Text>
        <Pressable style={s.emptyPrimary} onPress={() => navigation.navigate("AddTrip")}>
          <Text style={s.emptyPrimaryT}>+ Add a trip</Text>
        </Pressable>
        <Pressable style={s.emptySecondary} onPress={() => navigation.navigate("Connections")}>
          <Text style={s.emptySecondaryT}>📧  Import from email</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

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

  const nextFlight = React.useMemo(() => findNextFlight(trips), [trips]);

  const onSimulate = async () => {
    await scheduleDisruption(nextFlight);
    setTimeout(() => navigation.navigate("Alert", { flight: nextFlight }), 3500);
  };

  return (
    <SafeAreaView style={s.app}>
      <ScrollView
        contentContainerStyle={g.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.teal} />}
      >
        {/* Header */}
        <View style={s.appH}>
          <View style={s.logoRow}>
            <LinearGradient colors={[C.accent, C.teal]} style={s.mark}>
              <Text style={{ fontSize: 14 }}>✈</Text>
            </LinearGradient>
            <Text style={s.logo}>Wingman</Text>
          </View>
          <Pressable style={s.avatar} onPress={() => navigation.navigate("Settings")}>
            <LinearGradient colors={[C.accent + "80", C.teal + "80"]} style={s.avatarGrad}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>M</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={C.teal} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Next Up card — shown when there's an upcoming flight */}
            {nextFlight && <NextUpCard flight={nextFlight} navigation={navigation} />}

            {/* Trip list or empty state */}
            {trips.length === 0 ? (
              <EmptyState navigation={navigation} />
            ) : (
              <>
                {trips.length > 0 && <Text style={g.sectionT}>ALL TRIPS</Text>}
                {trips.map(trip => (
                  <TripCard key={trip.id} trip={trip} onDelete={handleDelete} navigation={navigation} />
                ))}
                <Btn title="+ Add a trip" onPress={() => navigation.navigate("AddTrip")} style={{ marginTop: 4 }} />
                <Btn title="📧  Import from email" kind="ghost" onPress={() => navigation.navigate("Connections")} style={{ marginTop: 8 }} />
              </>
            )}

            {/* Live monitoring row */}
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

            {/* Simulate disruption */}
            <Text style={g.sectionT}>WHEN TRAVEL BREAKS</Text>
            <Btn title="⚡  Simulate a disruption" onPress={onSimulate} />
            <Text style={s.hint}>Schedules a real push in a few seconds — tap it to see the rescue.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  appH: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  logo: { color: C.ink, fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  avatar: { width: 34, height: 34, borderRadius: 17, overflow: "hidden" },
  avatarGrad: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },

  // Next Up card
  nextCard: { borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.teal },
  nextLabel: { color: C.mut, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  nextCountdown: { color: C.teal, fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
  nextRouteRow: { flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: 2 },
  nextAirport: { color: C.ink, fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  nextArrowWrap: { flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 },
  nextArrowLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  nextArrowIc: { color: C.mut, fontSize: 16 },
  nextMeta: { color: C.mut, fontSize: 13 },
  nextRiskStrip: { marginTop: 16, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.06)" },
  nextRiskT: { color: C.mut, fontSize: 13, fontWeight: "600" },
  nextRiskPct: { fontSize: 15, fontWeight: "800" },

  // Trip cards
  tripCard: { borderRadius: 22, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  dest: { color: C.ink, fontSize: 21, fontWeight: "700", letterSpacing: -0.5 },
  when: { color: C.mut, fontSize: 13, marginTop: 3 },
  pillLive: { backgroundColor: "rgba(20,201,153,0.10)", borderColor: "rgba(20,201,153,0.22)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillLiveT: { color: C.teal, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  leg: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  legIc: { fontSize: 16 },
  legT: { color: C.ink, fontSize: 14, fontWeight: "600", letterSpacing: 0.1 },
  legS: { color: C.mut, fontSize: 12, marginTop: 2 },
  tapHint: { color: C.mut, fontSize: 11, textAlign: "right", marginTop: 12, opacity: 0.5 },

  // Empty state
  emptyWrap: { marginBottom: 14 },
  emptyCard: { borderRadius: 24, padding: 36, alignItems: "center", borderWidth: 1, borderColor: C.line },
  emptyIc: { fontSize: 48, marginBottom: 16 },
  emptyT: { color: C.ink, fontSize: 20, fontWeight: "700", marginBottom: 8, letterSpacing: -0.3 },
  emptyS: { color: C.mut, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 24 },
  emptyPrimary: { width: "100%", backgroundColor: C.accent, borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 10 },
  emptyPrimaryT: { color: "#fff", fontSize: 16, fontWeight: "700" },
  emptySecondary: { width: "100%", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  emptySecondaryT: { color: C.mut, fontSize: 15, fontWeight: "600" },

  // Monitoring row
  monitor: { flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 16 },
  radarMini: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: "rgba(74,114,255,0.2)", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  radarMiniRing: { position: "absolute", width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "rgba(74,114,255,0.15)" },
  radarMiniSweep: { position: "absolute", top: 0, left: 18, width: 1.5, height: 19, backgroundColor: C.accent, opacity: 0.8 },
  radarMiniDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.teal, position: "absolute", top: 10, left: 22 },
  mt: { color: C.ink, fontSize: 14, fontWeight: "600", letterSpacing: 0.1 },
  ms: { color: C.mut, fontSize: 13, marginTop: 2 },
  hint: { color: C.mut, fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 18 },

  // Ground Intelligence
  groundIntelWrap: { marginTop: 16, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.06)" },
  groundIntelLabel: { color: C.mut, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 10 },
  groundIntelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  groundIntelIc: { fontSize: 14, width: 22 },
  groundIntelStep: { flex: 1, color: C.ink, fontSize: 13, fontWeight: "500" },
  groundIntelTime: { color: C.mut, fontSize: 13, fontWeight: "700" },
  groundIntelVerdict: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
});
