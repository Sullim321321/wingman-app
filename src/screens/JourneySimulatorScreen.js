// JourneySimulatorScreen — Wingman
// Live journey simulation: traffic + security + gate walk = buffer to flight
// Shows real-time countdown and verdict, refreshes every 2 minutes
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C, T } from "../theme";
import { SerifText, tap } from "../components";
import { simulateJourney } from "../api";

const VERDICT_CONFIG = {
  will_miss:   { color: "#D95F5F", bg: "#D95F5F12", border: "#D95F5F40", icon: "⚠", label: "You may miss this flight" },
  tight:       { color: "#D4902A", bg: "#D4902A12", border: "#D4902A40", icon: "⏱", label: "Tight — leave now" },
  on_track:    { color: "#2DB896", bg: "#2DB89612", border: "#2DB89630", icon: "✓", label: "On track" },
  comfortable: { color: "#2DB896", bg: "#2DB89612", border: "#2DB89630", icon: "✓", label: "Plenty of time" },
};

function TimelineStep({ step, isLast }) {
  return (
    <View style={s.stepRow}>
      <View style={s.stepLeft}>
        <View style={s.stepDot} />
        {!isLast && <View style={s.stepLine} />}
      </View>
      <View style={s.stepContent}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={s.stepIcon}>{step.icon}</Text>
            <Text style={s.stepLabel}>{step.label}</Text>
          </View>
          <Text style={s.stepDuration}>
            {step.duration > 0 ? `${step.duration}m` : ""}
          </Text>
        </View>
        {step.note ? <Text style={s.stepNote}>{step.note}</Text> : null}
      </View>
    </View>
  );
}

