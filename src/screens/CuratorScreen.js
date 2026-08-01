// CuratorScreen — the Curator's face (Explore tab).
//
// The first surface in the new "quiet luxury" language: ivory paper, deep ink, one
// bronze accent, sage for what Wingman knows. It renders the curation engine —
// a hotel slate (with a reason each), dining, and off-beat things to do attributed
// to the editors you read — and takes a spoken dining wish ("avec and Alinea but
// chiller"). The rest of the app is still dark; the retheme follows this.

import React, { useState, useCallback, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { T } from "../theme";
import { useTheme, useThemedStyles } from "../ThemeContext";
import { FadeRise } from "../components";
import { getCurate, curateDining, getPockets } from "../api";

// (Dead light-locked consts removed — PAPER/CARD/INK/… are re-bound to the live theme
//  inside the component and makeStyles, so Curator flips light↔dark correctly. Epic 5.)

const RATIONALE = {
  usual:     { icon: "repeat",           label: "Your usual" },
  deal:      { icon: "pricetag-outline", label: "Deal I found" },
  discovery: { icon: "sparkles-outline", label: "Worth a try" },
  memory:    { icon: "time-outline",     label: "You loved it" },
};

export default function CuratorScreen({ navigation }) {
  const { C } = useTheme();
  const s = useThemedStyles(makeStyles);
  // Inline colour usages themed from the active palette (shadow the light module consts).
  const PAPER = C.bg, CARD = C.card, INK = C.ink, MUT = C.mutD, BRONZE = C.gold, SAGE = C.teal, LINE = C.line;
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState(null); // { latitude, longitude } — for real booking
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const [wish, setWish] = useState("");
  const [dining, setDining] = useState(null);
  const [diningBusy, setDiningBusy] = useState(false);
  const [pockets, setPockets] = useState([]);   // free windows in the near future

  const load = useCallback(async (c) => {
    const where = (c ?? city).trim();
    if (!where) return;
    setBusy(true); setErr(null);
    try { setData(await getCurate(where)); }
    catch (e) { setErr(e?.message || "Couldn't reach the curator."); }
    finally { setBusy(false); }
  }, [city]);

  // On open: use your location to set the city, then curate. You can override it.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        const c = place?.city || place?.subregion || "";
        if (c) { setCity(c); load(c); }
      } catch { /* leave the field for manual entry */ }
    })();
  }, []); // eslint-disable-line

  const askDining = useCallback(async () => {
    const request = wish.trim();
    if (!request) return;
    setDiningBusy(true);
    try { setDining(await curateDining({ city: city.trim(), request })); }
    catch (e) { setDining({ error: e?.message || "Couldn't answer that." }); }
    finally { setDiningBusy(false); }
  }, [wish, city]);

  // Your free windows, from the calendar — the Curator's "two hours to yourself" moment.
  useEffect(() => {
    (async () => {
      try { const r = await getPockets(3); setPockets(r?.pockets || []); }
      catch { /* pockets are a nicety; never block the Curator */ }
    })();
  }, []);

  const fmtPocket = (p) => {
    const s = new Date(p.start), e = new Date(p.end);
    const day = s.toLocaleDateString("en-US", { weekday: "short" });
    const t = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${day} ${t(s)}–${t(e)}`;
  };

  // Tapping a pocket curates FOR that window — the alive moment: free time → a suggestion.
  const askForPocket = useCallback(async (p) => {
    const hrs = Math.round(p.minutes / 60);
    const request = `Something to do in my free time — ${fmtPocket(p)}, about ${hrs} ${hrs === 1 ? "hour" : "hours"} free. Off-beat, to my taste.`;
    setWish(request);
    setDiningBusy(true);
    try { setDining(await curateDining({ city: city.trim(), request })); }
    catch (e) { setDining({ error: e?.message || "Couldn't answer that." }); }
    finally { setDiningBusy(false); }
  }, [city]);

  const picks = data?.picks;
  // Once you've asked something, the answer stands alone — the resting slate hides.
  const answering = !!(dining && (dining.picks?.length || dining.error));

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <FadeRise>

        <View style={s.head}>
          <View style={s.brand}>
            <Text style={s.w}>W</Text>
            <Text style={s.wordmark}>WINGMAN</Text>
          </View>
          <Text style={s.loc}>Curator</Text>
        </View>

        <Text style={s.hero}>What's good{city ? `, ${city}` : ""}?</Text>
        <Text style={s.sub}>Pulled from your taste and the editors you read.</Text>

        {/* Where */}
        <View style={s.cityRow}>
          <TextInput
            style={s.cityInput}
            value={city}
            onChangeText={setCity}
            placeholder="City"
            placeholderTextColor={MUT}
            onSubmitEditing={() => load()}
            returnKeyType="search"
          />
          <Pressable style={s.cityGo} onPress={() => load()}>
            <Text style={s.cityGoT}>Curate</Text>
          </Pressable>
        </View>

        {/* Spoken dining wish */}
        <View style={s.wishWrap}>
          <TextInput
            style={s.wishInput}
            value={wish}
            onChangeText={setWish}
            placeholder="Tell me what you're after — 'avec and Alinea but chiller'"
            placeholderTextColor={MUT}
            multiline
          />
          <Pressable style={s.wishGo} onPress={askDining} disabled={diningBusy}>
            <Text style={s.wishGoT}>{diningBusy ? "Thinking…" : "Ask"}</Text>
          </Pressable>
        </View>

        {/* When you ask something, you get the answer — and only the answer. The
            standing slate is the resting state; it steps aside so a reply isn't buried
            under a generic list. Clear the answer to bring the slate back. */}
        {answering ? (
          <View style={s.group}>
            <View style={s.answerHead}>
              <Text style={s.kicker}>{dining.intent === "exact" ? "ON IT" : "TRY THESE"}</Text>
              <Pressable onPress={() => { setDining(null); setWish(""); }} hitSlop={8}>
                <Text style={s.clearLink}>Clear</Text>
              </Pressable>
            </View>
            {dining.error ? (
              <View style={s.item}><Text style={s.why}>{dining.error}</Text></View>
            ) : dining.picks.map((p, i) => (
              <View key={"dn" + i} style={[s.item, i > 0 && s.itemDiv]}>
                <Text style={s.name}>{p.name}</Text>
                {p.vibe ? <Text style={s.vibe}>{p.vibe}</Text> : null}
                <Text style={s.why}>{p.why}</Text>
                {p.source ? <Text style={s.src}>{p.source}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {busy ? <ActivityIndicator color={BRONZE} style={{ marginTop: 30 }} /> : null}
        {err ? <Text style={s.err}>{err}</Text> : null}
        {!answering && data && data.known === false ? (
          <Text style={s.empty}>{data.note}</Text>
        ) : null}

        {!answering && pockets.length ? (
          <>
            <Text style={s.section}>POCKETS OF TIME</Text>
            <View style={s.group}>
              {pockets.slice(0, 4).map((p, i) => (
                <Pressable key={"pk" + i} style={[s.item, i > 0 && s.itemDiv]} onPress={() => askForPocket(p)}>
                  <View style={s.itemHead}>
                    <Ionicons name="time-outline" size={16} color={BRONZE} style={{ marginRight: 8 }} />
                    <Text style={s.name}>{fmtPocket(p)}</Text>
                  </View>
                  <Text style={s.why}>{Math.round((p.minutes / 60) * 10) / 10} hrs free · tap for something to do</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {!answering && picks?.stay?.length ? (
          <>
            <View style={s.sectionRow}>
              <Text style={s.section}>WHERE TO STAY</Text>
              <Pressable
                onPress={() => navigation?.navigate?.("StayBook", { city: city.trim(), latitude: coords?.latitude, longitude: coords?.longitude })}
                hitSlop={8}
              >
                <Text style={s.bookLink}>Book a room →</Text>
              </Pressable>
            </View>
            <View style={s.group}>
              {picks.stay.map((h, i) => {
                const rt = RATIONALE[h.rationale] || RATIONALE.discovery;
                return (
                  <View key={"st" + i} style={[s.item, i > 0 && s.itemDiv, h.rationale === "usual" && s.itemMark]}>
                    <View style={s.itemHead}>
                      <Ionicons name={rt.icon} size={16} color={h.rationale === "usual" ? SAGE : BRONZE} style={{ marginRight: 8 }} />
                      <Text style={s.name}>{h.name}</Text>
                    </View>
                    <Text style={s.why}>{[rt.label, h.area, h.why].filter(Boolean).join(" · ")}</Text>
                    {h.source ? <Text style={s.src}>{h.source}</Text> : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {!answering && picks?.dine?.length ? (
          <>
            <Text style={s.section}>DINE</Text>
            <View style={s.group}>
              {picks.dine.map((r, i) => (
                <View key={"di" + i} style={[s.item, i > 0 && s.itemDiv]}>
                  <Text style={s.name}>{r.name}</Text>
                  <Text style={s.why}>{r.why}</Text>
                  {r.source ? <Text style={s.src}>{r.source}</Text> : null}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {!answering && picks?.do?.length ? (
          <>
            <Text style={s.section}>OFF THE BEATEN PATH</Text>
            <View style={s.group}>
              {picks.do.map((a, i) => (
                <View key={"do" + i} style={[s.item, i > 0 && s.itemDiv]}>
                  <Text style={s.name}>{a.name}</Text>
                  <Text style={s.why}>{a.why}</Text>
                  {a.source ? <Text style={s.src}>{a.source}</Text> : null}
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={{ height: 150 }} />
      </FadeRise>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => {
  const PAPER = C.bg, CARD = C.card, INK = C.ink, MUT = C.mutD, BRONZE = C.gold, SAGE = C.teal, LINE = C.line;
  return ({
  app:    { flex: 1, backgroundColor: PAPER },
  scroll: { padding: 22, paddingTop: 20 },

  head:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  brand:  { flexDirection: "row", alignItems: "center", gap: 8 },
  w:      { fontFamily: T.display, fontSize: 22, color: INK },
  wordmark:{ fontFamily: T.sansB, fontSize: 11, letterSpacing: 3, color: MUT },
  loc:    { fontFamily: T.sansM, fontSize: 13, color: MUT },

  hero:   { fontFamily: T.display, fontSize: 30, lineHeight: 34, color: INK },
  sub:    { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 15, color: MUT, marginTop: 6, marginBottom: 20 },

  cityRow:   { flexDirection: "row", gap: 10, marginBottom: 12 },
  cityInput: { flex: 1, backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: T.sansM, fontSize: 15, color: INK },
  cityGo:    { backgroundColor: INK, borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" },
  cityGoT:   { fontFamily: T.sansM, fontSize: 15, color: PAPER },

  wishWrap:  { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12, marginBottom: 22 },
  wishInput: { fontFamily: T.sans, fontSize: 15, color: INK, minHeight: 44, lineHeight: 20 },
  wishGo:    { alignSelf: "flex-end", marginTop: 8, backgroundColor: BRONZE, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  wishGoT:   { fontFamily: T.sansM, fontSize: 13, color: PAPER },

  section: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.4, color: BRONZE, marginTop: 22, marginBottom: 11 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bookLink: { fontFamily: T.sansM, fontSize: 13, color: BRONZE, marginTop: 22, marginBottom: 11 },
  kicker:  { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.4, color: BRONZE, padding: 15, paddingBottom: 0 },
  answerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: 15 },
  clearLink: { fontFamily: T.sansM, fontSize: 13, color: MUT, paddingTop: 15 },

  group:   { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 14, overflow: "hidden" },
  item:    { padding: 15 },
  itemDiv: { borderTopWidth: 1, borderTopColor: LINE },
  itemMark:{ borderLeftWidth: 2, borderLeftColor: BRONZE },
  itemHead:{ flexDirection: "row", alignItems: "center" },
  name:    { fontFamily: T.serif, fontSize: 16, color: INK },
  vibe:    { fontFamily: T.sansM, fontSize: 13, color: MUT, marginTop: 3 },
  why:     { fontFamily: T.sans, fontSize: 13, color: SAGE, marginTop: 4, lineHeight: 17 },
  src:     { fontFamily: T.sansM, fontSize: 11, letterSpacing: 0.4, color: BRONZE, marginTop: 8 },

  err:    { fontFamily: T.sans, fontSize: 15, color: C.coral, marginTop: 20 },
  empty:  { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 15, color: MUT, marginTop: 24, lineHeight: 22 },
  });
};
