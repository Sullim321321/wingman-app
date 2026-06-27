import React, { useState } from "react";
import {
  SafeAreaView, View, Text, TextInput, ScrollView,
  Pressable, StyleSheet, Platform, KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, T } from "../theme";
import { Btn } from "../components";
import { updateProfile, updateLocale } from "../api";
import * as SecureStore from "expo-secure-store";

const KEY_PROFILE_DONE = "wingman_profile_done";

const CABIN_OPTIONS = [
  { id: "economy",         label: "Economy",         sub: "Best value" },
  { id: "premium_economy", label: "Premium Economy", sub: "Extra legroom" },
  { id: "business",        label: "Business",        sub: "Lie-flat & lounge" },
  { id: "first",           label: "First Class",     sub: "The full experience" },
];

const TRAVEL_STYLE = [
  { id: "window",  label: "Window seat",        icon: "◱" },
  { id: "aisle",   label: "Aisle seat",         icon: "◳" },
  { id: "direct",  label: "Direct flights only", icon: "→" },
  { id: "points",  label: "Points maximiser",   icon: "◈" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
];

const CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "AED", "SGD",
];

const TOTAL_STEPS = 4;

export default function ProfileSetupScreen({ navigation }) {
  const [step, setStep]           = useState(0); // 0=name, 1=cabin, 2=style, 3=locale
  const [firstName, setFirstName] = useState("");
  const [cabin, setCabin]         = useState("economy");
  const [travelStyles, setTravelStyles] = useState([]);
  const [locale, setLocale]       = useState("en");
  const [currency, setCurrency]   = useState("USD");
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState("");

  const toggleStyle = (id) =>
    setTravelStyles(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const next = () => setStep(s => s + 1);

  const finish = async () => {
    setBusy(true);
    setErr("");
    try {
      await updateProfile({
        first_name: firstName.trim(),
        preferences: {
          cabin_preference: cabin,
          seat_preference: travelStyles.includes("window") ? "window" : travelStyles.includes("aisle") ? "aisle" : null,
          direct_only: travelStyles.includes("direct"),
          points_maximiser: travelStyles.includes("points"),
          payment_preference: travelStyles.includes("points") ? "best_value" : "cash_first",
          taste_setup_complete: true,
        },
      });
      await updateLocale({ locale, currency });
      await SecureStore.setItemAsync(KEY_PROFILE_DONE, "1");
      navigation.replace("Tabs");
    } catch (e) {
      setErr("Couldn't save your profile. Try again.");
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Progress dots */}
        <View style={s.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotActive, i < step && s.dotDone]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Step 0: Name ─────────────────────────────────────────────── */}
          {step === 0 && (
            <View style={s.step}>
              <LinearGradient colors={[C.gold, C.goldD || "#b8942a"]} style={s.mark}>
                <Text style={{ fontSize: 26 }}>✈</Text>
              </LinearGradient>
              <Text style={s.h}>What should Wingman call you?</Text>
              <Text style={s.sub}>
                Your first name is how Wingman greets you and personalises alerts.
              </Text>
              <TextInput
                style={s.input}
                placeholder="First name"
                placeholderTextColor={C.mut}
                autoCapitalize="words"
                autoFocus
                value={firstName}
                onChangeText={setFirstName}
                onSubmitEditing={() => firstName.trim() && next()}
                returnKeyType="next"
              />
              {err ? <Text style={s.err}>{err}</Text> : null}
              <Btn
                title="Continue"
                kind="accent"
                onPress={() => firstName.trim() && next()}
                style={{ marginTop: 24, alignSelf: "stretch" }}
              />
            </View>
          )}

          {/* ── Step 1: Cabin preference ──────────────────────────────────── */}
          {step === 1 && (
            <View style={s.step}>
              <Text style={s.h}>Your preferred cabin</Text>
              <Text style={s.sub}>
                Wingman uses this when searching rescue flights and award redemptions.
              </Text>
              {CABIN_OPTIONS.map(opt => (
                <Pressable
                  key={opt.id}
                  style={[s.option, cabin === opt.id && s.optionActive]}
                  onPress={() => setCabin(opt.id)}
                >
                  <View style={s.optionInner}>
                    <Text style={[s.optionLabel, cabin === opt.id && s.optionLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={s.optionSub}>{opt.sub}</Text>
                  </View>
                  {cabin === opt.id && <Text style={s.check}>✓</Text>}
                </Pressable>
              ))}
              <Btn
                title="Continue"
                kind="accent"
                onPress={next}
                style={{ marginTop: 24, alignSelf: "stretch" }}
              />
            </View>
          )}

          {/* ── Step 2: Travel style ──────────────────────────────────────── */}
          {step === 2 && (
            <View style={s.step}>
              <Text style={s.h}>Your travel style</Text>
              <Text style={s.sub}>
                Select all that apply. Wingman uses these to rank rescue options and
                book on your behalf.
              </Text>
              <View style={s.chips}>
                {TRAVEL_STYLE.map(opt => {
                  const active = travelStyles.includes(opt.id);
                  return (
                    <Pressable
                      key={opt.id}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => toggleStyle(opt.id)}
                    >
                      <Text style={[s.chipIcon, active && s.chipIconActive]}>{opt.icon}</Text>
                      <Text style={[s.chipLabel, active && s.chipLabelActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {err ? <Text style={s.err}>{err}</Text> : null}
              <Btn
                title="Continue"
                kind="accent"
                onPress={next}
                style={{ marginTop: 32, alignSelf: "stretch" }}
              />
              <Text style={s.skip} onPress={next}>Skip for now</Text>
            </View>
          )}

          {/* ── Step 3: Language & Currency ───────────────────────────────── */}
          {step === 3 && (
            <View style={s.step}>
              <Text style={s.h}>Language & currency</Text>
              <Text style={s.sub}>
                Wingman will display prices and alerts in your preferred currency and language.
              </Text>

              <Text style={s.sectionLabel}>LANGUAGE</Text>
              <View style={s.chips}>
                {LANGUAGES.map(lang => (
                  <Pressable
                    key={lang.code}
                    style={[s.chip, locale === lang.code && s.chipActive]}
                    onPress={() => setLocale(lang.code)}
                  >
                    <Text style={[s.chipLabel, locale === lang.code && s.chipLabelActive]}>
                      {lang.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[s.sectionLabel, { marginTop: 24 }]}>CURRENCY</Text>
              <View style={s.chips}>
                {CURRENCIES.map(cur => (
                  <Pressable
                    key={cur}
                    style={[s.chip, currency === cur && s.chipActiveTeal]}
                    onPress={() => setCurrency(cur)}
                  >
                    <Text style={[s.chipLabel, currency === cur && s.chipLabelTeal]}>
                      {cur}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {err ? <Text style={s.err}>{err}</Text> : null}
              <Btn
                title={busy ? "Setting up…" : "Let's fly"}
                kind="accent"
                onPress={busy ? undefined : finish}
                style={{ marginTop: 32, alignSelf: "stretch" }}
              />
              <Text style={s.skip} onPress={finish}>Skip for now</Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, padding: 28, paddingTop: 16 },
  dots:   { flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 16 },
  dot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.line },
  dotActive: { backgroundColor: C.gold, width: 18 },
  dotDone:   { backgroundColor: C.gold + "60" },
  step:   { flex: 1 },
  mark:   { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  h:      { color: C.ink, fontSize: 26, fontWeight: "700", marginBottom: 8, lineHeight: 32 },
  sub:    { color: C.mut, fontSize: 14, lineHeight: 20, marginBottom: 28 },
  sectionLabel: { color: C.mut, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 12, textTransform: "uppercase" },
  input:  {
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.line,
    borderRadius: 12, padding: 14,
    color: C.ink, fontSize: 17,
    marginBottom: 4,
  },
  err:    { color: "#e05", fontSize: 13, marginTop: 6 },
  option: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.line,
    borderRadius: 12, padding: 14,
    marginBottom: 10,
  },
  optionActive: { borderColor: C.gold, backgroundColor: C.gold + "12" },
  optionInner:  { flex: 1 },
  optionLabel:  { color: C.ink, fontSize: 15, fontWeight: "600" },
  optionLabelActive: { color: C.gold },
  optionSub:    { color: C.mut, fontSize: 12, marginTop: 2 },
  check:        { color: C.gold, fontSize: 18, fontWeight: "700" },
  chips:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip:         {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: C.line,
    backgroundColor: C.card,
  },
  chipActive:     { borderColor: C.gold, backgroundColor: C.gold + "15" },
  chipActiveTeal: { borderColor: C.teal, backgroundColor: C.teal + "15" },
  chipIcon:       { color: C.mut, fontSize: 15 },
  chipIconActive: { color: C.gold },
  chipLabel:      { color: C.mut, fontSize: 13, fontWeight: "500" },
  chipLabelActive: { color: C.gold },
  chipLabelTeal:  { color: C.teal },
  skip:           { color: C.mut, fontSize: 13, textAlign: "center", marginTop: 16, textDecorationLine: "underline" },
});