function BufferGauge({ bufferMins, maxMins = 90 }) {
  const pct = Math.max(0, Math.min(100, (bufferMins / maxMins) * 100));
  const color = bufferMins < 0 ? "#D95F5F" : bufferMins < 15 ? "#D4902A" : "#2DB896";
  return (
    <View style={s.gaugeWrap}>
      <View style={s.gaugeTrack}>
        <View style={[s.gaugeFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={[s.gaugeLabel, { color }]}>
          {bufferMins < 0 ? `${Math.abs(bufferMins)}m overdue` : `${bufferMins}m buffer`}
        </Text>
        <Text style={s.gaugeLabel}>Required arrival: now</Text>
      </View>
    </View>
  );
}

export default function JourneySimulatorScreen({ route, navigation }) {
  const { tripId, legId, flightIdent } = route.params || {};
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData]             = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const fetchSimulation = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      let lat = null, lng = null;
      const optIn = await AsyncStorage.getItem("wingman_location_opt_in");
      if (optIn === "true") {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      }
      const result = await simulateJourney(tripId, legId, lat, lng);
      if (result?.ok) {
        setData(result);
        setLastUpdated(new Date());
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId, legId]);

  useEffect(() => {
    fetchSimulation();
    // Auto-refresh every 2 minutes
    intervalRef.current = setInterval(() => fetchSimulation(), 2 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, [fetchSimulation]);

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={C.gold} style={{ marginTop: 80 }} />
        <Text style={s.loadingT}>Calculating your journey…</Text>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.errorWrap}>
          <Text style={s.errorT}>Could not load journey data.</Text>
          <Pressable style={s.retryBtn} onPress={() => fetchSimulation()}>
            <Text style={s.retryBtnT}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const vc = VERDICT_CONFIG[data.verdict] || VERDICT_CONFIG.comfortable;
  const mapsUrl = data.flight?.origin
    ? `https://maps.google.com/?q=${data.flight.origin}+Airport`
    : null;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchSimulation(true)} tintColor={C.gold} />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <SerifText bold style={s.title}>Journey to {data.flight?.origin}</SerifText>
          <Text style={s.subtitle}>
            {data.flight?.ident}  ·  Departs {data.flight?.departs_at
              ? new Date(data.flight.departs_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
              : "—"}
          </Text>
          {lastUpdated && (
            <Text style={s.updated}>Updated {lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Text>
          )}
        </View>

        {/* Verdict banner */}
        <View style={[s.verdictBanner, { backgroundColor: vc.bg, borderColor: vc.border }]}>
          <LinearGradient colors={[vc.bg, "transparent"]} style={StyleSheet.absoluteFill} />
          <Text style={[s.verdictIcon, { color: vc.color }]}>{vc.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.verdictLabel, { color: vc.color }]}>{vc.label}</Text>
            {data.traffic_eta && (
              <Text style={s.verdictSub}>
                ETA to airport: {data.current_eta || "—"}  ·  Required by: {data.required_arrival || "—"}
              </Text>
            )}
          </View>
        </View>

        {/* Buffer gauge */}
        <BufferGauge bufferMins={data.buffer_minutes} />

        {/* Key stats */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statLabel}>MINS TO DEPART</Text>
            <Text style={s.statValue}>{data.mins_to_depart}</Text>
          </View>
          {data.traffic_eta && (
            <View style={s.statItem}>
              <Text style={s.statLabel}>DRIVE</Text>
              <Text style={s.statValue}>{data.traffic_eta.duration_mins}m</Text>
              <Text style={s.statNote}>{data.traffic_eta.summary}</Text>
            </View>
          )}
          <View style={s.statItem}>
            <Text style={s.statLabel}>SECURITY</Text>
            <Text style={s.statValue}>~{data.security_mins}m</Text>
          </View>
          <View style={s.statItem}>
            <Text style={s.statLabel}>GATE WALK</Text>
            <Text style={s.statValue}>{data.gate_walk_mins}m</Text>
          </View>
        </View>

        {/* Timeline */}
        {(data.timeline || []).length > 0 && (
          <>
            <Text style={s.sectionTitle}>YOUR JOURNEY</Text>
            <View style={s.timelineCard}>
              {data.timeline.map((step, i) => (
                <TimelineStep
                  key={i}
                  step={step}
                  isLast={i === data.timeline.length - 1}
                />
              ))}
            </View>
          </>
        )}

        {/* Traffic warning */}
        {data.at_risk && data.traffic_eta && (
          <View style={s.warningCard}>
            <Text style={s.warningTitle}>Leave now</Text>
            <Text style={s.warningBody}>
              With {data.traffic_eta.duration_mins} min drive time, ~{data.security_mins} min security, and {data.gate_walk_mins} min to gate, you have {data.buffer_minutes < 0 ? "no" : `only ${data.buffer_minutes} min`} buffer.
            </Text>
            {mapsUrl && (
              <Pressable style={s.mapsBtn} onPress={() => Linking.openURL(mapsUrl)}>
                <Text style={s.mapsBtnT}>Open in Maps  →</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Ask Wingman */}
        <Pressable
          style={s.askCard}
          onPress={() => { tap(); navigation.navigate("Concierge", {
            prefill: `I'm heading to ${data.flight?.origin} for ${data.flight?.ident}. What do I need to know?`
          }); }}
        >
          <Text style={s.askT}>Ask Wingman about this journey  →</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg },
  scroll:         { paddingHorizontal: 20, paddingTop: 16 },
  loadingT:       { color: C.mut, textAlign: "center", marginTop: 12, fontFamily: T.sans, fontSize: 13 },
  errorWrap:      { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  errorT:         { color: C.mut, fontSize: 14, fontFamily: T.sans, marginBottom: 16 },
  retryBtn:       { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.gold },
  retryBtnT:      { color: C.gold, fontSize: 13, fontFamily: T.sansM },
  header:         { marginBottom: 16 },
  title:          { color: C.ink, fontSize: 26, marginBottom: 4 },
  subtitle:       { color: C.mut, fontSize: 13, fontFamily: T.sans },
  updated:        { color: C.mut, fontSize: 10, fontFamily: T.sans, marginTop: 4 },
  verdictBanner:  { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, overflow: "hidden" },
  verdictIcon:    { fontSize: 22 },
  verdictLabel:   { fontSize: 15, fontFamily: T.sansB },
  verdictSub:     { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 3 },
  gaugeWrap:      { marginBottom: 16 },
  gaugeTrack:     { height: 6, backgroundColor: C.line, borderRadius: 3, overflow: "hidden" },
  gaugeFill:      { height: 6, borderRadius: 3 },
  gaugeLabel:     { fontSize: 11, fontFamily: T.sansM },
  statsRow:       { flexDirection: "row", gap: 8, marginBottom: 16 },
  statItem:       { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  statLabel:      { color: C.mut, fontSize: 8, fontFamily: T.sansB, letterSpacing: 1.2, marginBottom: 4 },
  statValue:      { color: C.ink, fontSize: 18, fontFamily: T.serifB },
  statNote:       { color: C.mut, fontSize: 9, fontFamily: T.sans, marginTop: 2, textAlign: "center" },
  sectionTitle:   { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.4, marginBottom: 8 },
  timelineCard:   { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line, marginBottom: 12 },
  stepRow:        { flexDirection: "row", gap: 12, minHeight: 50 },
  stepLeft:       { alignItems: "center", width: 16 },
  stepDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: C.gold, marginTop: 4 },
  stepLine:       { flex: 1, width: 1, backgroundColor: C.line, marginTop: 4 },
  stepContent:    { flex: 1, paddingBottom: 16 },
  stepIcon:       { fontSize: 16 },
  stepLabel:      { color: C.ink, fontSize: 13, fontFamily: T.sansM },
  stepDuration:   { color: C.gold, fontSize: 13, fontFamily: T.sansB },
  stepNote:       { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 3 },
  warningCard:    { backgroundColor: "#D4902A12", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#D4902A40", marginBottom: 12 },
  warningTitle:   { color: "#D4902A", fontSize: 14, fontFamily: T.sansB, marginBottom: 4 },
  warningBody:    { color: C.ink, fontSize: 12, fontFamily: T.sans, lineHeight: 18, marginBottom: 10 },
  mapsBtn:        { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#D4902A60" },
  mapsBtnT:       { color: "#D4902A", fontSize: 13, fontFamily: T.sansM },
  askCard:        { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  askT:           { color: C.gold, fontSize: 13, fontFamily: T.sansM },
});
