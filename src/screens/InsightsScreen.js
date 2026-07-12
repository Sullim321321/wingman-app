import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { C, T, SHADOW, litEdge } from "../theme";
import { BackBar, g, tap, FadeRise } from "../components";
import { ShareCardModal } from "../components/ShareCard";
import { getInsightsROI, getActivity, getInsightsHistory } from "../api";

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
  const outcomeColor = outcome === "saved" ? C.gold : outcome === "handled" ? C.teal : outcome === "missed" ? "#C97B6E" : C.mut;
  const outcomeLabel = outcome === "saved" ? "Saved" : outcome === "handled" ? "Handled" : outcome === "missed" ? "Missed" : "Pending";
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

// Editorial comparison bar (Design #5): you vs. an industry/unmanaged baseline,
// both drawn to scale so the gap is visible at a glance.
function CompareBar({ label, you, industry, fmt, betterLow }) {
  if (you == null) return null;
  const max = Math.max(you, industry, 1);
  const better = betterLow ? you <= industry : you >= industry;
  const youColor = better ? C.confirmed : C.attentionM;
  return (
    <View style={s.cmpRow}>
      <Text style={s.cmpLabel}>{label}</Text>
      <View style={s.cmpTrack}>
        <View style={[s.cmpFill, { width: `${Math.max((you / max) * 100, 2)}%`, backgroundColor: youColor }]} />
        <Text style={s.cmpVal}>You · {fmt(you)}</Text>
      </View>
      <View style={s.cmpTrack}>
        <View style={[s.cmpFill, { width: `${Math.max((industry / max) * 100, 1)}%`, backgroundColor: C.card2 }]} />
        <Text style={s.cmpValMut}>Industry · {fmt(industry)}</Text>
      </View>
    </View>
  );
}

// "Recent outcomes" should show actual outcomes — a disruption handled, a rescue
// accepted — not passive imports (which belong in Signals). These are the event
// types that represent an outcome, plus a mapper to a resolved/pending label.
const OUTCOME_TYPES = new Set(["rebook", "recovery", "disruption", "delay", "weather", "cancellation"]);
function deriveOutcome(ev) {
  if (ev.outcome) return ev.outcome;
  if (ev.type === "rebook" || (ev.metadata && (ev.metadata.value_saved > 0 || ev.metadata.rescue_accepted))) return "saved";
  if (ev.type === "recovery") return "handled";
  return "pending";
}

const YEAR = new Date().getFullYear();

