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
      colors={gradient || [C.card2, C.card]}
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
  const hasDisruptions = data.disruptions_handled > 0;
  const hasValue = data.total_value_saved > 0;

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <BackBar nav={navigation} label={`${YEAR} Wrapped`} />

        {/* Hero */}
        <WrappedCard gradient={["#1A1209", "#2C1F0A"]}>
          <Text style={s.heroEye}>{YEAR} WRAPPED</Text>
          <Text style={s.heroTitle}>Another year{name},{"\n"}protected.</Text>
          <Text style={s.heroSub}>Here’s everything Wingman did for you this year.</Text>
        </WrappedCard>

        {/* Trips + Flights */}
        <View style={s.twoCol}>
          <WrappedCard gradient={[C.card, C.card2]}>
            <Text style={s.bigNum}>{data.total_trips}</Text>
            <Text style={s.bigLabel}>{data.total_trips === 1 ? "Trip" : "Trips"}</Text>
            <Text style={s.bigSub}>protected end-to-end</Text>
          </WrappedCard>
          <WrappedCard gradient={[C.card, C.card2]}>
            <Text style={s.bigNum}>{data.total_flights}</Text>
            <Text style={s.bigLabel}>{data.total_flights === 1 ? "Flight" : "Flights"}</Text>
            <Text style={s.bigSub}>monitored in real time</Text>
          </WrappedCard>
        </View>

        {/* Disruptions handled */}
        {hasDisruptions && (
          <WrappedCard gradient={["rgba(201,169,110,0.08)", "rgba(201,169,110,0.02)"]}>
            <Text style={s.roiEye}>DISRUPTIONS HANDLED</Text>
            <Text style={s.roiNum}>{data.disruptions_handled}</Text>
            <Text style={s.roiSub}>
              {data.disruptions_handled === 1
                ? "Wingman stepped in once so you didn’t have to."
                : `Wingman stepped in ${data.disruptions_handled} times so you didn’t have to.`}
            </Text>
          </WrappedCard>
        )}

        {/* Value saved */}
        {hasValue && (
          <WrappedCard gradient={["rgba(201,169,110,0.14)", "rgba(201,169,110,0.04)"]}>
            <Text style={s.roiEye}>VALUE PROTECTED</Text>
            <Text style={s.roiNum}>${Number(data.total_value_saved).toLocaleString()}</Text>
            <Text style={s.roiSub}>
              In rebooking fees, lounge access, and upgrades Wingman secured for you
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

        {/* Closing card */}
        <WrappedCard gradient={["#1A1209", "#2C1F0A"]}>
          <Text style={s.heroEye}>LOOKING AHEAD</Text>
          <Text style={[s.heroTitle, { fontSize: 26, lineHeight: 34 }]}>
            Every trip in {YEAR + 1},{"\n"}covered.
          </Text>
          <Text style={s.heroSub}>Wingman’s already watching your next flight.</Text>
        </WrappedCard>

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
  heroTitle: { color: C.ink, fontSize: 34, fontFamily: T.serifB, lineHeight: 42, marginBottom: 10 },
  heroSub:   { color: C.mut, fontSize: 15, lineHeight: 22 },

  twoCol: { flexDirection: "row", gap: 14, marginBottom: 0 },

  bigNum:   { color: C.gold, fontSize: 48, fontFamily: T.serifB, lineHeight: 56 },
  bigLabel: { color: C.ink, fontSize: 16, fontFamily: T.sansB, marginTop: 2 },
  bigSub:   { color: C.mut, fontSize: 12, marginTop: 4 },

  roiEye: { color: C.gold, fontSize: 11, fontFamily: T.sansB, letterSpacing: 2, marginBottom: 8 },
  roiNum: { color: C.ink, fontSize: 52, fontFamily: T.serifB, lineHeight: 60, marginBottom: 6 },
  roiSub: { color: C.mut, fontSize: 14, lineHeight: 20 },

  destEye: { color: C.mut, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 8 },
  destSub: { color: C.mut, fontSize: 14, marginTop: 6, lineHeight: 20 },

  shareBtn:     { marginTop: 8, marginBottom: 14, borderRadius: 16, overflow: "hidden" },
  shareBtnGrad: { paddingVertical: 16, alignItems: "center", borderRadius: 16 },
  shareBtnT:    { color: C.inkD, fontSize: 15, fontFamily: T.sansB, letterSpacing: 0.3 },

  footer: { color: C.mut, fontSize: 12, textAlign: "center", marginBottom: 8 },

  emptyIcon: { fontSize: 40, color: C.gold, marginBottom: 16, textAlign: "center" },
  emptyH:    { color: C.ink, fontSize: 20, fontFamily: T.serifB, textAlign: "center", marginBottom: 10 },
  emptySub:  { color: C.mut, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
