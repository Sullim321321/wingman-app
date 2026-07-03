// TripsScreen.js
// Dedicated trip list tab — shows all imported/added trips with TripCards.
// Replaces the old ActivityScreen wiring on the Trips tab.

import React, { useState, useCallback, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, T, TS } from "../theme";
import { Btn, tap, SerifText, g } from "../components";
import { getTrips, deleteTrip, getPrediction } from "../api";
import { getCachedTrips } from "../offlineCache";
import { getEtching } from "../etchings";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GENERIC_TITLE = /^(Unknown Trip|Unknown|Trip|Imported Trip)$/i;
const CARRIER_ONLY  = /^(United Airlines|Delta Air Lines|American Airlines|British Airways|Lufthansa|Air France|Emirates|Qantas|Southwest Airlines|JetBlue|Alaska Airlines|Spirit Airlines|Frontier Airlines|Ryanair|easyJet|Wizz Air|Turkish Airlines|Singapore Airlines|Cathay Pacific|Air Canada|KLM|Iberia|Virgin Atlantic|Air New Zealand|Etihad Airways|Southwest|JetBlue Airways|Alaska) (Flight|Booking|Confirmation|Reservation)$/i;

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

// ─── Trip Card ────────────────────────────────────────────────────────────────

function TripCard({ trip, onDelete, navigation }) {
  const [risk, setRisk] = useState(null);
  const legs = trip.legs || [];
  const firstFlight = legs.find(l => l.type === "flight");

  useEffect(() => {
    if (!firstFlight?.origin || !firstFlight?.destination) return;
    const dep = firstFlight.departs_at ? new Date(firstFlight.departs_at).getTime() : 0;
    if (dep < Date.now()) return;
    getPrediction({ dep: firstFlight.origin, arr: firstFlight.destination })
      .then(p => setRisk(p?.risk ?? null))
      .catch(() => {});
  }, [firstFlight?.origin, firstFlight?.destination]);

  // Build date range
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

  // Subtitle: hotel name > destination city > first flight destination
  const hotelLeg  = legs.find(l => l.type === "hotel" || l.type === "airbnb");
  const hotelName = hotelLeg?.carrier || hotelLeg?.destination_city || hotelLeg?.destination || null;
  const destCity  = legs.find(l => l.destination_city)?.destination_city || null;

  // Derive display title
  const derivedTitle = trip.title || destCity ||
    (firstFlight?.origin && firstFlight?.destination ? `${firstFlight.origin} → ${firstFlight.destination}` : "Trip");

  // Thumbnail
  const etchingKey = destCity || firstFlight?.destination || "";
  const destIcons = {
    "Bali": "🌴", "Swiss": "⛰️", "Tokyo": "🜯", "Paris": "🗻",
    "London": "🏰", "New York": "🏙️", "NYC": "🏙️", "Edinburgh": "🏰",
    "Rome": "🇯", "Barcelona": "🇪🇸", "Amsterdam": "🇳🇱",
  };
  const iconKey = Object.keys(destIcons).find(k => etchingKey.includes(k) || derivedTitle.includes(k));
  const thumbIcon = iconKey ? destIcons[iconKey] : "✈️";

  return (
    <Pressable
      onPress={() => { tap(); navigation.navigate("TripDetail", { trip }); }}
      onLongPress={() => Alert.alert("Delete trip?", trip.title, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete(trip.id) },
      ])}
      style={{ marginBottom: 10 }}
    >
      <View style={s.tripCard}>
        {/* Thumbnail */}
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
        {/* Info */}
        <View style={s.tripInfo}>
          {dateRange && <Text style={s.tripDateRange}>{dateRange}</Text>}
          <Text style={s.dest}>{derivedTitle}</Text>
          {(hotelName || destCity || firstFlight?.destination) && (
            <Text style={s.when}>{hotelName || destCity || firstFlight?.destination}</Text>
          )}
        </View>
        {/* Right: countdown pill + risk badge + chevron */}
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          {(() => {
            if (!firstFlight?.departs_at) return null;
            const diff = new Date(firstFlight.departs_at).getTime() - Date.now();
            if (diff <= 0) return null;
            const days = Math.floor(diff / 86400000);
            if (days === 0) return <View style={s.cdPill}><Text style={s.cdPillT}>TODAY</Text></View>;
            if (days === 1) return <View style={s.cdPill}><Text style={s.cdPillT}>TOMORROW</Text></View>;
            if (days <= 30) return <View style={s.cdPill}><Text style={s.cdPillT}>{days}D</Text></View>;
            return null;
          })()}
          {risk != null && risk >= 30 && <RiskBadge risk={risk} />}
          <Text style={{ color: C.mut, fontSize: 18, lineHeight: 22 }}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ navigation }) {
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIconWrap}>
        <Text style={{ fontSize: 22, color: C.gold, fontFamily: T.sansB }}>✈</Text>
      </View>
      <SerifText bold style={s.emptyTitle}>No trips yet</SerifText>
      <Text style={s.emptySub}>
        Add a trip and Wingman monitors it 24/7 — delays, cancellations, gate changes, and rescue options the moment anything goes wrong.
      </Text>
      {/* What Wingman watches — value preview */}
      <View style={s.watchCard}>
        {[
          { icon: "!", color: C.coral,  label: "Delays & cancellations" },
          { icon: "✓", color: C.teal,   label: "Automatic rebooking options" },
          { icon: "❖", color: C.gold,   label: "Pre-departure briefings" },
          { icon: "~", color: C.amber,  label: "Disruption risk predictions" },
        ].map((item, i) => (
          <View key={i} style={[s.watchRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
            <View style={[s.watchBadge, { backgroundColor: item.color + "18" }]}>
              <Text style={{ color: item.color, fontSize: 12, fontFamily: T.sansB }}>{item.icon}</Text>
            </View>
            <Text style={s.watchLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
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
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getCachedTrips(() => getTrips());
      // getCachedTrips wraps the response: result.data is what getTrips() returned
      // getTrips() returns { trips: [...] } from the server
      const fetchedTrips = (result.data?.trips || []);
      setTrips(fetchedTrips);
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

  const visibleTrips = trips.filter(t => {
    if (!t.title || GENERIC_TITLE.test(t.title.trim())) return false;
    if (CARRIER_ONLY.test(t.title.trim())) return false;
    if ((t.legs || []).length === 0) return false;
    return true;
  });

  return (
    <SafeAreaView style={s.app}>
      {/* Header */}
      <View style={s.head}>
        <Text style={s.headT}>TRIPS</Text>
        {visibleTrips.length > 0 && (
          <View style={s.countBadge}>
            <Text style={s.countT}>{visibleTrips.length}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => { tap(); navigation.navigate("AddTrip"); }} style={s.addBtn}>
          <Text style={s.addBtnT}>+ Add</Text>
        </Pressable>
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
        ) : visibleTrips.length === 0 ? (
          <EmptyState navigation={navigation} />
        ) : (
          <>
            {visibleTrips.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                onDelete={handleDelete}
                navigation={navigation}
              />
            ))}
            <Btn
              title="+ Add a trip"
              onPress={() => { tap(); navigation.navigate("AddTrip"); }}
              style={{ marginTop: 4 }}
            />
            <Btn
              title="Import from email"
              kind="ghost"
              onPress={() => { tap(); navigation.navigate("Connections"); }}
              style={{ marginTop: 8, marginBottom: 16 }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  head: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6,
  },
  headT: { color: C.ink, fontSize: 11, fontFamily: T.sansB, letterSpacing: T.trackWide },
  countBadge: {
    backgroundColor: C.gold + "15", borderWidth: 1, borderColor: C.gold + "35",
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
  },
  countT: { color: C.gold, fontSize: 10, fontFamily: T.sansB, letterSpacing: T.trackMed },
  addBtn: {
    borderWidth: 1, borderColor: C.gold + "40", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  addBtnT: { color: C.gold, fontSize: 11, fontFamily: T.sansB, letterSpacing: 0.4 },

  // Trip card — matches HomeScreen spec exactly
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
  tripThumb: {
    width: 56, height: 56, borderRadius: 8,
    backgroundColor: C.card2, borderWidth: 1, borderColor: C.line,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  tripThumbT: { fontSize: 22, color: C.gold + "80" },
  tripInfo:   { flex: 1 },
  dest:       { color: C.ink, fontSize: TS.tripName, fontFamily: T.sansM, letterSpacing: -0.1, lineHeight: 22 },
  when:       { color: C.mut, fontSize: TS.tripSub, fontFamily: T.sans, marginTop: 3, lineHeight: 17 },
  tripDateRange: {
    color: C.gold, fontSize: TS.tripDate, fontFamily: T.sansB,
    letterSpacing: T.trackMed, marginBottom: 3,
  },

  // Countdown pill
  cdPill:  { backgroundColor: C.gold + "18", borderColor: C.gold + "40", borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  cdPillT: { color: C.gold, fontSize: 10, fontFamily: T.sansB, letterSpacing: T.trackMed },
  // Empty state
  emptyWrap: {
    alignItems: "center", padding: 44,
    backgroundColor: C.card, borderRadius: 20,
    borderWidth: 1, borderColor: C.line,
  },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: C.card2, borderWidth: 1, borderColor: C.gold + "30",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  emptyTitle: { color: C.ink, fontSize: 22, letterSpacing: T.trackTight, marginBottom: 10 },
  emptySub: {
    color: C.mut, fontSize: 14, fontFamily: T.sans,
    textAlign: "center", lineHeight: 21, marginBottom: 28,
  },
  emptyPrimary: {
    backgroundColor: C.gold, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14,
    width: "100%", alignItems: "center", marginBottom: 12,
  },
  emptyPrimaryT: { color: C.inkD, fontSize: 15, fontFamily: T.sansB, letterSpacing: 0.3 },
  emptyGhost: {
    borderWidth: 1, borderColor: C.line, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14,
    width: "100%", alignItems: "center",
  },
  emptyGhostT: { color: C.ink, fontSize: 15, fontFamily: T.sansM, letterSpacing: 0.2 },
  // Watch card (empty state preview)
  watchCard:  { width: "100%", borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card2, overflow: "hidden", marginBottom: 24 },
  watchRow:   { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  watchBadge: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  watchLabel: { color: C.ink, fontSize: 13, fontFamily: T.sansM, flex: 1 },
});
