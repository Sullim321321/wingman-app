// TravelProfileScreen — Wingman
// Lets users set: home airports, seat preference, travel pace,
// payment methods, dietary preferences, connection time, notification prefs
import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  TextInput, Switch, Alert, ActivityIndicator,
} from "react-native";
import { C, T } from "../theme";
import { SerifText, tap } from "../components";
import { getTravelProfile, updateTravelProfile } from "../api";

const SEAT_OPTIONS    = ["aisle", "window", "middle"];
const CABIN_OPTIONS   = ["economy", "premium_economy", "business", "first"];
const PACE_OPTIONS    = ["tight", "comfortable", "generous"];
const PAYMENT_OPTIONS = [
  { key: "apple_pay",    label: "Apple Pay" },
  { key: "contactless",  label: "Contactless card" },
  { key: "credit_card",  label: "Credit card" },
  { key: "cash",         label: "Cash" },
];
const DIETARY_OPTIONS = [
  "vegetarian", "vegan", "gluten-free", "halal", "kosher",
  "dairy-free", "nut-free", "pescatarian",
];
const PACE_LABELS = {
  tight: "Tight — I cut it close",
  comfortable: "Comfortable — standard buffer",
  generous: "Generous — I like plenty of time",
};
const CABIN_LABELS = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first: "First Class",
};

