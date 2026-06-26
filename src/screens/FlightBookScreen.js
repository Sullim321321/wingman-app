import React, { useState } from "react";
import {
  View, Text, TextInput, ScrollView, Pressable, ActivityIndicator,
  StyleSheet, Platform, KeyboardAvoidingView, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackBar, Btn, g, tap } from "../components";
import { C } from "../theme";
import * as api from "../api";

function formatTime(dt) {
  if (!dt) return "--";
  return new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}
function formatDate(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function formatDuration(iso) {
  if (!iso) return "";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  return (m[1] ? `${m[1]}h ` : "") + (m[2] ? `${m[2]}m` : "");
}

function Field({ label, value, onChange, placeholder, keyboardType, maxLength, autoCapitalize }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.field}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.mut}
        keyboardType={keyboardType || "default"}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize || "words"}
      />
    </View>
  );
}

export default function FlightBookScreen({ navigation, route }) {
  const { offer } = route.params;
  const slice = offer.slices?.[0];
  const segs = slice?.segments || [];
  const firstSeg = segs[0];
  const lastSeg = segs[segs.length - 1];
  const numPassengers = offer.passengers?.length || 1;

  const emptyPax = () => ({ given_name: "", family_name: "", born_on: "", gender: "m", email: "", phone: "" });
  const [passengers, setPassengers] = useState(Array.from({ length: numPassengers }, emptyPax));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function updatePax(i, field, value) {
    setPassengers(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }

  async function book() {
    // Validate
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.given_name.trim() || !p.family_name.trim() || !p.born_on.trim()) {
        setError(`Please fill in name and date of birth for passenger ${i + 1}.`);
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.born_on.trim())) {
        setError(`Date of birth for passenger ${i + 1} must be YYYY-MM-DD.`);
        return;
      }
    }
    setError(null);
    Alert.alert(
      "Confirm Booking",
      `Book ${firstSeg?.origin} → ${lastSeg?.destination} for ${offer.total_currency} ${offer.total_amount}?\n\nThis will charge your Duffel balance.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Book Now", style: "destructive", onPress: async () => {
            setLoading(true);
            try {
              const result = await api.bookFlight({
                offer_id: offer.id,
                passengers: passengers.map(p => ({
                  given_name: p.given_name.trim(),
                  family_name: p.family_name.trim(),
                  born_on: p.born_on.trim(),
                  gender: p.gender === "m" ? "m" : "f",
                  email: p.email.trim() || undefined,
                  phone: p.phone.trim() || undefined,
                })),
              });
              navigation.replace("FlightConfirm", { booking: result });
            } catch (e) {
              setError(e.message || "Booking failed. Please try again.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={g.scroll} keyboardShouldPersistTaps="handled">
          <BackBar nav={navigation} label="Passenger Details" />

          {/* Flight summary */}
          <View style={s.summary}>
            <View style={s.summaryRoute}>
              <View style={{ alignItems: "center" }}>
                <Text style={s.summaryIata}>{firstSeg?.origin}</Text>
                <Text style={s.summaryTime}>{formatTime(firstSeg?.departing_at)}</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={s.summaryDur}>{formatDuration(slice?.duration)}</Text>
                <View style={{ width: "80%", height: 1, backgroundColor: C.line, marginVertical: 4 }} />
                <Text style={s.summaryStops}>{segs.length === 1 ? "Nonstop" : `${segs.length - 1} stop`}</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={s.summaryIata}>{lastSeg?.destination}</Text>
                <Text style={s.summaryTime}>{formatTime(lastSeg?.arriving_at)}</Text>
              </View>
            </View>
            <Text style={s.summaryDate}>{formatDate(firstSeg?.departing_at)}</Text>
            <View style={s.summaryPrice}>
              <Text style={s.summaryPriceLabel}>Total</Text>
              <Text style={s.summaryPriceVal}>{offer.total_currency} {offer.total_amount}</Text>
            </View>
          </View>

          {/* Passenger forms */}
          {passengers.map((pax, i) => (
            <View key={i}>
              <Text style={g.sectionT}>PASSENGER {numPassengers > 1 ? i + 1 : ""}</Text>
              <View style={s.group}>
                <Field label="First name" value={pax.given_name} onChange={v => updatePax(i, "given_name", v)} placeholder="Amelia" />
                <Field label="Last name" value={pax.family_name} onChange={v => updatePax(i, "family_name", v)} placeholder="Earhart" />
                <Field label="Date of birth" value={pax.born_on} onChange={v => updatePax(i, "born_on", v)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" autoCapitalize="none" />
                <View style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>Gender</Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                    {[{ v: "m", l: "Male" }, { v: "f", l: "Female" }].map(({ v, l }) => (
                      <Pressable key={v} style={[s.genderBtn, pax.gender === v && s.genderBtnSel]} onPress={() => { tap(); updatePax(i, "gender", v); }}>
                        <Text style={[s.genderT, pax.gender === v && s.genderTSel]}>{l}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Field label="Email (optional)" value={pax.email} onChange={v => updatePax(i, "email", v)} placeholder="amelia@example.com" keyboardType="email-address" autoCapitalize="none" />
                <Field label="Phone (optional)" value={pax.phone} onChange={v => updatePax(i, "phone", v)} placeholder="+1 555 000 0000" keyboardType="phone-pad" autoCapitalize="none" />
              </View>
            </View>
          ))}

          <View style={s.notice}>
            <Text style={s.noticeT}>⚠️ Test mode — no real booking will be made. Duffel test environment only.</Text>
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={{ marginTop: 20, marginBottom: 40 }}>
            {loading
              ? <ActivityIndicator color={C.teal} size="large" />
              : <Btn title={`Book for ${offer.total_currency} ${offer.total_amount}`} onPress={book} kind="accent" />
            }
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  summary: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, marginBottom: 4 },
  summaryRoute: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  summaryIata: { color: C.ink, fontSize: 22, fontWeight: "800" },
  summaryTime: { color: C.mut, fontSize: 12, marginTop: 2 },
  summaryDur: { color: C.mut, fontSize: 12 },
  summaryStops: { color: C.mut, fontSize: 11 },
  summaryDate: { color: C.mut, fontSize: 13, marginBottom: 10 },
  summaryPrice: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 },
  summaryPriceLabel: { color: C.mut, fontSize: 13 },
  summaryPriceVal: { color: C.teal, fontSize: 20, fontWeight: "800" },
  group: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { color: C.mut, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  field: { color: C.ink, fontSize: 15, borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 8 },
  genderBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: "#0E1530", borderWidth: 1, borderColor: C.line, alignItems: "center" },
  genderBtnSel: { backgroundColor: "rgba(34,211,166,0.12)", borderColor: C.teal },
  genderT: { color: C.mut, fontSize: 14, fontWeight: "600" },
  genderTSel: { color: C.teal },
  notice: { backgroundColor: "rgba(255,176,46,0.08)", borderWidth: 1, borderColor: "rgba(255,176,46,0.2)", borderRadius: 12, padding: 12, marginTop: 8 },
  noticeT: { color: C.amber, fontSize: 12.5 },
  error: { color: C.coral, fontSize: 13, marginTop: 8 },
});
