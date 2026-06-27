import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { Btn, BackBar, g } from "../components";
import { getFlightStatus, getPrediction, refreshTrip, getTripRisk, recordTripOutcome, shareTripLink } from "../api";

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

function formatMoney(n) {
  if (n == null) return null;
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
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

// ─── ConnectionRiskBadge ─────────────────────────────────────────────────────

function ConnectionRiskBadge({ risk }) {
  const cfg = {
    critical: { bg: "rgba(255,77,109,0.15)", border: "rgba(255,77,109,0.4)", text: C.coral, icon: "⚡" },
    high:     { bg: "rgba(255,140,0,0.12)",  border: "rgba(255,140,0,0.35)",  text: "#FF8C00", icon: "⚠️" },
    moderate: { bg: "rgba(201,169,110,0.12)", border: "rgba(201,169,110,0.3)", text: C.gold,   icon: "👁" },
    low:      { bg: "rgba(100,200,140,0.1)",  border: "rgba(100,200,140,0.25)", text: "#64C88C", icon: "✓" },
  }[risk.risk_level] || { bg: "rgba(201,169,110,0.12)", border: "rgba(201,169,110,0.3)", text: C.gold, icon: "·" };

  return (
    <View style={[s.connRiskCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Text style={{ fontSize: 14 }}>{cfg.icon}</Text>
        <Text style={[s.connRiskLevel, { color: cfg.text }]}>
          {risk.risk_level.toUpperCase()} — {risk.connection_minutes}min connection
        </Text>
        <Text style={[s.connRiskScore, { color: cfg.text }]}>{risk.risk_score}%</Text>
      </View>
      <Text style={s.connRiskRoute}>
        {risk.leg_a_flight} → {risk.connection_airport} → {risk.leg_b_flight}
      </Text>
      <Text style={s.connRiskRec}>{risk.recommendation}</Text>
      {risk.downstream_value_at_risk > 0 && (
        <Text style={[s.connRiskDownstream, { color: cfg.text }]}>
          {formatMoney(risk.downstream_value_at_risk)} downstream value at risk
        </Text>
      )}
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

function HotelLegCard({ leg, hotelAlert }) {
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
      {hotelAlert && (
        <View style={s.hotelAlertBanner}>
          <Text style={s.hotelAlertText}>🔔 {hotelAlert.alert}</Text>
        </View>
      )}
    </View>
  );
}

// ─── OutcomeCard (post-trip learning loop) ───────────────────────────────────

function OutcomeCard({ tripId, onSubmitted }) {
  const [rating, setRating] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      await recordTripOutcome(tripId, {
        rating,
        disruptions_predicted: null,
        disruptions_actual: null,
        value_saved: null,
        notes: null,
      });
      setSubmitted(true);
      if (onSubmitted) onSubmitted();
    } catch (e) {
      Alert.alert("Error", "Could not save rating. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={s.outcomeCard}>
        <Text style={s.outcomeTitle}>✓ Thanks — Wingman learns from every trip</Text>
        <Text style={s.outcomeSub}>Your feedback improves future predictions and rescue options.</Text>
      </View>
    );
  }

  return (
    <View style={s.outcomeCard}>
      <Text style={s.outcomeTitle}>How did this trip go?</Text>
      <Text style={s.outcomeSub}>Your rating helps Wingman improve its predictions and rescue decisions.</Text>
      <View style={s.starRow}>
        {[1, 2, 3, 4, 5].map(n => (
          <Pressable key={n} onPress={() => setRating(n)} style={s.starBtn}>
            <Text style={[s.star, rating >= n && { color: C.gold }]}>★</Text>
          </Pressable>
        ))}
      </View>
      {rating && (
        <Text style={s.ratingLabel}>
          {rating === 5 ? "Flawless execution" : rating === 4 ? "Mostly smooth" : rating === 3 ? "A few hiccups" : rating === 2 ? "Needed more help" : "Rough trip"}
        </Text>
      )}
      <Btn
        title={submitting ? "Saving…" : "Submit rating"}
        kind="accent"
        onPress={handleSubmit}
        disabled={!rating || submitting}
        style={{ marginTop: 12 }}
      />
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function TripDetailScreen({ route, navigation }) {
  const { trip: initialTrip } = route.params;
  const [trip, setTrip] = useState(initialTrip);
  const [refreshing, setRefreshing] = useState(false);

  // Risk scoring state
  const [riskData, setRiskData] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);

  // Outcome submitted state
  const [outcomeSubmitted, setOutcomeSubmitted] = useState(false);

  const legs = trip.legs || [];
  const flightLegs = legs.filter(l => l.type === "flight");
  const otherLegs = legs.filter(l => l.type !== "flight");
  const firstFlight = flightLegs[0];
  const depDate = fmt(firstFlight?.departs_at);

  // Determine if trip is in the past (completed)
  const isCompleted = firstFlight?.departs_at
    ? new Date(firstFlight.departs_at).getTime() < Date.now() - 24 * 3600000
    : false;

  // Load risk data on mount
  useEffect(() => {
    if (!trip.id || flightLegs.length < 2) return;
    setRiskLoading(true);
    getTripRisk(trip.id)
      .then(d => setRiskData(d))
      .catch(() => {})
      .finally(() => setRiskLoading(false));
  }, [trip.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTrip(trip.id);
      // Also refresh risk data
      if (flightLegs.length >= 2) {
        const d = await getTripRisk(trip.id);
        setRiskData(d);
      }
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

  const handleShareTrip = async () => {
    try {
      const data = await shareTripLink(trip.id);
      await Share.share({
        message: `Check out my trip "${trip.title}" — ${data.share_url}`,
        url: data.share_url,
      });
    } catch (e) {
      Alert.alert("Share", "Could not generate share link. Try again.");
    }
  };

  const openAlert = (leg) => {
    navigation.navigate("Alert", {
      flight: leg,
      tripId: trip.id,
      legId: leg.id,
      disruption_type: "delay",
      delay_minutes: 90,
    });
  };

  // Build hotel alert lookup by leg id
  const hotelAlertMap = {};
  if (riskData?.hotel_alerts) {
    for (const alert of riskData.hotel_alerts) {
      hotelAlertMap[alert.leg_id] = alert;
    }
  }

  // Highest risk level across all connections
  const riskLevels = { critical: 4, high: 3, moderate: 2, low: 1 };
  const topRisk = riskData?.risks?.reduce((best, r) => {
    return (riskLevels[r.risk_level] || 0) > (riskLevels[best?.risk_level] || 0) ? r : best;
  }, null);

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
            {topRisk && topRisk.risk_level !== "low" && (
              <View style={[s.pillInfo, {
                backgroundColor: topRisk.risk_level === "critical" ? "rgba(255,77,109,0.12)" : "rgba(255,140,0,0.1)",
                borderColor: topRisk.risk_level === "critical" ? "rgba(255,77,109,0.3)" : "rgba(255,140,0,0.3)",
              }]}>
                <Text style={[s.pillInfoT, {
                  color: topRisk.risk_level === "critical" ? C.coral : "#FF8C00",
                }]}>
                  {topRisk.risk_level === "critical" ? "⚡ Critical connection" : "⚠️ Tight connection"}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Connection risk section — only for multi-leg trips */}
        {riskLoading && (
          <View style={s.riskLoadingRow}>
            <ActivityIndicator size="small" color={C.gold} />
            <Text style={{ color: C.mut, fontSize: 13, marginLeft: 10 }}>Scoring connection risks…</Text>
          </View>
        )}

        {!riskLoading && riskData?.risks?.length > 0 && (
          <>
            <Text style={g.sectionT}>CONNECTION RISK ANALYSIS</Text>
            {riskData.risks.map((risk, i) => (
              <ConnectionRiskBadge key={i} risk={risk} />
            ))}
          </>
        )}

        {/* Hotel alerts */}
        {riskData?.hotel_alerts?.length > 0 && (
          <>
            <Text style={g.sectionT}>HOTEL ALERTS</Text>
            {riskData.hotel_alerts.map((alert, i) => (
              <View key={i} style={s.hotelAlertCard}>
                <Text style={s.hotelAlertCardText}>🔔 {alert.alert}</Text>
              </View>
            ))}
          </>
        )}

        {/* Flight legs */}
        {flightLegs.length > 0 && (
          <>
            <Text style={g.sectionT}>FLIGHTS</Text>
            {flightLegs.map((leg, i) => (
              <View key={i}>
                <FlightLegCard leg={leg} />
                {/* Disruption CTA for upcoming flights */}
                {!isCompleted && (
                  <Pressable
                    style={s.disruptionCta}
                    onPress={() => openAlert(leg)}
                  >
                    <Text style={s.disruptionCtaText}>⚡ Simulate disruption / rescue options →</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </>
        )}

        {/* Hotel / car legs */}
        {otherLegs.length > 0 && (
          <>
            <Text style={g.sectionT}>OTHER BOOKINGS</Text>
            {otherLegs.map((leg, i) => (
              <HotelLegCard key={i} leg={leg} hotelAlert={hotelAlertMap[leg.id]} />
            ))}
          </>
        )}

        {legs.length === 0 && (
          <View style={s.emptyCard}>
            <Text style={s.emptyT}>No legs yet</Text>
            <Text style={s.emptySub}>Add flights or bookings to this trip to see live status.</Text>
          </View>
        )}

        {/* Post-trip outcome card (learning loop) */}
        {isCompleted && !outcomeSubmitted && (
          <>
            <Text style={g.sectionT}>TRIP OUTCOME</Text>
            <OutcomeCard tripId={trip.id} onSubmitted={() => setOutcomeSubmitted(true)} />
          </>
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

        {/* Share + Refresh */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          <Btn title="↗  Share trip" kind="ghost" onPress={handleShareTrip} style={{ flex: 1 }} />
          <Btn title="↻  Refresh" kind="ghost" onPress={onRefresh} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  header: { borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.line, marginBottom: 4 },
  tripTitle: { color: C.ink, fontSize: 24, fontWeight: "700" },
  tripDate: { color: C.mut, fontSize: 14, marginTop: 4 },
  pillRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  pillLive: { backgroundColor: "rgba(34,211,166,0.14)", borderColor: "rgba(34,211,166,0.3)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillLiveT: { color: C.teal, fontSize: 11, fontWeight: "700" },
  pillInfo: { backgroundColor: "rgba(201,169,110,0.12)", borderColor: "rgba(201,169,110,0.25)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillInfoT: { color: C.gold, fontSize: 11, fontWeight: "600" },

  // Risk loading
  riskLoadingRow: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, marginBottom: 10 },

  // Connection risk cards
  connRiskCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  connRiskLevel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5, flex: 1 },
  connRiskScore: { fontSize: 14, fontWeight: "800" },
  connRiskRoute: { color: C.ink, fontSize: 13, fontWeight: "600", marginBottom: 4 },
  connRiskRec: { color: C.mut, fontSize: 12, lineHeight: 17 },
  connRiskDownstream: { fontSize: 12, fontWeight: "700", marginTop: 6 },

  // Hotel alert
  hotelAlertCard: { backgroundColor: "rgba(201,169,110,0.08)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", padding: 12, marginBottom: 10 },
  hotelAlertCardText: { color: C.gold, fontSize: 13, lineHeight: 18 },
  hotelAlertBanner: { marginTop: 10, backgroundColor: "rgba(201,169,110,0.08)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", padding: 10 },
  hotelAlertText: { color: C.gold, fontSize: 12, lineHeight: 17 },

  // Leg cards
  legCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 10 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  airport: { color: C.ink, fontSize: 22, fontWeight: "800", letterSpacing: 0.5 },
  arrow: { color: C.mut, fontSize: 16 },
  flightNum: { color: C.mut, fontSize: 13 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoIc: { fontSize: 14 },
  infoT: { color: C.ink, fontSize: 13, fontWeight: "500" },

  // Disruption CTA
  disruptionCta: { marginTop: -4, marginBottom: 10, paddingHorizontal: 4 },
  disruptionCtaText: { color: C.gold, fontSize: 12, fontWeight: "600" },

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

  // Outcome card (learning loop)
  outcomeCard: { backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(201,169,110,0.25)", borderRadius: 18, padding: 18, marginBottom: 12 },
  outcomeTitle: { color: C.ink, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  outcomeSub: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  starRow: { flexDirection: "row", gap: 8 },
  starBtn: { padding: 4 },
  star: { fontSize: 28, color: C.line },
  ratingLabel: { color: C.gold, fontSize: 13, fontWeight: "600", marginTop: 8 },

  // Concierge CTA
  conciergeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 8 },
  conciergeDot: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  conciergeT: { color: C.ink, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  conciergeS: { color: C.mut, fontSize: 12, lineHeight: 17 },
});
