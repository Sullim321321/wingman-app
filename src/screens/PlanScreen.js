// PlanScreen — the front door.
//
// What was here before: 44 lines of hardcoded mockup. Static text about a Stockholm
// trip nobody was taking, wired to nothing, reachable from nowhere. A painted-on door.
//
// What this is: a conversation that builds a trip, where every constraint Wingman
// learns is recorded WITH ITS REASON. That last part is the whole company. A booking
// whose reason we kept can be defended when the flight dies. One without it can only
// be replaced — and replacing "the Palace Hotel" with "a hotel in Tokyo" is how you
// lose the cold plunge eight weeks out from a time trial.
//
// The panel below the conversation is not a summary of the chat. It is the graph, live.

import React, { useState, useRef, useCallback } from "react";
import {
  SafeAreaView, View, Text, TextInput, ScrollView, Pressable,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from "react-native";
import { C, T } from "../theme";
import { WMark, tap, success, FadeRise, SerifText } from "../components";
import { planMessage, confirmConstraint } from "../api";

const HARD = {
  must:   { label: "MUST",   color: C.gold },
  strong: { label: "STRONG", color: C.ink },
  nice:   { label: "NICE",   color: C.mut },
};

/**
 * The model writes markdown. We were rendering it raw, so a well-made point arrived
 * as literal asterisks: "**Two of you, one room?**". A chief of staff who can't
 * emphasise a word looks like a chatbot with a formatting bug — because it is one.
 *
 * Bold and italic only. Not a markdown engine — a typesetter for the three things
 * the model actually reaches for.
 */
function Rich({ text, style }) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*|(?<!\*)\*[^*]+\*(?!\*))/g).filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <Text key={i} style={{ fontFamily: T.sansB, color: C.ink }}>{p.slice(2, -2)}</Text>;
        }
        if (p.startsWith("*") && p.endsWith("*")) {
          return <Text key={i} style={{ fontFamily: T.garamondI, fontStyle: "italic" }}>{p.slice(1, -1)}</Text>;
        }
        return <Text key={i}>{p}</Text>;
      })}
    </Text>
  );
}