function SectionHeader({ title, sub }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

function OptionChip({ label, selected, onPress }) {
  return (
    <Pressable
      style={[s.chip, selected && s.chipSelected]}
      onPress={() => { tap(); onPress(); }}
    >
      <Text style={[s.chipT, selected && s.chipTSelected]}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({ label, sub, value, onValueChange }) {
  return (
    <View style={s.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {sub ? <Text style={s.toggleSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: C.line, true: C.gold + "80" }}
        thumbColor={value ? C.gold : C.mut}
      />
    </View>
  );
}

export default function TravelProfileScreen({ navigation }) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState(false);

  // Profile state
  const [homeAirports, setHomeAirports]       = useState([]);
  const [homeInput, setHomeInput]             = useState("");
  const [seatPref, setSeatPref]               = useState("aisle");
  const [cabinPref, setCabinPref]             = useState("economy");
  const [travelPace, setTravelPace]           = useState("comfortable");
  const [paymentMethods, setPaymentMethods]   = useState(["apple_pay", "contactless"]);
  const [dietary, setDietary]                 = useState([]);
  const [minConnection, setMinConnection]     = useState(60);
  const [autoCheckin, setAutoCheckin]         = useState(true);
  const [notifyGate, setNotifyGate]           = useState(true);
  const [notifyDelay, setNotifyDelay]         = useState(true);
  const [notifyJourney, setNotifyJourney]     = useState(true);

  useEffect(() => {
    getTravelProfile()
      .then(d => {
        if (!d?.profile) return;
        const p = d.profile;
        setHomeAirports(p.home_airports || []);
        setSeatPref(p.seat_preference || "aisle");
        setCabinPref(p.cabin_preference || "economy");
        setTravelPace(p.travel_pace || "comfortable");
        setPaymentMethods(p.payment_methods || ["apple_pay", "contactless"]);
        setDietary(p.dietary || []);
        setMinConnection(p.min_connection_mins || 60);
        setAutoCheckin(p.auto_checkin !== false);
        setNotifyGate(p.notify_gate_change !== false);
        setNotifyDelay(p.notify_delay !== false);
        setNotifyJourney(p.notify_journey !== false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const mark = () => setDirty(true);

  const addHomeAirport = () => {
    const code = homeInput.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    if (!code || homeAirports.includes(code)) { setHomeInput(""); return; }
    setHomeAirports(prev => [...prev, code]);
    setHomeInput("");
    mark();
  };

  const removeHomeAirport = (code) => {
    setHomeAirports(prev => prev.filter(c => c !== code));
    mark();
  };

  const togglePayment = (key) => {
    setPaymentMethods(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
    mark();
  };

  const toggleDietary = (item) => {
    setDietary(prev =>
      prev.includes(item) ? prev.filter(d => d !== item) : [...prev, item]
    );
    mark();
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateTravelProfile({
        home_airports: homeAirports,
        seat_preference: seatPref,
        cabin_preference: cabinPref,
        travel_pace: travelPace,
        payment_methods: paymentMethods,
        dietary,
        min_connection_mins: minConnection,
        auto_checkin: autoCheckin,
        notify_gate_change: notifyGate,
        notify_delay: notifyDelay,
        notify_journey: notifyJourney,
      });
      setDirty(false);
      Alert.alert("Saved", "Your travel profile has been updated.");
    } catch (e) {
      Alert.alert("Error", "Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={C.gold} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <SerifText bold style={s.title}>Travel Profile</SerifText>
          <Text style={s.subtitle}>Wingman uses this to personalise every interaction — from seat selection to payment warnings.</Text>
        </View>

        {/* Home Airports */}
        <SectionHeader title="Home Airport(s)" sub="Where you usually fly from" />
        <View style={s.card}>
          <View style={s.airportRow}>
            {homeAirports.map(code => (
              <Pressable key={code} style={s.airportChip} onPress={() => removeHomeAirport(code)}>
                <Text style={s.airportChipT}>{code}</Text>
                <Text style={s.airportChipX}>  ✕</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              placeholder="Add IATA code (e.g. DUB)"
              placeholderTextColor={C.mut}
              value={homeInput}
              onChangeText={setHomeInput}
              autoCapitalize="characters"
              maxLength={4}
              returnKeyType="done"
              onSubmitEditing={addHomeAirport}
            />
            <Pressable style={s.addBtn} onPress={addHomeAirport}>
              <Text style={s.addBtnT}>Add</Text>
            </Pressable>
          </View>
        </View>

        {/* Seat Preference */}
        <SectionHeader title="Seat Preference" sub="Used for automatic check-in" />
        <View style={[s.card, s.chipRow]}>
          {SEAT_OPTIONS.map(opt => (
            <OptionChip
              key={opt}
              label={opt.charAt(0).toUpperCase() + opt.slice(1)}
              selected={seatPref === opt}
              onPress={() => { setSeatPref(opt); mark(); }}
            />
          ))}
        </View>

        {/* Cabin Preference */}
        <SectionHeader title="Cabin Preference" sub="Your usual cabin class" />
        <View style={[s.card, s.chipRow]}>
          {CABIN_OPTIONS.map(opt => (
            <OptionChip
              key={opt}
              label={CABIN_LABELS[opt]}
              selected={cabinPref === opt}
              onPress={() => { setCabinPref(opt); mark(); }}
            />
          ))}
        </View>

        {/* Travel Pace */}
        <SectionHeader title="Travel Pace" sub="How much buffer do you like at the airport?" />
        <View style={s.card}>
          {PACE_OPTIONS.map(opt => (
            <Pressable
              key={opt}
              style={[s.paceRow, travelPace === opt && s.paceRowSelected]}
              onPress={() => { tap(); setTravelPace(opt); mark(); }}
            >
              <View style={[s.paceRadio, travelPace === opt && s.paceRadioSelected]} />
              <Text style={[s.paceLabel, travelPace === opt && s.paceLabelSelected]}>
                {PACE_LABELS[opt]}
              </Text>
            </Pressable>
          ))}
          <Text style={s.paceHint}>
            Minimum connection time: {minConnection} min
          </Text>
          <View style={s.connectionRow}>
            {[30, 45, 60, 90, 120].map(m => (
              <OptionChip
                key={m}
                label={`${m}m`}
                selected={minConnection === m}
                onPress={() => { setMinConnection(m); mark(); }}
              />
            ))}
          </View>
        </View>

        {/* Payment Methods */}
        <SectionHeader title="How You Pay" sub="Wingman warns you when these won't work" />
        <View style={[s.card, s.chipRow]}>
          {PAYMENT_OPTIONS.map(opt => (
            <OptionChip
              key={opt.key}
              label={opt.label}
              selected={paymentMethods.includes(opt.key)}
              onPress={() => togglePayment(opt.key)}
            />
          ))}
        </View>

        {/* Dietary */}
        <SectionHeader title="Dietary Preferences" sub="Used for restaurant and lounge suggestions" />
        <View style={[s.card, s.chipRow]}>
          {DIETARY_OPTIONS.map(opt => (
            <OptionChip
              key={opt}
              label={opt.charAt(0).toUpperCase() + opt.slice(1)}
              selected={dietary.includes(opt)}
              onPress={() => toggleDietary(opt)}
            />
          ))}
        </View>

        {/* Automation */}
        <SectionHeader title="Automation" sub="What Wingman can do on your behalf" />
        <View style={s.card}>
          <ToggleRow
            label="Auto check-in"
            sub="Wingman checks you in when the window opens and selects your preferred seat"
            value={autoCheckin}
            onValueChange={v => { setAutoCheckin(v); mark(); }}
          />
        </View>

        {/* Notifications */}
        <SectionHeader title="Notifications" sub="What Wingman alerts you about" />
        <View style={s.card}>
          <ToggleRow
            label="Gate changes & delays"
            sub="Instant push when your flight status changes"
            value={notifyDelay}
            onValueChange={v => { setNotifyDelay(v); mark(); }}
          />
          <View style={s.divider} />
          <ToggleRow
            label="Journey buffer alerts"
            sub="Alert when traffic + security means you might be cutting it close"
            value={notifyJourney}
            onValueChange={v => { setNotifyJourney(v); mark(); }}
          />
          <View style={s.divider} />
          <ToggleRow
            label="Gate change alerts"
            sub="Push when your departure gate changes"
            value={notifyGate}
            onValueChange={v => { setNotifyGate(v); mark(); }}
          />
        </View>

        {/* Save */}
        {dirty && (
          <Pressable style={s.saveBtn} onPress={save} disabled={saving}>
            {saving
              ? <ActivityIndicator color={C.bg} />
              : <Text style={s.saveBtnT}>Save Profile</Text>
            }
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg },
  scroll:         { paddingHorizontal: 20, paddingTop: 16 },
  header:         { marginBottom: 24 },
  title:          { color: C.ink, fontSize: 28, marginBottom: 6 },
  subtitle:       { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 19 },
  sectionHeader:  { marginTop: 20, marginBottom: 8 },
  sectionTitle:   { color: C.ink, fontSize: 14, fontFamily: T.sansB, letterSpacing: 0.3 },
  sectionSub:     { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 2 },
  card:           { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line, marginBottom: 4 },
  chipRow:        { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg },
  chipSelected:   { borderColor: C.gold, backgroundColor: C.gold + "18" },
  chipT:          { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  chipTSelected:  { color: C.gold },
  airportRow:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  airportChip:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.gold + "60", backgroundColor: C.gold + "12" },
  airportChipT:   { color: C.gold, fontSize: 13, fontFamily: T.sansB },
  airportChipX:   { color: C.mut, fontSize: 11 },
  inputRow:       { flexDirection: "row", gap: 8 },
  input:          { flex: 1, backgroundColor: C.bg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.line, color: C.ink, fontSize: 14, fontFamily: T.sans },
  addBtn:         { backgroundColor: C.gold, borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  addBtnT:        { color: C.bg, fontSize: 13, fontFamily: T.sansB },
  paceRow:        { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  paceRowSelected:{ backgroundColor: C.gold + "0A", borderRadius: 10, paddingHorizontal: 8 },
  paceRadio:      { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: C.mut },
  paceRadioSelected: { borderColor: C.gold, backgroundColor: C.gold },
  paceLabel:      { color: C.mut, fontSize: 13, fontFamily: T.sans, flex: 1 },
  paceLabelSelected: { color: C.ink, fontFamily: T.sansM },
  paceHint:       { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 10, marginBottom: 6 },
  connectionRow:  { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  toggleRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  toggleLabel:    { color: C.ink, fontSize: 13, fontFamily: T.sansM },
  toggleSub:      { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2, lineHeight: 16 },
  divider:        { height: 1, backgroundColor: C.line, marginVertical: 4 },
  saveBtn:        { backgroundColor: C.gold, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 20 },
  saveBtnT:       { color: C.bg, fontSize: 15, fontFamily: T.sansB },
});
