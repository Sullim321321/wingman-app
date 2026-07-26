// StayBookScreen — C6a: real, bookable hotels, hold-then-confirm.
//
// The safety story lives on the server (holds.js + stays.js): a HOLD places a Duffel
// quote and moves no money; the CHARGE is refused unless the confirm names the exact
// held offer and price and the hold is still live. This screen just walks that path in
// the quiet-luxury language: search → pick a room → hold → confirm. It never charges
// without an explicit tap on "Confirm & book", and it shows the test/live mode plainly.

import React, { useState, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Alert, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, T } from "../theme";
import { searchStays, getStayRates, holdStay, confirmStay, draftBookingEmail } from "../api";

function isoDay(d) { return d.toISOString().slice(0, 10); }
function fmt(day) {
  const d = new Date(day + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? day
    : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export default function StayBookScreen({ route, navigation }) {
  const p = route?.params || {};
  const [city] = useState(p.city || "");
  const [lat] = useState(p.latitude ?? null);
  const [lng] = useState(p.longitude ?? null);

  const today = new Date();
  const [checkIn, setCheckIn] = useState(isoDay(new Date(today.getTime() + 7 * 864e5)));
  const [checkOut, setCheckOut] = useState(isoDay(new Date(today.getTime() + 9 * 864e5)));

  const [guestName, setGuestName] = useState(p.guestName || "");
  const [mode, setMode] = useState(null);          // duffel mode label
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const [openId, setOpenId] = useState(null);       // expanded hotel
  const [rates, setRates] = useState({});           // search_result_id -> rates[]
  const [ratesBusy, setRatesBusy] = useState(null);

  const [hold, setHold] = useState(null);           // { hold, confirm_line }
  const [holdBusy, setHoldBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(null);

  const [emailHotel, setEmailHotel] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const runSearch = useCallback(async () => {
    setBusy(true); setErr(null); setResults(null); setOpenId(null); setHold(null); setDone(null);
    try {
      const r = await searchStays({ city, latitude: lat, longitude: lng, check_in_date: checkIn, check_out_date: checkOut });
      setMode(r.duffel_mode || null);
      setResults(r.results || []);
    } catch (e) { setErr(e?.message || "Couldn't reach availability."); }
    finally { setBusy(false); }
  }, [city, lat, lng, checkIn, checkOut]);

  const openRates = useCallback(async (sr) => {
    if (openId === sr.search_result_id) { setOpenId(null); return; }
    setOpenId(sr.search_result_id);
    if (rates[sr.search_result_id]) return;
    setRatesBusy(sr.search_result_id);
    try {
      const r = await getStayRates(sr.search_result_id);
      setRates((m) => ({ ...m, [sr.search_result_id]: r.rates || [] }));
    } catch (e) { setErr(e?.message || "Couldn't load rooms."); }
    finally { setRatesBusy(null); }
  }, [openId, rates]);

  const placeHold = useCallback(async (rate, hotelName) => {
    setHoldBusy(true); setErr(null);
    try {
      const r = await holdStay({ ...rate, name: hotelName });
      setHold({ ...r, hotelName });
    } catch (e) { setErr(e?.message || "Couldn't place the hold."); }
    finally { setHoldBusy(false); }
  }, []);

  const doConfirm = useCallback(async () => {
    if (!hold?.hold) return;
    const name = guestName.trim();
    if (!name || !name.includes(" ")) {
      Alert.alert("Who's the room for?", "Enter the guest's full name (first and last).");
      return;
    }
    const [given_name, ...rest] = name.split(" ");
    const family_name = rest.join(" ");
    setConfirming(true); setErr(null);
    try {
      const r = await confirmStay({
        hold: hold.hold,
        confirm: { confirm: true, offer_id: hold.hold.offer_id, amount: hold.hold.amount },
        guests: [{ given_name, family_name }],
      });
      if (r.ok) setDone(r.booking);
      else setErr(r.error || "The booking was refused.");
    } catch (e) { setErr(e?.message || "Couldn't complete the booking."); }
    finally { setConfirming(false); }
  }, [hold, guestName]);

  const draftEmail = useCallback(async () => {
    const name = emailHotel.trim();
    if (!name) { Alert.alert("Which hotel?", "Enter the hotel's name to draft the request."); return; }
    setEmailBusy(true); setErr(null);
    try {
      const r = await draftBookingEmail({
        hotel_name: name, area: city || undefined,
        check_in: checkIn, check_out: checkOut,
        guest_name: guestName.trim() || undefined,
      });
      if (r?.mailto) {
        const ok = await Linking.canOpenURL(r.mailto);
        if (ok) await Linking.openURL(r.mailto);
        else Alert.alert("Draft ready", r.body || "Your mail app couldn't be opened.");
      } else setErr(r?.error || "Couldn't draft the request.");
    } catch (e) { setErr(e?.message || "Couldn't draft the request."); }
    finally { setEmailBusy(false); }
  }, [emailHotel, city, checkIn, checkOut, guestName]);

  // ── Confirmation success ──────────────────────────────────────────────────
  if (done) {
    return (
      <SafeAreaView style={s.app}>
        <View style={s.doneWrap}>
          <Ionicons name="checkmark-circle-outline" size={44} color={C.teal} />
          <Text style={s.doneH}>Booked.</Text>
          <Text style={s.doneName}>{done.name}</Text>
          <Text style={s.doneMeta}>{done.currency} {done.amount}{done.reference ? ` · ${done.reference}` : ""}</Text>
          <Pressable style={s.primary} onPress={() => navigation.navigate("Tabs", { screen: "Trips" })}>
            <Text style={s.primaryT}>See it in Trips</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.head}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={C.ink} /></Pressable>
          <Text style={s.title}>Where to stay{city ? ` · ${city}` : ""}</Text>
          <View style={{ width: 24 }} />
        </View>

        {mode && mode !== "live" ? (
          <Text style={s.testBanner}>Test mode — these are Duffel's sample hotels, not real availability or prices. Nothing is charged. A live key shows real rooms.</Text>
        ) : null}

        {/* Dates */}
        <View style={s.dateRow}>
          <View style={s.dateCell}>
            <Text style={s.dateLabel}>CHECK-IN</Text>
            <TextInput style={s.dateInput} value={checkIn} onChangeText={setCheckIn} placeholder="YYYY-MM-DD" placeholderTextColor={C.mutD} autoCapitalize="none" />
            <Text style={s.datePretty}>{fmt(checkIn)}</Text>
          </View>
          <View style={s.dateCell}>
            <Text style={s.dateLabel}>CHECK-OUT</Text>
            <TextInput style={s.dateInput} value={checkOut} onChangeText={setCheckOut} placeholder="YYYY-MM-DD" placeholderTextColor={C.mutD} autoCapitalize="none" />
            <Text style={s.datePretty}>{fmt(checkOut)}</Text>
          </View>
        </View>
        <Pressable style={s.primary} onPress={runSearch} disabled={busy}>
          <Text style={s.primaryT}>{busy ? "Looking…" : "Find rooms"}</Text>
        </Pressable>

        {err ? <Text style={s.err}>{err}</Text> : null}
        {busy ? <ActivityIndicator color={C.gold} style={{ marginTop: 24 }} /> : null}

        {results && !results.length ? (
          <Text style={s.empty}>Nothing available for those dates nearby.</Text>
        ) : null}

        {results?.map((r) => {
          const open = openId === r.search_result_id;
          const rs = rates[r.search_result_id];
          return (
            <View key={r.search_result_id} style={s.card}>
              <Pressable style={s.cardHead} onPress={() => openRates(r)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.hotel}>{r.name}</Text>
                  <Text style={s.area}>{[r.area, r.rating ? `${r.rating}★` : null].filter(Boolean).join(" · ")}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.price}>{r.currency} {r.price}</Text>
                  <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={C.mut} />
                </View>
              </Pressable>

              {open ? (
                <View style={s.rates}>
                  {ratesBusy === r.search_result_id ? <ActivityIndicator color={C.gold} /> : null}
                  {rs?.map((rate) => (
                    <View key={rate.id} style={s.rateRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rateMeta}>{[rate.board_type, rate.refundable ? "Refundable" : "Non-refundable"].filter(Boolean).join(" · ")}</Text>
                        <Text style={s.ratePrice}>{rate.currency} {rate.price}</Text>
                      </View>
                      <Pressable style={s.holdBtn} onPress={() => placeHold(rate, r.name)} disabled={holdBusy}>
                        <Text style={s.holdBtnT}>{holdBusy ? "…" : "Hold"}</Text>
                      </Pressable>
                    </View>
                  ))}
                  {rs && !rs.length ? <Text style={s.empty}>No bookable rooms returned.</Text> : null}
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Confirm sheet */}
        {hold ? (
          <View style={s.confirmCard}>
            <Text style={s.confirmKicker}>CONFIRM TO BOOK</Text>
            <Text style={s.confirmName}>{hold.hotelName}</Text>
            <Text style={s.confirmLine}>{hold.confirm_line}</Text>
            <Text style={s.dateLabel}>GUEST</Text>
            <TextInput style={s.dateInput} value={guestName} onChangeText={setGuestName} placeholder="Full name" placeholderTextColor={C.mutD} />
            <View style={s.confirmActions}>
              <Pressable style={s.ghost} onPress={() => setHold(null)}><Text style={s.ghostT}>Not yet</Text></Pressable>
              <Pressable style={s.primaryC} onPress={doConfirm} disabled={confirming}>
                <Text style={s.primaryT}>{confirming ? "Booking…" : "Confirm & book"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Concierge-email fallback — hotels Duffel can't book */}
        <View style={s.emailCard}>
          <Text style={s.emailKicker}>SOMEWHERE I CAN'T BOOK DIRECTLY?</Text>
          <Text style={s.emailBlurb}>Name it and I'll draft the request — dates and guest filled in. You send it from your own mail.</Text>
          <View style={s.emailRow}>
            <TextInput style={s.emailInput} value={emailHotel} onChangeText={setEmailHotel} placeholder="Hotel name" placeholderTextColor={C.mutD} />
            <Pressable style={s.emailGo} onPress={draftEmail} disabled={emailBusy}>
              <Text style={s.emailGoT}>{emailBusy ? "…" : "Draft"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontFamily: T.serif, fontSize: 16, color: C.ink, flex: 1, textAlign: "center" },

  testBanner: { fontFamily: T.sansM, fontSize: 13, color: C.gold, backgroundColor: C.actionFill, borderRadius: 10, padding: 10, marginBottom: 14, overflow: "hidden" },

  dateRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  dateCell: { flex: 1 },
  dateLabel: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2, color: C.mut, marginBottom: 6, marginTop: 8 },
  dateInput: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: T.sansM, fontSize: 15, color: C.ink },
  datePretty: { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 13, color: C.mut, marginTop: 4 },

  primary: { backgroundColor: C.parch, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  primaryC: { backgroundColor: C.parch, borderRadius: 12, paddingVertical: 14, alignItems: "center", flex: 1 },
  primaryT: { fontFamily: T.sansM, fontSize: 15, color: C.inkD },

  err: { fontFamily: T.sans, fontSize: 15, color: C.coral, marginTop: 16 },
  empty: { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 15, color: C.mut, marginTop: 16 },

  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, marginTop: 12, overflow: "hidden" },
  cardHead: { flexDirection: "row", alignItems: "center", padding: 15 },
  hotel: { fontFamily: T.serif, fontSize: 16, color: C.ink },
  area: { fontFamily: T.sansM, fontSize: 13, color: C.mut, marginTop: 3 },
  price: { fontFamily: T.serifB || T.serif, fontSize: 16, color: C.ink },

  rates: { borderTopWidth: 1, borderTopColor: C.line, padding: 15, gap: 12 },
  rateRow: { flexDirection: "row", alignItems: "center" },
  rateMeta: { fontFamily: T.sans, fontSize: 13, color: C.mut },
  ratePrice: { fontFamily: T.sansM, fontSize: 15, color: C.ink, marginTop: 2 },
  holdBtn: { borderWidth: 1, borderColor: C.gold, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  holdBtnT: { fontFamily: T.sansM, fontSize: 13, color: C.gold },

  confirmCard: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.gold, borderRadius: 16, padding: 18, marginTop: 20 },
  confirmKicker: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.4, color: C.gold },
  confirmName: { fontFamily: T.display, fontSize: 22, color: C.ink, marginTop: 6 },
  confirmLine: { fontFamily: T.sans, fontSize: 13, color: C.ink, lineHeight: 20, marginTop: 6 },
  confirmActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  ghost: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  ghostT: { fontFamily: T.sansM, fontSize: 15, color: C.mut },

  emailCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 16, marginTop: 26 },
  emailKicker: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2, color: C.mut },
  emailBlurb: { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 13, color: C.mut, marginTop: 8, lineHeight: 19 },
  emailRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  emailInput: { flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: T.sansM, fontSize: 15, color: C.ink },
  emailGo: { backgroundColor: C.parch, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  emailGoT: { fontFamily: T.sansM, fontSize: 15, color: C.inkD },

  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  doneH: { fontFamily: T.display, fontSize: 30, color: C.ink, marginTop: 12 },
  doneName: { fontFamily: T.serif, fontSize: 16, color: C.ink, marginTop: 10 },
  doneMeta: { fontFamily: T.sansM, fontSize: 13, color: C.mut, marginTop: 6, marginBottom: 24 },
});
