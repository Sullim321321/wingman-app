// ActivityScreen.js — Intelligence tab, Editorial v3
// Italic serif headline "Intelligence." · active signals at top (coloured dot badges)
// Older items below EARLIER rule · curated feed, not a notification list

import React, { useState, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  ActivityIndicator, RefreshControl, Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, T } from "../theme";
import { tap } from "../components";
import { getActivity } from "../api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isActive(event) {
  const diff = Date.now() - new Date(event.created_at).getTime();
  return diff < 24 * 3600000; // within last 24h = active
}

// Signal type configuration
const SIGNAL_META = {
  disruption:  { color: C.coral,  label: "DISRUPTION",  actionable: true  },
  delay:       { color: C.amber,  label: "DELAY",        actionable: true  },
  weather:     { color: C.amber,  label: "WEATHER",      actionable: true  },
  recovery:    { color: C.teal,   label: "RECOVERY",     actionable: false },
  seat_alert:  { color: C.teal,   label: "SEAT",         actionable: false },
  departed:    { color: C.gold,   label: "DEPARTED",     actionable: false },
  landed:      { color: C.teal,   label: "LANDED",       actionable: false },
  trip:        { color: C.gold,   label: "TRIP",         actionable: false },
  import:      { color: C.teal,   label: "IMPORT",       actionable: false },
  hotel_email: { color: C.gold,   label: "HOTEL",        actionable: false },
  status:      { color: C.mut,    label: "STATUS",       actionable: false },
};

// ─── Signal Row ───────────────────────────────────────────────────────────────

