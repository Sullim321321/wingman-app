// LedgerScreen — what Wingman did, and what it was protecting when it did it.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS REPLACES, AND WHY
//
// Insights showed: "$430 TOTAL VALUE PROTECTED · 48 trips tracked · 1 disruption
// handled · 1/1 rescues accepted · 23m avg. time saved."
//
// Look at that last one. Twenty-three minutes saved — measured how? Against which
// counterfactual? Nobody ran the version of the day where Wingman didn't act. It is a
// number with a decimal point's worth of confidence and no evidence underneath it,
// rendered large, in the place where the product is supposed to prove its worth.
//
// That is the same failure as the 266-night stay, "46 trips protected," the backfill
// that printed 0-of-0 as a pass, and the monitor that read a 404 as calm: THE SYSTEM
// REPORTING CONFIDENTLY ON EVIDENCE IT NEVER CHECKED. We removed it from the cascade,
// from the planner, from the rescue engine — and left it running on the one screen
// whose entire job is to make you trust the thing.
//
// So: no aggregates. No averages. No "value protected." The ledger asserts nothing it
// cannot show you.
//
// Every row is a decision that actually happened, the reason it was taken, and the
// named constraints it was defending — in the words you used when you told Wingman
// they mattered. `deliberate()` REFUSES to record a wingman decision that can't name
// what it was protecting, so an empty ledger is an honest one and a full ledger is
// proof. That is a stronger claim than any dashboard could make.
//
// A chief of staff's worth is not a chart. It is a record.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { C, T } from "../theme";
import { BackBar, SerifText, FadeRise, tap } from "../components";
import { getLedger } from "../api";

