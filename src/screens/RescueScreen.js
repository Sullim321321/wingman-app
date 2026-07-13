// RescueScreen — "Ranked by what they protect, not by price."
//
// Every other travel app sorts by price and calls the cheapest one "best." On the Asia
// trip that would put Maddie on a flight landing after the seaplane has gone —
// cancelling a night at Aman to save $80 — and report it as a save.
//
// Here, each option leads with what it KEEPS and what it COSTS, in her own words:
// "loses the seaplane transfer — the only one to the island that day." Price is a line
// of metadata, not the headline.
//
// And when Wingman cannot stand behind the best option — because even that one costs
// something she can't get back — it does not recommend. It says so, plainly, and hands
// the decision back with the trade-off spelled out. "One tap and I fix the rest" is a
// promise it may only make when it can actually keep it.

import React, { useEffect, useState, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { C, T } from "../theme";
import { WMark, tap, FadeRise, SerifText } from "../components";
import { getSituationOptions } from "../api";

export default function RescueScreen({ navigation, route }) {
  const { legId, delay = 0 } = route.params || {};
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr]   = useState(null);

  const load = useCallback(async () => {
    try {
      setBusy(true);
      setData(await getSituationOptions(legId, delay));
      setErr(null);
    } catch (e) {
      setErr(e?.message || "Couldn't search alternatives.");
    } finally {
      setBusy(false);
    }
  }, [legId, delay]);

  useEffect(() => { load(); }, [load]);

  if (busy) {
    return (
      <SafeAreaView style={s.app}>
        <View style={s.center}>
          <WMark size={26} color={C.gold} />
          <Text style={s.loading}>Working out what each option would cost you…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (err) {
    return (
      <SafeAreaView style={s.app}>
        <View style={s.center}>
          <Text style={s.err}>{err}</Text>
          <Pressable onPress={load}><Text style={s.retry}>Try again</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { options = [], recommended_id, no_recommendation_because } = data || {};

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.bar}>
          <Pressable onPress={() => { tap(); navigation.goBack(); }} hitSlop={12}>
            <Text style={s.back}>‹  Situation</Text>
          </Pressable>
        </View>

        <FadeRise>
          <SerifText style={s.h}>
            {options.length ? `${options.length} ways through.` : "No way through."}
          </SerifText>
          <Text style={s.sub}>Ranked by what they protect, not by what they cost.</Text>
        </FadeRise>

        {/* When Wingman can't stand behind an answer, it says so — rather than
            recommending the least-bad option and letting you assume it approved. */}
        {no_recommendation_because ? (
          <FadeRise delay={60}>
            <View style={s.noRec}>
              <View style={s.noRecTop}>
                <WMark size={16} color={C.amber} />
                <Text style={s.noRecH}>I'M NOT MAKING THIS CALL</Text>
              </View>
              <Text style={s.noRecT}>{no_recommendation_because}</Text>
            </View>
          </FadeRise>
        ) : null}

        {options.map((o, i) => {
          const rec = o.offer_id === recommended_id;
          return (
            <FadeRise key={o.offer_id} delay={80 + i * 50}>
              <View style={[s.card, rec && s.cardRec]}>
                <View style={s.cardTop}>
                  <View style={s.rank}><Text style={s.rankT}>{i + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.carrier}>{o.carrier || "Alternative"}</Text>
                    <Text style={s.meta}>
                      {[o.cabin?.replace("_", " "), fmt(o.departs_at), o.price ? `$${Math.round(o.price)}` : null]
                        .filter(Boolean).join("  ·  ")}
                    </Text>
                  </View>
                  {rec ? <Text style={s.recTag}>BEST</Text> : null}
                </View>

                <View style={s.rule} />

                {/* What survives. */}
                {o.protects?.length ? (
                  <View style={s.line}>
                    <Text style={[s.lineK, { color: C.teal }]}>KEEPS</Text>
                    <Text style={s.lineV}>{o.protects.join(", ")}</Text>
                  </View>
                ) : null}

                {/* What it costs you — in the reason you booked it for. */}
                {o.loses?.map((l, k) => (
                  <View key={k} style={s.line}>
                    <Text style={[s.lineK, { color: l.hardness === "must" ? C.coral : C.amber }]}>LOSES</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.lineV}>{l.what}</Text>
                      {l.why ? <Text style={s.lineWhy}>{l.why}</Text> : null}
                    </View>
                  </View>
                ))}

                {/* Rules it violates outright. */}
                {o.breaks?.map((br, k) => (
                  <View key={`b${k}`} style={s.line}>
                    <Text style={[s.lineK, { color: C.coral }]}>BREAKS</Text>
                    <Text style={s.lineV}>{br.rationale}</Text>
                  </View>
                ))}

                {/* The limits of its own knowledge, per option. */}
                {o.cannot_assess?.length ? (
                  <View style={s.line}>
                    <Text style={[s.lineK, { color: C.mut }]}>UNSURE</Text>
                    <Text style={[s.lineV, { color: C.mut }]}>{o.cannot_assess.join(", ")}</Text>
                  </View>
                ) : null}

                {rec ? (
                  <Pressable
                    style={s.cta}
                    onPress={() => {
                      tap();
                      // Booking spends money. It goes through the existing confirm flow —
                      // never fired straight from a list row.
                      // FlightBook takes the RAW Duffel offer (it reads slices,
                      // segments, passengers). FlightConfirm takes a completed booking.
                      // Sending it { offerId } would have crashed on `offer.slices`.
                      navigation.navigate("FlightBook", { offer: o.offer, legId });
                    }}
                  >
                    <Text style={s.ctaT}>Rebook me on this</Text>
                    <Text style={s.ctaSub}>Reversible for 30 minutes</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={s.alt}
                    onPress={() => { tap(); navigation.navigate("FlightBook", { offer: o.offer, legId }); }}
                  >
                    <Text style={s.altT}>Choose this instead</Text>
                  </Pressable>
                )}
              </View>
            </FadeRise>
          );
        })}

        {!options.length ? (
          <View style={s.empty}>
            <Text style={s.emptyT}>
              {no_recommendation_because || "I couldn't find any alternatives — and I won't invent one."}
            </Text>
          </View>
        ) : null}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function fmt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch { return null; }
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 40 },
  loading: { fontFamily: T.garamondI, fontSize: 16, lineHeight: 23, color: C.mut,
             fontStyle: "italic", textAlign: "center" },
  err: { fontFamily: T.sansM, fontSize: 14, color: C.coral },
  retry: { fontFamily: T.sansB, fontSize: 14, color: C.gold },

  scroll: { padding: 20, paddingBottom: 10 },
  bar: { marginBottom: 20 },
  back: { fontFamily: T.sansM, fontSize: 14, color: C.mut },

  h: { fontFamily: T.serifB, fontSize: 27, color: C.ink, letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontFamily: T.garamondI, fontSize: 16.5, lineHeight: 24, color: C.mut,
         fontStyle: "italic", marginBottom: 26 },

  noRec: { borderWidth: 1, borderColor: "rgba(212,144,42,0.42)", borderRadius: 14,
           padding: 16, marginBottom: 24, backgroundColor: "rgba(212,144,42,0.05)" },
  noRecTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  noRecH: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2.2, color: C.amber },
  noRecT: { fontFamily: T.sans, fontSize: 14, lineHeight: 21, color: C.ink },

  card: { borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16,
          marginBottom: 14, backgroundColor: C.card },
  cardRec: { borderColor: C.gold, backgroundColor: "#262019" },

  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  rank: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: C.gold,
          alignItems: "center", justifyContent: "center" },
  rankT: { fontFamily: T.garamond, fontSize: 12.5, color: C.gold },
  carrier: { fontFamily: T.sansB, fontSize: 15.5, color: C.ink },
  meta: { fontFamily: T.sansM, fontSize: 12, color: C.mut, marginTop: 3, textTransform: "capitalize" },
  recTag: { fontFamily: T.sansB, fontSize: 8.5, letterSpacing: 1.4, color: C.gold },

  rule: { height: 1, backgroundColor: C.line, marginVertical: 13 },

  line: { flexDirection: "row", gap: 10, marginBottom: 9 },
  lineK: { fontFamily: T.sansB, fontSize: 8.5, letterSpacing: 1.3, width: 46, marginTop: 3 },
  lineV: { flex: 1, fontFamily: T.sansM, fontSize: 13.5, lineHeight: 19, color: C.ink },
  lineWhy: { fontFamily: T.garamondI, fontSize: 13.5, lineHeight: 19, color: C.mut,
             fontStyle: "italic", marginTop: 2 },

  cta: { backgroundColor: C.gold, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  ctaT: { fontFamily: T.sansB, fontSize: 14.5, color: C.inkD },
  ctaSub: { fontFamily: T.sansM, fontSize: 10, color: "#5C4A26", marginTop: 3 },

  alt: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 12,
         alignItems: "center", marginTop: 8 },
  altT: { fontFamily: T.sansM, fontSize: 13.5, color: C.gold },

  empty: { padding: 20, alignItems: "center" },
  emptyT: { fontFamily: T.garamondI, fontSize: 16, lineHeight: 24, color: C.mut,
            fontStyle: "italic", textAlign: "center" },
});