export default function InsightsScreen({ navigation }) {
  const [roi, setRoi] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [showShare, setShowShare] = useState(false);
  const [history, setHistory] = useState([]);

  const fetchData = useCallback((p) => {
    setLoading(true);
    Promise.all([
      getInsightsROI(p).catch(() => null),
      getActivity(20).catch(() => ({ events: [] })),
      getInsightsHistory(12).catch(() => null),
    ]).then(([roiData, actData, histData]) => {
      setRoi(roiData);
      setEvents(actData?.events || []);
      setHistory(histData?.series || []);
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
  // Derive the raw count from the rate, so we can show "1 of 1" instead of a
  // meaningless "100%" when the sample is tiny. The server only sends the rate.
  const rescuesAccepted = (rescueAcceptRate != null && disruptionsHandled > 0)
    ? Math.round((rescueAcceptRate / 100) * disruptionsHandled)
    : null;
  const bestRescueValue   = roi?.best_rescue_value ?? null;
  const bestRescueFlight  = roi?.best_rescue_flight ?? null;
  const protectedSince    = roi?.protected_since ?? null;

  // Format protected_since as "Jan 2025"
  const protectedSinceStr = protectedSince
    ? new Date(protectedSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;

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
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <View style={{ height: 150, borderRadius: 16, backgroundColor: C.card2, marginBottom: 18 }} />
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 18 }}>
            <View style={{ flex: 1, height: 92, borderRadius: 14, backgroundColor: C.card2 }} />
            <View style={{ flex: 1, height: 92, borderRadius: 14, backgroundColor: C.card2 }} />
          </View>
          <View style={{ width: "40%", height: 12, borderRadius: 4, backgroundColor: C.card2, marginBottom: 16 }} />
          {[0, 1, 2].map(i => (
            <View key={i} style={{ height: 64, borderRadius: 12, backgroundColor: C.card, marginBottom: 12 }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={[g.scroll, { paddingBottom: 140 }]}>
        <BackBar nav={navigation} label="Insights" />

        {/* Hero ROI card — warm gold-tinted gradient, editorial serif value */}
        <FadeRise>
        <LinearGradient colors={["rgba(201,169,110,0.16)", "rgba(201,169,110,0.04)"]} style={s.roiCard}>
          <View style={s.roiEyebrowRow}>
            <Text style={s.roiEyebrow}>TOTAL VALUE PROTECTED</Text>
            <Text style={s.roiYear}>{YEAR}</Text>
          </View>
          {totalSaved > 0 ? (
            <Text style={s.roiValue}>${totalSaved.toLocaleString()}</Text>
          ) : (
            <Text style={s.roiValueEmpty}>All clear.</Text>
          )}
          <Text style={s.roiSub}>
            {totalSaved > 0
              ? `Across ${disruptionsHandled} disruption${disruptionsHandled !== 1 ? "s" : ""} handled by Wingman`
              : "Nothing's gone wrong on your watch yet. The moment it does, I'll handle it — and the value I protect will show here."}
          </Text>
          {totalSaved > 0 && (
            <Pressable style={s.shareBtn} onPress={() => { tap(); setShowShare(true); }}>
              <Text style={s.shareBtnT}>Share your ROI  ↗</Text>
            </Pressable>
          )}
        </LinearGradient>
        </FadeRise>

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
                {/* Was "Trips protected". They weren't protected — they were read out
                    of an inbox. Wingman has handled exactly one disruption. Claiming
                    46 trips were "protected" is the app flattering itself, and the
                    moment a user notices, they stop believing the numbers that ARE
                    true. "Tracked" is what actually happened. */}
                <Text style={s.streakLabel}>Trips tracked</Text>
                <Text style={s.streakSub}>{protectedSinceStr ? `Since ${protectedSinceStr}` : "Total with Wingman"}</Text>
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

        {/* ── Stats grid ─────────────────────────────────────────────────────────
            A percentage computed from ONE data point is not a statistic, it's a
            coincidence. "100% rescue accept rate" from a single accepted option
            reads like a boast and tells you nothing — and once a reader clocks
            that, they discount every other number on the screen.

            So: below three disruptions, we show the raw count instead of a rate.
            "1 of 1" is honest and still says something. And the empty "Prediction
            accuracy —" card is gone: a card with no value in it is furniture. */}
        <View style={s.statsGrid}>
          <StatCard
            value={disruptionsHandled > 0 ? String(disruptionsHandled) : "—"}
            label="Disruptions handled"
            sub="Delays, cancellations, cascades"
          />
          {disruptionsHandled >= 3 ? (
            <StatCard
              value={rescueAcceptRate != null ? `${rescueAcceptRate}%` : "—"}
              label="Rescue accept rate"
              sub="Options you approved"
            />
          ) : (
            <StatCard
              value={rescuesAccepted != null && disruptionsHandled > 0
                ? `${rescuesAccepted}/${disruptionsHandled}`
                : "—"}
              label="Rescues accepted"
              sub={disruptionsHandled > 0 ? "Too few for a rate yet" : "Nothing to rescue yet"}
            />
          )}
          <StatCard
            value={avgTimeSaved != null ? `${avgTimeSaved}m` : "—"}
            label="Avg. time saved"
            sub="Per disruption resolved"
          />
        </View>

        {/* Value protected over time (Roadmap 2, Design #10) */}
        {history.some(h => h.value > 0) ? (() => {
          const max = Math.max(...history.map(h => h.value), 1);
          const best = history.reduce((a, b) => (b.value > a.value ? b : a), history[0]);
          return (
            <FadeRise style={s.trendCard}>
              <Text style={s.trendTitle}>VALUE PROTECTED · LAST 12 MONTHS</Text>
              <View style={s.trendChart}>
                {history.map((h, i) => (
                  <View key={h.month} style={s.trendCol}>
                    <View style={s.trendBarWrap}>
                      <View
                        style={[
                          s.trendBar,
                          { height: `${Math.max((h.value / max) * 100, h.value > 0 ? 6 : 1.5)}%` },
                          h.value === 0 && s.trendBarEmpty,
                          h.month === best.month && h.value > 0 && s.trendBarBest,
                        ]}
                      />
                    </View>
                    <Text style={[s.trendLabel, i % 2 !== 0 && { opacity: 0 }]}>{h.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.trendFoot}>
                Best month: {best.label} — ${best.value.toLocaleString()} protected
                {best.rescues > 0 ? ` across ${best.rescues} rescue${best.rescues !== 1 ? "s" : ""}` : ""}.
              </Text>
            </FadeRise>
          );
        })() : null}

        {/* Benchmark comparison — editorial bars (Design #5) */}
        {(disruptionsHandled > 0 || totalSaved > 0) && (
          <FadeRise style={s.benchCard}>
            <Text style={s.benchTitle}>HOW YOU COMPARE</Text>
            <CompareBar
              label="Value recovered per disruption"
              you={totalSaved > 0 ? Math.round(totalSaved / Math.max(disruptionsHandled, 1)) : null}
              industry={0}
              betterLow={false}
              fmt={(v) => `$${v.toLocaleString()}`}
            />
            <CompareBar
              label="Time saved per disruption"
              you={avgTimeSaved != null ? avgTimeSaved : null}
              industry={0}
              betterLow={false}
              fmt={(v) => `${v}m`}
            />
            <CompareBar
              label="Rescue accept rate"
              you={rescueAcceptRate != null ? rescueAcceptRate : null}
              industry={38}
              betterLow={false}
              fmt={(v) => `${v}%`}
            />
            <Text style={s.benchFoot}>Baseline: an unmanaged traveler recovers nothing and rebooks by hand.</Text>
          </FadeRise>
        )}

        {/* Learning loop callout */}
        <View style={s.learnCard}>
          <Text style={s.learnIcon}>◈</Text>
          <View style={{ flex: 1 }}>
            {/* Was "Compound the moat" — investor-deck language, in a product, aimed
                at someone who just wants their flight sorted. Nobody using a travel
                app is thinking about moats. Say the thing plainly instead. */}
            <Text style={s.learnTitle}>It gets better as you travel</Text>
            <Text style={s.learnBody}>
              Every time Wingman predicts something and you tell it what actually happened, it gets sharper — about your airports, your airlines, your tolerance for a tight connection.
            </Text>
          </View>
        </View>

        {/* New user motivational empty state */}
        {tripsTotal === 0 && disruptionsHandled === 0 && events.length === 0 && (
          <View style={s.newUserCard}>
            <Text style={s.newUserHed}>Your travel ROI starts here.</Text>
            <Text style={s.newUserBody}>
              Once Wingman handles its first disruption on your behalf, your savings, time recovered, and rescue rate will appear here — compounding with every trip.
            </Text>
            <Pressable style={s.newUserBtn} onPress={() => { tap(); navigation.navigate("AddTrip"); }}>
              <Text style={s.newUserBtnT}>Add your first trip  →</Text>
            </Pressable>
          </View>
        )}

        {/* Recent outcomes — real outcomes only (imports live in Signals) */}
        {(() => {
          const outcomeEvents = events.filter(e => OUTCOME_TYPES.has(e.type) || e.outcome);
          if (outcomeEvents.length === 0) return null;
          return (
            <View>
              <Text style={g.sectionT}>RECENT OUTCOMES</Text>
              <View style={g.group}>
                {outcomeEvents.slice(0, 8).map((ev, i) => (
                  <OutcomeRow
                    key={ev.id || i}
                    icon={ev.type === "disruption" ? "◎" : ev.type === "booking" ? "◆" : "◇"}
                    title={ev.title || ev.event_type || "Event"}
                    detail={ev.body || ev.trip_title || ""}
                    outcome={deriveOutcome(ev)}
                    time={ev.created_at ? new Date(ev.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null}
                  />
                ))}
              </View>
            </View>
          );
        })()}

        {/* Wingman Wrapped entry */}
        <Pressable style={s.wrappedCard} onPress={() => { tap(); navigation.navigate("Wrapped"); }}>
          <LinearGradient colors={["#241808", "#1A1209"]} style={s.wrappedGrad}>
            <Text style={s.wrappedEye}>{YEAR} WRAPPED</Text>
            <Text style={s.wrappedTitle}>Your year in travel</Text>
            <Text style={s.wrappedSub}>Every trip, flight, and disruption handled — all in one place.</Text>
            <Text style={s.wrappedCta}>View →</Text>
          </LinearGradient>
        </Pressable>

        {/* Empty state */}
        {events.length === 0 && totalSaved === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>◈</Text>
            <Text style={s.emptyH}>Nothing to report yet.</Text>
            <Text style={s.emptySub}>
              Add a trip and Wingman begins monitoring immediately. The moment it handles a disruption, your ROI appears here.
            </Text>
          </View>
        )}
      </ScrollView>

      <ShareCardModal
        visible={showShare}
        onClose={() => setShowShare(false)}
        variant="roi"
        data={{ totalSaved, disruptions: disruptionsHandled }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  roiCard: { borderRadius: 20, padding: 28, borderWidth: 1, borderColor: C.gold + "4D", marginBottom: 20 },
  roiEyebrowRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  roiEyebrow: { color: C.gold, fontSize: 11, fontFamily: T.sansB, letterSpacing: 2.5 },
  roiYear: { color: C.mut, fontSize: 11, fontFamily: T.sansM, letterSpacing: 0.5 },
  roiValue: { color: C.ink, fontSize: 56, fontFamily: T.serifB, lineHeight: 64, marginBottom: 8 },
  roiValueEmpty: { color: C.ink, fontSize: 40, fontFamily: T.garamondSI, lineHeight: 46, marginBottom: 8, opacity: 0.9 },
  roiSub: { color: C.mut, fontSize: 14, lineHeight: 20 },
  shareBtn: { marginTop: 18, alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: C.gold + "50", backgroundColor: C.gold + "12" },
  shareBtnT: { color: C.gold, fontSize: 12, fontFamily: T.sansB, letterSpacing: 0.5 },

  periodRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  periodBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  periodBtnOn: { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.08)" },
  periodT: { color: C.mut, fontSize: 12, fontFamily: T.sansB },
  periodTOn: { color: C.gold },

  streakRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  streakCard: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", ...litEdge, ...SHADOW.soft },
  streakValue: { color: C.gold, fontSize: 28, fontFamily: T.serifB, marginBottom: 4 },
  streakLabel: { color: C.ink, fontSize: 13, fontFamily: T.sansB },
  streakSub: { color: C.mut, fontSize: 11, marginTop: 2 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, minWidth: "45%", backgroundColor: C.card,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(201,169,110,0.18)",
  },
  statValue: { color: C.gold, fontSize: 28, fontFamily: T.serifB, marginBottom: 4 },
  statLabel: { color: C.ink, fontSize: 13, fontFamily: T.sansB },
  statSub: { color: C.mut, fontSize: 11, marginTop: 2 },

  learnCard: {
    flexDirection: "row", gap: 14, padding: 18,
    backgroundColor: "rgba(201,169,110,0.06)", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", marginBottom: 24,
    ...litEdge, ...SHADOW.soft,
  },
  learnIcon: { fontSize: 22, color: C.gold, marginTop: 2 },
  learnTitle: { color: C.gold, fontSize: 14, fontFamily: T.sansB, marginBottom: 4 },
  learnBody: { color: C.mut, fontSize: 13, lineHeight: 19 },

  newUserCard: { backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(201,169,110,0.15)", borderRadius: 16, padding: 22, marginBottom: 16 },
  newUserHed:  { fontFamily: T.garamondI, fontSize: 22, color: C.ink, marginBottom: 10, lineHeight: 28 },
  newUserBody: { fontFamily: T.sans, fontSize: 14, color: C.mut, lineHeight: 21, marginBottom: 18 },
  newUserBtn:  { backgroundColor: "rgba(201,169,110,0.12)", borderWidth: 1, borderColor: "rgba(201,169,110,0.3)", borderRadius: 24, paddingVertical: 12, paddingHorizontal: 20, alignSelf: "flex-start" },
  newUserBtnT: { fontFamily: T.sansM, fontSize: 14, color: C.gold },

  outcomeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  outcomeIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(201,169,110,0.08)", alignItems: "center", justifyContent: "center" },
  outcomeIconT: { fontSize: 14, color: C.gold },
  outcomeTitle: { color: C.ink, fontSize: 14, fontFamily: T.sansB },
  outcomeDetail: { color: C.mut, fontSize: 12, marginTop: 2 },
  outcomeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  outcomeBadgeT: { fontSize: 11, fontFamily: T.sansB },
  outcomeTime: { color: C.mut, fontSize: 11, marginTop: 4 },

  wrappedCard: { borderRadius: 20, overflow: "hidden", marginBottom: 14 },
  wrappedGrad:  { padding: 24, borderRadius: 20, borderWidth: 1, borderColor: C.gold + "40", backgroundColor: C.card },
  wrappedEye:   { color: C.gold, fontSize: 11, fontFamily: T.sansB, letterSpacing: 2.5, marginBottom: 10 },
  wrappedTitle: { color: C.ink, fontSize: 24, fontFamily: T.serifB, marginBottom: 6, letterSpacing: -0.3 },
  wrappedSub:   { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  wrappedCta:   { color: C.gold, fontSize: 13, fontFamily: T.sansM, letterSpacing: 0.3 },

  empty: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 36, color: C.gold, marginBottom: 16 },
  emptyH: { color: C.ink, fontSize: 18, fontFamily: T.serifB, textAlign: "center", marginBottom: 10 },
  emptySub: { color: C.mut, fontSize: 14, lineHeight: 21, textAlign: "center" },
  // Benchmark card
  benchCard:      { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, overflow: "hidden", marginBottom: 20, ...litEdge },
  benchTitle:     { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.5, padding: 16, paddingBottom: 10 },
  benchRow:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  benchLabel:     { color: C.ink, fontSize: 13, fontFamily: T.sansM, marginBottom: 2 },
  benchBenchmark: { color: C.mut, fontSize: 11, fontFamily: T.sans },
  benchBadge:     { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  benchBadgeT:    { fontSize: 12, fontFamily: T.sansB },
  benchNA:        { color: C.mut, fontSize: 13, fontFamily: T.sans },
  benchFoot:      { color: C.mut, fontSize: 11, fontFamily: T.sans, lineHeight: 16, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  // ── Value-protected trend (Roadmap 2) ──
  trendCard: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line,
    padding: 18, marginBottom: 20, ...litEdge, ...SHADOW.soft,
  },
  trendTitle: { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 16 },
  trendChart: { flexDirection: "row", alignItems: "flex-end", height: 110, gap: 5 },
  trendCol: { flex: 1, alignItems: "center" },
  trendBarWrap: { width: "100%", height: 90, justifyContent: "flex-end" },
  trendBar: { width: "100%", borderRadius: 3, backgroundColor: C.gold, opacity: 0.55 },
  trendBarBest: { opacity: 1 },
  trendBarEmpty: { backgroundColor: C.card2, opacity: 1 },
  trendLabel: { color: C.mut, fontSize: 9, fontFamily: T.sansM, marginTop: 6 },
  trendFoot: { color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 18, marginTop: 14 },
  // ── Comparison bars (Design #5) ──
  cmpRow:         { paddingHorizontal: 16, paddingVertical: 10 },
  cmpLabel:       { color: C.ink, fontSize: 13, fontFamily: T.sansM, marginBottom: 4 },
  cmpTrack:       { height: 24, borderRadius: 6, backgroundColor: C.bg, overflow: "hidden", justifyContent: "center", marginTop: 6 },
  cmpFill:        { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6 },
  cmpVal:         { color: C.ink, fontSize: 11, fontFamily: T.sansB, paddingHorizontal: 10 },
  cmpValMut:      { color: C.mut, fontSize: 11, fontFamily: T.sansM, paddingHorizontal: 10 },
});
