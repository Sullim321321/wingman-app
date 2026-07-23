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
import { getCurate, curateDining } from "../api";

const PAPER = "#F5F2EC", CARD = "#FCFAF5", INK = "#211E1A", MUT = "#9A948A",
      BRONZE = "#96754A", SAGE = "#5E7A63", LINE = "rgba(33,30,26,0.08)";

const RATIONALE = {
  usual:     { icon: "repeat",           label: "Your usual" },
  deal:      { icon: "pricetag-outline", label: "Deal I found" },
  discovery: { icon: "sparkles-outline", label: "Worth a try" },
  memory:    { icon: "time-outline",     label: "You loved it" },
};

export default function CuratorScreen({ navigation }) {
  const [city, setCity] = useState("");
  const [coords, setCoords] = useState(null); // { latitude, longitude } — for real booking
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const [wish, setWish] = useState("");
  const [dining, setDining] = useState(null);
  const [diningBusy, setDiningBusy] = useState(false);

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

  const picks = data?.picks;

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

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

        {dining?.picks?.length ? (
          <View style={s.group}>
            <Text style={s.kicker}>{dining.intent === "exact" ? "ON IT" : "TRY THESE"}</Text>
            {dining.picks.map((p, i) => (
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
        {data && data.known === false ? (
          <Text style={s.empty}>{data.note}</Text>
        ) : null}

        {picks?.stay?.length ? (
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

        {picks?.dine?.length ? (
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

        {picks?.do?.length ? (
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

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:    { flex: 1, backgroundColor: PAPER },
  scroll: { padding: 22, paddingTop: 20 },

  head:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  brand:  { flexDirection: "row", alignItems: "center", gap: 8 },
  w:      { fontFamily: T.serif, fontSize: 21, color: INK },
  wordmark:{ fontFamily: T.sansB, fontSize: 10.5, letterSpacing: 3, color: MUT },
  loc:    { fontFamily: T.sansM, fontSize: 12, color: MUT },

  hero:   { fontFamily: T.serif, fontSize: 30, lineHeight: 34, color: INK },
  sub:    { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 14.5, color: MUT, marginTop: 6, marginBottom: 20 },

  cityRow:   { flexDirection: "row", gap: 10, marginBottom: 12 },
  cityInput: { flex: 1, backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: T.sansM, fontSize: 15, color: INK },
  cityGo:    { backgroundColor: INK, borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" },
  cityGoT:   { fontFamily: T.sansM, fontSize: 14, color: PAPER },

  wishWrap:  { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12, marginBottom: 22 },
  wishInput: { fontFamily: T.sans, fontSize: 14.5, color: INK, minHeight: 44, lineHeight: 20 },
  wishGo:    { alignSelf: "flex-end", marginTop: 8, backgroundColor: BRONZE, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  wishGoT:   { fontFamily: T.sansM, fontSize: 13, color: PAPER },

  section: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.4, color: BRONZE, marginTop: 22, marginBottom: 11 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bookLink: { fontFamily: T.sansM, fontSize: 12.5, color: BRONZE, marginTop: 22, marginBottom: 11 },
  kicker:  { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.4, color: BRONZE, padding: 15, paddingBottom: 0 },

  group:   { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 14, overflow: "hidden" },
  item:    { padding: 15 },
  itemDiv: { borderTopWidth: 1, borderTopColor: LINE },
  itemMark:{ borderLeftWidth: 2, borderLeftColor: BRONZE },
  itemHead:{ flexDirection: "row", alignItems: "center" },
  name:    { fontFamily: T.serif, fontSize: 18, color: INK },
  vibe:    { fontFamily: T.sansM, fontSize: 12, color: MUT, marginTop: 3 },
  why:     { fontFamily: T.sans, fontSize: 12.5, color: SAGE, marginTop: 4, lineHeight: 17 },
  src:     { fontFamily: T.sansM, fontSize: 11, letterSpacing: 0.4, color: BRONZE, marginTop: 8 },

  err:    { fontFamily: T.sans, fontSize: 14, color: "#A32D2D", marginTop: 20 },
  empty:  { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 15, color: MUT, marginTop: 24, lineHeight: 22 },
});
