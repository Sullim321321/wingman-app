import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { Btn, BackBar, g } from "../components";
import { getFlightStatus, getPrediction, refreshTrip } from "../api";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch { return null; }
}

function fmtTime(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return null; }
}

function minutesToHM(mins) {
  if (!mins) return null;
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? "-" : "+";
  return h > 0 ? `${sign}${h}h ${m}m` : `${sign}${m}m`;
}

// ─── StatusBadge ────────────────────────────────────────────────────────────

function StatusBadge({ status, size = "md" }) {
  if (!status) return null;
  const map = {
    "On Time":   { bg: "rgba(34,211,166,0.14)", border: "rgba(34,211,166,0.3)", text: C.teal },
    "Delayed":   { bg: "rgba(255,176,46,0.14)",  border: "rgba(255,176,46,0.3)",  text: C.amber },
    "Cancelled": { bg: "rgba(255,92,122,0.14)",  border: "rgba(255,92,122,0.3)",  text: C.coral },
    "Landed":    { bg: "rgba(99,102,241,0.14)",  border: "rgba(99,102,241,0.3)",  text: "#818CF8" },
    "Scheduled": { bg: "rgba(148,163,184,0.14)", border: "rgba(148,163,184,0.3)", text: C.mut },
    "In Air":    { bg: "rgba(201,169,110,0.14)",  border: "rgba(201,169,110,0.3)",  text: C.gold },
    "Booked":    { bg: "rgba(148,163,184,0.14)", border: "rgba(148,163,184,0.3)", text: C.mut },
    "Unknown":   { bg: "rgba(148,163,184,0.14)", border: "rgba(148,163,184,0.3)", text: C.mut },
  };
  const st = map[status] || map["Scheduled"];
  const px = size === "lg" ? { paddingHorizontal: 14, paddingVertical: 6 } : { paddingHorizontal: 10, paddingVertical: 4 };
  const fs = size === "lg" ? 13 : 11;
  return (
    <View style={{ backgroundColor: st.bg, borderColor: st.border, borderWidth: 1, borderRadius: 999, ...px }}>
      <Text style={{ color: st.text, fontSize: fs, fontWeight: "700" }}>{status}</Text>
    </View>
  );
}

// ─── RiskBar ────────────────────────────────────────────────────────────────

