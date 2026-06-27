import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
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

export default function InsightsScreen({ navigation }) {
  const [roi, setRoi] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all"); // "30d" | "90d" | "all"

  useEffect(() => {
    Promise.all([
      getInsightsROI().catch(() => null),
      getActivity(20).catch(() => ({ events: [] })),
    ]).then(([roiData, actData]) => {
      setRoi(roiData);
      setEvents(actData?.events || []);
    }).finally(() => setLoading(false));
  }, []);

  const totalSaved = roi?.total_value_saved ?? 0;
  const disruptionsHandled = roi?.disruptions_handled ?? 0;
  const rescueAcceptRate = roi?.rescue_accept_rate ?? null;
  const avgTimeSaved = roi?.avg_time_saved_minutes ?? null;
  const predictionAccuracy = roi?.prediction_accuracy_pct ?? null;

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
        <LinearGradient colors={[C.cardWarm, C.card]} style={s.roiCard}>
          <Text style={s.roiEyebrow}>TOTAL VALUE PROTECTED</Text>
          <Text style={s.roiValue}>
            {totalSaved > 0 ? `$${totalSaved.toLocaleString()}` : "—"}
          </Text>
          <Text style={s.roiSub}>
            {totalSaved > 0
              ? `Across ${disruptionsHandled} disruption${disruptionsHandled !== 1 ? "s" : ""} handled by Wingman`
              : "Complete your first trip to see your ROI"}
          </Text>
        </LinearGradient>

        {/* Period selector */}
        <View style={s.periodRow}>
          {[{ id: "30d", label: "30 days" }, { id: "90d", label: "90 days" }, { id: "all", label: "All time" }].map((p) => (
            <Pressable
              key={p.id}
              style={[s.periodBtn, period === p.id && s.periodBtnOn]}
              onPress={() => { tap(); setPeriod(p.id); }}
            >
              <Text style={[s.periodT, period === p.id && s.periodTOn]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          <StatCard
            value={disruptionsHandled > 0 ? String(disruptionsHandled) : "—"}
            label="Disruptions handled"
            sub="Delays, cancellations, cascades"
          />
          <StatCard
            value={rescueAcceptRate != null ? `${Math.round(rescueAcceptRate * 100)}%` : "—"}
            label="Rescue accept rate"
            sub="Options you approved"
          />
          <StatCard
            value={avgTimeSaved != null ? `${avgTimeSaved}m` : "—"}
            label="Avg. time saved"
            sub="Per disruption resolved"
          />
          <StatCard
            value={predictionAccuracy != null ? `${Math.round(predictionAccuracy)}%` : "—"}
            label="Prediction accuracy"
            sub="Predicted vs. actual delay"
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
  roiEyebrow: { color: C.gold, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 8 },
  roiValue: { color: C.ink, fontSize: 52, fontFamily: "PlayfairDisplay_700Bold", lineHeight: 60, marginBottom: 8 },
  roiSub: { color: C.mut, fontSize: 14, lineHeight: 20 },

  periodRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  periodBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  periodBtnOn: { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.08)" },
  periodT: { color: C.mut, fontSize: 12, fontWeight: "600" },
  periodTOn: { color: C.gold },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, minWidth: "45%", backgroundColor: C.card,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line,
  },
  statValue: { color: C.gold, fontSize: 28, fontFamily: "PlayfairDisplay_700Bold", marginBottom: 4 },
  statLabel: { color: C.ink, fontSize: 13, fontWeight: "700" },
  statSub: { color: C.mut, fontSize: 11, marginTop: 2 },

  learnCard: {
    flexDirection: "row", gap: 14, padding: 18,
    backgroundColor: "rgba(201,169,110,0.06)", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", marginBottom: 24,
  },
  learnIcon: { fontSize: 22, color: C.gold, marginTop: 2 },
  learnTitle: { color: C.gold, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  learnBody: { color: C.mut, fontSize: 13, lineHeight: 19 },

  outcomeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  outcomeIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(201,169,110,0.08)", alignItems: "center", justifyContent: "center" },
  outcomeIconT: { fontSize: 14, color: C.gold },
  outcomeTitle: { color: C.ink, fontSize: 14, fontWeight: "600" },
  outcomeDetail: { color: C.mut, fontSize: 12, marginTop: 2 },
  outcomeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  outcomeBadgeT: { fontSize: 11, fontWeight: "700" },
  outcomeTime: { color: C.mut, fontSize: 11, marginTop: 4 },

  empty: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 36, color: C.gold, marginBottom: 16 },
  emptyH: { color: C.ink, fontSize: 18, fontFamily: "PlayfairDisplay_700Bold", textAlign: "center", marginBottom: 10 },
  emptySub: { color: C.mut, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