function SignalRow({ event, onAction, showBorder }) {
  const meta = SIGNAL_META[event.type] || SIGNAL_META.status;
  const active = isActive(event);

  return (
    <Pressable
      style={[s.signalRow, showBorder && s.signalRowBorder]}
      onPress={() => { if (meta.actionable) { tap(); onAction(event); } }}
    >
      {/* Coloured dot */}
      <View style={s.dotWrap}>
        <View style={[s.dot, { backgroundColor: meta.color + "14", borderColor: meta.color + "30" }]}>
          {active && meta.actionable ? (
            <View style={[s.dotLive, { backgroundColor: meta.color }]} />
          ) : (
            <View style={[s.dotStatic, { backgroundColor: meta.color + "80" }]} />
          )}
        </View>
      </View>

      {/* Content */}
      <View style={s.signalBody}>
        {/* Type label + time */}
        <View style={s.signalMeta}>
          <Text style={[s.signalType, { color: meta.color }]}>{meta.label}</Text>
          {event.trip_title && (
            <Text style={s.signalTrip} numberOfLines={1}>{event.trip_title}</Text>
          )}
          <Text style={s.signalTime}>{timeAgo(event.created_at)}</Text>
        </View>

        {/* Title */}
        <Text style={s.signalTitle}>{event.title}</Text>

        {/* Body */}
        {event.body ? (
          <Text style={s.signalBodyText} numberOfLines={2}>{event.body}</Text>
        ) : null}

        {/* Action */}
        {meta.actionable && (
          <Pressable
            style={[s.signalAction, { borderColor: meta.color + "30", backgroundColor: meta.color + "08" }]}
            onPress={() => { tap(); onAction(event); }}
          >
            <Text style={[s.signalActionT, { color: meta.color }]}>
              {event.type === "disruption" ? "See rescue options" : "Review options"}  ›
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ActivityScreen({ navigation }) {
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getActivity();
      setEvents(data.events || []);
    } catch (e) {
      console.error("[activity]", e.message);
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAction = (event) => {
    const flight = event.flight || {
      origin:        event.origin        || null,
      destination:   event.destination   || null,
      carrier:       event.carrier       || null,
      flight_number: event.flight_number || null,
      departs_at:    event.departs_at    || null,
      tripTitle:     event.trip_title    || null,
    };
    navigation.navigate("Alert", { flight });
  };

  const activeSignals = events.filter(isActive);
  const olderSignals  = events.filter(e => !isActive(e));
  const disruptionCount = events.filter(e =>
    e.type === "disruption" || e.type === "delay" || e.type === "weather"
  ).length;
  const activeCount = activeSignals.length;

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
          <Text style={s.mastTitle}>Intelligence.</Text>
          {activeCount > 0 && (
            <View style={[s.disruptBadge, disruptionCount > 0 ? null : { backgroundColor: C.gold }]}>
              <Text style={s.disruptBadgeT}>{activeCount}</Text>
            </View>
          )}
        </View>

        <View style={s.rule} />

        {loading ? (
          // Skeleton rows while loading
          <View style={s.feedBlock} >
            {[0,1,2].map(i => (
              <View key={i} style={[s.signalRow, i > 0 && s.signalRowBorder]}>
                <View style={[s.dot, { backgroundColor: C.card2, borderColor: "transparent" }]} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={{ height: 9, width: "30%", backgroundColor: C.card2, borderRadius: 4 }} />
                  <View style={{ height: 14, width: "75%", backgroundColor: C.card2, borderRadius: 4 }} />
                  <View style={{ height: 12, width: "55%", backgroundColor: C.card2, borderRadius: 4 }} />
                </View>
              </View>
            ))}
          </View>
        ) : error ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyHed}>Couldn't load signals.</Text>
            <Text style={s.emptySub}>{error}</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyHed}>All clear.</Text>
            <Text style={s.emptySub}>
              Wingman is watching your trips. Disruptions, delays, and gate changes will surface here the moment they happen — with rescue options ready.
            </Text>
            <Pressable style={s.emptyPrimary} onPress={() => { tap(); navigation.navigate("AddTrip"); }}>
              <Text style={s.emptyPrimaryT}>+ Add a trip</Text>
            </Pressable>
            <Pressable style={s.emptyGhost} onPress={() => { tap(); navigation.navigate("Connections"); }}>
              <Text style={s.emptyGhostT}>Import from email</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── Active signals ── */}
            {activeSignals.length > 0 && (
              <>
                <Text style={s.sectionLabel}>ACTIVE</Text>
                <View style={s.feedBlock}>
                  {activeSignals.map((event, i) => (
                    <SignalRow
                      key={event.id || i}
                      event={event}
                      onAction={handleAction}
                      showBorder={i > 0}
                    />
                  ))}
                </View>
              </>
            )}

            {/* ── Older signals ── */}
            {olderSignals.length > 0 && (
              <>
                <View style={s.earlierRule}>
                  <View style={s.earlierLine} />
                  <Text style={s.earlierLabel}>EARLIER</Text>
                  <View style={s.earlierLine} />
                </View>
                <View style={s.feedBlock}>
                  {olderSignals.map((event, i) => (
                    <SignalRow
                      key={event.id || i}
                      event={event}
                      onAction={handleAction}
                      showBorder={i > 0}
                    />
                  ))}
                </View>
              </>
            )}

            {/* ── All active, no older ── */}
            {activeSignals.length > 0 && olderSignals.length === 0 && (
              <View style={s.allClearRow}>
                <Text style={s.allClearT}>No earlier signals.</Text>
              </View>
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
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 16 },

  // ── Masthead ──
  masthead: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  mastTitle: {
    fontFamily: T.garamondSI,
    fontSize: 34,
    color: C.ink,
    letterSpacing: -0.3,
    lineHeight: 38,
  },
  disruptBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.coral,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  disruptBadgeT: {
    fontFamily: T.sansB,
    fontSize: 11,
    color: "#fff",
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

  // ── Feed block ──
  feedBlock: {
    marginHorizontal: 24,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    overflow: "hidden",
  },

  // ── Signal row ──
  signalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  signalRowBorder: {
    borderTopWidth: 1,
    borderTopColor: C.line,
  },

  // Dot
  dotWrap: {
    paddingTop: 2,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dotLive: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotStatic: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Signal content
  signalBody: {
    flex: 1,
    gap: 4,
  },
  signalMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  signalType: {
    fontFamily: T.sansB,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  signalTrip: {
    flex: 1,
    fontFamily: T.sans,
    fontSize: 10,
    color: C.mut,
    letterSpacing: 0.3,
  },
  signalTime: {
    fontFamily: T.sans,
    fontSize: 10,
    color: C.mut,
    opacity: 0.6,
  },
  signalTitle: {
    fontFamily: T.sansM,
    fontSize: 14,
    color: C.ink,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  signalBodyText: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
    lineHeight: 18,
  },
  signalAction: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 20,
  },
  signalActionT: {
    fontFamily: T.sansM,
    fontSize: 11,
    letterSpacing: 0.3,
  },

  // ── Earlier rule ──
  earlierRule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  earlierLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.line,
    opacity: 0.4,
  },
  earlierLabel: {
    fontFamily: T.sansM,
    fontSize: 9,
    letterSpacing: 2.5,
    color: C.mut,
    opacity: 0.5,
  },

  // ── All clear row ──
  allClearRow: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  allClearT: {
    fontFamily: T.garamondI,
    fontSize: 14,
    color: C.mut,
    opacity: 0.6,
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
