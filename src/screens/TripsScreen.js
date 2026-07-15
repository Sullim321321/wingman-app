// TripsScreen.js — Editorial v3
// Italic serif headline "Your trips." · date-anchored rows · status pills
// Upcoming above rule, past below rule — no cards, no chips, no chrome

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Animated,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Swipeable } from "react-native-gesture-handler";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { C, T, SHADOW, litEdge } from "../theme";
import { tap, FadeRise } from "../components";
import { getTrips, deleteTrip, getPrediction, getOnboardingSummary } from "../api";
import { getCachedTrips } from "../offlineCache";
import * as fid from "../flightid";

const BACKFILL_KEY = "wingman_backfill_recap_seen";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GENERIC_TITLE = /^(Unknown Trip|Unknown|Trip|Imported Trip|Reservations|Needs review)$/i;
const CARRIER_ONLY  = /^(United Airlines|Delta Air Lines|American Airlines|British Airways|Lufthansa|Air France|Emirates|Qantas|Southwest Airlines|JetBlue|Alaska Airlines|Spirit Airlines|Frontier Airlines|Ryanair|easyJet|Wizz Air|Turkish Airlines|Singapore Airlines|Cathay Pacific|Air Canada|KLM|Iberia|Virgin Atlantic|Air New Zealand|Etihad Airways|Southwest|JetBlue Airways|Alaska) (Flight|Booking|Confirmation|Reservation|Trip)$/i;
// General catch: any "<Something> Airlines/Airways Trip" style junk title
const CARRIER_GENERIC = /(Airlines|Air Lines|Airways|Airline)\s+(Trip|Flight|Booking|Confirmation|Reservation)$/i;

function isVisible(t) {
  if (!t.title || GENERIC_TITLE.test(t.title.trim())) return false;
  if (CARRIER_ONLY.test(t.title.trim())) return false;
  if (CARRIER_GENERIC.test(t.title.trim())) return false;
  if ((t.legs || []).length === 0) return false;
  return true;
}

function tripEndTime(trip) {
  const legs = trip.legs || [];
  if (trip.trip_end) return new Date(trip.trip_end).getTime();
  return legs.reduce((latest, l) => {
    const t = l.arrives_at || l.departs_at;
    const ts = t ? new Date(t).getTime() : 0;
    return ts > latest ? ts : latest;
  }, 0);
}

function tripStartTime(trip) {
  const legs = trip.legs || [];
  if (trip.trip_start) return new Date(trip.trip_start).getTime();
  const firstFlight = legs.find(l => l.type === "flight");
  const first = firstFlight?.departs_at || legs[0]?.departs_at;
  return first ? new Date(first).getTime() : 0;
}

function statusForTrip(trip) {
  const now = Date.now();
  const start = tripStartTime(trip);
  const end   = tripEndTime(trip);
  if (end > 0 && end < now - 86400000) return "past";
  if (start > 0 && start <= now && end >= now) return "active";
  return "upcoming";
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ status, riskScore }) {
  if (status === "past") {
    return (
      <View style={[s.pill, s.pillMut]}>
        <Text style={[s.pillT, { color: C.mut }]}>COMPLETED</Text>
      </View>
    );
  }
  if (status === "active") {
    return (
      <View style={[s.pill, s.pillTeal]}>
        <View style={s.pillDot} />
        <Text style={[s.pillT, { color: C.teal }]}>ACTIVE</Text>
      </View>
    );
  }
  // Upcoming — show risk if significant, otherwise nothing
  if (riskScore != null && riskScore >= 60) {
    return (
      <View style={[s.pill, s.pillCoral]}>
        <Text style={[s.pillT, { color: C.coral }]}>{riskScore}% RISK</Text>
      </View>
    );
  }
  if (riskScore != null && riskScore >= 30) {
    return (
      <View style={[s.pill, s.pillAmber]}>
        <Text style={[s.pillT, { color: C.amber }]}>{riskScore}% RISK</Text>
      </View>
    );
  }
  return null;
}

// ─── Trip Row ─────────────────────────────────────────────────────────────────

