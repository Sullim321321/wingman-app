import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Share, Linking, TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, T } from "../theme";
import { Btn, BackBar, g } from "../components";
import { getFlightStatus, getPrediction, refreshTrip, getTripRisk, recordTripOutcome, shareTripLink, getDestinationIntel, inviteCompanion, getCompanions } from "../api";
import { API_BASE } from "../config";

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
    "On Time":   { bg: C.teal + "22",  border: C.teal + "4D",  text: C.teal },
    "Delayed":   { bg: C.amber + "22", border: C.amber + "4D", text: C.amber },
    "Cancelled": { bg: C.coral + "22", border: C.coral + "4D", text: C.coral },
    "Landed":    { bg: C.indigo + "22",           border: C.indigo + "4D",           text: C.indigo },
    "Scheduled": { bg: C.card2, border: C.line, text: C.mut },
    "In Air":    { bg: C.gold + "22",  border: C.gold + "4D",  text: C.gold },
    "Booked":    { bg: C.card2,          border: C.line,          text: C.mut },
    "Unknown":   { bg: C.card2,          border: C.line,          text: C.mut },
  };
  const st = map[status] || map["Scheduled"];
  const px = size === "lg" ? { paddingHorizontal: 14, paddingVertical: 6 } : { paddingHorizontal: 10, paddingVertical: 4 };
  const fs = size === "lg" ? 13 : 11;
  return (
    <View style={{ backgroundColor: st.bg, borderColor: st.border, borderWidth: 1, borderRadius: 999, ...px }}>
      <Text style={{ color: st.text, fontSize: fs, fontFamily: T.sansB }}>{status}</Text>
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
    critical: { bg: C.coral + "26",  border: C.coral + "66",  text: C.coral, icon: "⚡" },
    high:     { bg: C.amber + "1E",  border: C.amber + "59",  text: C.amber, icon: "⚠️" },
    moderate: { bg: C.gold  + "1E",  border: C.gold  + "40",  text: C.gold,  icon: "👁" },
    low:      { bg: C.teal  + "1A",  border: C.teal  + "40",  text: C.teal,  icon: "✓" },
  }[risk.risk_level] || { bg: C.gold + "1E", border: C.gold + "40", text: C.gold, icon: "·" };

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

// ─── TrainLegCard ──────────────────────────────────────────────────────────────

