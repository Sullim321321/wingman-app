// WingmanWrappedScreen — Annual travel stats summary
// Inspired by Spotify Wrapped — full-screen story-style cards

import React, { useState, useEffect } from "react";
import {
  SafeAreaView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, Share, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, T } from "../theme";
import { BackBar } from "../components";
import { getWrapped } from "../api";

const YEAR = new Date().getFullYear();

function WrappedCard({ children, gradient }) {
  return (
    <LinearGradient
      colors={gradient || [C.cardWarm, C.card]}
      style={s.card}
    >
      {children}
    </LinearGradient>
  );
}

export default function WingmanWrappedScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getWrapped(YEAR)
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleShare = async () => {
    if (!data) return;
    const lines = [
      `My ${YEAR} Wingman Wrapped ✈`,
      `${data.total_trips} trips protected`,
      `${data.total_flights} flights`,
      data.total_value_saved > 0 ? `$${Number(data.total_value_saved).toLocaleString()} saved from disruptions` : null,
      data.most_visited_airport ? `Most visited: ${data.most_visited_airport}` : null,
      data.unique_destinations > 0 ? `${data.unique_destinations} unique destinations` : null,
      `wingmantravel.app`,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join("\n") });
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={s.app}>
        <BackBar nav={navigation} label="Wrapped" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={s.app}>
        <BackBar nav={navigation} label="Wrapped" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={s.emptyIcon}>◎</Text>
          <Text style={s.emptyH}>Not enough data yet</Text>
          <Text style={s.emptySub}>Complete a trip with Wingman to unlock your {YEAR} Wrapped.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const name = data.first_name ? `, ${data.first_name}` : "";

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <BackBar nav={navigation} label={`${YEAR} Wrapped`} />

        {/* Hero */}
        <WrappedCard gradient={["#1A1209", "#2C1F0A"]}>
          <Text style={s.heroEye}>{YEAR} WRAPPED</Text>
          <Text style={s.heroTitle}>Another year{name},{"\n"}protected.</Text>
          <Text style={s.heroSub}>Here's what Wingman did for you this year.</Text>
        </WrappedCard>

        {/* Trips + Flights */}
        <View style={s.twoCol}>
          <WrappedCard gradient={[C.card, C.card2]}>
            <Text style={s.bigNum}>{data.total_trips}</Text>
            <Text style={s.bigLabel}>Trips</Text>
            <Text style={s.bigSub}>protected by Wingman</Text>
          </WrappedCard>
          <WrappedCard gradient={[C.card, C.card2]}>
            <Text style={s.bigNum}>{data.total_flights}</Text>
            <Text style={s.bigLabel}>Flights</Text>
            <Text style={s.bigSub}>monitored in real time</Text>
          </WrappedCard>
        </View>

        {/* Value saved */}
        {data.total_value_saved > 0 && (
          <WrappedCard gradient={["rgba(201,169,110,0.12)", "rgba(201,169,110,0.04)"]}>
            <Text style={s.roiEye}>VALUE PROTECTED</Text>
            <Text style={s.roiNum}>${Number(data.total_value_saved).toLocaleString()}</Text>
            <Text style={s.roiSub}>
              Across {data.disruptions_handled} disruption{data.disruptions_handled !== 1 ? "s" : ""} Wingman handled for you
            </Text>
          </WrappedCard>
        )}

        {/* Destinations */}
        {data.unique_destinations > 0 && (
          <WrappedCard gradient={[C.card, C.card2]}>
            <Text style={s.destEye}>DESTINATIONS VISITED</Text>
            <Text style={s.bigNum}>{data.unique_destinations}</Text>
            {data.most_visited_airport && (
              <Text style={s.destSub}>
                Most visited airport: <Text style={{ color: C.gold }}>{data.most_visited_airport}</Text>
              </Text>
            )}
            {data.most_used_airline && (
              <Text style={s.destSub}>
                Most flown airline: <Text style={{ color: C.gold }}>{data.most_used_airline}</Text>
              </Text>
            )}
          </WrappedCard>
        )}

        {/* Share CTA */}
        <Pressable style={s.shareBtn} onPress={handleShare}>
          <LinearGradient colors={[C.gold, C.goldD]} style={s.shareBtnGrad}>
            <Text style={s.shareBtnT}>Share my {YEAR} Wrapped ↗</Text>
          </LinearGradient>
        </Pressable>

        <Text style={s.footer}>Wingman · wingmantravel.app</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:    { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  card: { borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.line, marginBottom: 14 },

  heroEye:   { color: C.gold, fontSize: 11, fontFamily: T.sansB, letterSpacing: 2, marginBottom: 12 },
  heroTitle: { color: C.ink, fontSize: 34, fontFamily: "PlayfairDisplay_700Bold", lineHeight: 42, marginBottom: 10 },
  heroSub:   { color: C.mut, fontSize: 15, lineHeight: 22 },

  twoCol: { flexDirection: "row", gap: 14, marginBottom: 0 },

  bigNum:   { color: C.gold, fontSize: 48, fontFamily: "PlayfairDisplay_700Bold", lineHeight: 56 },
  bigLabel: { color: C.ink, fontSize: 16, fontFamily: T.sansB, marginTop: 2 },
  bigSub:   { color: C.mut, fontSize: 12, marginTop: 4 },

  roiEye: { color: C.gold, fontSize: 11, fontFamily: T.sansB, letterSpacing: 2, marginBottom: 8 },
  roiNum: { color: C.ink, fontSize: 52, fontFamily: "PlayfairDisplay_700Bold", lineHeight: 60, marginBottom: 6 },
  roiSub: { color: C.mut, fontSize: 14, lineHeight: 20 },

  destEye: { color: C.mut, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 8 },
  destSub: { color: C.mut, fontSize: 14, marginTop: 6, lineHeight: 20 },

  shareBtn:     { marginTop: 8, marginBottom: 14, borderRadius: 16, overflow: "hidden" },
  shareBtnGrad: { paddingVertical: 16, alignItems: "center", borderRadius: 16 },
  shareBtnT:    { color: C.inkD, fontSize: 15, fontFamily: T.sansB, letterSpacing: 0.3 },

  footer: { color: C.mut, fontSize: 12, textAlign: "center", marginBottom: 8 },

  emptyIcon: { fontSize: 40, color: C.gold, marginBottom: 16, textAlign: "center" },
  emptyH:    { color: C.ink, fontSize: 20, fontFamily: "PlayfairDisplay_700Bold", textAlign: "center", marginBottom: 10 },
  emptySub:  { color: C.mut, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