function TripRow({ trip, navigation, onDelete }) {
  const [riskScore, setRiskScore] = useState(null);
  const swipeRef = useRef(null);

  const legs        = trip.legs || [];
  const firstFlight = legs.find(l => l.type === "flight");
  const startTs     = tripStartTime(trip);
  const status      = statusForTrip(trip);

  useEffect(() => {
    if (status === "past") return;
    if (!firstFlight?.origin || !firstFlight?.destination) return;
    getPrediction({ dep: firstFlight.origin, arr: firstFlight.destination })
      .then(p => { if (p?.risk != null) setRiskScore(p.risk); })
      .catch(() => {});
  }, [firstFlight?.origin, firstFlight?.destination, status]);

  // Date anchor — large day number
  const dayNum  = startTs ? new Date(startTs).getDate() : null;
  const monthAb = startTs ? new Date(startTs).toLocaleDateString("en-US", { month: "short" }).toUpperCase() : null;
  const yearStr = startTs ? new Date(startTs).getFullYear() : null;
  const nowYear = new Date().getFullYear();

  // Route label
  const origin = firstFlight?.origin || null;
  const dest   = firstFlight?.destination || null;
  const routeLabel = origin && dest ? `${origin} → ${dest}` : null;

  // Flight ident
  const ident = firstFlight
    ? (fid.displayName(firstFlight) || "")
    : null;

  // Derived title
  const derivedTitle = trip.title ||
    (firstFlight?.destination ? firstFlight.destination : "Trip");

  // Days away
  const daysAway = startTs
    ? Math.ceil((startTs - Date.now()) / 86400000)
    : null;
  const daysLabel = status === "upcoming" && daysAway != null
    ? (daysAway <= 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `${daysAway}d`)
    : null;

  // Next-action nudge — one proactive prompt per trip
  const nextNudge = (() => {
    if (status === "past") return null;
    if (status === "active") return "In progress — tap for live status";
    if (daysAway === 0) return "Check-in may be open — tap to check";
    if (daysAway === 1) return "Flight tomorrow — check gate & lounge";
    if (daysAway != null && daysAway <= 3) return "Check-in opens soon — Wingman is watching";
    if (daysAway != null && daysAway <= 7) {
      if (riskScore != null && riskScore >= 40) return `${riskScore}% disruption risk — tap to see options`;
      return "Wingman is monitoring for delays & price drops";
    }
    return null;
  })();

  const renderRightActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.8],
      extrapolate: "clamp",
    });
    return (
      <Pressable
        style={s.deleteAction}
        onPress={() => {
          swipeRef.current?.close();
          Alert.alert("Delete trip?", derivedTitle, [
            { text: "Cancel", style: "cancel", onPress: () => swipeRef.current?.close() },
            { text: "Delete", style: "destructive", onPress: () => onDelete(trip.id) },
          ]);
        }}
      >
        <Animated.Text style={[s.deleteActionT, { transform: [{ scale }] }]}>Delete</Animated.Text>
      </Pressable>
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
    >
    <Pressable
      style={s.tripRow}
      onPress={() => { tap(); navigation.navigate("Dossier", { tripId: trip.id }); }}
    >
      {/* Date anchor */}
      <View style={s.dateAnchor}>
        {dayNum ? (
          <>
            <Text style={[s.dayNum, status === "past" && s.dayNumMut]}>{dayNum}</Text>
            <Text style={[s.monthAb, status === "past" && s.monthAbMut]}>{monthAb}</Text>
            {yearStr && yearStr !== nowYear && (
              <Text style={s.yearStr}>{yearStr}</Text>
            )}
          </>
        ) : (
          <Text style={s.dayNum}>—</Text>
        )}
      </View>

      {/* Main content */}
      <View style={s.tripBody}>
        <Text style={[s.tripTitle, status === "past" && s.tripTitleMut]} numberOfLines={1}>
          {derivedTitle}
        </Text>
        {routeLabel && (
          <Text style={s.tripRoute}>{routeLabel}{ident ? `  ·  ${ident}` : ""}</Text>
        )}
        <View style={s.tripMeta}>
          {daysLabel && (
            <Text style={[s.daysLabel, daysAway === 0 && { color: C.teal }]}>{daysLabel}</Text>
          )}
          <StatusPill status={status} riskScore={riskScore} />
        </View>
        {nextNudge && (
          <Text style={s.tripNudge} numberOfLines={1}>{nextNudge}</Text>
        )}
      </View>

      {/* Chevron */}
      <Text style={s.chevron}>›</Text>
    </Pressable>
    </Swipeable>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ navigation }) {
  return (
    <View style={s.emptyWrap}>
      <Text style={s.emptyHed}>No trips yet.</Text>
      <Text style={s.emptySub}>
        Add a trip and Wingman monitors it around the clock — delays, cancellations, gate changes, and rescue options the moment anything goes wrong.
      </Text>
      <Pressable style={s.emptyPrimary} onPress={() => { tap(); navigation.navigate("AddTrip"); }}>
        <Text style={s.emptyPrimaryT}>+ Add a trip</Text>
      </Pressable>
      <Pressable style={s.emptyGhost} onPress={() => { tap(); navigation.navigate("Connections"); }}>
        <Text style={s.emptyGhostT}>Import from email</Text>
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TripsScreen({ navigation }) {
  const [trips,      setTrips]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(null);   // a failed load ≠ an empty life
  const [refreshing, setRefreshing] = useState(false);
  const [showPast,   setShowPast]   = useState(false);
  const [pastTrips,  setPastTrips]  = useState([]);
  const [pastLoading, setPastLoading] = useState(false);
  const [tripView,   setTripView]   = useState("upcoming"); // upcoming | past | all
  const [recap,      setRecap]      = useState(null);   // backfill onboarding summary
  const [recapSeen,  setRecapSeen]  = useState(true);   // default hidden until we check

  // One-time "here's what I found" recap after a Gmail backfill.
  useEffect(() => {
    (async () => {
      try {
        const seen = await SecureStore.getItemAsync(BACKFILL_KEY);
        if (seen) return; // already dismissed — never fetch again
        setRecapSeen(false);
        const s = await getOnboardingSummary();
        if (s && s.trips_found > 0) setRecap(s);
      } catch {}
    })();
  }, []);

  const dismissRecap = async () => {
    tap();
    setRecap(null);
    setRecapSeen(true);
    try { await SecureStore.setItemAsync(BACKFILL_KEY, "1"); } catch {}
  };

  const load = useCallback(async () => {
    try {
      const result = await getCachedTrips(() => getTrips());
      setTrips(result.data?.trips || []);
      setLoadError(null);
    } catch (e) {
      // "No trips yet" and "I couldn't reach the server" are DIFFERENT FACTS, and this
      // used to render them identically — the empty state showed either way. That is the
      // same class of bug as the delay monitor reading a 404 as calm: a failure disguised
      // as a clean result. Keep the error so the screen can tell the truth about which
      // one this is.
      console.error("[trips]", e.message);
      setLoadError(e?.message || "Couldn't reach Wingman.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadPast = useCallback(async () => {
    setPastLoading(true);
    try {
      const result = await getTrips({ all: true });
      const all = result?.trips || [];
      // Past = trips whose latest leg is in the past, but only within the last 30
      // days — the screen stays tidy and recent. (Full history is still kept in the
      // database and used by the concierge + memory; this is display-only.)
      const now = Date.now();
      const THIRTY_DAYS = 30 * 86400000;
      const past = all.filter(t => {
        const end = tripEndTime(t);
        return end > 0 && end < now - 86400000 && end >= now - THIRTY_DAYS;
      }).sort((a, b) => tripStartTime(b) - tripStartTime(a));
      setPastTrips(past);
    } catch (e) {
      console.error("[trips/past]", e.message);
    } finally {
      setPastLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); loadPast(); }, [load, loadPast]));

  const handleDelete = async (id) => {
    try {
      await deleteTrip(id);
      setTrips(prev => prev.filter(t => t.id !== id));
      setPastTrips(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const handleTogglePast = () => {
    const next = !showPast;
    setShowPast(next);
    if (next && pastTrips.length === 0) loadPast();
  };

  const visible = trips.filter(isVisible);
  const upcoming = visible.filter(t => {
    if (statusForTrip(t) === "past") return false;
    // A trip with NO date can't be "upcoming" — undated bookings are almost always
    // stray past items (an old hotel or dinner whose email had no parseable date).
    // Keep them out of the prominent Upcoming list instead of floating them to the top.
    if (tripStartTime(t) === 0 && tripEndTime(t) === 0) return false;
    return true;
  }).sort((a, b) => tripStartTime(a) - tripStartTime(b));

  const hasPast = pastTrips.filter(isVisible).length > 0;
  // If there's nothing upcoming but there IS history, auto-reveal it so the screen
  // never looks empty for someone who's clearly travelled.
  useEffect(() => {
    if (!loading && upcoming.length === 0 && hasPast) setTripView("all");
  }, [loading, upcoming.length, hasPast]);

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.gold}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Masthead ── */}
        <View style={s.masthead}>
          <Text style={s.mastTitle}>Your trips.</Text>
          <Pressable style={s.addBtn} onPress={() => { tap(); navigation.navigate("AddTrip"); }}>
            <Text style={s.addBtnT}>+ Add</Text>
          </Pressable>
        </View>

        <View style={s.rule} />

        {/* ── Segmented view control ── */}
        <View style={s.segRow}>
          {[{ id: "upcoming", label: "Upcoming" }, { id: "past", label: "Past" }, { id: "all", label: "All" }].map(seg => (
            <Pressable
              key={seg.id}
              style={[s.segBtn, tripView === seg.id && s.segBtnOn]}
              onPress={() => { tap(); setTripView(seg.id); if (seg.id !== "upcoming" && pastTrips.length === 0) loadPast(); }}
            >
              <Text style={[s.segT, tripView === seg.id && s.segTOn]}>{seg.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Backfill recap (UX #6) — shown once after Gmail connect ── */}
        {!recapSeen && recap && (
          <View style={s.recapCard}>
            <View style={s.recapHead}>
              <Ionicons name="sparkles-outline" size={16} color={C.gold} />
              <Text style={s.recapKicker}>HERE'S WHAT I FOUND</Text>
              <Pressable onPress={dismissRecap} hitSlop={10} style={{ marginLeft: "auto" }} accessibilityRole="button" accessibilityLabel="Dismiss recap">
                <Ionicons name="close" size={18} color={C.mut} />
              </Pressable>
            </View>
            <Text style={s.recapBody}>
              I've pulled together {recap.trips_found} trip{recap.trips_found === 1 ? "" : "s"}
              {recap.earliest_year ? ` going back to ${recap.earliest_year}` : ""}.
              {recap.favorite_hotel
                ? ` Your go-to stay is ${recap.favorite_hotel.name}${recap.favorite_hotel.stays ? ` — ${recap.favorite_hotel.stays} stays` : ""}${recap.favorite_hotel.city ? ` in ${recap.favorite_hotel.city}` : ""}.`
                : ""}
              {recap.top_city ? ` You fly to ${recap.top_city} more than anywhere else.` : ""}
              {recap.dining_count > 0 ? ` I'm also keeping ${recap.dining_count} dining reservation${recap.dining_count === 1 ? "" : "s"} in view.` : ""}
            </Text>
            <Text style={s.recapFoot}>From here on, I'll watch every trip and surface only what needs you.</Text>
          </View>
        )}

        {loading ? (
          // Skeleton rows while loading
          <View style={{ paddingHorizontal: 24, gap: 0 }}>
            <Text style={s.sectionLabel}>UPCOMING</Text>
            {[0, 1, 2].map(i => (
              <View key={i} style={[s.tripRow, { borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.line }]}>
                <View style={s.dateAnchor}>
                  <View style={{ width: 28, height: 28, backgroundColor: C.card2, borderRadius: 4 }} />
                  <View style={{ width: 22, height: 10, backgroundColor: C.card2, borderRadius: 3, marginTop: 4 }} />
                </View>
                <View style={s.tripBody}>
                  <View style={{ height: 16, width: "60%", backgroundColor: C.card2, borderRadius: 4, marginBottom: 6 }} />
                  <View style={{ height: 12, width: "40%", backgroundColor: C.card2, borderRadius: 3 }} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <>
            {/* ── Upcoming trips (hidden on the Past tab) ── */}
            {tripView !== "past" && (
              upcoming.length > 0 ? (
                <>
                  <Text style={s.sectionLabel}>UPCOMING</Text>
                  {upcoming.map((trip, i) => (
                    <FadeRise key={trip.id} delay={Math.min(i * 45, 270)}>
                      <TripRow
                        trip={trip}
                        navigation={navigation}
                        onDelete={handleDelete}
                      />
                    </FadeRise>
                  ))}
                </>
              ) : loadError ? (
                // The honest failure. NOT the empty state — a server we couldn't reach
                // is a different thing from a life with no trips in it, and pretending
                // otherwise would tell you to add a trip when the real problem is the network.
                <View style={s.errWrap}>
                  <Text style={s.errHed}>I couldn't reach Wingman.</Text>
                  <Text style={s.errSub}>This isn't "no trips" — it's a connection I couldn't make. Your trips are safe; I just can't show them this second.</Text>
                  <Pressable style={s.errBtn} onPress={() => { tap(); setLoading(true); load(); }}>
                    <Text style={s.errBtnT}>Try again</Text>
                  </Pressable>
                </View>
              ) : (!hasPast && pastTrips.length === 0) ? (
                <EmptyState navigation={navigation} />
              ) : (
                <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
                  <Text style={s.sectionLabel}>UPCOMING</Text>
                  <Text style={s.noUpcoming}>Nothing on the horizon right now — check Past, or add your next trip.</Text>
                </View>
              )
            )}

            {/* ── Import CTA ── */}
            <Pressable
              style={s.importRow}
              onPress={() => { tap(); navigation.navigate("Connections"); }}
            >
              <View style={s.importIcon}>
                <Ionicons name="mail-outline" size={16} color={C.gold} />
              </View>
              <Text style={s.importLabel}>Import from email</Text>
              <Text style={s.importArrow}>›</Text>
            </Pressable>

            {/* ── Past trips (Past / All tabs) ── */}
            {tripView !== "upcoming" && (
              pastLoading ? (
                <ActivityIndicator color={C.gold} style={{ marginVertical: 24 }} />
              ) : pastTrips.filter(isVisible).length > 0 ? (
                <>
                  <View style={s.pastRule}>
                    <View style={s.pastRuleLine} />
                    <Text style={s.pastRuleLabel}>EARLIER · LAST 30 DAYS</Text>
                    <View style={s.pastRuleLine} />
                  </View>
                  {pastTrips.filter(isVisible).map(trip => (
                    <TripRow
                      key={trip.id}
                      trip={trip}
                      navigation={navigation}
                      onDelete={handleDelete}
                    />
                  ))}
                </>
              ) : (
                <Text style={s.pastEmpty}>No past trips in the last 30 days.</Text>
              )
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  errWrap: { alignItems: "center", paddingHorizontal: 34, paddingTop: 60 },
  errHed:  { fontFamily: T.serif, fontSize: 22, color: C.ink, marginBottom: 10, textAlign: "center" },
  errSub:  { fontFamily: T.sans, fontSize: 14, color: C.mut, textAlign: "center", lineHeight: 21, marginBottom: 20 },
  errBtn:  { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
  errBtnT: { fontFamily: T.sansM, fontSize: 14, color: C.ink },

  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    paddingBottom: 140,
  },

  // ── Segmented view control ──
  segRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 24,
    marginTop: 14,
    marginBottom: 4,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
  },
  segBtnOn: { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.08)" },
  segT: { fontFamily: T.sansM, fontSize: 12, color: C.mut, letterSpacing: 0.3 },
  segTOn: { color: C.gold },

  // ── Backfill recap card ──
  recapCard: {
    marginHorizontal: 24,
    marginTop: 14,
    marginBottom: 4,
    padding: 18,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "rgba(201,169,110,0.35)",
    ...litEdge,
    ...SHADOW.soft,
  },
  recapHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  recapKicker: {
    fontFamily: T.sansB,
    fontSize: 10,
    letterSpacing: 1.4,
    color: C.mutD,
  },
  recapBody: {
    fontFamily: T.garamondI,
    fontSize: 17,
    lineHeight: 25,
    color: C.ink,
  },
  recapFoot: {
    fontFamily: T.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: C.mut,
    marginTop: 10,
  },

  // ── Masthead ──
  masthead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  mastTitle: {
    fontFamily: T.garamondSI,
    fontSize: 34,
    color: C.ink,
    letterSpacing: -0.3,
    lineHeight: 38,
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
    marginBottom: 4,
  },
  addBtnT: {
    fontFamily: T.sansM,
    fontSize: 12,
    color: C.gold,
    letterSpacing: 1,
  },

  // ── Rule ──
  rule: {
    height: 1,
    marginHorizontal: 24,
    backgroundColor: C.line,
    opacity: 0.5,
    marginBottom: 4,
  },

  // ── Section label ──
  sectionLabel: {
    fontFamily: T.sansM,
    fontSize: 9,
    letterSpacing: 2.5,
    color: C.mut,
    textTransform: "uppercase",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
    opacity: 0.7,
  },
  noUpcoming: {
    fontFamily: T.garamondI,
    fontSize: 15,
    color: C.mut,
    lineHeight: 22,
    paddingTop: 4,
    paddingBottom: 8,
  },

  // ── Trip row ──
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    gap: 16,
  },

  // Date anchor
  dateAnchor: {
    width: 40,
    alignItems: "center",
    flexShrink: 0,
  },
  dayNum: {
    fontFamily: T.garamondSI,
    fontSize: 28,
    color: C.gold,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  dayNumMut: {
    color: C.mut,
    opacity: 0.5,
  },
  monthAb: {
    fontFamily: T.sansM,
    fontSize: 9,
    letterSpacing: 1.5,
    color: C.gold,
    textTransform: "uppercase",
    marginTop: 1,
  },
  monthAbMut: {
    color: C.mut,
    opacity: 0.5,
  },
  yearStr: {
    fontFamily: T.sans,
    fontSize: 9,
    color: C.mut,
    opacity: 0.5,
    marginTop: 1,
  },

  // Trip body
  tripBody: {
    flex: 1,
    gap: 3,
  },
  tripTitle: {
    fontFamily: T.sansM,
    fontSize: 15,
    color: C.ink,
    letterSpacing: -0.2,
  },
  tripTitleMut: {
    color: C.mut,
    opacity: 0.6,
  },
  tripRoute: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
    letterSpacing: 0.3,
  },
  tripMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  daysLabel: {
    fontFamily: T.sansM,
    fontSize: 10,
    color: C.gold,
    letterSpacing: 0.5,
  },
  tripNudge: {
    fontFamily: T.sans,
    fontSize: 11,
    color: C.mut,
    letterSpacing: 0.2,
    marginTop: 4,
    fontStyle: "italic",
  },

  // Chevron
  chevron: {
    fontFamily: T.sans,
    fontSize: 18,
    color: C.mut,
    opacity: 0.4,
  },

  // ── Swipe-to-delete action ──
  deleteAction: {
    backgroundColor: C.coral || "#E05C5C",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  deleteActionT: {
    fontFamily: T.sansM,
    fontSize: 13,
    color: "#fff",
    letterSpacing: 0.5,
  },

  // ── Status pills ──
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillT: {
    fontFamily: T.sansB,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  pillMut: {
    backgroundColor: "rgba(138,127,112,0.07)",
    borderColor: "rgba(138,127,112,0.18)",
  },
  pillTeal: {
    backgroundColor: "rgba(45,184,150,0.08)",
    borderColor: "rgba(45,184,150,0.2)",
  },
  pillAmber: {
    backgroundColor: "rgba(212,144,42,0.08)",
    borderColor: "rgba(212,144,42,0.2)",
  },
  pillCoral: {
    backgroundColor: "rgba(217,95,95,0.08)",
    borderColor: "rgba(217,95,95,0.2)",
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.teal,
  },

  // ── Import row ──
  importRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    gap: 14,
  },
  importIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(43,184,150,0.06)",
    borderWidth: 1,
    borderColor: "rgba(43,184,150,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  importIconT: {
    fontSize: 14,
  },
  importLabel: {
    flex: 1,
    fontFamily: T.sansM,
    fontSize: 13,
    color: C.teal,
  },
  importArrow: {
    fontFamily: T.sans,
    fontSize: 18,
    color: C.mut,
    opacity: 0.4,
  },

  // ── Past rule ──
  pastRule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 4,
  },
  pastRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.line,
    opacity: 0.4,
  },
  pastRuleLabel: {
    fontFamily: T.sansM,
    fontSize: 9,
    letterSpacing: 2.5,
    color: C.mut,
    opacity: 0.5,
  },
  // ── Past trips toggle ──
  pastToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 8,
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
  },
  pastToggleT: {
    fontFamily: T.sansM,
    fontSize: 12,
    letterSpacing: 0.8,
    color: C.mut,
  },
  pastToggleArrow: {
    fontFamily: T.sansM,
    fontSize: 10,
    color: C.mut,
    opacity: 0.6,
  },
  pastEmpty: {
    fontFamily: T.garamondI,
    fontSize: 15,
    color: C.mut,
    textAlign: "center",
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  // ── Empty state ──
  emptyWrap: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  emptyHed: {
    fontFamily: T.garamondSI,
    fontSize: 28,
    color: C.ink,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  emptySub: {
    fontFamily: T.garamondI,
    fontSize: 16,
    color: C.mut,
    lineHeight: 26,
    marginBottom: 28,
  },
  emptyPrimary: {
    backgroundColor: C.gold,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  emptyPrimaryT: {
    fontFamily: T.sansB,
    fontSize: 14,
    color: C.bg,
    letterSpacing: 0.5,
  },
  emptyGhost: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 28,
    paddingVertical: 13,
    alignItems: "center",
  },
  emptyGhostT: {
    fontFamily: T.sansM,
    fontSize: 14,
    color: C.mut,
  },
});