function RiskBar({ risk }) {
  if (risk == null) return null;
  const color = risk >= 60 ? C.coral : risk >= 35 ? C.amber : C.teal;
  const label = risk >= 60 ? "High risk" : risk >= 35 ? "Moderate" : "Low risk";
  return (
    <View style={s.riskWrap}>
      <View style={s.riskRow}>
        <Text style={s.riskLabel}>{label}</Text>
        <Text style={[s.riskPct, { color }]}>{risk}%</Text>
      </View>
      <View style={s.riskTrack}>
        <View style={[s.riskFill, { width: risk + "%", backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ─── FlightLegCard ──────────────────────────────────────────────────────────

function FlightLegCard({ leg }) {
  const [liveStatus, setLiveStatus] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(false);

  useEffect(() => {
    if (!leg.flight_number) return;
    const ident = (leg.carrier || "") + leg.flight_number;
    setLoadingStatus(true);
    getFlightStatus(ident)
      .then(d => setLiveStatus(d))
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  }, [leg.flight_number, leg.carrier]);

  useEffect(() => {
    if (!leg.origin || !leg.destination) return;
    setLoadingWeather(true);
    getPrediction({ dep: leg.origin, arr: leg.destination })
      .then(d => setWeather(d))
      .catch(() => {})
      .finally(() => setLoadingWeather(false));
  }, [leg.origin, leg.destination]);

  const status = liveStatus?.status || leg.status || "Scheduled";
  const delay = liveStatus?.delay;
  const gate = liveStatus?.gate;
  const terminal = liveStatus?.terminal;
  const actualDep = liveStatus?.actualDep;
  const scheduledDep = liveStatus?.scheduledDep || leg.departs_at;

  return (
    <View style={s.legCard}>
      {/* Route header */}
      <View style={[g.rowBetween, { marginBottom: 12 }]}>
        <View style={{ flex: 1 }}>
          <View style={s.routeRow}>
            <Text style={s.airport}>{leg.origin || "?"}</Text>
            <Text style={s.arrow}>→</Text>
            <Text style={s.airport}>{leg.destination || "?"}</Text>
          </View>
          <Text style={s.flightNum}>
            {leg.carrier && leg.flight_number ? `${leg.carrier} ${leg.flight_number}` : "Flight"}
            {scheduledDep ? `  ·  ${fmtTime(scheduledDep)}` : ""}
          </Text>
        </View>
        {loadingStatus
          ? <ActivityIndicator size="small" color={C.teal} />
          : <StatusBadge status={status} size="lg" />
        }
      </View>

      {/* Delay info */}
      {delay != null && delay !== 0 && (
        <View style={[s.infoRow, { marginBottom: 8 }]}>
          <Text style={s.infoIc}>⏱</Text>
          <Text style={[s.infoT, { color: delay > 0 ? C.amber : C.teal }]}>
            {delay > 0 ? `Delayed ${minutesToHM(delay)}` : `Early ${minutesToHM(delay)}`}
            {actualDep ? `  ·  Now departs ${fmtTime(actualDep)}` : ""}
          </Text>
        </View>
      )}

      {/* Gate / terminal */}
      {(gate || terminal) && (
        <View style={s.infoRow}>
          <Text style={s.infoIc}>🚪</Text>
          <Text style={s.infoT}>
            {[terminal ? `Terminal ${terminal}` : null, gate ? `Gate ${gate}` : null].filter(Boolean).join("  ·  ")}
          </Text>
        </View>
      )}

      {/* Weather risk */}
      {(loadingWeather || weather) && (
        <View style={s.weatherWrap}>
          <Text style={s.weatherTitle}>
            {loadingWeather ? "Checking weather risk…" : `Disruption risk: ${leg.origin} → ${leg.destination}`}
          </Text>
          {loadingWeather
            ? <ActivityIndicator size="small" color={C.mut} style={{ marginTop: 6 }} />
            : <>
                <RiskBar risk={weather?.risk} />
                {weather?.factors?.length > 0 && (
                  <View style={{ marginTop: 8, gap: 4 }}>
                    {weather.factors.slice(0, 3).map((f, i) => (
                      <View key={i} style={s.factorRow}>
                        <Text style={s.factorDot}>•</Text>
                        <Text style={s.factorT}>{f.label}: <Text style={s.factorD}>{f.detail || f.impact}</Text></Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
          }
        </View>
      )}
    </View>
  );
}

// ─── HotelLegCard ───────────────────────────────────────────────────────────

function HotelLegCard({ leg }) {
  const checkIn = fmt(leg.departs_at || leg.check_in);
  const checkOut = fmt(leg.arrives_at || leg.check_out);
  return (
    <View style={s.legCard}>
      <View style={g.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={s.legCardTitle}>🏨  {leg.carrier || leg.destination || "Hotel"}</Text>
          {checkIn && <Text style={s.legCardSub}>Check-in {checkIn}{checkOut ? `  ·  Check-out ${checkOut}` : ""}</Text>}
          {leg.confirmation && <Text style={s.legCardSub}>Conf: {leg.confirmation}</Text>}
        </View>
        <StatusBadge status="Booked" />
      </View>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function TripDetailScreen({ route, navigation }) {
  const { trip: initialTrip } = route.params;
  const [trip, setTrip] = useState(initialTrip);
  const [refreshing, setRefreshing] = useState(false);

  const legs = trip.legs || [];
  const flightLegs = legs.filter(l => l.type === "flight");
  const otherLegs = legs.filter(l => l.type !== "flight");
  const firstFlight = flightLegs[0];
  const depDate = fmt(firstFlight?.departs_at);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTrip(trip.id);
      // Re-fetch trip data would require a getTrip endpoint; for now just re-render
    } catch (e) {
      Alert.alert("Refresh failed", e.message);
    } finally {
      setRefreshing(false);
    }
  }, [trip.id]);

  const openConcierge = () => {
    const context = `I'm asking about my trip: "${trip.title}"` +
      (depDate ? ` departing ${depDate}` : "") +
      (firstFlight ? `. My first flight is ${firstFlight.carrier || ""}${firstFlight.flight_number || ""} from ${firstFlight.origin || "?"} to ${firstFlight.destination || "?"}` : "") +
      ". What should I know?";
    navigation.navigate("Concierge", { prefill: context });
  };

  return (
    <SafeAreaView style={s.app}>
      <ScrollView
        contentContainerStyle={[g.scroll, { paddingTop: 8 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
      >
        <BackBar nav={navigation} label="Trips" />

        {/* Trip header */}
        <LinearGradient colors={[C.card, C.card2]} style={s.header}>
          <Text style={s.tripTitle}>{trip.title}</Text>
          {depDate && <Text style={s.tripDate}>{depDate}</Text>}
          <View style={s.pillRow}>
            <View style={s.pillLive}><Text style={s.pillLiveT}>● Live monitoring</Text></View>
            {flightLegs.length > 0 && (
              <View style={s.pillInfo}>
                <Text style={s.pillInfoT}>{flightLegs.length} flight{flightLegs.length !== 1 ? "s" : ""}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Flight legs */}
        {flightLegs.length > 0 && (
          <>
            <Text style={g.sectionT}>FLIGHTS</Text>
            {flightLegs.map((leg, i) => <FlightLegCard key={i} leg={leg} />)}
          </>
        )}

        {/* Hotel / car legs */}
        {otherLegs.length > 0 && (
          <>
            <Text style={g.sectionT}>OTHER BOOKINGS</Text>
            {otherLegs.map((leg, i) => <HotelLegCard key={i} leg={leg} />)}
          </>
        )}

        {legs.length === 0 && (
          <View style={s.emptyCard}>
            <Text style={s.emptyT}>No legs yet</Text>
            <Text style={s.emptySub}>Add flights or bookings to this trip to see live status.</Text>
          </View>
        )}

        {/* Concierge CTA */}
        <Text style={g.sectionT}>WINGMAN CONCIERGE</Text>
        <Pressable style={s.conciergeCard} onPress={openConcierge}>
          <LinearGradient colors={[C.gold, C.goldD]} style={s.conciergeDot}>
            <Text style={{ fontSize: 14 }}>✈</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={s.conciergeT}>Ask Wingman about this trip</Text>
            <Text style={s.conciergeS}>Rebooking options, weather risk, what to do if it's cancelled</Text>
          </View>
          <Text style={{ color: C.mut, fontSize: 18 }}>›</Text>
        </Pressable>

        {/* Refresh button */}
        <Btn
          title="↻  Refresh flight statuses"
          kind="ghost"
          onPress={onRefresh}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  header: { borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.line, marginBottom: 4 },
  tripTitle: { color: C.ink, fontSize: 24, fontWeight: "700" },
  tripDate: { color: C.mut, fontSize: 14, marginTop: 4 },
  pillRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  pillLive: { backgroundColor: "rgba(34,211,166,0.14)", borderColor: "rgba(34,211,166,0.3)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillLiveT: { color: C.teal, fontSize: 11, fontWeight: "700" },
  pillInfo: { backgroundColor: "rgba(201,169,110,0.12)", borderColor: "rgba(201,169,110,0.25)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillInfoT: { color: C.gold, fontSize: 11, fontWeight: "600" },
  // Leg cards
  legCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 10 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  airport: { color: C.ink, fontSize: 22, fontWeight: "800", letterSpacing: 0.5 },
  arrow: { color: C.mut, fontSize: 16 },
  flightNum: { color: C.mut, fontSize: 13 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoIc: { fontSize: 14 },
  infoT: { color: C.ink, fontSize: 13, fontWeight: "500" },
  // Weather
  weatherWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  weatherTitle: { color: C.mut, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  riskWrap: { marginTop: 4 },
  riskRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  riskLabel: { color: C.ink, fontSize: 13, fontWeight: "600" },
  riskPct: { fontSize: 13, fontWeight: "800" },
  riskTrack: { height: 6, backgroundColor: C.card2, borderRadius: 99, overflow: "hidden" },
  riskFill: { height: "100%", borderRadius: 99 },
  factorRow: { flexDirection: "row", gap: 6 },
  factorDot: { color: C.mut, fontSize: 12 },
  factorT: { color: C.mut, fontSize: 12, flex: 1 },
  factorD: { color: C.ink, fontWeight: "500" },
  // Hotel card
  legCardTitle: { color: C.ink, fontSize: 15, fontWeight: "700", marginBottom: 4 },
  legCardSub: { color: C.mut, fontSize: 12, marginTop: 2 },
  // Empty
  emptyCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 32, alignItems: "center", marginBottom: 12 },
  emptyT: { color: C.ink, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  emptySub: { color: C.mut, fontSize: 13, textAlign: "center", lineHeight: 19 },
  // Concierge CTA
  conciergeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 8 },
  conciergeDot: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  conciergeT: { color: C.ink, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  conciergeS: { color: C.mut, fontSize: 12, lineHeight: 17 },
});
