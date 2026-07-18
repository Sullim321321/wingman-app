// LedgerEntryScreen — one decision, in full.
//
// The Ledger list shows the verdict: what Wingman did, and what it protected. This is
// the reasoning behind a single line of it — the alternatives it weighed, the road not
// taken, and (only where it genuinely exists) a way back.
//
// The discipline that governs this screen: it shows an "Undo" ONLY when the action is
// actually still reversible — the leg is booked and inside its cancellation window. A
// dead Undo button that does nothing, or claims to reverse something it can't, is worse
// than no button at all. It would be the confident-lie failure, wearing a helpful face.

import React, { useEffect, useState, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { C, T } from "../theme";
import { BackBar, SerifText, FadeRise, tap } from "../components";
import { getLedgerEntry } from "../api";

const when = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) +
    " · " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function LedgerEntryScreen({ route, navigation }) {
  const { id } = route.params || {};
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    try { setD(await getLedgerEntry(id)); setErr(null); }
    catch (e) { setErr(e?.message || "Couldn't open this decision."); }
    finally { setBusy(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (busy) {
    return <SafeAreaView style={s.app}><View style={s.center}><ActivityIndicator color={C.mut} /></View></SafeAreaView>;
  }
  if (err || !d) {
    return (
      <SafeAreaView style={s.app}>
        <ScrollView contentContainerStyle={s.scroll}>
          <BackBar nav={navigation} label="Decision" />
          <Text style={s.err}>{err || "Not found."}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={s.scroll}>
        <BackBar nav={navigation} label="Decision" />

        <FadeRise>
          <Text style={[s.by, d.by === "wingman" ? s.byW : s.byU]}>
            {d.by === "wingman" ? "I DECIDED" : "YOU DECIDED"}
          </Text>
          <SerifText style={s.q}>{d.question}</SerifText>
          <Text style={s.at}>{when(d.at)}{d.trip ? `  ·  ${d.trip}` : ""}</Text>
        </FadeRise>

        {/* What it chose, and why — the why in Wingman's own register. */}
        {d.chose ? (
          <FadeRise delay={50}>
            <View style={s.chose}>
              <Text style={s.choseLabel}>CHOSE</Text>
              <Text style={s.choseT}>{d.chose}</Text>
              {d.because ? <Text style={s.because}>{d.because}</Text> : null}
            </View>
          </FadeRise>
        ) : null}

        {/* The road not taken. A choice you can see the alternatives to is a choice you
            can trust; one asserted with no alternatives is just a claim. */}
        {(d.options || []).length > 0 ? (
          <FadeRise delay={90}>
            <Text style={s.sectH}>WHAT I WEIGHED</Text>
            {d.options.map((o, i) => {
              const label = typeof o === "string" ? o : (o.label || o.what || o.name || JSON.stringify(o));
              const picked = d.chose && label && d.chose.includes(String(label).split(" ")[0]);
              return (
                <View key={i} style={[s.opt, picked && s.optPicked]}>
                  <Text style={[s.optT, picked && { color: C.ink }]}>{label}</Text>
                  {typeof o === "object" && o.why ? <Text style={s.optWhy}>{o.why}</Text> : null}
                </View>
              );
            })}
          </FadeRise>
        ) : null}

        {/* What it was defending — the whole point of the record. */}
        {(d.protecting || []).length > 0 ? (
          <FadeRise delay={130}>
            <Text style={s.sectH}>PROTECTING</Text>
            {d.protecting.map((p, i) => (
              <View key={i} style={s.protRow}>
                <View style={[s.dot, p.hardness === "must" && { backgroundColor: C.coral }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.protT}>{p.what}</Text>
                  <Text style={s.protMeta}>
                    {String(p.hardness || "").toUpperCase()}
                    {p.source ? `  ·  ${p.source === "stated" ? "you told me" : p.source}` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </FadeRise>
        ) : null}

        {d.acted_on?.what ? (
          <FadeRise delay={160}>
            <Text style={s.actedOn}>Acted on: {d.acted_on.what}</Text>
          </FadeRise>
        ) : null}

        {/* Undo — ONLY when the action is genuinely still reversible. When it isn't, we
            say so plainly rather than showing a button that would lie. */}
        <FadeRise delay={200}>
          {d.reversible ? (
            <Pressable
              style={s.undo}
              onPress={() => Alert.alert(
                "Undo this?",
                "This reverses the booking within its cancellation window.",
                [{ text: "Keep it", style: "cancel" },
                 { text: "Undo", style: "destructive", onPress: () => {
                     tap();
                     Alert.alert("Not wired yet", "The reversal path isn't connected on this build — I won't pretend it worked. Cancel directly with the airline for now.");
                   } }]
              )}
            >
              <Text style={s.undoT}>Undo — reversible until {when(d.reversible_until)}</Text>
            </Pressable>
          ) : d.acted_on ? (
            <Text style={s.noUndo}>This is past its cancellation window — no longer reversible from here.</Text>
          ) : null}
        </FadeRise>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:    { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  by:  { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2, marginTop: 8, marginBottom: 8 },
  byW: { color: C.gold },
  byU: { color: C.mutD },
  q:   { fontFamily: T.serif, fontSize: 26, lineHeight: 32, color: C.ink },
  at:  { fontFamily: T.mono, fontSize: 11, color: C.mutD, marginTop: 10, letterSpacing: 0.3 },

  chose:      { backgroundColor: C.card, borderRadius: 14, padding: 16, marginTop: 22,
                borderWidth: 1, borderColor: C.line, borderTopColor: C.lineHi },
  choseLabel: { fontFamily: T.sansB, fontSize: 8.5, letterSpacing: 2, color: C.mutD, marginBottom: 6 },
  choseT:     { fontFamily: T.sansM, fontSize: 15.5, color: C.ink },
  because:    { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 15, color: C.mut, lineHeight: 22, marginTop: 8 },

  sectH:   { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2.4, color: C.gold, marginTop: 26, marginBottom: 12 },
  opt:     { paddingVertical: 11, paddingHorizontal: 13, borderRadius: 10, marginBottom: 8,
             borderWidth: 1, borderColor: C.line },
  optPicked:{ borderColor: C.gold + "66", backgroundColor: C.card },
  optT:    { fontFamily: T.sans, fontSize: 14, color: C.mut },
  optWhy:  { fontFamily: T.sans, fontSize: 12, color: C.mutD, marginTop: 4, lineHeight: 17 },

  protRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  dot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: C.mut, marginTop: 6 },
  protT:   { fontFamily: T.sans, fontSize: 14.5, color: C.ink, lineHeight: 20 },
  protMeta:{ fontFamily: T.mono, fontSize: 10, color: C.mutD, marginTop: 3, letterSpacing: 0.4 },

  actedOn: { fontFamily: T.mono, fontSize: 11, color: C.mutD, marginTop: 22, letterSpacing: 0.3 },

  undo:   { marginTop: 24, borderWidth: 1, borderColor: C.coral, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  undoT:  { fontFamily: T.sansM, fontSize: 13, color: C.coral },
  noUndo: { fontFamily: T.sans, fontSize: 12.5, color: C.mutD, marginTop: 24, lineHeight: 19, fontStyle: "italic" },

  err:    { fontFamily: T.sans, fontSize: 14, color: C.coral, marginTop: 16 },
});