const when = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export default function LedgerScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr]   = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await getLedger()); setErr(null); }
    catch (e) { setErr(e?.message || "Couldn't load the ledger."); }
    finally { setBusy(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (busy) {
    return (
      <SafeAreaView style={s.app}>
        <View style={s.center}><ActivityIndicator color={C.mut} /></View>
      </SafeAreaView>
    );
  }

  const entries = data?.entries || [];
  const alone   = data?.acted_alone || 0;
  const back    = data?.handed_back || 0;

  return (
    <SafeAreaView style={s.app}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.mut} />}
      >
        <BackBar nav={navigation} label="The Ledger" />

        <FadeRise>
          <SerifText style={s.h1}>What I did,{"\n"}and what I was protecting.</SerifText>
        </FadeRise>

        {/* The ONLY two numbers on this screen, and they are true by construction:
            how many times Wingman acted alone, and how many times it handed the call
            back to you. Nothing is averaged. Nothing is imputed. */}
        {entries.length > 0 ? (
          <FadeRise delay={60}>
            <View style={s.tally}>
              <View style={s.tallyCol}>
                <Text style={s.tallyN}>{alone}</Text>
                <Text style={s.tallyL}>I ACTED ALONE</Text>
              </View>
              <View style={s.tallyRule} />
              <View style={s.tallyCol}>
                <Text style={s.tallyN}>{back}</Text>
                <Text style={s.tallyL}>I HANDED IT BACK</Text>
              </View>
            </View>
          </FadeRise>
        ) : null}

        {err ? <Text style={s.err}>{err}</Text> : null}

        {/* An empty ledger is not a failure state. It is an accurate one. */}
        {!err && entries.length === 0 ? (
          <FadeRise delay={60}>
            <View style={s.empty}>
              <Text style={s.emptyH}>Nothing yet.</Text>
              <Text style={s.emptyT}>
                I haven't had to make a call on your behalf. When I do, it will be
                written here — what I chose, why, and what I was defending when I chose it.
              </Text>
              <Text style={s.emptyN}>
                I won't record a decision I can't explain. So this page being empty means
                exactly what it says, and nothing more.
              </Text>
            </View>
          </FadeRise>
        ) : null}

        {entries.map((e, i) => (
          <FadeRise key={e.id} delay={100 + i * 40}>
            <Pressable style={s.row} onPress={() => { tap(); navigation.navigate("LedgerEntry", { id: e.id }); }}>
              <View style={s.rowTop}>
                <Text style={[s.by, e.by === "wingman" ? s.byW : s.byU]}>
                  {e.by === "wingman" ? "I DECIDED" : "YOU DECIDED"}
                </Text>
                <Text style={s.when}>{when(e.at)}</Text>
              </View>

              <Text style={s.q}>{e.question}</Text>
              {e.chose ? <Text style={s.chose}>{e.chose}</Text> : null}

              {/* The reason, in Wingman's own register — italic serif. */}
              {e.because ? <Text style={s.because}>{e.because}</Text> : null}

              {/* ── THE POINT OF THE WHOLE SCREEN ──
                  Not "a decision was made." What it was DEFENDING, in the words you
                  used when you said it mattered. This is the line no other travel app
                  can print, because none of them kept the reason. */}
              {e.protecting?.length ? (
                <View style={s.prot}>
                  <Text style={s.protH}>PROTECTING</Text>
                  {e.protecting.map((p) => (
                    <View key={p.id} style={s.protRow}>
                      <View style={[s.dot, p.hardness === "must" && { backgroundColor: C.coral }]} />
                      <Text style={s.protT}>{p.what}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {(e.what || e.trip) ? (
                <Text style={s.meta}>{[e.what, e.trip].filter(Boolean).join("  ·  ")}</Text>
              ) : null}
            </Pressable>
          </FadeRise>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:    { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  h1: { fontFamily: T.serif, fontSize: 30, lineHeight: 37, color: C.ink, marginTop: 10, marginBottom: 24 },

  // The only two numbers. Mono, because they were counted, not estimated.
  tally:     { flexDirection: "row", alignItems: "center", backgroundColor: C.card,
               borderRadius: 14, borderWidth: 1, borderColor: C.line,
               borderTopColor: C.lineHi, paddingVertical: 18, marginBottom: 26 },
  tallyCol:  { flex: 1, alignItems: "center" },
  tallyRule: { width: 1, height: 34, backgroundColor: C.line },
  tallyN:    { fontFamily: T.monoM, fontSize: 26, color: C.ink, letterSpacing: 1 },
  tallyL:    { fontFamily: T.sansB, fontSize: 8.5, letterSpacing: 2.2, color: C.mutD, marginTop: 7 },

  row:    { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12,
            borderWidth: 1, borderColor: C.line, borderTopColor: C.lineHi },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  by:     { fontFamily: T.sansB, fontSize: 8.5, letterSpacing: 2 },
  byW:    { color: C.gold },     // Wingman acted. Cream — the accent.
  byU:    { color: C.mutD },     // You acted. Quiet.
  when:   { fontFamily: T.mono, fontSize: 10, color: C.mutD, letterSpacing: 0.6 },

  q:      { fontFamily: T.sans, fontSize: 15, color: C.ink, lineHeight: 21 },
  chose:  { fontFamily: T.sansM, fontSize: 14, color: C.ink, marginTop: 6 },
  because:{ fontFamily: T.garamondI, fontStyle: "italic", fontSize: 15, lineHeight: 22,
            color: C.mut, marginTop: 8 },

  prot:    { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  protH:   { fontFamily: T.sansB, fontSize: 8, letterSpacing: 2.2, color: C.mutD, marginBottom: 8 },
  protRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginBottom: 6 },
  dot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: C.mut, marginTop: 7 },
  protT:   { fontFamily: T.sans, fontSize: 13.5, color: C.ink, flex: 1, lineHeight: 19 },

  meta:   { fontFamily: T.mono, fontSize: 10, color: C.mutD, marginTop: 12, letterSpacing: 0.5 },

  empty:  { paddingVertical: 10 },
  emptyH: { fontFamily: T.serif, fontSize: 22, color: C.ink, marginBottom: 10 },
  emptyT: { fontFamily: T.sans, fontSize: 14.5, color: C.mut, lineHeight: 23 },
  emptyN: { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 14.5, color: C.mutD,
            lineHeight: 22, marginTop: 16 },

  err:    { fontFamily: T.sans, fontSize: 14, color: C.coral, marginTop: 10 },
});
