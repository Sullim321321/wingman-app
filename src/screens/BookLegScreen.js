// BookLegScreen — the plan becomes a commitment.
//
// This screen exists to make ONE thing legible: Wingman is not sorting by price.
//
// Every other travel app puts the cheapest fare at the top and lets you discover the
// consequences yourself. Wingman ranks by what an option PROTECTS — the reasons you
// gave it, and the things downstream that survive if it holds. Price is a tiebreak,
// and only a tiebreak: it is far too small a nudge to buy its way past a broken must.
//
// So the primary line on each option is not the fare. It's what the fare costs you.
//
// Three refusals this screen has to render honestly, because they are the product:
//
//   1. NOT READY   — the plan has a hole in it (no date, no origin, no passport name).
//                    We show the QUESTION, never a filled-in guess. The planner refused
//                    to invent a date; booking does not get to undo that refusal.
//
//   2. WON'T BOOK  — the option breaks, or quietly destroys, something you called
//                    non-negotiable. It stays on the list, greyed, with the reason.
//                    Hiding it would be a second lie on top of the first.
//
//   3. NOT ALONE   — Wingman can't fully evaluate this, so it will not act by itself.
//                    "Unknown" blocks Wingman. It never blocks you: you can look at the
//                    same uncertainty and decide anyway. That asymmetry is the ethic.

import React, { useEffect, useState, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, Alert,
} from "react-native";
import { C, T } from "../theme";
import { WMark, tap, FadeRise, SerifText } from "../components";
import { getLegBooking, bookLeg } from "../api";

