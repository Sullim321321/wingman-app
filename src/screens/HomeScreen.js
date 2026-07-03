// HomeScreen — Quiet Luxury / Editorial
// Obsidian v3 — exact match to pre-seed deck visual language
// Playfair Display serif greeting + DM Sans body

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Animated, Easing, TextInput, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { C, T, TS } from "../theme";
import { Btn, tap, SerifText, g, OfflineBanner } from "../components";
import { getCachedTrips, getCachedPoints } from "../offlineCache";
import { getTrips, deleteTrip, getFlightStatus, getFlightStatusPublic, getPrediction, getGroundIntel, getMe, getLoyaltyAccounts, getTripBriefing, getNextTripWindow, getPoints, getWeather, getHomeState, getDisruptionAlternatives, simulateJourney, renameUnknownTrips } from "../api";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { scheduleDisruption, schedulePreDepartureBriefing, schedulePostTripDebrief } from "../notify";
import { getEtching } from "../etchings";

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
              <Text style={{ fontSize: 13, color: C.inkD, fontFamily: T.sansB }}>✈</Text>
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

        {/* Destination etching illustration — absolute right side of card */}
        {getEtching(flight.destination) && (
          <Image
            source={getEtching(flight.destination)}
            style={s.parchEtching}
            resizeMode="cover"
          />
        )}

        {/* Route: 'JFK to LAX' — exact deck serif format */}
        <View style={s.parchRouteRow}>
          <SerifText bold style={s.parchAirport}>{flight.origin || "—"}</SerifText>
          <Text style={s.parchTo}>{" to "}</Text>
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

        {/* View Details link — exact deck copy */}
        <View style={[g.rowBetween, { marginTop: 16 }]}>
          {risk != null && risk >= 30 ? (
            <Text style={s.parchRisk}>
              {risk >= 60 ? "⚠️ High delay risk" : `⚠️ Moderate delay risk`}
            </Text>
          ) : (
            <Text style={s.parchHint}>{flightLabel || ""}</Text>
          )}
          <Text style={s.parchArrow}>View Details  →</Text>
        </View>
        {/* Quick action chips */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Pressable
            style={s.parchChip}
            onPress={() => navigation.navigate("Concierge", {
              prefill: `What do I need to know for my ${flightLabel || 'upcoming'} flight?`
            })}
          >
            <Text style={s.parchChipT}>✦ Ask Wingman</Text>
          </Pressable>
          {flight.origin && (
            <Pressable
              style={s.parchChip}
              onPress={() => navigation.navigate("AirportNavigation", {
                iata: flight.origin,
                gate: flight.gate || null,
                flightInfo: flightLabel || null,
              })}
            >
              <Text style={s.parchChipT}>🛋 Lounges</Text>
            </Pressable>
          )}
          {flight.destination && (
            <Pressable
              style={s.parchChip}
              onPress={() => navigation.navigate("GroundTransport", {
                iata: flight.destination,
                city: flight.destination,
              })}
            >
              <Text style={s.parchChipT}>🚆 Ground transport</Text>
            </Pressable>
          )}
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
        <Text style={s.legIc}>✈</Text>
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
  // Countdown pill — show days away for upcoming trips
  const cdPill = firstFlight?.departs_at ? (() => {
    const diff = new Date(firstFlight.departs_at).getTime() - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "TODAY";
    if (days === 1) return "TOMORROW";
    if (days <= 30) return `${days}D`;
    return null;
  })() : null;

  useEffect(() => {
    if (!firstFlight?.origin || !firstFlight?.destination) return;
    const dep = firstFlight.departs_at ? new Date(firstFlight.departs_at).getTime() : 0;
    if (dep < Date.now()) return;
    getPrediction({ dep: firstFlight.origin, arr: firstFlight.destination })
      .then(p => setRisk(p?.risk ?? null))
      .catch(() => {});
  }, [firstFlight?.origin, firstFlight?.destination]);

  // Build date range from trip_start/trip_end (API-provided), fallback to leg scanning
  const startTs = trip.trip_start || firstFlight?.departs_at || legs[0]?.departs_at;
  const endTs   = trip.trip_end   || legs.reduce((latest, l) => {
    const t = l.arrives_at || l.departs_at;
    return t && (!latest || new Date(t) > new Date(latest)) ? t : latest;
  }, null);
  const depDateFmt = startTs
    ? new Date(startTs).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()
    : null;
  const arrDateFmt = endTs && endTs !== startTs
    ? new Date(endTs).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()
    : null;
  const dateRange = depDateFmt && arrDateFmt ? `${depDateFmt} – ${arrDateFmt}` : depDateFmt;

  // Subtitle: hotel name > Airbnb name > destination city > first flight destination
  const hotelLeg  = legs.find(l => l.type === "hotel" || l.type === "airbnb");
  const hotelName = hotelLeg?.carrier || hotelLeg?.destination_city || hotelLeg?.destination || null;
  const destCity  = legs.find(l => l.destination_city)?.destination_city || null;

  // Derive a smart display title — prefer the stored trip title (now destination-named)
  const derivedTitle = trip.title || destCity ||
    (firstFlight?.origin && firstFlight?.destination ? `${firstFlight.origin} → ${firstFlight.destination}` : "Trip");

  // Destination etching thumbnail — use etching system matching parchment card
  const etchingKey = destCity || firstFlight?.destination || "";
  const destIcons = { "Bali": "🌴", "Swiss": "⛰️", "Kyoto": "🜯", "Tokyo": "🜯", "Paris": "🗻", "London": "🏰", "New York": "🏙️", "NYC": "🏙️", "Edinburgh": "🏰", "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Rome": "🇯", "Barcelona": "🇪🇸", "Amsterdam": "🇳🇱" };
  const iconKey = Object.keys(destIcons).find(k => etchingKey.includes(k) || derivedTitle.includes(k));
  const thumbIcon = iconKey ? destIcons[iconKey] : "✈️";

  return (
    <Pressable
      onPress={() => { tap(); navigation.navigate("TripDetail", { trip }); }}
      onLongPress={() => Alert.alert("Delete trip?", trip.title, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete(trip.id) }
      ])}
      style={{ marginBottom: 10 }}
    >
      <View style={s.tripCard}>
        {/* Thumbnail — destination etching (matches parchment card system) */}
        <View style={s.tripThumb}>
          {getEtching(firstFlight?.destination) ? (
            <Image
              source={getEtching(firstFlight?.destination)}
              style={{ width: 56, height: 56, borderRadius: 8, opacity: 0.85 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={s.tripThumbT}>{thumbIcon}</Text>
          )}
        </View>
        {/* Info block */}
        <View style={s.tripInfo}>
          {dateRange && <Text style={s.tripDateRange}>{dateRange}</Text>}
          <Text style={s.dest}>{derivedTitle}</Text>
          {/* Show hotel/Airbnb name, or destination city, or first flight destination */}
          {(hotelName || destCity || firstFlight?.destination) && (
            <Text style={s.when}>{hotelName || destCity || firstFlight.destination}</Text>
          )}
        </View>
        {/* Right: countdown pill + risk badge + chevron */}
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          {cdPill && (
            <View style={{ backgroundColor: C.gold + "18", borderColor: C.gold + "40", borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
              <Text style={{ color: C.gold, fontSize: 10, fontFamily: T.sansB, letterSpacing: T.trackMed }}>{cdPill}</Text>
            </View>
          )}
          {risk != null && risk >= 30 && <RiskBadge risk={risk} />}
          <Text style={{ color: C.mut, fontSize: 18, lineHeight: 22 }}>›</Text>
        </View>
      </View>
      {/* Quick action chips below card */}
      {firstFlight && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6, marginBottom: 4, paddingHorizontal: 2 }}>
          <Pressable
            style={s.tcChip}
            onPress={() => { tap(); navigation.navigate("Concierge", {
              tripId: trip.id,
              prefill: `What should I know about my ${trip.title || firstFlight.origin + ' to ' + firstFlight.destination} trip?`
            }); }}
          >
            <Text style={s.tcChipT}>✦ Ask Wingman</Text>
          </Pressable>
          {firstFlight.destination && (
            <Pressable
              style={s.tcChip}
              onPress={() => { tap(); navigation.navigate("GroundTransport", {
                iata: firstFlight.destination,
                city: firstFlight.destination,
                tripId: trip.id,
              }); }}
            >
              <Text style={s.tcChipT}>🚆 Transport</Text>
            </Pressable>
          )}
          {firstFlight.origin && (
            <Pressable
              style={s.tcChip}
              onPress={() => { tap(); navigation.navigate("AirportNavigation", {
                iata: firstFlight.origin,
                gate: null,
                flightInfo: firstFlight.carrier && firstFlight.flight_number ? `${firstFlight.carrier}${firstFlight.flight_number}` : null,
              }); }}
            >
              <Text style={s.tcChipT}>🛋 Lounge</Text>
            </Pressable>
          )}
        </View>
      )}
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
          <View style={s.emptyIcon}><Text style={{ fontSize: 16, color: C.gold, fontFamily: T.sans }}>✈</Text></View>
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

      {/* Quick-try: pre-fill a real flight so testers see live data immediately */}
      {!tracked && (
        <Pressable
          style={s.demoBtn}
          onPress={() => { tap(); setFlightNum("UA412"); }}
        >
          <Text style={s.demoBtnT}>Try a live example: UA412 →</Text>
        </Pressable>
      )}

      {/* Gmail import CTA */}
      <Pressable style={s.gmailCard} onPress={() => navigation.navigate("Connections")}>
        <LinearGradient colors={[C.gold + "0A", "transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, borderRadius: 18 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[s.emptyIcon, { width: 40, height: 40, borderRadius: 12 }]}>
            <Text style={{ fontSize: 16, color: C.gold, fontFamily: T.sans }}>@</Text>
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
  const [weather, setWeather]               = useState(null);
  const [homeState, setHomeState]           = useState(null);  // contextual travel state
  const [journeyData, setJourneyData]       = useState(null);  // journey simulation result
  const [disruptionData, setDisruptionData] = useState(null);  // disruption alternatives
  const [devMode, setDevMode]               = useState(__DEV__); // hidden 5-tap unlock
  const devTapCount = useRef(0);

  useEffect(() => {
    // Fetch geolocated weather if user has opted in
    (async () => {
      try {
        const optIn = await AsyncStorage.getItem("wingman_location_opt_in");
        if (optIn !== "true") return;
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const w = await getWeather(loc.coords.latitude, loc.coords.longitude);
        if (w?.ok) setWeather(w);
      } catch {}
    })();
    // Fetch contextual home state (location-aware)
    (async () => {
      try {
        const optIn = await AsyncStorage.getItem("wingman_location_opt_in");
        let lat = null, lng = null;
        if (optIn === "true") {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            lat = loc.coords.latitude;
            lng = loc.coords.longitude;
          }
        }
        const hs = await getHomeState(lat, lng);
        if (hs?.ok) {
          setHomeState(hs);
          // If at airport or pre-departure within 3h, fetch journey simulation
          if ((hs.state === "at_airport" || hs.state === "pre_departure") &&
              hs.active_leg?.id && hs.active_leg?.trip_id &&
              (hs.hours_to_depart == null || hs.hours_to_depart <= 3)) {
            try {
              const jd = await simulateJourney(hs.active_leg.trip_id, hs.active_leg.id, lat, lng);
              if (jd?.ok) setJourneyData(jd);
            } catch {}
          }
        }
      } catch {}
    })();
    getMe().then(u => { if (u?.first_name) setFirstName(u.first_name); }).catch(() => {});
    // Silently rename any Unknown Trip records using existing leg data
    renameUnknownTrips().catch(() => {});
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

  const [offlineInfo, setOfflineInfo] = useState({ cached: false, stale: false, cachedAt: null });
  const load = useCallback(async () => {
    try {
      const result = await getCachedTrips(() => getTrips());
      setOfflineInfo({ cached: result.cached, stale: result.stale, cachedAt: result.cachedAt });
      const data = result.data;
      const fetchedTrips = data.trips || [];
      setTrips(fetchedTrips);
      // Fetch briefing for any flight departing within 7 days (not just today)
      const now7d = Date.now() + 7 * 86400000;
      const upcomingTrip = fetchedTrips.find(trip =>
        (trip.legs || []).some(l => {
          if (l.type !== 'flight' || !l.departs_at) return false;
          const t = new Date(l.departs_at).getTime();
          return t > Date.now() && t <= now7d;
        })
      );
      if (upcomingTrip) {
        // Build a local fallback briefing from trip leg data so the card always shows
        const upcomingLeg = (upcomingTrip.legs || []).find(l => {
          if (l.type !== 'flight' || !l.departs_at) return false;
          const t = new Date(l.departs_at).getTime();
          return t > Date.now() && t <= now7d;
        });
        if (upcomingLeg) {
          setBriefing({
            tripId:      upcomingTrip.id,
            flight: {
              carrier:       upcomingLeg.carrier || "",
              flight_number: upcomingLeg.flight_number || "",
              origin:        upcomingLeg.origin || "",
              destination:   upcomingLeg.destination || "",
              departs_at:    upcomingLeg.departs_at,
            },
            live_status: null,
            tsa_wait:    null,
          });
        }
        // Try to enrich with live backend data
        try {
          const b = await getTripBriefing(upcomingTrip.id);
          if (b && b.flight) setBriefing({ ...b, tripId: upcomingTrip.id });
        } catch { /* briefing enrichment is best-effort */ }
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
        <OfflineBanner cached={offlineInfo.cached} stale={offlineInfo.stale} cachedAt={offlineInfo.cachedAt} style={{ marginTop: 8 }} />
        {/* ── Header — exact deck layout: W left, WINGMAN centered, avatar right */}
        <View style={s.appH}>
          {/* W monogram */}
          <View style={s.wMark}>
            <SerifText bold style={s.wMarkText}>W</SerifText>
          </View>
          {/* WINGMAN wordmark — absolutely centered */}
          <Text style={s.logo}>WINGMAN</Text>
          {/* Avatar / settings — with live-monitoring dot when active */}
          <Pressable style={s.avatar} onPress={() => { tap(); navigation.navigate("Settings"); }}>
            <View style={s.avatarInner}>
              <Text style={s.avatarT}>{firstName ? firstName[0].toUpperCase() : "W"}</Text>
            </View>
            {homeState?.state && homeState.state !== "no_trip" && (
              <View style={s.avatarDot} />
            )}
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* ── Intelligence Briefing — Charlie's Angels opening ──────── */}
            {(() => {
              const hs = homeState;
              const leg = hs?.active_leg;
              const trip = hs?.active_trip;
              const hotel = hs?.hotel;
              const w = hs?.weather || weather;
              const weatherCity = w?.city || trip?.destination_city || null;
              const weatherStr = w ? `${w.temp}°${weatherCity ? ` in ${weatherCity}` : ""}` : null;
              const hoursAway = hs?.hours_to_depart;

              // Build the headline brief line
              let briefLine = null;
              if (hs?.state === "in_transit" && leg) {
                const landMins = leg.arrives_at ? Math.round((new Date(leg.arrives_at).getTime() - Date.now()) / 60000) : null;
                briefLine = landMins && landMins > 0
                  ? `${leg.ident || "Your flight"} is airborne. Landing in ${landMins >= 60 ? `${Math.floor(landMins/60)}h ${landMins%60}m` : `${landMins}m`}.`
                  : `${leg.ident || "Your flight"} is in the air.`;
              } else if (hs?.state === "at_airport" && leg) {
                briefLine = `You're at ${leg.origin}. ${leg.gate ? `Gate ${leg.gate}. ` : ""}${hoursAway != null ? `${Math.round(hoursAway * 60)}m to departure.` : ""}`;
              } else if (hs?.state === "at_destination" && trip) {
                briefLine = `You're in ${trip.destination_city || leg?.destination || "your destination"}.${weatherStr ? ` ${weatherStr}.` : ""}`;
              } else if (hs?.state === "pre_departure" && leg) {
                const dStr = hoursAway != null
                  ? (hoursAway >= 48 ? `in ${Math.round(hoursAway / 24)} days` : hoursAway >= 1 ? `in ${Math.round(hoursAway)}h` : `in ${Math.round(hoursAway * 60)}m`)
                  : null;
                briefLine = `Next up: ${leg.origin} → ${leg.destination}${dStr ? ` ${dStr}` : ""}.`;
              } else if (nextFlight) {
                briefLine = `Next flight: ${nextFlight.origin} → ${nextFlight.destination}.`;
              }

              // Build the sub-line context
              const subParts = [];
              if (hs?.state === "at_destination" && hotel) {
                const checkinTime = hotel.checkin_at ? new Date(hotel.checkin_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
                subParts.push(`${hotel.name}${checkinTime ? ` · check-in ${checkinTime}` : ""}`);
              } else if (hs?.state === "in_transit" && leg?.destination) {
                subParts.push(`Arriving ${leg.destination}`);
                if (hotel) subParts.push(`${hotel.name} tonight`);
              } else if ((hs?.state === "pre_departure" || hs?.state === "at_airport") && weatherStr) {
                subParts.push(weatherStr);
              } else if (weatherStr) {
                subParts.push(weatherStr);
              }
              if (!briefLine && !subParts.length) {
                subParts.push("Nothing on the radar.");
              }
              // If no homeState but there's a next flight, add a contextual sub-line
              if (!hs?.state && nextFlight?.departs_at) {
                const daysAway = Math.ceil((new Date(nextFlight.departs_at).getTime() - Date.now()) / 86400000);
                if (daysAway > 0 && daysAway <= 14) {
                  const label = daysAway === 1 ? "tomorrow" : `in ${daysAway} days`;
                  subParts.length = 0; // replace generic sub-line
                  subParts.push(`${nextFlight.origin} → ${nextFlight.destination} ${label}`);
                }
              }

              return (
                <View style={s.greetWrap}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <SerifText style={[s.greetH, { flex: 1, marginRight: 8 }]}>
                      {greeting()}{firstName ? `, ${firstName}.` : "."}
                    </SerifText>
                    {/* Weather chip — only when no location context in brief */}
                    {weatherStr && hs?.state !== "at_destination" && hs?.state !== "in_transit" && (
                      <View style={s.weatherChip}>
                        <Text style={s.weatherTemp}>{w.temp}°</Text>
                        {weatherCity && <Text style={s.weatherDesc}>{weatherCity}</Text>}
                      </View>
                    )}
                  </View>
                  {briefLine ? (
                    <Text style={s.greetS}>{briefLine}</Text>
                  ) : (
                    <Text style={s.greetS}>You're clear. Nothing on the radar.</Text>
                  )}
                  {subParts.length > 0 && (
                    <Text style={[s.greetS, { marginTop: 4, color: C.gold, opacity: 0.8 }]}>
                      {subParts.join("  ·  ")}
                    </Text>
                  )}
                </View>
              );
            })()}

            {/* ── Contextual Travel State Card ──────────────────────────────── */}
            {homeState && homeState.state !== "no_trip" && homeState.active_leg && (() => {
              const hs = homeState;
              const leg = hs.active_leg;
              const trip = hs.active_trip;
              const isDisrupted = leg.status === "Cancelled" || (leg.delay_minutes || 0) >= 45;
              const isAtRisk = journeyData?.at_risk;
              const stateColors = {
                at_airport:    { border: C.gold + "60",  bg: C.gold + "0A",  label: "AT THE AIRPORT" },
                pre_departure: { border: C.line,          bg: "transparent",  label: "UPCOMING FLIGHT" },
                in_transit:    { border: "#5B8CFF" + "60", bg: "#5B8CFF0A",  label: "IN THE AIR" },
                at_destination:{ border: C.teal + "60",  bg: C.teal + "0A",  label: "AT DESTINATION" },
              };
              const sc = stateColors[hs.state] || stateColors.pre_departure;
              const urgentBorder = isDisrupted ? C.coral + "60" : isAtRisk ? C.amber + "60" : sc.border;
              const urgentBg     = isDisrupted ? C.coral + "0A" : isAtRisk ? C.amber + "0A" : sc.bg;
              return (
                <Pressable
                  style={[s.stateCard, { borderColor: urgentBorder, backgroundColor: urgentBg }]}
                  onPress={() => navigation.navigate("TripDetail", { tripId: leg.trip_id })}
                >
                  {/* State label */}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <Text style={[s.stateLabel, { color: isDisrupted ? C.coral : isAtRisk ? C.amber : C.gold }]}>
                      {isDisrupted ? "⚠  DISRUPTION" : isAtRisk ? "⏱  TIGHT TIMING" : sc.label}
                    </Text>
                    {leg.status ? <StatusBadge status={leg.status} /> : null}
                  </View>
                  {/* Route */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <SerifText bold style={{ color: C.ink, fontSize: 24 }}>{leg.origin}</SerifText>
                    <Text style={{ color: C.mut, fontSize: 14 }}>→</Text>
                    <SerifText bold style={{ color: C.ink, fontSize: 24 }}>{leg.destination}</SerifText>
                    {leg.ident ? <Text style={{ color: C.mut, fontSize: 12, fontFamily: T.sans, marginLeft: 4 }}>{leg.ident}</Text> : null}
                  </View>
                  {/* Flight meta row */}
                  <View style={{ flexDirection: "row", gap: 16, marginBottom: 10 }}>
                    {leg.departs_at && (
                      <View>
                        <Text style={s.stateMeta}>DEPARTS</Text>
                        <Text style={s.stateValue}>{new Date(leg.departs_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Text>
                      </View>
                    )}
                    {leg.gate && (
                      <View>
                        <Text style={s.stateMeta}>GATE</Text>
                        <Text style={s.stateValue}>{leg.gate}</Text>
                      </View>
                    )}
                    {leg.terminal && (
                      <View>
                        <Text style={s.stateMeta}>TERMINAL</Text>
                        <Text style={s.stateValue}>{leg.terminal}</Text>
                      </View>
                    )}
                    {(leg.delay_minutes || 0) > 0 && (
                      <View>
                        <Text style={[s.stateMeta, { color: C.amber }]}>DELAY</Text>
                        <Text style={[s.stateValue, { color: C.amber }]}>+{leg.delay_minutes}m</Text>
                      </View>
                    )}
                  </View>
                  {/* Journey buffer bar (if journeyData loaded) */}
                  {journeyData && journeyData.buffer_minutes != null && (
                    <View style={[s.bufferBar, { borderColor: journeyData.at_risk ? C.amber + "40" : C.teal + "30" }]}>
                      <Text style={[s.bufferVerdict, { color: journeyData.at_risk ? C.amber : C.teal }]}>
                        {journeyData.verdict === "will_miss" ? "⚠  You may miss this flight"
                          : journeyData.verdict === "tight"    ? `⏱  Tight — ${journeyData.buffer_minutes}m buffer`
                          : journeyData.verdict === "on_track" ? `✓  On track — ${journeyData.buffer_minutes}m to spare`
                          : `✓  Plenty of time — ${journeyData.buffer_minutes}m buffer`}
                      </Text>
                      {journeyData.traffic_eta && (
                        <Text style={s.bufferSub}>
                          Drive: {journeyData.traffic_eta.duration_mins}m  ·  Security: ~{journeyData.security_mins}m  ·  Gate: {journeyData.gate_walk_mins}m
                        </Text>
                      )}
                    </View>
                  )}
                  {/* Journey timing button — at_airport or pre_departure */}
                  {!isDisrupted && (hs.state === "at_airport" || hs.state === "pre_departure") && leg.trip_id && (
                    <Pressable
                      style={s.journeyTimingBtn}
                      onPress={() => navigation.navigate("JourneySimulator", { tripId: leg.trip_id, legId: leg.id, flightIdent: leg.ident })}
                    >
                      <Text style={s.journeyTimingBtnT}>⏱  Check journey timing  →</Text>
                    </Pressable>
                  )}
                  {/* Disruption alternatives CTA */}
                  {isDisrupted && (
                    <Pressable
                      style={s.disruptionCTA}
                      onPress={() => navigation.navigate("Disruption", { tripId: leg.trip_id, legId: leg.id, ident: leg.ident })}
                    >
                      <Text style={s.disruptionCTAT}>See options & your rights  →</Text>
                    </Pressable>
                  )}
                  {/* Suggestion chips */}
                  {(hs.suggestions || []).length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {hs.suggestions.map((sug, i) => (
                          <Pressable
                            key={i}
                            style={s.sugChip}
                            onPress={() => {
                              tap();
                              if (sug.route === "Concierge") navigation.navigate("Concierge", { prefill: sug.prefill });
                              else if (sug.params) navigation.navigate(sug.route, sug.params);
                              else navigation.navigate(sug.route);
                            }}
                          >
                            <Text style={s.sugChipT}>{sug.icon}  {sug.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  )}
                </Pressable>
              );
            })()}
            {/* ── Contextual quick-action chips (no active trip) ──────── */}
            {(!homeState?.state || homeState?.state === "no_trip") && trips.length === 0 && (
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {[
                  { label: "Add a trip",        icon: "+", route: "AddTrip",      params: undefined },
                  { label: "Import from email", icon: "@", route: "Connections",  params: undefined },
                  { label: "Travel profile",    icon: "✈", route: "TravelProfile",params: undefined },
                ].map(a => (
                  <Pressable
                    key={a.label}
                    style={s.qaChip}
                    onPress={() => { tap(); navigation.navigate(a.route, a.params); }}
                  >
                    <Text style={s.qaChipIcon}>{a.icon}</Text>
                    <Text style={s.qaChipT}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* ── Day-of-flight mission briefing ────────────────────────── */}
            {briefing && briefing.flight && (() => {
              const daysUntil = briefing.flight.departs_at
                ? Math.ceil((new Date(briefing.flight.departs_at).getTime() - Date.now()) / 86400000)
                : 0;
              const briefingTitle = daysUntil <= 0 ? "TODAY'S BRIEFING"
                : daysUntil === 1 ? "TOMORROW'S BRIEFING"
                : `FLIGHT BRIEFING · ${daysUntil} DAYS`;
              return (
              <>
                <Text style={g.sectionT}>{briefingTitle}</Text>
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
                        prefill: `What do I need to know for my ${briefing.flight.carrier}${briefing.flight.flight_number} flight${daysUntil <= 0 ? ' today' : daysUntil === 1 ? ' tomorrow' : ` in ${daysUntil} days`}?`,
                        tripId: briefing.tripId,
                      })}
                    >
                      <Text style={s.briefingCTAT}>Ask Wingman →</Text>
                    </Pressable>
                    {briefing.flight.origin && (
                      <Pressable
                        style={s.briefingGroundBtn}
                        onPress={() => navigation.navigate("AirportNavigation", {
                          iata: briefing.flight.origin,
                          gate: briefing.live_status?.gate || null,
                          flightInfo: `${briefing.flight.carrier}${briefing.flight.flight_number}`,
                        })}
                      >
                        <Text style={s.briefingGroundBtnT}>Lounges & gates</Text>
                      </Pressable>
                    )}
                    {briefing.flight.destination && (
                      <Pressable
                        style={s.briefingGroundBtn}
                        onPress={() => navigation.navigate("GroundTransport", {
                          iata: briefing.flight.destination,
                          city: briefing.flight.destination,
                        })}
                      >
                        <Text style={s.briefingGroundBtnT}>Ground transport</Text>
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              </>
              );
            })()}

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

            {/* ── Next booking window alert ───────────────────────────────── */}
            {nextTripWindow && (() => {
              const { days_until, destination, window_type } = nextTripWindow;
              const label = window_type === "holiday" ? "Holiday window" : window_type === "event" ? "Event window" : "Booking window";
              return (
                <Pressable
                  style={[s.expiryCard, { borderColor: C.teal + "40", backgroundColor: C.teal + "0A" }]}
                  onPress={() => navigation.navigate("Concierge", { prefill: `Help me plan a trip to ${destination || "my next destination"} — I have ${days_until} days to book.` })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={[s.expiryTitle, { color: C.teal }]}>✦ {label}</Text>
                    <Text style={{ color: C.teal, fontSize: 11, fontFamily: T.sansB }}>{days_until}D AWAY</Text>
                  </View>
                  <Text style={s.expiryBody}>
                    {destination ? `${destination} — ` : ""}Book now for the best fares before this window closes.
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                    <Text style={{ color: C.mut, fontSize: 11, fontFamily: T.sans }}>Ask Wingman to help plan</Text>
                    <Text style={{ color: C.teal, fontSize: 13 }}>›</Text>
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
            {(() => {
              const GENERIC_TITLE = /^(Unknown Trip|Unknown|Trip|Imported Trip)$/i;
              const CARRIER_ONLY = /^(United Airlines|Delta Air Lines|American Airlines|British Airways|Lufthansa|Air France|Emirates|Qantas|Southwest Airlines|JetBlue|Alaska Airlines|Spirit Airlines|Frontier Airlines|Ryanair|easyJet|Wizz Air|Turkish Airlines|Singapore Airlines|Cathay Pacific|Air Canada|KLM|Iberia|Virgin Atlantic|Air New Zealand|Etihad Airways|Southwest|JetBlue Airways|Alaska) (Flight|Booking|Confirmation|Reservation)$/i;
              const visibleTrips = trips.filter(t => {
                if (!t.title || GENERIC_TITLE.test(t.title.trim())) return false;
                if (CARRIER_ONLY.test(t.title.trim())) return false;
                if ((t.legs || []).length === 0) return false;
                return true;
              });
              if (visibleTrips.length === 0) return <EmptyState navigation={navigation} />;
              return (
                <>
                  <Text style={g.sectionT}>YOUR TRIPS</Text>
                  {visibleTrips.map(trip => (
                    <TripCard key={trip.id} trip={trip} onDelete={handleDelete} navigation={navigation} />
                  ))}
                  <Btn title="+ Add a trip" onPress={() => navigation.navigate("AddTrip")} style={{ marginTop: 4 }} />
                  <Btn title="Import from email" kind="ghost" onPress={() => navigation.navigate("Connections")} style={{ marginTop: 8 }} />
                </>
              );
            })()}

            {/* ── Live monitoring row ─────────────────────────────────────── */}
            <Text
              style={g.sectionT}
              onPress={() => {
                devTapCount.current += 1;
                if (devTapCount.current >= 5) {
                  devTapCount.current = 0;
                  setDevMode(v => !v);
                }
              }}
            >LIVE MONITORING</Text>
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

            {/* ── Simulate disruption — hidden behind 5-tap on LIVE MONITORING ── */}
            {devMode && (
              <>
                <Text style={g.sectionT}>TEST NOTIFICATIONS</Text>
                <Btn
                  title="Simulate a disruption"
                  onPress={onSimulate}
                  style={{ marginBottom: 10 }}
                />
                <Btn
                  title="Simulate pre-departure briefing"
                  kind="ghost"
                  onPress={async () => {
                    await schedulePreDepartureBriefing(nextFlight, nextFlight?.tripId || null);
                  }}
                  style={{ marginBottom: 10 }}
                />
                <Btn
                  title="Simulate post-trip debrief"
                  kind="ghost"
                  onPress={async () => {
                    const t = trips[trips.length - 1];
                    await schedulePostTripDebrief(t?.title || "your trip", t?.id || null);
                  }}
                  style={{ marginBottom: 4 }}
                />
                <Text style={s.hint}>Schedules push notifications — tap to see each flow.</Text>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  // Header — exact deck layout: W left, WINGMAN centered, avatar right
  appH:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  wMark:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  wMarkText: { color: C.gold, fontSize: 32, fontFamily: T.serifI },  // Italic serif W — exact deck monogram
  logo:      { position: "absolute", left: 0, right: 0, textAlign: "center", color: C.gold, fontSize: TS.headerBrand, fontFamily: T.sansB, letterSpacing: T.trackXWide },
  avatar:    { width: 34, height: 34, borderRadius: 17, overflow: "visible" },
  avatarInner: { width: 34, height: 34, borderRadius: 17, backgroundColor: "transparent", borderWidth: 1.5, borderColor: C.ink + "80", alignItems: "center", justifyContent: "center" },
  avatarT:   { color: C.ink, fontFamily: T.sansB, fontSize: 13 },
  avatarDot:  { position: "absolute", top: 0, right: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: C.teal, borderWidth: 1.5, borderColor: C.bg },

  // Greeting — exact deck scale
  greetWrap: { marginBottom: 28 },
  greetH:    { color: C.ink, fontSize: TS.greetingH, letterSpacing: T.trackTight, marginBottom: 6 },
  greetS:    { color: C.mut, fontSize: TS.greetingSub, fontFamily: T.sans, lineHeight: 22 },

  // ── Parchment Next Up card — exact deck spec ───────────────────────────────
  parchCard: {
    backgroundColor: C.parch,
    borderRadius: 16,
    padding: 20,
    borderWidth: 0,
    marginBottom: 4,
  },
  parchIcon:      { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.inkD + "25", alignItems: "center", justifyContent: "center" },
  parchLabel:     { color: C.mutD, fontSize: TS.sectionLabel, fontFamily: T.sansB, letterSpacing: T.trackWide },
  liveDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: C.teal },
  parchCountdown: { color: C.inkD, fontSize: 13, fontFamily: T.sansB, letterSpacing: 0.3 },

  // Route — deck format: 'JFK to LAX' in serif (not arrow)
  parchRouteRow:  { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 4, flexWrap: "wrap", gap: 6 },
  parchAirport:   { color: C.inkD, fontSize: TS.nextUpTitle, fontFamily: T.serifB, letterSpacing: T.trackTight },
  parchTo:        { color: C.mutD, fontSize: TS.nextUpTitle - 4, fontFamily: T.serifI, letterSpacing: 0 },  // lowercase 'to' in italic serif
  parchArrowWrap: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 4 },
  parchArrowLine: { flex: 1, height: 0.5, backgroundColor: C.inkD + "25" },
  parchArrowIc:   { color: C.mutD, fontSize: 14, fontFamily: T.sans },
  // Etching illustration placeholder (right side of parchment card)
  parchEtching:   { position: "absolute", right: 0, top: 0, bottom: 0, width: 120, opacity: 0.28, borderRadius: 16, overflow: "hidden" },

  // Meta
  parchMeta:    { color: C.mutD, fontSize: TS.nextUpSub, fontFamily: T.sans },
  parchMetaDot: { color: C.mutD + "80", fontSize: TS.nextUpSub },

  // Bottom row
  parchHint:  { color: C.mutD, fontSize: TS.nextUpMeta, fontFamily: T.sans, opacity: 0.7 },
  parchRisk:  { color: C.amber, fontSize: TS.nextUpMeta, fontFamily: T.sansM },
  parchArrow: { color: C.inkD, fontSize: TS.nextUpMeta, fontFamily: T.sansM, letterSpacing: 0.2 },

  // Ground Intelligence (on parchment)
  groundWrap:    { marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: C.inkD + "20" },
  groundLabel:   { color: C.mutD, fontSize: 9, fontFamily: T.sansB, letterSpacing: T.trackWide, marginBottom: 10 },
  groundRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  groundIc:      { fontSize: 12, width: 20, textAlign: "center" },
  groundStep:    { flex: 1, color: C.inkD, fontSize: 13, fontFamily: T.sansM },
  groundTime:    { color: C.mutD, fontSize: 13, fontFamily: T.sansB },
  groundVerdict: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },

  // ── Trip cards — exact deck dark card spec ─────────────────────────────────
  tripCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  tripThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tripThumbT: { fontSize: 22, color: C.gold + "80" },
  tripInfo:  { flex: 1 },
  dest:      { color: C.ink, fontSize: TS.tripName, fontFamily: T.sansM, letterSpacing: -0.1, lineHeight: 22 },
  when:      { color: C.mut, fontSize: TS.tripSub, fontFamily: T.sans, marginTop: 3, lineHeight: 17 },
  tripDateRange: { color: C.gold, fontSize: TS.tripDate, fontFamily: T.sansB, letterSpacing: T.trackMed, marginBottom: 3 },
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
  briefingGroundBtnT: { color: C.teal, fontSize: 13, fontFamily: T.sansM, letterSpacing: 0.2 },

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
  demoBtn:        { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 14, marginBottom: 10 },
  demoBtnT:       { color: C.gold, fontSize: 13, fontFamily: T.sansM, letterSpacing: 0.2 },
  // ── Next trip window card ────────────────────────────────────────────────────
  windowCard:     { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.gold + "30", marginBottom: 12 },
  pointsTile:     { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  pointsTileLabel:{ fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.2, marginBottom: 4 },
  pointsTileBalance: { fontSize: 28, color: C.ink },
  pointsTileSub:  { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2 },
  pointsTileNext: { fontSize: 11, fontFamily: T.sansM },
  pointsTileBar:  { width: 100, height: 3, backgroundColor: C.line, borderRadius: 2, overflow: "hidden" },
  pointsTileBarFill: { height: 3, borderRadius: 2 },
  // ── Contextual State Card ────────────────────────────────────────────────────
  stateCard:      { backgroundColor: "transparent", borderRadius: 20, padding: 18, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  stateLabel:     { fontSize: 10, fontFamily: T.sans, fontWeight: "700", letterSpacing: 1.4 },
  stateMeta:      { color: "#8A8070", fontSize: 9, fontFamily: T.sans, fontWeight: "700", letterSpacing: 1.2, marginBottom: 2 },
  stateValue:     { color: C.inkD, fontSize: 15, fontFamily: T.sansM },
  bufferBar:      { borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 6 },
  bufferVerdict:  { fontSize: 12, fontFamily: T.sans, fontWeight: "600" },
  bufferSub:      { color: "#8A8070", fontSize: 11, fontFamily: T.sans, marginTop: 3 },
  disruptionCTA:  { backgroundColor: "#D95F5F18", borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: "#D95F5F40" },
  disruptionCTAT: { color: "#D95F5F", fontSize: 13, fontFamily: T.sans, fontWeight: "600", textAlign: "center" },
  sugChip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  sugChipT:       { color: C.gold, fontSize: 12, fontFamily: T.sans, fontFamily: T.sansM },
  journeyTimingBtn:  { backgroundColor: "#D4902A12", borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: "#D4902A40" },
  journeyTimingBtnT: { color: "#D4902A", fontSize: 12, fontFamily: T.sans, fontWeight: "600", textAlign: "center" },
  windowTitle:    { color: C.ink, fontSize: 14, fontFamily: T.sansB },
  windowBody:     { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 19 },
  weatherChip:    { alignItems: "flex-end", marginLeft: 12, paddingTop: 4 },
  weatherTemp:    { color: C.gold, fontSize: 22, fontFamily: T.serifB, lineHeight: 26 },
  weatherDesc:    { color: C.mut, fontSize: 10, fontFamily: T.sans, letterSpacing: 0.8, textTransform: "uppercase", textAlign: "right", marginTop: 2 },
  // Quick-action chips (empty state, no active trip)
  qaChip:         { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: C.gold + "35", backgroundColor: C.gold + "0A" },
  qaChipIcon:     { color: C.gold, fontSize: 13, fontFamily: T.sansB },
  qaChipT:        { color: C.gold, fontSize: 12, fontFamily: T.sansM, letterSpacing: 0.2 },
  // Trip card quick-action chips
  tcChip:         { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  tcChipT:        { color: C.mut, fontSize: 11, fontFamily: T.sansM, letterSpacing: 0.2 },
  // Parchment card quick-action chips (dark ink on parchment)
  parchChip:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: "rgba(60,50,30,0.2)", backgroundColor: "rgba(60,50,30,0.07)" },
  parchChipT:     { color: C.inkD, fontSize: 11, fontFamily: T.sansM, letterSpacing: 0.2 },
});