export default function PlanScreen({ navigation, route }) {
  const [turns, setTurns]    = useState([]);          // {role, content}
  const [draft, setDraft]    = useState("");
  const [busy, setBusy]      = useState(false);
  const [tripId, setTripId]  = useState(route?.params?.tripId ?? null);
  const [constraints, setCs] = useState([]);
  const [legs, setLegs]      = useState([]);
  const [gaps, setGaps]      = useState([]);
  const [err, setErr]        = useState(null);
  const scroller = useRef(null);

  const send = useCallback(async (text) => {
    const message = String(text ?? draft).trim();
    if (!message || busy) return;
    tap();
    setErr(null);
    setDraft("");
    const next = [...turns, { role: "user", content: message }];
    setTurns(next);
    setBusy(true);
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);

    try {
      const r = await planMessage(message, tripId, turns);
      if (r.trip_id && !tripId) setTripId(r.trip_id);
      // Belt and braces: the server guarantees a reply now, but an empty assistant
      // bubble is such a bad failure — you speak, and the app stares back — that it
      // shouldn't be possible from either end.
      const reply = (r.reply || "").trim();
      setTurns([...next, ...(reply ? [{ role: "assistant", content: reply }] : [])]);
      setCs(r.constraints || []);
      setLegs(r.legs || []);
      setGaps(r.gaps || []);
    } catch (e) {
      // Say what actually happened. "That didn't go through" is how we burned weeks
      // hunting a backend bug that turned out to be a client-side TypeError.
      setErr(e?.message || "That didn't reach Wingman.");
      setTurns(next);
    } finally {
      setBusy(false);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [draft, busy, turns, tripId]);

  const confirm = async (c) => {
    tap();
    try {
      await confirmConstraint(c.id);
      success();
      setCs((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: "active", source: "stated" } : x)));
    } catch (_) { /* stays proposed; they can tap again */ }
  };

  // Rejecting is as important as confirming. Wingman put Beijing and Guangzhou on the
  // tour when they weren't; without a way to say "no", a wrong MUST just sits there
  // anchoring the whole trip. Saying so is also how it learns.
  const reject = (c) => {
    tap();
    setCs((prev) => prev.filter((x) => x.id !== c.id));
    send(`No — "${c.rationale}" isn't right. Drop it.`);
  };

  const proposed = constraints.filter((c) => c.status === "proposed");
  const active   = constraints.filter((c) => c.status !== "proposed");
  // trip_id === null means a STANDING constraint — true of you, on every trip.
  // Mixing "vegetarian" in with "a week in March" made the panel read as noise and
  // buried the constraints that are actually about this trip.
  const thisTrip = active.filter((c) => c.trip_id != null);
  const aboutYou = active.filter((c) => c.trip_id == null);
  const empty    = turns.length === 0;

  return (
    <SafeAreaView style={s.app}>
      <View style={s.bar}>
        <Pressable onPress={() => { tap(); navigation.goBack(); }} hitSlop={12}>
          <Text style={s.back}>‹</Text>
        </Pressable>
        <View style={s.barMid}>
          <WMark size={20} color={C.gold} />
          <Text style={s.barT}>PLAN</Text>
        </View>
        {constraints.length > 0
          ? <Text style={s.count}>{constraints.length}</Text>
          : <View style={{ width: 22 }} />}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView ref={scroller} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {empty ? <Opening onPick={send} /> : null}

          {turns.map((t, i) =>
            t.role === "user" ? (
              <FadeRise key={i}>
                <View style={s.me}><Text style={s.meT}>{t.content}</Text></View>
              </FadeRise>
            ) : (
              <FadeRise key={i}>
                <View style={s.wm}>
                  <View style={s.wmHead}>
                    <WMark size={16} color={C.gold} />
                    <Text style={s.wmName}>WINGMAN</Text>
                  </View>
                  <Rich text={t.content} style={s.wmT} />
                </View>
              </FadeRise>
            )
          )}

          {busy ? (
            <View style={s.think}>
              <WMark size={16} color={C.gold} />
              <Text style={s.thinkT}>thinking…</Text>
            </View>
          ) : null}

          {err ? (
            <View style={s.err}>
              <Text style={s.errT}>{err}</Text>
              <Pressable onPress={() => send(turns[turns.length - 1]?.content)}>
                <Text style={s.errA}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── THE GRAPH, LIVE ──────────────────────────────────────────────
              Things Wingman worked out but was not told. They are shown at their
              TRUE weight — a visa is a 'must', not a preference — and they gate
              nothing until confirmed. Silently demoting one to a nicety is how
              somebody lands in Shanghai without an L visa. */}
          {proposed.length > 0 ? (
            <View style={s.block}>
              <Text style={[s.blockH, { color: C.amber }]}>NEEDS YOUR WORD</Text>
              <Text style={s.blockSub}>
                I worked these out rather than being told. They don't count until you say so.
              </Text>
              {proposed.map((c) => (
                <View key={c.id} style={s.pro}>
                  <Text style={s.proT}>{c.rationale}</Text>
                  {/* "Sourced" must be CHECKABLE, not a badge you're asked to trust.
                      The planner found a real page about the LANY tour and still got
                      two cities wrong — so the link goes where you can see it. */}
                  {c.evidence?.url ? (
                    <Pressable onPress={() => { tap(); Linking.openURL(c.evidence.url).catch(() => {}); }}>
                      <Text style={s.srcLink} numberOfLines={1}>
                        Source: {String(c.evidence.url).replace(/^https?:\/\//, "").split("/")[0]} ↗
                      </Text>
                    </Pressable>
                  ) : null}
                  <View style={s.proRow}>
                    <Pressable style={s.proNo} onPress={() => reject(c)}>
                      <Text style={s.proNoT}>Not right</Text>
                    </Pressable>
                    <Pressable style={s.proBtn} onPress={() => confirm(c)}>
                      <Text style={s.proBtnT}>Confirm</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* ── THE SHAPE ────────────────────────────────────────────────────
              Sketched, not booked. Every one of these carries a dashed border and
              the word SKETCH, and none of them can carry a flight number or a
              confirmation — the server strips those fields and an invariant fails
              loudly if one ever gets through.

              A planned leg that LOOKS like a booked one is the worst thing this
              app could ship: a fiction, rendered by the same components as a fact,
              shown to someone standing in an airport. */}
          {legs.length > 0 ? (
            <View style={s.block}>
              <Text style={s.blockH}>THE SHAPE SO FAR</Text>
              <Text style={s.blockSub}>Nothing here is booked. This is the outline.</Text>
              {legs.map((l) => (
                <View key={l.id} style={s.leg}>
                  <View style={s.legTop}>
                    <Text style={s.legT}>
                      {l.property_name || l.destination || l.destination_city}
                    </Text>
                    <Text style={s.legTag}>SKETCH</Text>
                  </View>
                  {l.raw_data?.why ? <Text style={s.legWhy}>{l.raw_data.why}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {thisTrip.length > 0 ? (
            <View style={s.block}>
              <Text style={s.blockH}>THIS TRIP</Text>
              {thisTrip.map((c) => <CRow key={c.id} c={c} />)}
            </View>
          ) : null}

          {/* Standing constraints — true of you on every trip. Wingman is applying
              them without being asked, which is the promise; but they belong in
              their own quiet block, not competing with the trip being planned. */}
          {aboutYou.length > 0 ? (
            <View style={s.block}>
              <Text style={[s.blockH, { color: C.mut }]}>ALWAYS TRUE OF YOU</Text>
              {aboutYou.map((c) => <CRow key={c.id} c={c} dim />)}
            </View>
          ) : null}

          {gaps.length > 0 && !busy && !empty ? (
            <Text style={s.gaps}>Still to settle: {gaps.join(" · ")}</Text>
          ) : null}

          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={s.composer}>
          <TextInput
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={empty ? "Where are you going?" : "Tell me more…"}
            placeholderTextColor={C.mut}
            multiline
            editable={!busy}
          />
          <Pressable
            style={[s.sendBtn, (!draft.trim() || busy) && { opacity: 0.35 }]}
            onPress={() => send()}
            disabled={!draft.trim() || busy}
            accessibilityLabel="Send to Wingman"
          >
            {busy ? <ActivityIndicator color={C.inkD} size="small" /> : <Text style={s.sendT}>↑</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ── one constraint, with its reason and its provenance ─────────────────────── */
function CRow({ c, dim }) {
  const h = HARD[c.hardness] || HARD.nice;
  return (
    <View style={s.cRow}>
      <View style={[s.cDot, { backgroundColor: h.color, opacity: dim ? 0.5 : 1 }]} />
      <View style={{ flex: 1 }}>
        <Text style={[s.cT, dim && { color: C.mut }]}>{c.rationale}</Text>
        <View style={s.cMeta}>
          <Text style={[s.cHard, { color: h.color, opacity: dim ? 0.6 : 1 }]}>{h.label}</Text>
          {c.scope ? <Text style={s.cScope}>· {c.scope}</Text> : null}
          {c.evidence?.url ? <Text style={s.cSrc}>· sourced</Text> : null}
          {c.expires_at ? (
            <Text style={s.cExp}>
              · until {new Date(c.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/* ── the empty state, which is really the pitch ─────────────────────────────── */
function Opening({ onPick }) {
  const seeds = [
    "Six shows across Asia in September — help me plan it",
    "A week somewhere warm in March, just the two of us",
    "I'm in Tokyo for work and want two days after",
  ];
  return (
    <FadeRise>
      <View style={s.open}>
        <SerifText style={s.openH}>Tell me about the trip.</SerifText>
        <Text style={s.openSub}>
          I'll ask what I need, look up what I can't be sure of, and remember why —
          so when something breaks, I know what's worth protecting.
        </Text>
        <View style={s.seeds}>
          {seeds.map((sd) => (
            <Pressable key={sd} style={s.seed} onPress={() => onPick(sd)}>
              <Text style={s.seedT}>{sd}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </FadeRise>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
         paddingHorizontal: 20, paddingVertical: 12,
         borderBottomWidth: 1, borderBottomColor: C.line },
  back: { color: C.mut, fontSize: 26, lineHeight: 28, width: 22 },
  barMid: { flexDirection: "row", alignItems: "center", gap: 8 },
  barT: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.6, color: C.gold },
  count: { fontFamily: T.sansM, fontSize: 12, color: C.mut, width: 22, textAlign: "right" },

  scroll: { padding: 20, paddingBottom: 8 },

  open: { paddingVertical: 30 },
  openH: { fontFamily: T.serifB, fontSize: 27, color: C.ink, letterSpacing: -0.5, marginBottom: 12 },
  openSub: { fontFamily: T.garamondI, fontSize: 17, lineHeight: 25, color: C.mut, fontStyle: "italic" },
  seeds: { marginTop: 26, gap: 10 },
  seed: { borderWidth: 1, borderColor: C.line, backgroundColor: C.card, borderRadius: 14, padding: 15 },
  seedT: { fontFamily: T.sansM, fontSize: 14, color: C.ink, lineHeight: 20 },

  me: { alignSelf: "flex-end", maxWidth: "86%", backgroundColor: C.card2,
        borderRadius: 16, borderBottomRightRadius: 5, padding: 13, marginBottom: 14 },
  meT: { fontFamily: T.sansM, fontSize: 14.5, lineHeight: 21, color: C.ink },

  wm: { maxWidth: "94%", marginBottom: 18 },
  wmHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 7 },
  wmName: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2.2, color: C.gold },
  wmT: { fontFamily: T.sans, fontSize: 15, lineHeight: 23, color: C.ink },

  think: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  thinkT: { fontFamily: T.garamondI, fontSize: 15, color: C.mut, fontStyle: "italic" },

  err: { borderWidth: 1, borderColor: C.coral, borderRadius: 12, padding: 13, marginBottom: 14,
         backgroundColor: "rgba(217,95,95,0.07)" },
  errT: { fontFamily: T.sansM, fontSize: 13, color: C.coral, marginBottom: 6 },
  errA: { fontFamily: T.sansB, fontSize: 13, color: C.gold },

  block: { marginTop: 12, marginBottom: 6, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 18 },
  blockH: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2.6, color: C.gold, marginBottom: 10 },
  blockSub: { fontFamily: T.garamondI, fontSize: 14.5, lineHeight: 20, color: C.mut, marginBottom: 14 },

  pro: { borderWidth: 1, borderColor: "rgba(212,144,42,0.4)", borderRadius: 12, padding: 14, marginBottom: 10 },
  proT: { fontFamily: T.sansM, fontSize: 14, lineHeight: 20, color: C.ink, marginBottom: 10 },
  proRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  src: { fontFamily: T.sansM, fontSize: 11, color: C.teal },
  srcLink: { fontFamily: T.sansM, fontSize: 11.5, color: C.teal, marginBottom: 10 },
  proBtn: { backgroundColor: C.gold, borderRadius: 9, paddingHorizontal: 16, paddingVertical: 8 },
  proBtnT: { fontFamily: T.sansB, fontSize: 13, color: C.inkD },
  proNo: { borderWidth: 1, borderColor: C.line, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  proNoT: { fontFamily: T.sansM, fontSize: 13, color: C.mut },

  // Dashed border, muted fill, an explicit SKETCH tag. A proposed leg must be
  // recognisable as unbooked at a glance, from across a room, half-asleep.
  leg: { borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(201,169,110,0.35)",
         borderRadius: 12, padding: 13, marginBottom: 9, backgroundColor: "rgba(201,169,110,0.03)" },
  legTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  legT: { fontFamily: T.sansM, fontSize: 14.5, color: C.ink, flex: 1 },
  legTag: { fontFamily: T.sansB, fontSize: 8, letterSpacing: 1.4, color: C.gold, opacity: 0.75 },
  legWhy: { fontFamily: T.garamondI, fontSize: 14, lineHeight: 19, color: C.mut,
            fontStyle: "italic", marginTop: 5 },

  cRow: { flexDirection: "row", gap: 11, marginBottom: 14 },
  cDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  cT: { fontFamily: T.sansM, fontSize: 14, lineHeight: 20, color: C.ink },
  cMeta: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 4 },
  cHard: { fontFamily: T.sansB, fontSize: 8.5, letterSpacing: 1.3 },
  cScope: { fontFamily: T.sansM, fontSize: 10.5, color: C.gold },
  cSrc: { fontFamily: T.sansM, fontSize: 10.5, color: C.teal },
  cExp: { fontFamily: T.sansM, fontSize: 10.5, color: C.amber },

  gaps: { fontFamily: T.garamondI, fontSize: 14, color: C.mut, marginTop: 14 },

  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 16,
              borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: C.card2, borderRadius: 22,
           paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12,
           fontFamily: T.sans, fontSize: 15, color: C.ink },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.gold,
             alignItems: "center", justifyContent: "center" },
  sendT: { fontSize: 20, color: C.inkD, fontWeight: "700", lineHeight: 22 },
});
