// SituationScreen — the cascade takeover. This is the product.
//
// The deck's whole promise is one sentence: "We protect what depends on them." This
// is the screen where that either happens or it doesn't.
//
// It renders the dependency spine — what actually hangs off the broken flight — and
// every node carries a verdict the system can DEFEND:
//
//   BROKEN   we measured the slack; the delay exceeds it.
//   AT RISK  same-day dependency, still standing, worth watching.
//   UNKNOWN  the edge was inferred, or we have no departure time. We do not know.
//
// That last one is the point of the entire exercise. The version of this screen we
// replaced marked every booking after the delay as "at risk" without ever computing
// whether the delay reached it — a confident lie, in a push notification, to someone
// standing in an airport. An honest "I don't know yet — want me to call?" is worth
// more than a beautiful fiction, and it's still ahead of every other travel app.
//
// And each node shows WHY that booking exists. Not decoration: it is what lets a
// rescue defend the trip instead of merely rebooking it. "The Palace has the cold
// plunge and sits on the Imperial Palace loop" is the reason you cannot simply swap
// in another hotel in Tokyo.

import React, { useEffect, useState, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { C, T } from "../theme";
import { WMark, tap, FadeRise, SerifText } from "../components";
import { getSituation } from "../api";

const VERDICT = {
  broken:  { label: "WON'T SURVIVE", color: C.coral, dot: C.coral },
  at_risk: { label: "AT RISK",       color: C.amber, dot: C.amber },
  unknown: { label: "UNKNOWN",       color: C.mut,   dot: "transparent" },
};

export default function SituationScreen({ navigation, route }) {
  const { legId, delay = 0 } = route.params || {};
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr]   = useState(null);

  const load = useCallback(async () => {
    try {
      setBusy(true);
      setData(await getSituation(legId, delay));
      setErr(null);
    } catch (e) {
      setErr(e?.message || "Couldn't load the situation.");
    } finally {
      setBusy(false);
    }
  }, [legId, delay]);

  useEffect(() => { load(); }, [load]);

  if (busy) {
    return (
      <SafeAreaView style={s.app}>
        <View style={s.center}><ActivityIndicator color={C.gold} /></View>
      </SafeAreaView>
    );
  }

  if (err || !data) {
    return (
      <SafeAreaView style={s.app}>
        <View style={s.center}>
          <Text style={s.err}>{err || "Nothing to show."}</Text>
          <Pressable onPress={load}><Text style={s.retry}>Try again</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { leg, nodes, summary } = data;
  const flight = [leg.carrier, leg.flight_number].filter(Boolean).join(" ") || leg.type;
  const route_ = [leg.origin, leg.destination].filter(Boolean).join(" → ");

  // Honest headline. If everything downstream is unknown, SAY that — don't dress a
  // shrug up as an assessment.
  const allUnknown = summary.broken === 0 && summary.at_risk === 0 && summary.unknown > 0;
  const headline =
    summary.broken  ? "I've worked out what this breaks."
    : summary.at_risk ? "Nothing's broken yet. Two things are tight."
    : allUnknown      ? "I can't yet tell what this affects."
    : "Nothing downstream depends on this.";

  return (
    <SafeAreaView style={s.app}>
      <View style={s.topRule} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.bar}>
          <Pressable onPress={() => { tap(); navigation.goBack(); }} hitSlop={12}>
            <Text style={s.close}>Close</Text>
          </Pressable>
          <Text style={s.barT}>SITUATION</Text>
        </View>

        <FadeRise>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.kicker}>{delay ? "FLIGHT DELAYED" : "DISRUPTION"}</Text>
              <Text style={s.flight}>{flight}{route_ ? `  ·  ${route_}` : ""}</Text>
            </View>
            {delay ? <SerifText style={s.delay}>+{delay} min</SerifText> : null}
          </View>

          <Text style={s.voice}>{headline}</Text>
        </FadeRise>

        {/* ── the dependency spine ──────────────────────────────────────────── */}
        {nodes.length > 0 ? (
          <FadeRise delay={70}>
            <View style={s.sect}>
              <Text style={s.sectH}>WHAT DEPENDS ON IT</Text>
            </View>

            {nodes.map((n, i) => {
              const v = VERDICT[n.verdict] || VERDICT.unknown;
              const last = i === nodes.length - 1;
              return (
                <View key={n.leg_id} style={s.node}>
                  <View style={s.rail}>
                    <View style={[s.dot, { borderColor: v.color, backgroundColor: v.dot }]} />
                    {!last ? <View style={s.railLine} /> : null}
                  </View>

                  <View style={s.nodeBody}>
                    <View style={s.nodeTop}>
                      <Text style={s.nodeT}>{n.label}</Text>
                      <Text style={[s.verdict, { color: v.color }]}>{v.label}</Text>
                    </View>

                    {/* The system explaining itself — including when it can't. */}
                    <Text style={[s.why, n.verdict === "unknown" && { color: C.mut }]}>{n.why}</Text>

                    {/* WHY this booking exists. The line no competitor can render,
                        because no competitor stored it. */}
                    {n.reasons?.length ? (
                      <View style={s.reasons}>
                        {n.reasons.slice(0, 3).map((r) => (
                          <Text key={r.id} style={s.reason}>
                            {r.hardness === "must" ? "· " : "· "}
                            {r.rationale}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {/* An inferred edge must never masquerade as an observed one. */}
                    {n.verdict === "unknown" ? (
                      <Pressable style={s.check} onPress={() => { tap(); navigation.navigate("Concierge"); }}>
                        <Text style={s.checkT}>Ask me to check</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </FadeRise>
        ) : (
          <FadeRise delay={70}>
            <View style={s.clear}>
              <WMark size={20} color={C.teal} />
              <Text style={s.clearT}>
                Nothing else on this trip depends on that flight. It's contained.
              </Text>
            </View>
          </FadeRise>
        )}

        {/* Honesty footer — what the system knows about the limits of its knowledge. */}
        {summary.unknown > 0 ? (
          <FadeRise delay={140}>
            <View style={s.limits}>
              <Text style={s.limitsH}>WHAT I DON'T KNOW</Text>
              <Text style={s.limitsT}>
                {summary.unknown === 1 ? "One booking" : `${summary.unknown} bookings`} I can't
                assess — I inferred the link rather than confirming it, or I don't have a time for
                it. I won't claim an impact I haven't checked.
              </Text>
            </View>
          </FadeRise>
        ) : null}

        <View style={{ height: 30 }} />
      </ScrollView>

      {summary.broken > 0 || summary.at_risk > 0 ? (
        <View style={s.foot}>
          {/* Straight to real, ranked alternatives — not a chat box. A diagnosis that
              ends in "talk to me about it" is half a product. */}
          <Pressable
            style={s.cta}
            onPress={() => { tap(); navigation.navigate("Rescue", { legId, delay }); }}
          >
            <Text style={s.ctaT}>Show me the way through</Text>
          </Pressable>
          <Text style={s.footNote}>Ranked by what they protect. Reversible for 30 minutes.</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  err: { fontFamily: T.sansM, fontSize: 14, color: C.coral },
  retry: { fontFamily: T.sansB, fontSize: 14, color: C.gold },

  topRule: { height: 3, backgroundColor: C.coral },
  scroll: { padding: 20, paddingBottom: 10 },

  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  close: { fontFamily: T.sansM, fontSize: 14, color: C.mut },
  barT: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2.6, color: C.gold },

  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 18 },
  kicker: { fontFamily: T.sansB, fontSize: 9.5, letterSpacing: 2.2, color: C.coral, marginBottom: 7 },
  flight: { fontFamily: T.sansM, fontSize: 13.5, color: C.mut },
  delay: { fontFamily: T.serifB, fontSize: 26, color: C.ink, letterSpacing: -0.5 },

  voice: { fontFamily: T.garamondI, fontSize: 19, lineHeight: 27, color: C.goldL,
           fontStyle: "italic", marginBottom: 30 },

  sect: { marginBottom: 18 },
  sectH: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2.6, color: C.gold },

  node: { flexDirection: "row", gap: 14 },
  rail: { alignItems: "center", width: 14 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.6, marginTop: 3 },
  railLine: { flex: 1, width: 1.5, backgroundColor: C.line, marginTop: 4, marginBottom: -4 },

  nodeBody: { flex: 1, paddingBottom: 26 },
  nodeTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  nodeT: { flex: 1, fontFamily: T.sansM, fontSize: 15.5, color: C.ink },
  verdict: { fontFamily: T.sansB, fontSize: 8.5, letterSpacing: 1.2, marginTop: 3 },
  why: { fontFamily: T.sans, fontSize: 13.5, lineHeight: 20, color: C.ink, opacity: 0.8, marginTop: 6 },

  reasons: { marginTop: 9, paddingLeft: 2 },
  reason: { fontFamily: T.garamondI, fontSize: 14, lineHeight: 20, color: C.gold,
            fontStyle: "italic", opacity: 0.75 },

  check: { alignSelf: "flex-start", marginTop: 11, borderWidth: 1, borderColor: C.line,
           borderRadius: 9, paddingHorizontal: 13, paddingVertical: 7 },
  checkT: { fontFamily: T.sansM, fontSize: 12.5, color: C.gold },

  clear: { flexDirection: "row", alignItems: "flex-start", gap: 11, borderWidth: 1,
           borderColor: "rgba(45,184,150,0.3)", borderRadius: 14, padding: 16 },
  clearT: { flex: 1, fontFamily: T.garamondI, fontSize: 16, lineHeight: 23, color: C.ink, fontStyle: "italic" },

  limits: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 18, marginTop: 6 },
  limitsH: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2.6, color: C.mut, marginBottom: 9 },
  limitsT: { fontFamily: T.sans, fontSize: 13.5, lineHeight: 20, color: C.mut },

  foot: { padding: 20, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg },
  cta: { backgroundColor: C.gold, borderRadius: 13, paddingVertical: 16, alignItems: "center" },
  ctaT: { fontFamily: T.sansB, fontSize: 15, color: C.inkD },
  footNote: { fontFamily: T.sansM, fontSize: 10.5, color: C.mut, textAlign: "center", marginTop: 12 },
});
