// HomeScreen — Quiet Luxury / Editorial
// Warm espresso bg + parchment Next Up card + champagne gold accents
// Playfair Display serif greeting + DM Sans body

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Animated, Easing, TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { C, T } from "../theme";
import { Btn, tap, SerifText, g } from "../components";
import { getTrips, deleteTrip, getFlightStatus, getFlightStatusPublic, getPrediction, getGroundIntel, getMe, getLoyaltyAccounts, getTripBriefing, getNextTripWindow, getPoints } from "../api";
import { scheduleDisruption } from "../notify";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
// Shown on parchment card — uses dark ink variants

function StatusBadge({ status, onParch = false }) {
  if (!status) return null;
  const map = {
    "On Time":   { bg: onParch ? "rgba(45,184,150,0.15)"  : "rgba(45,184,150,0.12)",  border: "rgba(45,184,150,0.35)",  text: onParch ? "#1A7A5E" : C.teal },
    "Delayed":   { bg: onParch ? "rgba(212,144,42,0.15)"  : "rgba(212,144,42,0.12)",  border: "rgba(212,144,42,0.35)",  text: onParch ? "#8A5A00" : C.amber },
    "Cancelled": { bg: onParch ? "rgba(217,95,95,0.15)"   : "rgba(217,95,95,0.12)",   border: "rgba(217,95,95,0.35)",   text: onParch ? "#8A2020" : C.coral },
    "Landed":    { bg: onParch ? "rgba(138,128,100,0.15)" : "rgba(138,128,100,0.12)", border: "rgba(138,128,100,0.3)",  text: onParch ? "#5A5040" : C.mut },
    "Scheduled": { bg: onParch ? "rgba(138,128,100,0.12)" : "rgba(138,128,100,0.10)", border: "rgba(138,128,100,0.2)",  text: onParch ? "#6B5F50" : C.mut },
    "In Air":    { bg: onParch ? "rgba(201,169,110,0.15)" : "rgba(201,169,110,0.12)", border: "rgba(201,169,110,0.35)", text: onParch ? "#7A5A20" : C.gold },
    "Booked":    { bg: onParch ? "rgba(138,128,100,0.12)" : "rgba(138,128,100,0.10)", border: "rgba(138,128,100,0.2)",  text: onParch ? "#6B5F50" : C.mut },
  };
  const st = map[status] || map["Scheduled"];
  return (
    <View style={{ backgroundColor: st.bg, borderColor: st.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: st.text, fontSize: 10, fontFamily: T.sansB, letterSpacing: T.trackMed }}>{status.toUpperCase()}</Text>
    </View>
  );
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

function RiskBadge({ risk }) {
  if (risk == null || risk < 30) return null;
  const high = risk >= 60;
  return (
    <View style={{
      backgroundColor: high ? "rgba(217,95,95,0.12)" : "rgba(212,144,42,0.12)",
      borderColor:     high ? "rgba(217,95,95,0.25)" : "rgba(212,144,42,0.25)",
      borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
      flexDirection: "row", alignItems: "center", gap: 4,
    }}>
      <Text style={{ color: high ? C.coral : C.amber, fontSize: 10, fontFamily: T.sansB, letterSpacing: T.trackMed }}>
        {high ? "!" : "~"} {risk}% RISK
      </Text>
    </View>
  );
}

// ─── Next Up Card (Parchment) ─────────────────────────────────────────────────
// Light parchment card on dark background — the signature visual of the app

function NextUpCard({ flight, navigation }) {
  const [risk, setRisk]             = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [groundIntel, setGroundIntel] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.25, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
  const riskColor = risk >= 60 ? "#8A2020" : risk >= 30 ? "#8A5A00" : "#1A7A5E";
  const statusText = risk == null ? null : risk >= 60 ? "HIGH RISK" : risk >= 30 ? "MOD. RISK" : "ON TIME";

  return (
    <Pressable onPress={() => navigation.navigate("Alert", { flight })} style={{ marginBottom: 22 }}>
      {/* Parchment card — light on dark */}
      <View style={s.parchCard}>
        {/* Top row: NEXT UP label + status badge */}
        <View style={[g.rowBetween, { marginBottom: 16 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* Hairline plane icon in a circle */}
            <View style={s.parchIcon}>
              <Text style={{ fontSize: 14, color: C.inkD }}>+</Text>
            </View>
            <Text style={s.parchLabel}>NEXT UP</Text>
          </View>
          {statusText && !riskLoading && (
            <View style={{
              backgroundColor: risk >= 60 ? "rgba(217,95,95,0.12)" : risk >= 30 ? "rgba(212,144,42,0.12)" : "rgba(45,184,150,0.12)",
              borderColor:     risk >= 60 ? "rgba(217,95,95,0.3)"  : risk >= 30 ? "rgba(212,144,42,0.3)"  : "rgba(45,184,150,0.3)",
              borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
            }}>
              <Text style={{ color: riskColor, fontSize: 10, fontFamily: T.sansB, letterSpacing: T.trackMed }}>
                {statusText}
              </Text>
            </View>
          )}
          {cd && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Animated.View style={[s.liveDot, { opacity: pulseAnim }]} />
              <Text style={s.parchCountdown}>{cd}</Text>
            </View>
          )}
        </View>

        {/* Route: large serif airport codes */}
        <View style={s.parchRouteRow}>
          <SerifText bold style={s.parchAirport}>{flight.origin || "—"}</SerifText>
          <View style={s.parchArrowWrap}>
            <View style={s.parchArrowLine} />
            <Text style={s.parchArrowIc}>›</Text>
            <View style={s.parchArrowLine} />
          </View>
          <SerifText bold style={s.parchAirport}>{flight.destination || "—"}</SerifText>
        </View>

        {/* Flight meta */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          {flightLabel ? <Text style={s.parchMeta}>{flightLabel}</Text> : null}
          {flight.departs_at ? <Text style={s.parchMetaDot}>·</Text> : null}
          {flight.departs_at ? <Text style={s.parchMeta}>{formatTime(flight.departs_at)}</Text> : null}
          {flight.tripTitle ? <Text style={s.parchMetaDot}>·</Text> : null}
          {flight.tripTitle ? <Text style={s.parchMeta}>{flight.tripTitle}</Text> : null}
        </View>

        {/* Ground Intelligence timeline */}
        {groundIntel?.timeline?.length > 0 && (
          <View style={s.groundWrap}>
            <Text style={s.groundLabel}>GROUND TIMELINE</Text>
            {groundIntel.timeline.map((step, i) => (
              <View key={i} style={s.groundRow}>
                <Text style={[s.groundIc, { color: C.inkD }]}>{step.icon || "›"}</Text>
                <Text style={s.groundStep}>{step.label}</Text>
                <Text style={[s.groundTime, step.minutes > 30 ? { color: "#8A5A00" } : {}]}>
                  {step.minutes > 0 ? `${step.minutes}m` : "Now"}
                </Text>
              </View>
            ))}
            {groundIntel.bufferMinutes != null && (
              <View style={[s.groundVerdict, {
                backgroundColor: groundIntel.atRisk ? "rgba(217,95,95,0.10)" : "rgba(45,184,150,0.10)",
                borderColor:     groundIntel.atRisk ? "rgba(217,95,95,0.25)" : "rgba(45,184,150,0.25)",
              }]}>
                <Text style={{ color: groundIntel.atRisk ? "#8A2020" : "#1A7A5E", fontSize: 12, fontFamily: T.sansB }}>
                  {groundIntel.verdict === "will_miss" ? "!  At risk of missing flight"
                    : groundIntel.verdict === "tight"    ? `~  Tight — ${groundIntel.bufferMinutes}m buffer`
                    : groundIntel.verdict === "on_track" ? `+  On track — ${groundIntel.bufferMinutes}m to spare`
                    : `+  Plenty of time — ${groundIntel.bufferMinutes}m buffer`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* View Details link */}
        <View style={[g.rowBetween, { marginTop: 16 }]}>
          <Text style={s.parchHint}>Tap for rescue options</Text>
          <Text style={s.parchArrow}>View Details  ›</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Flight Leg Row ───────────────────────────────────────────────────────────

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
      {/* Hairline plane icon */}
      <View style={s.legIconWrap}>
        <Text style={s.legIc}>+</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.legT}>{title}</Text>
        {sub ? <Text style={s.legS}>{sub}</Text> : null}
      </View>
      {fetching
        ? <ActivityIndicator size="small" color={C.gold} />
        : <StatusBadge status={status || "Scheduled"} />
      }
    </View>
  );
}

// ─── Trip Card ────────────────────────────────────────────────────────────────

function TripCard({ trip, onDelete, navigation }) {
  const [risk, setRisk] = useState(null);
  const legs = trip.legs || [];
  const firstFlight = legs.find(l => l.type === "flight");
  const depDate = formatDate(firstFlight?.departs_at);

  useEffect(() => {
    if (!firstFlight?.origin || !firstFlight?.destination) return;
    const dep = firstFlight.departs_at ? new Date(firstFlight.departs_at).getTime() : 0;
    if (dep < Date.now()) return;
    getPrediction({ dep: firstFlight.origin, arr: firstFlight.destination })
      .then(p => setRisk(p?.risk ?? null))
      .catch(() => {});
  }, [firstFlight?.origin, firstFlight?.destination]);

  return (
    <Pressable onPress={() => navigation.navigate("TripDetail", { trip })} style={{ marginBottom: 12 }}>
      <View style={s.tripCard}>
        <View style={g.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={s.dest}>{trip.title}</Text>
            {depDate && <Text style={s.when}>{depDate}</Text>}
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {risk != null && <RiskBadge risk={risk} />}
            {risk == null && (
              <View style={s.pillLive}>
                <View style={s.pillDot} />
                <Text style={s.pillLiveT}>MONITORING</Text>
              </View>
            )}
            <Pressable onPress={() => Alert.alert("Delete trip?", trip.title, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => onDelete(trip.id) }
            ])}>
              <Text style={{ color: C.mut, fontSize: 18, lineHeight: 22 }}>×</Text>
            </Pressable>
          </View>
        </View>

        {legs.map((leg, i) => {
          if (leg.type === "flight") return <FlightLeg key={i} leg={leg} />;
          // Hotel / transfer
          const ic = leg.type === "hotel" ? "H" : "T";
          const title = leg.carrier || leg.destination || "Booking";
          const sub = formatDate(leg.departs_at || leg.check_in);
          return (
            <View key={i} style={s.leg}>
              <View style={s.legIconWrap}>
                <Text style={[s.legIc, { fontSize: 11 }]}>{ic}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.legT}>{title}</Text>
                {sub ? <Text style={s.legS}>{sub}</Text> : null}
              </View>
              <StatusBadge status="Booked" />
            </View>
          );
        })}

        {legs.length === 0 && (
          <Text style={{ color: C.mut, fontSize: 13, fontFamily: T.sans, marginTop: 8 }}>No legs added yet</Text>
        )}
        <Text style={s.tapHint}>Tap for details  ›</Text>
      </View>
    </Pressable>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ navigation }) {
  const [flightNum, setFlightNum] = useState("");
  const [tracking, setTracking]   = useState(false);
  const [tracked, setTracked]     = useState(null);
  const [trackErr, setTrackErr]   = useState("");

  const STATUS_COLORS = {
    "On Time": C.teal, "Delayed": C.amber, "Cancelled": C.coral,
    "In Air": C.gold, "Landed": C.mut, "Scheduled": C.mut,
  };

  const trackFlight = async () => {
    const q = flightNum.trim().toUpperCase().replace(/\s+/g, "");
    if (!q) return;
    setTracking(true); setTrackErr(""); setTracked(null);
    try {
      const data = await getFlightStatusPublic(q);
      if (!data || data.status === "Unknown") {
        setTrackErr("Flight not found. Try a format like UA412 or AA100.");
      } else {
        setTracked(data);
      }
    } catch (e) {
      setTrackErr("Couldn't reach flight data. Check your connection.");
    } finally {
      setTracking(false);
    }
  };

  return (
    <View style={s.emptyWrap}>
      {/* Live flight tracker — works before any trip is added */}
      <View style={s.trackerCard}>
        <LinearGradient colors={[C.gold + "10", "transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, borderRadius: 22 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <View style={s.emptyIcon}><Text style={{ fontSize: 14, color: C.gold }}>+</Text></View>
          <Text style={s.trackerTitle}>Track any flight, right now</Text>
        </View>
        <Text style={s.trackerSub}>No trip needed. Enter any flight number to see live status.</Text>
        <View style={s.trackerRow}>
          <TextInput
            style={s.trackerInput}
            value={flightNum}
            onChangeText={t => { setFlightNum(t); setTrackErr(""); setTracked(null); }}
            placeholder="UA412, AA100, DL55…"
            placeholderTextColor={C.mut}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={trackFlight}
          />
          <Pressable
            style={[s.trackerBtn, (!flightNum.trim() || tracking) && { opacity: 0.5 }]}
            onPress={trackFlight}
            disabled={!flightNum.trim() || tracking}
          >
            {tracking
              ? <ActivityIndicator color={C.bg} size="small" />
              : <Text style={s.trackerBtnT}>Track</Text>
            }
          </Pressable>
        </View>
        {trackErr ? <Text style={s.trackerErr}>{trackErr}</Text> : null}
        {tracked && (
          <View style={s.trackedResult}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={s.trackedIdent}>{tracked.ident || flightNum}</Text>
              <View style={{ backgroundColor: (STATUS_COLORS[tracked.status] || C.mut) + "22", borderColor: (STATUS_COLORS[tracked.status] || C.mut) + "55", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: STATUS_COLORS[tracked.status] || C.mut, fontSize: 10, fontFamily: T.sansB }}>{(tracked.status || "Unknown").toUpperCase()}</Text>
              </View>
            </View>
            {(tracked.origin || tracked.destination) && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <SerifText bold style={{ color: C.ink, fontSize: 22 }}>{tracked.origin || "—"}</SerifText>
                <Text style={{ color: C.mut, fontSize: 14 }}>→</Text>
                <SerifText bold style={{ color: C.ink, fontSize: 22 }}>{tracked.destination || "—"}</SerifText>
              </View>
            )}
            {tracked.departs_at && (
              <Text style={{ color: C.mut, fontSize: 12, fontFamily: T.sans }}>
                Departs {formatTime(tracked.departs_at)}{tracked.delay > 0 ? `  ·  +${tracked.delay}m delay` : ""}
              </Text>
            )}
            <Pressable style={[s.emptyPrimary, { marginTop: 14 }]} onPress={() => navigation.navigate("AddTrip")}>
              <Text style={s.emptyPrimaryT}>+ Add this trip to Wingman</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Gmail import CTA */}
      <Pressable style={s.gmailCard} onPress={() => navigation.navigate("Connections")}>
        <LinearGradient colors={[C.gold + "0A", "transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, borderRadius: 18 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[s.emptyIcon, { width: 40, height: 40, borderRadius: 12 }]}>
            <Text style={{ fontSize: 16, color: C.gold }}>@</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.gmailTitle}>Auto-import all your trips</Text>
            <Text style={s.gmailSub}>Connect Gmail and Wingman finds every booking — no manual entry.</Text>
          </View>
          <Text style={{ color: C.gold, fontSize: 18 }}>›</Text>
        </View>
      </Pressable>

      {/* Add trip manually */}
      <Btn title="+ Add a trip manually" onPress={() => navigation.navigate("AddTrip")} style={{ marginTop: 6 }} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const [trips, setTrips]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [briefing, setBriefing]   = useState(null);
  const [expiringPoints, setExpiringPoints] = useState(null);
  const [nextTripWindow, setNextTripWindow] = useState(null);
  const [pointsData, setPointsData]         = useState(null);

  useEffect(() => {
    getMe().then(u => { if (u?.first_name) setFirstName(u.first_name); }).catch(() => {});
    getPoints().then(d => { if (d?.balance !== undefined) setPointsData(d); }).catch(() => {});
    // Check for expiring loyalty points
    getNextTripWindow().then(data => {
      if (data?.window?.days_until > 0 && data.window.days_until <= 21) {
        setNextTripWindow(data.window);
      }
    }).catch(() => {});
    getLoyaltyAccounts().then(data => {
      const accts = data?.accounts || [];
      const soon = accts.filter(a => {
        if (!a.expiration_date || !a.points_balance) return false;
        const days = Math.round((new Date(a.expiration_date) - Date.now()) / 86400000);
        return days > 0 && days <= 60 && a.points_balance > 1000;
      });
      if (soon.length > 0) setExpiringPoints(soon[0]);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await getTrips();
      const fetchedTrips = data.trips || [];
      setTrips(fetchedTrips);
      // Check if any trip departs today — fetch briefing if so
      const today = new Date().toDateString();
      const todayTrip = fetchedTrips.find(trip =>
        (trip.legs || []).some(l => l.type === 'flight' && l.departs_at && new Date(l.departs_at).toDateString() === today)
      );
      if (todayTrip) {
        try {
          const b = await getTripBriefing(todayTrip.id);
          if (b && b.flight) setBriefing({ ...b, tripId: todayTrip.id });
        } catch { /* briefing is best-effort */ }
      }
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.gold}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.appH}>
          {/* W monogram + WINGMAN wordmark */}
          <View style={s.logoRow}>
            <View style={s.wMark}>
              <SerifText bold style={s.wMarkText}>W</SerifText>
            </View>
            <Text style={s.logo}>WINGMAN</Text>
          </View>
          {/* Avatar / settings */}
          <Pressable style={s.avatar} onPress={() => navigation.navigate("Settings")}>
            <View style={s.avatarInner}>
              <Text style={s.avatarT}>{firstName ? firstName[0].toUpperCase() : "W"}</Text>
            </View>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* ── Serif greeting ─────────────────────────────────────────── */}
            <View style={s.greetWrap}>
              <SerifText style={s.greetH}>{greeting()}{firstName ? `, ${firstName}.` : "."}</SerifText>
              <Text style={s.greetS}>
                {nextFlight
                  ? `Next flight: ${nextFlight.origin} → ${nextFlight.destination}`
                  : "You're all set for today."}
              </Text>
            </View>

            {/* ── Day-of-flight mission briefing ────────────────────────── */}
            {briefing && briefing.flight && (
              <>
                <Text style={g.sectionT}>TODAY'S BRIEFING</Text>
                <Pressable
                  style={s.briefingCard}
                  onPress={() => navigation.navigate("TripDetail", { tripId: briefing.tripId })}
                >
                  <View style={s.briefingHeader}>
                    <Text style={s.briefingFlight}>
                      {briefing.flight.carrier}{briefing.flight.flight_number}  ·  {briefing.flight.origin} → {briefing.flight.destination}
                    </Text>
                    {briefing.live_status?.status && (
                      <StatusBadge status={briefing.live_status.status} />
                    )}
                  </View>
                  <View style={s.briefingRow}>
                    <View style={s.briefingItem}>
                      <Text style={s.briefingLabel}>DEPARTS</Text>
                      <Text style={s.briefingValue}>{formatTime(briefing.flight.departs_at)}</Text>
                    </View>
                    {briefing.live_status?.gate && (
                      <View style={s.briefingItem}>
                        <Text style={s.briefingLabel}>GATE</Text>
                        <Text style={s.briefingValue}>{briefing.live_status.gate}</Text>
                      </View>
                    )}
                    {briefing.live_status?.terminal && (
                      <View style={s.briefingItem}>
                        <Text style={s.briefingLabel}>TERMINAL</Text>
                        <Text style={s.briefingValue}>{briefing.live_status.terminal}</Text>
                      </View>
                    )}
                    {briefing.tsa_wait?.wait_minutes && (
                      <View style={s.briefingItem}>
                        <Text style={s.briefingLabel}>TSA WAIT</Text>
                        <Text style={s.briefingValue}>{briefing.tsa_wait.wait_minutes}m</Text>
                      </View>
                    )}
                  </View>
                  {briefing.live_status?.delay > 0 && (
                    <View style={s.briefingAlert}>
                      <Text style={s.briefingAlertT}>⚠ Delayed {briefing.live_status.delay} minutes</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                    <Pressable
                      style={s.briefingCTA}
                      onPress={() => navigation.navigate("Concierge", {
                        prefill: `What do I need to know for my ${briefing.flight.carrier}${briefing.flight.flight_number} flight today?`
                      })}
                    >
                      <Text style={s.briefingCTAT}>Ask Wingman →</Text>
                    </Pressable>
                    {briefing.flight.destination && (
                      <Pressable
                        style={s.briefingGroundBtn}
                        onPress={() => navigation.navigate("GroundTransport", {
                          iata: briefing.flight.destination,
                          city: briefing.flight.destination,
                        })}
                      >
                        <Text style={s.briefingGroundBtnT}>🚆 Ground transport</Text>
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              </>
            )}

            {/* ── Wingman Points tile ─────────────────────────────────────── */}
            {pointsData && (() => {
              const tier = pointsData.tier || "explorer";
              const TIER_ACCENT = { explorer: C.mut, flyer: "#5B8CFF", navigator: C.gold, elite: "#FF9F43" };
              const accent = TIER_ACCENT[tier] || C.gold;
              return (
                <Pressable
                  style={[s.pointsTile, { borderColor: accent + "40" }]}
                  onPress={() => navigation.navigate("WingmanPoints")}
                >
                  <LinearGradient colors={[accent + "18", "transparent"]} style={StyleSheet.absoluteFill} />
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                      <Text style={[s.pointsTileLabel, { color: accent }]}>{tier.toUpperCase()} MEMBER</Text>
                      <SerifText bold style={s.pointsTileBalance}>{(pointsData.balance || 0).toLocaleString()}</SerifText>
                      <Text style={s.pointsTileSub}>Wingman Points</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      {pointsData.next_tier && (
                        <Text style={[s.pointsTileNext, { color: accent }]}>
                          {(pointsData.points_to_next || 0).toLocaleString()} to {pointsData.next_tier}
                        </Text>
                      )}
                      <View style={s.pointsTileBar}>
                        <View style={[s.pointsTileBarFill, { width: `${pointsData.progress_pct || 0}%`, backgroundColor: accent }]} />
                      </View>
                      <Text style={{ color: C.mut, fontSize: 11, fontFamily: T.sans }}>View history  ›</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })()}

            {/* ── Points expiry alert card ────────────────────────────────── */}
            {expiringPoints && (() => {
              const daysLeft = Math.round((new Date(expiringPoints.expiration_date) - Date.now()) / 86400000);
              const urgent = daysLeft <= 14;
              return (
                <Pressable
                  style={[s.expiryCard, urgent && { borderColor: C.coral + "50", backgroundColor: C.coral + "0D" }]}
                  onPress={() => navigation.navigate("Loyalty")}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={[s.expiryTitle, urgent && { color: C.coral }]}>
                      {urgent ? "⚠️" : "⏳"} {daysLeft <= 7 ? `${daysLeft}d left` : daysLeft <= 14 ? "Expiring soon" : "Points expiring"}
                    </Text>
                    <Text style={{ color: urgent ? C.coral : C.amber, fontSize: 11, fontFamily: T.sansB }}>
                      {daysLeft} DAYS
                    </Text>
                  </View>
                  <Text style={s.expiryBody}>
                    <Text style={{ fontFamily: T.sansB }}>{Number(expiringPoints.points_balance).toLocaleString()}</Text>{" "}
                    {expiringPoints.program} points expire {daysLeft <= 1 ? "tomorrow" : `in ${daysLeft} days`}.
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                    <Text style={{ color: C.mut, fontSize: 11, fontFamily: T.sans }}>Tap to see redemption options</Text>
                    <Text style={{ color: urgent ? C.coral : C.amber, fontSize: 13 }}>›</Text>
                  </View>
                </Pressable>
              );
            })()}

            {/* ── Next Up parchment card ──────────────────────────────────── */}
            {nextFlight && (
              <>
                <Text style={g.sectionT}>NEXT UP</Text>
                <NextUpCard flight={nextFlight} navigation={navigation} />
              </>
            )}

            {/* ── Trip list or empty state ────────────────────────────────── */}
            {trips.length === 0 ? (
              <EmptyState navigation={navigation} />
            ) : (
              <>
                <Text style={g.sectionT}>YOUR TRIPS</Text>
                {trips.map(trip => (
                  <TripCard key={trip.id} trip={trip} onDelete={handleDelete} navigation={navigation} />
                ))}
                <Btn title="+ Add a trip" onPress={() => navigation.navigate("AddTrip")} style={{ marginTop: 4 }} />
                <Btn title="Import from email" kind="ghost" onPress={() => navigation.navigate("Connections")} style={{ marginTop: 8 }} />
              </>
            )}

            {/* ── Live monitoring row ─────────────────────────────────────── */}
            <Text style={g.sectionT}>LIVE MONITORING</Text>
            <Pressable style={s.monitor} onPress={() => navigation.navigate("Track")}>
              <View style={s.radarMini}>
                <View style={s.radarMiniRing} />
                <View style={s.radarMiniSweep} />
                <View style={s.radarMiniDot} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.mt}>Watching {trips.length} trip{trips.length !== 1 ? "s" : ""}</Text>
                <Text style={s.ms}>Tap for track record  ›</Text>
              </View>
              <Text style={{ color: C.mut, fontSize: 18, opacity: 0.5 }}>›</Text>
            </Pressable>

            {/* ── Simulate disruption ─────────────────────────────────────── */}
            <Text style={g.sectionT}>WHEN TRAVEL BREAKS</Text>
            <Btn title="Simulate a disruption" onPress={onSimulate} />
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

  // Header
  appH:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  logoRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  wMark:     { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: C.gold + "60", alignItems: "center", justifyContent: "center" },
  wMarkText: { color: C.gold, fontSize: 16 },
  logo:      { color: C.ink, fontSize: 12, fontFamily: T.sansB, letterSpacing: T.trackWide },
  avatar:    { width: 32, height: 32, borderRadius: 16, overflow: "hidden" },
  avatarInner: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  avatarT:   { color: C.gold, fontFamily: T.sansB, fontSize: 13 },

  // Greeting
  greetWrap: { marginBottom: 24 },
  greetH:    { color: C.ink, fontSize: 30, letterSpacing: T.trackTight, marginBottom: 4 },
  greetS:    { color: C.mut, fontSize: 14, fontFamily: T.sans, lineHeight: 20 },

  // ── Parchment Next Up card ──────────────────────────────────────────────────
  parchCard: {
    backgroundColor: C.parch,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.parch2,
    marginBottom: 4,
  },
  parchIcon:      { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: C.inkD + "30", alignItems: "center", justifyContent: "center" },
  parchLabel:     { color: C.mutD, fontSize: 10, fontFamily: T.sansB, letterSpacing: T.trackWide },
  liveDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: C.teal },
  parchCountdown: { color: C.inkD, fontSize: 13, fontFamily: T.sansB, letterSpacing: 0.3 },

  // Route
  parchRouteRow:  { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 2 },
  parchAirport:   { color: C.inkD, fontSize: 38, letterSpacing: -1 },
  parchArrowWrap: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 },
  parchArrowLine: { flex: 1, height: 0.5, backgroundColor: C.inkD + "30" },
  parchArrowIc:   { color: C.mutD, fontSize: 16, fontFamily: T.sans },

  // Meta
  parchMeta:    { color: C.mutD, fontSize: 13, fontFamily: T.sans },
  parchMetaDot: { color: C.mutD + "80", fontSize: 13 },

  // Bottom row
  parchHint:  { color: C.mutD, fontSize: 11, fontFamily: T.sans, opacity: 0.7 },
  parchArrow: { color: C.inkD, fontSize: 12, fontFamily: T.sansM, letterSpacing: 0.3 },

  // Ground Intelligence (on parchment)
  groundWrap:    { marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: C.inkD + "20" },
  groundLabel:   { color: C.mutD, fontSize: 9, fontFamily: T.sansB, letterSpacing: T.trackWide, marginBottom: 10 },
  groundRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  groundIc:      { fontSize: 12, width: 20, textAlign: "center" },
  groundStep:    { flex: 1, color: C.inkD, fontSize: 13, fontFamily: T.sansM },
  groundTime:    { color: C.mutD, fontSize: 13, fontFamily: T.sansB },
  groundVerdict: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },

  // ── Trip cards ──────────────────────────────────────────────────────────────
  tripCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
  },
  dest:      { color: C.ink, fontSize: 20, fontFamily: T.sansB, letterSpacing: -0.3 },
  when:      { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 3 },
  pillLive:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.gold + "10", borderColor: C.gold + "30", borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  pillDot:   { width: 5, height: 5, borderRadius: 3, backgroundColor: C.gold },
  pillLiveT: { color: C.gold, fontSize: 9, fontFamily: T.sansB, letterSpacing: T.trackMed },

  // Leg row
  leg:         { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: C.line },
  legIconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  legIc:       { fontSize: 13, color: C.gold, fontFamily: T.sansB },
  legT:        { color: C.ink, fontSize: 14, fontFamily: T.sansM, letterSpacing: 0.1 },
  legS:        { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 2 },
  tapHint:     { color: C.mut, fontSize: 10, fontFamily: T.sans, textAlign: "right", marginTop: 12, opacity: 0.5, letterSpacing: 0.3 },

  // ── Empty state ─────────────────────────────────────────────────────────────
  emptyWrap:      { marginBottom: 14 },
  emptyCard:      { backgroundColor: C.card, borderRadius: 20, padding: 36, alignItems: "center", borderWidth: 1, borderColor: C.line },
  emptyIcon:      { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: C.gold + "40", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyT:         { color: C.ink, fontSize: 22, letterSpacing: T.trackTight, marginBottom: 8 },
  emptyS:         { color: C.mut, fontSize: 14, fontFamily: T.sans, textAlign: "center", lineHeight: 21, marginBottom: 24 },
  emptyPrimary:   { width: "100%", backgroundColor: C.gold, borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 10 },
  emptyPrimaryT:  { color: C.inkD, fontSize: 15, fontFamily: T.sansB, letterSpacing: 0.3 },
  emptySecondary: { width: "100%", backgroundColor: "transparent", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.line },
  emptySecondaryT:{ color: C.mut, fontSize: 14, fontFamily: T.sansM },

  // ── Live monitoring row ──────────────────────────────────────────────────────
  monitor:       { flexDirection: "row", gap: 14, alignItems: "center", backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 16 },
  radarMini:     { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: C.gold + "30", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  radarMiniRing: { position: "absolute", width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: C.gold + "20" },
  radarMiniSweep:{ position: "absolute", top: 0, left: 17, width: 1.5, height: 18, backgroundColor: C.gold, opacity: 0.7 },
  radarMiniDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: C.gold, position: "absolute", top: 10, left: 20 },
  mt:            { color: C.ink, fontSize: 14, fontFamily: T.sansM, letterSpacing: 0.1 },
  ms:            { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 2 },
  hint:          { color: C.mut, fontSize: 12, fontFamily: T.sans, textAlign: "center", marginTop: 12, lineHeight: 18 },

  // ── Day-of-flight briefing card ─────────────────────────────────────────────
  briefingCard:   { backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.gold + "40", marginBottom: 4 },
  briefingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  briefingFlight: { color: C.ink, fontSize: 15, fontFamily: T.sansB, letterSpacing: 0.3, flex: 1 },
  briefingRow:    { flexDirection: "row", gap: 16, marginBottom: 12 },
  briefingItem:   { alignItems: "center" },
  briefingLabel:  { color: C.mut, fontSize: 9, fontFamily: T.sansB, letterSpacing: T.trackWide, marginBottom: 3 },
  briefingValue:  { color: C.ink, fontSize: 16, fontFamily: T.sansB },
  briefingAlert:  { backgroundColor: C.amber + "15", borderColor: C.amber + "40", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  briefingAlertT: { color: C.amber, fontSize: 13, fontFamily: T.sansM },
  briefingCTA:    { borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 12, marginTop: 4 },
  briefingCTAT:   { color: C.gold, fontSize: 13, fontFamily: T.sansM, letterSpacing: 0.2 },
  briefingGroundBtn:  { borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 12, marginTop: 4 },
  briefingGroundBtnT: { color: "#4ECDC4", fontSize: 13, fontFamily: T.sansM, letterSpacing: 0.2 },

  // ── Points expiry card ───────────────────────────────────────────────────────
  expiryCard:     { backgroundColor: C.amber + "10", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.amber + "30", marginBottom: 12 },
  expiryTitle:    { color: C.amber, fontSize: 13, fontFamily: T.sansB, marginBottom: 4 },
  expiryBody:     { color: C.ink, fontSize: 13, fontFamily: T.sans, lineHeight: 19 },
  // ── Day-one empty state — tracker + gmail ────────────────────────────────────
  trackerCard:    { backgroundColor: C.card, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: C.line, marginBottom: 12, overflow: "hidden" },
  trackerTitle:   { color: C.ink, fontSize: 16, fontFamily: T.sansB },
  trackerSub:     { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 19, marginBottom: 14 },
  trackerRow:     { flexDirection: "row", gap: 8, alignItems: "center" },
  trackerInput:   { flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.line, color: C.ink, fontSize: 15, fontFamily: T.sans },
  trackerBtn:     { backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  trackerBtnT:    { color: C.bg, fontSize: 14, fontFamily: T.sansB },
  trackerErr:     { color: C.coral, fontSize: 12, fontFamily: T.sansM, marginTop: 8 },
  trackedResult:  { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  trackedIdent:   { color: C.ink, fontSize: 16, fontFamily: T.sansB },
  gmailCard:      { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.line, marginBottom: 12, overflow: "hidden" },
  gmailTitle:     { color: C.ink, fontSize: 14, fontFamily: T.sansB, marginBottom: 2 },
  gmailSub:       { color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 17 },
  // ── Next trip window card ────────────────────────────────────────────────────
  windowCard:     { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.gold + "30", marginBottom: 12 },
  pointsTile:     { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  pointsTileLabel:{ fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.2, marginBottom: 4 },
  pointsTileBalance: { fontSize: 28, color: C.ink },
  pointsTileSub:  { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2 },
  pointsTileNext: { fontSize: 11, fontFamily: T.sansM },
  pointsTileBar:  { width: 100, height: 3, backgroundColor: C.line, borderRadius: 2, overflow: "hidden" },
  pointsTileBarFill: { height: 3, borderRadius: 2 },
  windowTitle:    { color: C.ink, fontSize: 14, fontFamily: T.sansB },
  windowBody:     { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 19 },
});
