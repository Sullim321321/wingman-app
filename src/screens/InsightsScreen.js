import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { C, T } from "../theme";
import { BackBar, g, tap } from "../components";
import { getInsightsROI, getActivity } from "../api";

function StatCard({ value, label, sub }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

function OutcomeRow({ icon, title, detail, outcome, time }) {
  const outcomeColor = outcome === "saved" ? C.gold : outcome === "missed" ? "#C97B6E" : C.mut;
  const outcomeLabel = outcome === "saved" ? "Saved" : outcome === "missed" ? "Missed" : "Pending";
  return (
    <View style={s.outcomeRow}>
      <View style={s.outcomeIcon}>
        <Text style={s.outcomeIconT}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.outcomeTitle}>{title}</Text>
        <Text style={s.outcomeDetail}>{detail}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <View style={[s.outcomeBadge, { borderColor: outcomeColor + "40", backgroundColor: outcomeColor + "12" }]}>
          <Text style={[s.outcomeBadgeT, { color: outcomeColor }]}>{outcomeLabel}</Text>
        </View>
        {time ? <Text style={s.outcomeTime}>{time}</Text> : null}
      </View>
    </View>
  );
}

const YEAR = new Date().getFullYear();

export default function InsightsScreen({ navigation }) {
  const [roi, setRoi] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");

  const fetchData = useCallback((p) => {
    setLoading(true);
    Promise.all([
      getInsightsROI(p).catch(() => null),
      getActivity(20).catch(() => ({ events: [] })),
    ]).then(([roiData, actData]) => {
      setRoi(roiData);
      setEvents(actData?.events || []);
    }).finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { fetchData(period); }, []));

  const handlePeriod = (p) => {
    tap();
    setPeriod(p);
    fetchData(p);
  };

  const totalSaved        = roi?.total_value_saved ?? 0;
  const disruptionsHandled = roi?.disruptions_handled ?? 0;
  const rescueAcceptRate  = roi?.rescue_accept_rate ?? null;
  const avgTimeSaved      = roi?.avg_time_saved_minutes ?? null;
  const tripsTotal        = roi?.trips_total ?? 0;
  const bestRescueValue   = roi?.best_rescue_value ?? null;
  const bestRescueFlight  = roi?.best_rescue_flight ?? null;

  const handleShare = async () => {
    try {
      await Share.share({
        message: totalSaved > 0
          ? `Wingman has protected $${totalSaved.toLocaleString()} across ${disruptionsHandled} disruption${disruptionsHandled !== 1 ? "s" : ""} on my trips. Best rescue: $${bestRescueValue}${bestRescueFlight ? ` on ${bestRescueFlight}` : ""}. Try Wingman — wingmantravel.app`
          : `I use Wingman to protect my travel. ${tripsTotal} trips and counting — wingmantravel.app`,
      });
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={s.app}>
        <BackBar nav={navigation} label="Insights" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.gold} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Insights" />

        {/* Hero ROI card */}
        <LinearGradient colors={[C.card2, C.card]} style={s.roiCard}>
          <Text style={s.roiEyebrow}>TOTAL VALUE PROTECTED</Text>
          <Text style={s.roiValue}>
            {totalSaved > 0 ? `$${totalSaved.toLocaleString()}` : "—"}
          </Text>
          <Text style={s.roiSub}>
            {totalSaved > 0
              ? `Across ${disruptionsHandled} disruption${disruptionsHandled !== 1 ? "s" : ""} handled by Wingman`
              : "Complete your first trip to see your ROI"}
          </Text>
          {totalSaved > 0 && (
            <Pressable style={s.shareBtn} onPress={handleShare}>
              <Text style={s.shareBtnT}>Share ↗</Text>
            </Pressable>
          )}
        </LinearGradient>

        {/* Period selector */}
        <View style={s.periodRow}>
          {[{ id: "30d", label: "30 days" }, { id: "90d", label: "90 days" }, { id: "all", label: "All time" }].map((p) => (
            <Pressable
              key={p.id}
              style={[s.periodBtn, period === p.id && s.periodBtnOn]}
              onPress={() => handlePeriod(p.id)}
            >
              <Text style={[s.periodT, period === p.id && s.periodTOn]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Streak + Best rescue cards */}
        {(tripsTotal > 0 || bestRescueValue) && (
          <View style={s.streakRow}>
            {tripsTotal > 0 && (
              <View style={s.streakCard}>
                <Text style={s.streakValue}>{tripsTotal}</Text>
                <Text style={s.streakLabel}>Trips protected</Text>
                <Text style={s.streakSub}>Total with Wingman</Text>
              </View>
            )}
            {bestRescueValue && (
              <View style={[s.streakCard, { borderColor: "rgba(201,169,110,0.35)" }]}>
                <Text style={s.streakValue}>${Number(bestRescueValue).toLocaleString()}</Text>
                <Text style={s.streakLabel}>Best rescue</Text>
                <Text style={s.streakSub}>{bestRescueFlight || "Personal record"}</Text>
              </View>
            )}
          </View>
        )}

        {/* Stats grid */}
        <View style={s.statsGrid}>
          <StatCard
            value={disruptionsHandled > 0 ? String(disruptionsHandled) : "—"}
            label="Disruptions handled"
            sub="Delays, cancellations, cascades"
          />
          <StatCard
            value={rescueAcceptRate != null ? `${rescueAcceptRate}%` : "—"}
            label="Rescue accept rate"
            sub="Options you approved"
          />
          <StatCard
            value={avgTimeSaved != null ? `${avgTimeSaved}m` : "—"}
            label="Avg. time saved"
            sub="Per disruption resolved"
          />
          <StatCard
            value="—"
            label="Prediction accuracy"
            sub="Builds with each trip"
          />
        </View>

        {/* Learning loop callout */}
        <View style={s.learnCard}>
          <Text style={s.learnIcon}>◈</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.learnTitle}>Compound the moat</Text>
            <Text style={s.learnBody}>
              Every predicted vs. actual outcome feeds Wingman's model — compounding accuracy over time. The more you travel, the smarter it gets.
            </Text>
          </View>
        </View>

        {/* Recent outcomes */}
        {events.length > 0 && (
          <View>
            <Text style={g.sectionT}>RECENT OUTCOMES</Text>
            <View style={g.group}>
              {events.slice(0, 8).map((ev, i) => (
                <OutcomeRow
                  key={ev.id || i}
                  icon={ev.type === "disruption" ? "◎" : ev.type === "booking" ? "◆" : "◇"}
                  title={ev.title || ev.event_type || "Event"}
                  detail={ev.body || ev.trip_title || ""}
                  outcome={ev.outcome || "pending"}
                  time={ev.created_at ? new Date(ev.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null}
                />
              ))}
            </View>
          </View>
        )}

        {/* Wingman Wrapped entry */}
        <Pressable style={s.wrappedCard} onPress={() => navigation.navigate("Wrapped")}>
          <LinearGradient colors={["#1A1209", "#2C1F0A"]} style={s.wrappedGrad}>
            <Text style={s.wrappedEye}>{YEAR} WRAPPED</Text>
            <Text style={s.wrappedTitle}>Your year in travel ›</Text>
            <Text style={s.wrappedSub}>Trips, flights, value protected — all in one place.</Text>
          </LinearGradient>
        </Pressable>

        {/* Empty state */}
        {events.length === 0 && totalSaved === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>◎</Text>
            <Text style={s.emptyH}>Your ROI dashboard will appear here</Text>
            <Text style={s.emptySub}>
              Once Wingman handles its first disruption, you will see exactly how much time and money it saved you.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  roiCard: { borderRadius: 20, padding: 28, borderWidth: 1, borderColor: C.line, marginBottom: 20 },
  roiEyebrow: { color: C.gold, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 8 },
  roiValue: { color: C.ink, fontSize: 52, fontFamily: "PlayfairDisplay_700Bold", lineHeight: 60, marginBottom: 8 },
  roiSub: { color: C.mut, fontSize: 14, lineHeight: 20 },
  shareBtn: { marginTop: 16, alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: C.gold + "50", backgroundColor: C.gold + "12" },
  shareBtnT: { color: C.gold, fontSize: 12, fontFamily: T.sansB, letterSpacing: 0.5 },

  periodRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  periodBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  periodBtnOn: { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.08)" },
  periodT: { color: C.mut, fontSize: 12, fontFamily: T.sansB },
  periodTOn: { color: C.gold },

  streakRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  streakCard: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line },
  streakValue: { color: C.gold, fontSize: 28, fontFamily: "PlayfairDisplay_700Bold", marginBottom: 4 },
  streakLabel: { color: C.ink, fontSize: 13, fontFamily: T.sansB },
  streakSub: { color: C.mut, fontSize: 11, marginTop: 2 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, minWidth: "45%", backgroundColor: C.card,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line,
  },
  statValue: { color: C.gold, fontSize: 28, fontFamily: "PlayfairDisplay_700Bold", marginBottom: 4 },
  statLabel: { color: C.ink, fontSize: 13, fontFamily: T.sansB },
  statSub: { color: C.mut, fontSize: 11, marginTop: 2 },

  learnCard: {
    flexDirection: "row", gap: 14, padding: 18,
    backgroundColor: "rgba(201,169,110,0.06)", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", marginBottom: 24,
  },
  learnIcon: { fontSize: 22, color: C.gold, marginTop: 2 },
  learnTitle: { color: C.gold, fontSize: 14, fontFamily: T.sansB, marginBottom: 4 },
  learnBody: { color: C.mut, fontSize: 13, lineHeight: 19 },

  outcomeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  outcomeIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(201,169,110,0.08)", alignItems: "center", justifyContent: "center" },
  outcomeIconT: { fontSize: 14, color: C.gold },
  outcomeTitle: { color: C.ink, fontSize: 14, fontFamily: T.sansB },
  outcomeDetail: { color: C.mut, fontSize: 12, marginTop: 2 },
  outcomeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  outcomeBadgeT: { fontSize: 11, fontFamily: T.sansB },
  outcomeTime: { color: C.mut, fontSize: 11, marginTop: 4 },

  wrappedCard: { borderRadius: 20, overflow: "hidden", marginBottom: 14 },
  wrappedGrad:  { padding: 24, borderRadius: 20, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)" },
  wrappedEye:   { color: C.gold, fontSize: 11, fontFamily: T.sansB, letterSpacing: 2, marginBottom: 8 },
  wrappedTitle: { color: C.ink, fontSize: 22, fontFamily: "PlayfairDisplay_700Bold", marginBottom: 6 },
  wrappedSub:   { color: C.mut, fontSize: 13, lineHeight: 19 },

  empty: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 36, color: C.gold, marginBottom: 16 },
  emptyH: { color: C.ink, fontSize: 18, fontFamily: "PlayfairDisplay_700Bold", textAlign: "center", marginBottom: 10 },
  emptySub: { color: C.mut, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