const money = (a, c) => {
  const n = parseFloat(a);
  if (!isFinite(n)) return "—";
  return `${c === "USD" ? "$" : `${c} `}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const clock = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const dur = (a, b) => {
  if (!a || !b) return "";
  const m = Math.round((new Date(b) - new Date(a)) / 60000);
  if (!isFinite(m) || m <= 0) return "";
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

export default function BookLegScreen({ route, navigation }) {
  const { legId } = route.params || {};
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(true);
  const [booking, setBooking] = useState(null);   // offer id currently being bought

  const load = useCallback(async () => {
    setBusy(true); setErr(null);
    try { setData(await getLegBooking(legId)); }
    catch (e) { setErr(e.message || "Couldn't look this up."); }
    finally { setBusy(false); }
  }, [legId]);

  useEffect(() => { load(); }, [load]);

  const buy = async (opt) => {
    // The confirmation names the money AND the consequence. A price alone is not
    // informed consent when the system knows something the price doesn't say.
    const cost = money(opt.price, opt.currency);
    const warn = [
      ...(opt.breaks || []).map((b) => b.rationale),
      ...(opt.loses || []).map((l) => l.what),
    ].filter(Boolean);
    Alert.alert(
      "Book this?",
      `${opt.carrier || "Flight"} · ${cost}` +
        (warn.length ? `\n\nThis costs you: ${warn.join("; ")}` : ""),
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Book",
          style: "default",
          onPress: async () => {
            setBooking(opt.offer_id);
            try {
              const r = await bookLeg(legId, opt.offer_id, "you");
              tap?.();
              Alert.alert(
                "Booked",
                `Reference ${r.booking_reference}.${
                  r.reasons_kept
                    ? `\n\nIt's still holding up ${r.reasons_kept} thing${r.reasons_kept === 1 ? "" : "s"} you told me mattered — I'll watch it.`
                    : ""
                }`,
                [{ text: "Good", onPress: () => navigation.goBack() }]
              );
            } catch (e) {
              Alert.alert("It didn't go through", e.message || "Nothing was charged.");
            } finally { setBooking(null); }
          },
        },
      ]
    );
  };

  if (busy) {
    return (
      <SafeAreaView style={s.wrap}>
        <View style={s.center}><ActivityIndicator color={C.gold} /></View>
      </SafeAreaView>
    );
  }

  if (err) {
    return (
      <SafeAreaView style={s.wrap}>
        <View style={s.center}>
          <Text style={s.err}>{err}</Text>
          <Pressable style={s.retry} onPress={load}><Text style={s.retryT}>Try again</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── NOT READY — the plan has a hole, and a hole is a question ────────────────
  if (!data?.ready) {
    return (
      <SafeAreaView style={s.wrap}>
        <ScrollView contentContainerStyle={s.pad}>
          <WMark />
          <SerifText style={s.h1}>Before I can book this</SerifText>
          <Text style={s.sub}>
            I could fill these in myself. I'd be guessing, and you'd have a confirmation
            number attached to the guess.
          </Text>
          {(data?.missing || []).map((m, i) => (
            <FadeRise key={m.field || i} delay={i * 60}>
              <View style={s.gap}>
                <Text style={s.gapAsk}>{m.ask}</Text>
                {m.why ? <Text style={s.gapWhy}>{m.why}</Text> : null}
                {m.route ? (
                  <Pressable style={s.gapBtn} onPress={() => navigation.navigate(m.route)}>
                    <Text style={s.gapBtnT}>Tell me →</Text>
                  </Pressable>
                ) : null}
              </View>
            </FadeRise>
          ))}
          <Text style={s.foot}>
            Answer these in the Plan tab and come back — I'll have flights ready.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const { resolved, options = [], may_act_alone: may } = data;

  return (
    <SafeAreaView style={s.wrap}>
      <ScrollView contentContainerStyle={s.pad}>
        <WMark />
        <SerifText style={s.h1}>
          {resolved?.from?.name} → {resolved?.to?.name}
        </SerifText>

        {/* Say which airports were chosen. "Tokyo" is two airports 60km apart, and the
            wrong one costs ninety minutes the seaplane doesn't have. Never silent. */}
        <Text style={s.sub}>
          Searching {resolved?.from?.iata}
          {resolved?.from?.covers?.length > 1 ? ` (${resolved.from.covers.join(", ")})` : ""}
          {" → "}
          {resolved?.to?.iata}
          {resolved?.to?.covers?.length > 1 ? ` (${resolved.to.covers.join(", ")})` : ""}
          {" · ranked by what they protect, not what they cost."}
        </Text>

        {/* "One tap and I fix the rest" is a promise Wingman may only make when it can
            actually keep it. When it can't, it hands the decision back — with the
            trade-off spelled out. Silence is how you'd assume it approved. */}
        {data.no_recommendation_because ? (
          <View style={[s.alone, { borderLeftColor: C.coral }]}>
            <Text style={[s.aloneH, { color: C.coral }]}>I won't pick for you</Text>
            <Text style={s.aloneT}>{data.no_recommendation_because}</Text>
          </View>
        ) : null}

        {/* Can Wingman do this alone? The graph answers — not a setting. */}
        {may && !may.ok && !data.no_recommendation_because ? (
          <View style={s.alone}>
            <Text style={s.aloneH}>I won't book this by myself</Text>
            <Text style={s.aloneT}>{may.detail}</Text>
          </View>
        ) : null}

        {options.length === 0 ? (
          <Text style={s.foot}>Nothing came back for that day. Want to try another date?</Text>
        ) : null}

        {options.map((o, i) => {
          const segs  = o.offer?.slices?.[0]?.segments || [];
          const stops = Math.max(0, segs.length - 1);
          // Not "the first one" — the one the SERVER stands behind. If it stands behind
          // none of them, nothing is crowned, and the reason is printed above.
          const isPick = o.offer_id && o.offer_id === data.recommended_id;
          // It broke a must, or it destroys one. Still shown — hiding it would be a
          // second lie on top of the first — but never tappable-by-accident.
          const harmful  = o.brokeMust || o.losesMust;
          const busyHere = booking === o.offer_id;

          return (
            <FadeRise key={o.offer_id || i} delay={i * 50}>
              <Pressable
                style={[s.opt, harmful && s.optRefused, isPick && s.optBest]}
                disabled={!!booking}
                onPress={() => buy(o)}
              >
                {isPick ? <Text style={s.best}>MY CHOICE</Text> : null}

                <View style={s.optTop}>
                  <Text style={s.optCarrier}>
                    {o.carrier || "—"}{o.flight ? ` ${o.flight}` : ""}
                  </Text>
                  <Text style={s.optPrice}>{money(o.price, o.currency)}</Text>
                </View>

                <Text style={s.optTimes}>
                  {clock(o.departs_at)} → {clock(o.arrives_at)}
                  {"  ·  "}{dur(o.departs_at, o.arrives_at)}
                  {"  ·  "}{stops === 0 ? "nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`}
                  {o.cabin ? `  ·  ${o.cabin}` : ""}
                </Text>

                {/* ── THE ACTUAL RANKING SIGNAL ──
                    What survives if you take this, and what dies. This is the line the
                    rest of the industry does not print, because it sorts by price and
                    lets you discover the consequences at the gate. */}
                {(o.protects || []).length ? (
                  <Text style={s.keeps}>✓ Keeps {o.protects.join(" · ")}</Text>
                ) : null}

                {(o.loses || []).length ? (
                  <Text style={s.costs}>
                    Costs you: {o.loses.map((l) => l.what + (l.why ? ` — ${l.why}` : "")).join(" · ")}
                  </Text>
                ) : null}

                {(o.breaks || []).length ? (
                  <Text style={s.refused}>
                    Breaks: {o.breaks.map((b) => b.rationale).filter(Boolean).join(" · ")}
                  </Text>
                ) : null}

                {/* The system stating the limits of its own knowledge, per option.
                    An absent check is not a passed check. */}
                {(o.cannot_assess || []).length ? (
                  <Text style={s.unknown}>
                    I can't assess: {o.cannot_assess.slice(0, 2).join("; ")}.
                  </Text>
                ) : null}

                {busyHere ? <ActivityIndicator color={C.gold} style={{ marginTop: 10 }} /> : null}
              </Pressable>
            </FadeRise>
          );
        })}

        <Text style={s.foot}>
          Price only separates options that protect you equally well.
        </Text>
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap:   { flex: 1, backgroundColor: C.bg },
  pad:    { padding: 20, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },

  h1:  { ...T.h1, color: C.ink, marginTop: 6 },
  sub: { ...T.body, color: C.mut, marginTop: 8, marginBottom: 20, lineHeight: 21 },

  err:    { ...T.body, color: C.coral, textAlign: "center", marginBottom: 16 },
  retry:  { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryT: { ...T.body, color: C.ink },

  // ── the holes in the plan ──
  gap:     { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  gapAsk:  { ...T.body, color: C.ink, fontSize: 16 },
  gapWhy:  { ...T.small, color: C.mut, marginTop: 6, lineHeight: 18 },
  gapBtn:  { marginTop: 12, alignSelf: "flex-start" },
  gapBtnT: { ...T.small, color: C.gold, fontWeight: "600" },

  // ── the autonomy refusal ──
  alone:  { backgroundColor: C.card2, borderLeftWidth: 3, borderLeftColor: C.amber, borderRadius: 10, padding: 14, marginBottom: 18 },
  aloneH: { ...T.small, color: C.amber, fontWeight: "700", letterSpacing: 0.4, marginBottom: 4 },
  aloneT: { ...T.small, color: C.mut, lineHeight: 18 },

  // ── an option ──
  opt:        { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  optBest:    { borderColor: C.gold + "66" },
  optRefused: { opacity: 0.45 },
  best:       { ...T.small, color: C.gold, fontWeight: "700", letterSpacing: 1, fontSize: 10, marginBottom: 8 },

  optTop:     { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  optCarrier: { ...T.body, color: C.ink, fontWeight: "600", flex: 1, paddingRight: 10 },
  // Deliberately NOT the loudest thing on the card.
  optPrice:   { ...T.body, color: C.mut, fontVariant: ["tabular-nums"] },
  optTimes:   { ...T.small, color: C.mut, marginTop: 6 },

  keeps:   { ...T.small, color: C.teal,  marginTop: 10, lineHeight: 18 },
  costs:   { ...T.small, color: C.amber, marginTop: 6, lineHeight: 18 },
  unknown: { ...T.small, color: C.mut,   marginTop: 6, fontStyle: "italic" },
  refused: { ...T.small, color: C.coral, marginTop: 10, lineHeight: 18 },

  foot: { ...T.small, color: C.mut, marginTop: 14, textAlign: "center", lineHeight: 18 },
});
