// DecisionsScreen — the unified decision inbox (Roadmap 2, UI #4)
// Every pending chief-of-staff decision in one prioritized, swipeable queue.
import React, { useState, useCallback, useRef } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, T, SHADOW, litEdge } from "../theme";
import { BackBar, DecisionCard, FadeRise, tap, g } from "../components";
import { getDecisions, confirmDecision, dismissDecision, undoDecision } from "../api";

// Highest value_saved across a decision's options — used to prioritize the queue.
function decisionValue(d) {
  return Math.max(0, ...((d.options || []).map(o => Number(o.value_saved) || 0)));
}

export default function DecisionsScreen({ navigation }) {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy]           = useState(false);
  const timers = useRef({});

  const load = useCallback(async () => {
    try {
      const d = await getDecisions();
      const list = (d.decisions || []).slice().sort((a, b) => decisionValue(b) - decisionValue(a));
      setDecisions(list);
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleConfirm = async (decision, optionId) => {
    const opt = (decision.options || []).find(o => o.id === optionId);
    if (decision.kind === "rebook" && opt?.recommended && decision.trip_id && decision.leg_id) {
      confirmDecision(decision.id, optionId).catch(() => {});
      setDecisions(prev => prev.filter(d => d.id !== decision.id));
      navigation.navigate("Disruption", { tripId: String(decision.trip_id), legId: String(decision.leg_id) });
      return;
    }
    setBusy(true);
    setDecisions(prev => prev.map(d => d.id === decision.id ? { ...d, _confirmed: true } : d));
    try { await confirmDecision(decision.id, optionId); }
    catch (_) { setDecisions(prev => prev.map(d => d.id === decision.id ? { ...d, _confirmed: undefined } : d)); }
    finally { setBusy(false); }
    timers.current[decision.id] = setTimeout(() => {
      setDecisions(prev => prev.filter(d => d.id !== decision.id));
    }, 6000);
  };

  const handleUndo = (decision) => {
    clearTimeout(timers.current[decision.id]);
    setDecisions(prev => prev.map(d => d.id === decision.id ? { ...d, _confirmed: undefined } : d));
    undoDecision(decision.id).catch(() => {});
  };

  const handleDismiss = (decision) => {
    setDecisions(prev => prev.filter(d => d.id !== decision.id));
    dismissDecision(decision.id).catch(() => {});
  };

  const totalValue = decisions.reduce((s, d) => s + decisionValue(d), 0);

  return (
    <SafeAreaView style={s.app}>
      <BackBar nav={navigation} label="Decisions" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.gold} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.masthead}>
          <Text style={s.title}>What needs you.</Text>
          <Text style={s.sub}>
            {loading
              ? "Gathering your decisions…"
              : decisions.length === 0
                ? "Nothing right now — I'll bring you a decision the moment one matters."
                : `${decisions.length} decision${decisions.length !== 1 ? "s" : ""} waiting${totalValue > 0 ? ` · up to $${totalValue.toLocaleString()} at stake` : ""}.`}
          </Text>
        </View>

        {!loading && decisions.length === 0 ? (
          <FadeRise style={s.emptyCard}>
            <Text style={s.emptyHed}>All handled.</Text>
            <Text style={s.emptyBody}>
              You're clear. Wingman is watching every trip and will surface a decision here — with a recommendation and a default — only when it genuinely needs your call.
            </Text>
          </FadeRise>
        ) : (
          <View style={{ paddingHorizontal: 4 }}>
            {decisions.map((d, i) => (
              <FadeRise key={d.id} delay={Math.min(i * 60, 300)}>
                <DecisionCard
                  decision={d}
                  busy={busy}
                  onConfirm={handleConfirm}
                  onDismiss={handleDismiss}
                  onUndo={handleUndo}
                />
              </FadeRise>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  masthead: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  title: { fontFamily: T.garamondSI, fontSize: 34, color: C.ink, lineHeight: 40 },
  sub: { fontFamily: T.sans, fontSize: 14, lineHeight: 20, color: C.mut, marginTop: 8 },
  emptyCard: {
    marginHorizontal: 24, marginTop: 16, padding: 22, borderRadius: 16,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line, ...litEdge, ...SHADOW.soft,
  },
  emptyHed: { fontFamily: T.garamondSI, fontSize: 24, color: C.ink, marginBottom: 8 },
  emptyBody: { fontFamily: T.sans, fontSize: 14, lineHeight: 21, color: C.mut },
});