function TrainLegCard({ leg }) {
  const dep = fmt(leg.departs_at);
  const arr = fmt(leg.arrives_at);
  const from = leg.station_from || leg.origin || "?";
  const to   = leg.station_to   || leg.destination || "?";
  return (
    <View style={s.legCard}>
      <View style={g.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={s.legCardTitle}>🚆 {leg.carrier || "Train"}</Text>
          <Text style={s.legCardRoute}>{from}  →  {to}</Text>
          {dep && <Text style={s.legCardSub}>
            Departs {dep}{fmtTime(leg.departs_at) ? `  ·  ${fmtTime(leg.departs_at)}` : ""}
            {arr ? `  –  Arrives ${arr}` : ""}
          </Text>}
          {leg.seat && <Text style={s.legCardSub}>Seat {leg.seat}</Text>}
          {leg.confirmation && <Text style={s.legCardSub}>Ref: {leg.confirmation}</Text>}
        </View>
        <StatusBadge status="Booked" />
      </View>
    </View>
  );
}

// ─── CarLegCard ─────────────────────────────────────────────────────────────────

function CarLegCard({ leg }) {
  const pickup = fmt(leg.departs_at);
  const dropoff = fmt(leg.arrives_at);
  const pickupLoc  = leg.pickup_location  || leg.origin      || leg.destination || "?";
  const dropoffLoc = leg.dropoff_location || leg.destination || pickupLoc;
  return (
    <View style={s.legCard}>
      <View style={g.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={s.legCardTitle}>🚗 {leg.carrier || "Car rental"}
            {leg.vehicle_class ? <Text style={s.legCardMeta}>  ·  {leg.vehicle_class}</Text> : null}
          </Text>
          <Text style={s.legCardRoute}>Pickup: {pickupLoc}</Text>
          {dropoffLoc !== pickupLoc && <Text style={s.legCardRoute}>Return: {dropoffLoc}</Text>}
          {pickup && <Text style={s.legCardSub}>
            From {pickup}{dropoff ? `  –  To ${dropoff}` : ""}
          </Text>}
          {leg.confirmation && <Text style={s.legCardSub}>Conf: {leg.confirmation}</Text>}
        </View>
        <StatusBadge status="Booked" />
      </View>
    </View>
  );
}

// ─── AirbnbLegCard ──────────────────────────────────────────────────────────────

function AirbnbLegCard({ leg }) {
  const checkIn  = fmt(leg.departs_at);
  const checkOut = fmt(leg.arrives_at);
  const nights = leg.nights || (checkIn && checkOut ? null : null);
  return (
    <View style={s.legCard}>
      <View style={g.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={s.legCardTitle}>🏠 {leg.carrier || leg.destination || "Airbnb"}</Text>
          {leg.property_address && <Text style={s.legCardSub}>{leg.property_address}</Text>}
          {checkIn && <Text style={s.legCardSub}>
            Check-in {checkIn}{checkOut ? `  ·  Check-out ${checkOut}` : ""}
            {nights ? `  ·  ${nights} night${nights !== 1 ? "s" : ""}` : ""}
          </Text>}
          {leg.guests && <Text style={s.legCardSub}>{leg.guests} guest{leg.guests !== 1 ? "s" : ""}</Text>}
          {leg.confirmation && <Text style={s.legCardSub}>Conf: {leg.confirmation}</Text>}
        </View>
        <StatusBadge status="Booked" />
      </View>
    </View>
  );
}

// ─── FerryLegCard ───────────────────────────────────────────────────────────────

function FerryLegCard({ leg }) {
  const dep = fmt(leg.departs_at);
  const arr = fmt(leg.arrives_at);
  return (
    <View style={s.legCard}>
      <View style={g.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={s.legCardTitle}>⛴️ {leg.carrier || "Ferry"}</Text>
          {(leg.origin || leg.destination) && (
            <Text style={s.legCardRoute}>{leg.origin || "?"}  →  {leg.destination || "?"}</Text>
          )}
          {dep && <Text style={s.legCardSub}>
            Departs {dep}{fmtTime(leg.departs_at) ? `  ·  ${fmtTime(leg.departs_at)}` : ""}
            {arr ? `  –  Arrives ${arr}` : ""}
          </Text>}
          {leg.confirmation && <Text style={s.legCardSub}>Ref: {leg.confirmation}</Text>}
        </View>
        <StatusBadge status="Booked" />
      </View>
    </View>
  );
}

// ─── ActivityLegCard ────────────────────────────────────────────────────────────

function ActivityLegCard({ leg }) {
  const date = fmt(leg.departs_at);
  return (
    <View style={s.legCard}>
      <View style={g.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={s.legCardTitle}>✨ {leg.carrier || leg.destination || "Activity"}</Text>
          {leg.destination && leg.destination !== leg.carrier && (
            <Text style={s.legCardSub}>{leg.destination}</Text>
          )}
          {date && <Text style={s.legCardSub}>
            {date}{fmtTime(leg.departs_at) ? `  ·  ${fmtTime(leg.departs_at)}` : ""}
          </Text>}
          {leg.guests && <Text style={s.legCardSub}>{leg.guests} person{leg.guests !== 1 ? "s" : ""}</Text>}
          {leg.confirmation && <Text style={s.legCardSub}>Ref: {leg.confirmation}</Text>}
        </View>
        <StatusBadge status="Booked" />
      </View>
    </View>
  );
}

// ─── GenericLegCard (transfer / cruise / other) ─────────────────────────────────

function GenericLegCard({ leg }) {
  const typeIcons = { transfer: "🚖", cruise: "🚢", other: "📌" };
  const icon = typeIcons[leg.type] || "📌";
  const date = fmt(leg.departs_at);
  return (
    <View style={s.legCard}>
      <View style={g.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={s.legCardTitle}>{icon} {leg.carrier || leg.destination || "Booking"}</Text>
          {(leg.origin || leg.destination) && (
            <Text style={s.legCardRoute}>{[leg.origin, leg.destination].filter(Boolean).join("  →  ")}</Text>
          )}
          {date && <Text style={s.legCardSub}>{date}</Text>}
          {leg.confirmation && <Text style={s.legCardSub}>Ref: {leg.confirmation}</Text>}
        </View>
        <StatusBadge status="Booked" />
      </View>
    </View>
  );
}

// ─── LegRouter — picks the right card component by type ─────────────────────────

function LegRouter({ leg, hotelAlert }) {
  switch (leg.type) {
    case "hotel":    return <HotelLegCard    leg={leg} hotelAlert={hotelAlert} />;
    case "airbnb":   return <AirbnbLegCard   leg={leg} />;
    case "train":    return <TrainLegCard     leg={leg} />;
    case "car":      return <CarLegCard       leg={leg} />;
    case "ferry":    return <FerryLegCard     leg={leg} />;
    case "activity": return <ActivityLegCard  leg={leg} />;
    default:         return <GenericLegCard   leg={leg} />;
  }
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

  // Destination intel state
  const [destIntel, setDestIntel] = useState(null);

  // Companion state
  const [companions, setCompanions] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const legs = trip.legs || [];
  const flightLegs = legs.filter(l => l.type === "flight");
  const firstFlight = flightLegs[0];

  // Use the trip_start/trip_end from the API (covers all leg types), fallback to first flight
  const tripStartDate = trip.trip_start || firstFlight?.departs_at || legs[0]?.departs_at;
  const tripEndDate   = trip.trip_end   || null;
  const depDate = fmt(tripStartDate);
  const endDate = fmt(tripEndDate);

  // Determine if trip is in the past (completed) — use last leg end date
  const lastLegEnd = tripEndDate || legs.reduce((latest, l) => {
    const t = l.arrives_at || l.departs_at;
    return t && (!latest || new Date(t) > new Date(latest)) ? t : latest;
  }, null);
  const isCompleted = lastLegEnd
    ? new Date(lastLegEnd).getTime() < Date.now() - 24 * 3600000
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

  // Load destination intel and companions on mount
  useEffect(() => {
    if (!trip.id) return;
    getDestinationIntel(trip.id).then(d => { if (d?.intel) setDestIntel(d); }).catch(e => {
      if (e.code === "pro_required") setDestIntel({ pro_required: true });
    });
    getCompanions(trip.id).then(d => { if (d?.companions) setCompanions(d.companions); }).catch(() => {});
  }, [trip.id]);

  const handleInviteCompanion = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteCompanion(trip.id, inviteEmail.trim());
      Alert.alert("Invite sent!", `An invite was sent to ${inviteEmail.trim()}.`);
      setInviteEmail("");
      const d = await getCompanions(trip.id);
      if (d?.companions) setCompanions(d.companions);
    } catch (e) {
            if (e.code === "pro_required") {
        navigation.navigate("Subscription");
      } else {
        Alert.alert("Error", e.message);
      }
    } finally {
      setInviting(false);
    }
  };
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
          {depDate && (
            <Text style={s.tripDate}>
              {depDate}{endDate && endDate !== depDate ? `  –  ${endDate}` : ""}
            </Text>
          )}
          <View style={s.pillRow}>
            <View style={s.pillLive}><Text style={s.pillLiveT}>● Live monitoring</Text></View>
            {flightLegs.length > 0 && (
              <View style={s.pillInfo}>
                <Text style={s.pillInfoT}>{flightLegs.length} flight{flightLegs.length !== 1 ? "s" : ""}</Text>
              </View>
            )}
            {legs.filter(l => l.type === "hotel" || l.type === "airbnb").length > 0 && (
              <View style={s.pillInfo}>
                <Text style={s.pillInfoT}>
                  {legs.filter(l => l.type === "hotel" || l.type === "airbnb").length === 1 ? "1 stay" :
                    `${legs.filter(l => l.type === "hotel" || l.type === "airbnb").length} stays`}
                </Text>
              </View>
            )}
            {legs.filter(l => l.type === "train").length > 0 && (
              <View style={s.pillInfo}>
                <Text style={s.pillInfoT}>
                  {legs.filter(l => l.type === "train").length} train{legs.filter(l => l.type === "train").length !== 1 ? "s" : ""}
                </Text>
              </View>
            )}
            {legs.filter(l => l.type === "car").length > 0 && (
              <View style={s.pillInfo}>
                <Text style={s.pillInfoT}>Car rental</Text>
              </View>
            )}
            {topRisk && topRisk.risk_level !== "low" && (
              <View style={[s.pillInfo, {
                backgroundColor: topRisk.risk_level === "critical" ? C.coral + "1E" : C.amber + "1A",
                borderColor:     topRisk.risk_level === "critical" ? C.coral + "4D" : C.amber + "40",
              }]}>
                <Text style={[s.pillInfoT, {
                  color: topRisk.risk_level === "critical" ? C.coral : C.amber,
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
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, marginBottom: 10 }}>
                  {/* Apple Wallet pass */}
                  {leg.id && (
                    <Pressable
                      style={s.walletBtn}
                      onPress={() => {
                        Linking.openURL(`${API_BASE}/wallet/pass/${leg.id}`);
                      }}
                    >
                      <Text style={s.walletBtnT}>💳 Add to Wallet</Text>
                    </Pressable>
                  )}
                  {/* Disruption CTA for upcoming flights */}
                  {!isCompleted && (
                    <Pressable
                      style={s.disruptionCta}
                      onPress={() => openAlert(leg)}
                    >
                      <Text style={s.disruptionCtaText}>⚡ Simulate disruption →</Text>
                    </Pressable>
                  )}
                  {/* Upgrade bid */}
                  {!isCompleted && leg.id && (
                    <Pressable
                      style={s.upgradeBidBtn}
                      onPress={() => navigation.navigate("UpgradeBid", {
                        tripId: trip.id,
                        legId: leg.id,
                        flightIdent: leg.flight_number,
                        origin: leg.origin,
                        destination: leg.destination,
                        carrier: leg.carrier,
                      })}
                    >
                      <Text style={s.upgradeBidBtnT}>✦ Bid upgrade</Text>
                    </Pressable>
                  )}
                  {/* Compensation (completed trips) */}
                  {isCompleted && leg.id && (
                    <Pressable
                      style={s.compensationBtn}
                      onPress={() => navigation.navigate("Compensation", {
                        tripId: trip.id,
                        legId: leg.id,
                        flightIdent: leg.flight_number,
                      })}
                    >
                      <Text style={s.compensationBtnT}>€ File compensation</Text>
                    </Pressable>
                  )}
                  {/* Airport intelligence buttons */}
                  {leg.destination && (
                    <View style={s.airportBtnsRow}>
                      <Pressable
                        style={s.groundTransportBtn}
                        onPress={() => navigation.navigate("GroundTransport", {
                          iata: leg.destination,
                          city: leg.destination,
                          destination: trip.destination_city || null,
                          tripId: trip.id,
                        })}
                      >
                        <Text style={s.groundTransportBtnT}>🚆 Transport</Text>
                      </Pressable>
                      <Pressable
                        style={s.airportDiningBtn}
                        onPress={() => navigation.navigate("AirportDining", {
                          iata: leg.destination,
                          flightInfo: leg.flight_number ? `${leg.carrier || ""}${leg.flight_number}` : null,
                        })}
                      >
                        <Text style={s.airportDiningBtnT}>🍽️ Dining</Text>
                      </Pressable>
                      <Pressable
                        style={s.airportNavBtn}
                        onPress={() => navigation.navigate("AirportNavigation", {
                          iata: leg.destination,
                          gate: null,
                          flightInfo: leg.flight_number ? `${leg.carrier || ""}${leg.flight_number}` : null,
                        })}
                      >
                        <Text style={s.airportNavBtnT}>🗺️ Navigate</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Accommodation (hotel + Airbnb + short-term rental) */}
        {legs.filter(l => l.type === "hotel" || l.type === "airbnb").length > 0 && (
          <>
            <Text style={g.sectionT}>ACCOMMODATION</Text>
            {legs.filter(l => l.type === "hotel" || l.type === "airbnb").map((leg, i) => (
              <LegRouter key={i} leg={leg} hotelAlert={hotelAlertMap[leg.id]} />
            ))}
          </>
        )}

        {/* Rail */}
        {legs.filter(l => l.type === "train").length > 0 && (
          <>
            <Text style={g.sectionT}>TRAINS</Text>
            {legs.filter(l => l.type === "train").map((leg, i) => (
              <LegRouter key={i} leg={leg} />
            ))}
          </>
        )}

        {/* Car rentals */}
        {legs.filter(l => l.type === "car").length > 0 && (
          <>
            <Text style={g.sectionT}>CAR RENTALS</Text>
            {legs.filter(l => l.type === "car").map((leg, i) => (
              <LegRouter key={i} leg={leg} />
            ))}
          </>
        )}

        {/* Ferries */}
        {legs.filter(l => l.type === "ferry").length > 0 && (
          <>
            <Text style={g.sectionT}>FERRIES</Text>
            {legs.filter(l => l.type === "ferry").map((leg, i) => (
              <LegRouter key={i} leg={leg} />
            ))}
          </>
        )}

        {/* Activities & experiences */}
        {legs.filter(l => l.type === "activity").length > 0 && (
          <>
            <Text style={g.sectionT}>ACTIVITIES</Text>
            {legs.filter(l => l.type === "activity").map((leg, i) => (
              <LegRouter key={i} leg={leg} />
            ))}
          </>
        )}

        {/* Transfers, cruises, and anything else */}
        {legs.filter(l => l.type === "transfer" || l.type === "cruise" || l.type === "other").length > 0 && (
          <>
            <Text style={g.sectionT}>OTHER BOOKINGS</Text>
            {legs.filter(l => l.type === "transfer" || l.type === "cruise" || l.type === "other").map((leg, i) => (
              <LegRouter key={i} leg={leg} />
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

        {/* Destination intelligence — pro upsell */}
        {destIntel?.pro_required && (
          <Pressable
            style={s.proUpsellCard}
            onPress={() => navigation.navigate("Subscription")}
          >
            <Text style={s.proUpsellTitle}>✦ Destination Intel — Pro</Text>
            <Text style={s.proUpsellSub}>Upgrade to get AI-curated local tips, restaurant picks, and neighbourhood guides for every destination.</Text>
            <Text style={s.proUpsellCta}>Upgrade to Pro →</Text>
          </Pressable>
        )}

        {/* Destination intelligence card */}
        {destIntel?.intel && (
          <>
            <Text style={g.sectionT}>DESTINATION INTEL — {destIntel.destination}</Text>
            <View style={s.intelCard}>
              {destIntel.intel.restaurant && (
                <View style={s.intelRow}>
                  <Text style={s.intelIc}>🍽</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.intelLabel}>WHERE TO EAT</Text>
                    <Text style={s.intelText}>{destIntel.intel.restaurant}</Text>
                  </View>
                </View>
              )}
              {destIntel.intel.neighbourhood && (
                <View style={s.intelRow}>
                  <Text style={s.intelIc}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.intelLabel}>NEIGHBOURHOOD</Text>
                    <Text style={s.intelText}>{destIntel.intel.neighbourhood}</Text>
                  </View>
                </View>
              )}
              {destIntel.intel.hotel_tip && (
                <View style={s.intelRow}>
                  <Text style={s.intelIc}>🏨</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.intelLabel}>HOTEL TIP</Text>
                    <Text style={s.intelText}>{destIntel.intel.hotel_tip}</Text>
                  </View>
                </View>
              )}
              {destIntel.intel.local_tip && (
                <View style={[s.intelRow, { marginBottom: 0 }]}>
                  <Text style={s.intelIc}>💡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.intelLabel}>LOCAL TIP</Text>
                    <Text style={s.intelText}>{destIntel.intel.local_tip}</Text>
                  </View>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Pressable
                  style={[s.intelCTA, { flex: 1 }]}
                  onPress={() => navigation.navigate("Destination", {
                    city: destIntel.destination,
                    trip_id: trip.id,
                    tripTitle: trip.title,
                  })}
                >
                  <Text style={s.intelCTAT}>Explore {destIntel.destination}  ›</Text>
                </Pressable>
                <Pressable
                  style={[s.intelCTA, { flex: 1 }]}
                  onPress={() => navigation.navigate("Concierge", {
                    prefill: `Tell me more about ${destIntel.destination} — restaurants, neighbourhoods, what to do.`
                  })}
                >
                  <Text style={s.intelCTAT}>Ask Wingman  ›</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* Travel companions */}
        <Text style={g.sectionT}>TRAVEL COMPANIONS</Text>
        <View style={s.companionCard}>
          {companions.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              {companions.map((c, i) => (
                <View key={i} style={s.companionRow}>
                  <View style={s.companionAvatar}>
                    <Text style={s.companionAvatarT}>{(c.invitee_email || "?")[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.companionEmail}>{c.invitee_email}</Text>
                  <Text style={[s.companionStatus, { color: c.accepted_at ? C.teal : C.mut }]}>
                    {c.accepted_at ? "Joined" : "Pending"}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {companions.length === 0 && (
            <Text style={s.companionEmpty}>No companions yet. Invite someone to share this trip.</Text>
          )}
          <View style={s.companionInputRow}>
            <View style={s.companionInput}>
              <TextInput
                style={s.companionInputText}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="Enter email address…"
                placeholderTextColor={C.mut}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleInviteCompanion}
              />
            </View>
            <Btn
              title={inviting ? "…" : "Invite"}
              kind="accent"
              onPress={handleInviteCompanion}
              disabled={inviting}
              style={{ paddingHorizontal: 16 }}
            />
          </View>
        </View>

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
  header: { borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", marginBottom: 4 },
  tripTitle: { color: C.ink, fontSize: 28, fontFamily: T.serifB, letterSpacing: -0.5 },
  tripDate: { color: C.mut, fontSize: 13, fontFamily: T.sans, marginTop: 4 },
  pillRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  pillLive: { backgroundColor: C.teal + "22", borderColor: C.teal + "4D", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillLiveT: { color: C.teal, fontSize: 11, fontFamily: T.sansB },
  pillInfo: { backgroundColor: C.gold + "1E", borderColor: C.gold + "40", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillInfoT: { color: C.gold, fontSize: 11, fontFamily: T.sansM },

  // Risk loading
  riskLoadingRow: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, marginBottom: 10 },

  // Connection risk cards
  connRiskCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  connRiskLevel: { fontSize: 12, fontFamily: T.sansB, letterSpacing: 0.5, flex: 1 },
  connRiskScore: { fontSize: 14, fontFamily: T.sansB },
  connRiskRoute: { color: C.ink, fontSize: 13, fontFamily: T.sansM, marginBottom: 4 },
  connRiskRec: { color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 17 },
  connRiskDownstream: { fontSize: 12, fontFamily: T.sansB, marginTop: 6 },

  // Hotel alert
  hotelAlertCard: { backgroundColor: "rgba(201,169,110,0.08)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", padding: 12, marginBottom: 10 },
  hotelAlertCardText: { color: C.gold, fontSize: 13, lineHeight: 18 },
  hotelAlertBanner: { marginTop: 10, backgroundColor: "rgba(201,169,110,0.08)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", padding: 10 },
  hotelAlertText: { color: C.gold, fontSize: 12, lineHeight: 17 },

  // Leg cards — exact deck spec
  legCard: { backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(201,169,110,0.15)", borderRadius: 14, padding: 18, marginBottom: 10 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  airport: { color: C.ink, fontSize: 30, fontFamily: T.serifB, letterSpacing: -0.5 },
  arrow: { color: C.mut, fontSize: 18 },
  flightNum: { color: C.mut, fontSize: 13, fontFamily: T.sans },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoIc: { fontSize: 14 },
  infoT: { color: C.ink, fontSize: 13, fontFamily: T.sansM },

  // Disruption CTA
  disruptionCta: { marginTop: -4, marginBottom: 10, paddingHorizontal: 4 },
  disruptionCtaText: { color: C.gold, fontSize: 12, fontFamily: T.sansM },

  // Weather
  weatherWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  weatherTitle: { color: C.mut, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  riskWrap: { marginTop: 4 },
  riskRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  riskLabel: { color: C.ink, fontSize: 13, fontFamily: T.sansM },
  riskPct: { fontSize: 13, fontFamily: T.sansB },
  riskTrack: { height: 6, backgroundColor: C.card2, borderRadius: 99, overflow: "hidden" },
  riskFill: { height: "100%", borderRadius: 99 },
  factorRow: { flexDirection: "row", gap: 6 },
  factorDot: { color: C.mut, fontSize: 12 },
  factorT: { color: C.mut, fontSize: 12, flex: 1 },
  factorD: { color: C.ink, fontFamily: T.sansM },

  // Leg cards — all types
  legCardTitle: { color: C.ink, fontSize: 15, fontFamily: T.sansB, marginBottom: 4, letterSpacing: 0.1 },
  legCardRoute: { color: C.ink, fontSize: 13, fontFamily: T.sansM, marginTop: 2, marginBottom: 2 },
  legCardMeta:  { color: C.mut, fontSize: 12, fontFamily: T.sans },
  legCardSub:   { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 2 },

  // Empty
  emptyCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 32, alignItems: "center", marginBottom: 12 },
  emptyT: { color: C.ink, fontSize: 16, fontFamily: T.sansB, marginBottom: 6 },
  emptySub: { color: C.mut, fontSize: 13, textAlign: "center", lineHeight: 19 },

  // Outcome card (learning loop)
  outcomeCard: { backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(201,169,110,0.3)", borderRadius: 18, padding: 20, marginBottom: 12 },
  outcomeTitle: { color: C.ink, fontSize: 16, fontFamily: T.sansB, marginBottom: 6 },
  outcomeSub: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  starRow: { flexDirection: "row", gap: 8 },
  starBtn: { padding: 4 },
  star: { fontSize: 28, color: C.line },
  ratingLabel: { color: C.gold, fontSize: 13, fontFamily: T.sansM, marginTop: 8 },

  // Concierge CTA
  conciergeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", borderRadius: 16, padding: 14, marginBottom: 8 },
  conciergeDot: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  conciergeT: { color: C.ink, fontSize: 14, fontFamily: T.sansB, marginBottom: 2 },
  conciergeS: { color: C.mut, fontSize: 12, lineHeight: 17 },

  // Destination intel card
  intelCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 12 },
  intelRow: { flexDirection: "row", gap: 12, marginBottom: 12, alignItems: "flex-start" },
  intelIc: { fontSize: 18, width: 24, textAlign: "center", marginTop: 2 },
  intelLabel: { color: C.mut, fontSize: 9, fontFamily: T.sansB, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 },
  intelText: { color: C.ink, fontSize: 13, lineHeight: 19 },
  intelCTA: { borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 12, marginTop: 4 },
  intelCTAT: { color: C.gold, fontSize: 13, fontFamily: T.sansM },

  // Companion card
  companionCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 12 },
  companionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  companionAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  companionAvatarT: { color: C.gold, fontSize: 13, fontFamily: T.sansB },
  companionEmail: { color: C.ink, fontSize: 13, flex: 1 },
  companionStatus: { fontSize: 11, fontFamily: T.sansB },
  companionEmpty: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  companionInputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  companionInput: { flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  companionInputText: { color: C.ink, fontSize: 13 },

  // Pro upsell card
  proUpsellCard: { backgroundColor: "rgba(201,169,110,0.06)", borderWidth: 1, borderColor: "rgba(201,169,110,0.3)", borderRadius: 18, padding: 18, marginBottom: 12 },
  proUpsellTitle: { color: C.gold, fontSize: 15, fontFamily: T.sansB, marginBottom: 6 },
  proUpsellSub: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  proUpsellCta: { color: C.gold, fontSize: 13, fontFamily: T.sansB },

  // Wallet button
  walletBtn: { backgroundColor: "#1C1C1E", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  walletBtnT: { color: C.ink, fontSize: 12, fontFamily: T.sansM },

  // Upgrade bid button
  upgradeBidBtn: { backgroundColor: "rgba(201,169,110,0.08)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(201,169,110,0.3)" },
  upgradeBidBtnT: { color: C.gold, fontSize: 12, fontFamily: T.sansM },

  // Compensation button
  compensationBtn: { backgroundColor: C.gold + "14", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.gold + "40" },
  compensationBtnT: { color: C.gold, fontSize: 12, fontFamily: T.sansM },

  // Ground transport + airport intel buttons
  airportBtnsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  groundTransportBtn: { backgroundColor: C.teal + "14", borderWidth: 1, borderColor: C.teal + "40", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  groundTransportBtnT: { color: C.teal, fontSize: 13, fontFamily: T.sansM },
  airportDiningBtn: { backgroundColor: C.gold + "14", borderWidth: 1, borderColor: C.gold + "40", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  airportDiningBtnT: { color: C.gold, fontSize: 13, fontFamily: T.sansM },
  airportNavBtn: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  airportNavBtnT: { color: C.ink, fontSize: 13, fontFamily: T.sansM },
});
