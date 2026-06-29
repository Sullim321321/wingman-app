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

export default function ProfileSetupScreen({ navigation }) {
  const [firstName, setFirstName] = useState("");
  const [cabin, setCabin]         = useState("economy");
  const [busy, setBusy]           = useState(false);

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    // Mark profile done locally first — never block navigation on a network error.
    try { await SecureStore.setItemAsync(KEY_PROFILE_DONE, "1"); } catch (_) {}
    // Fire API saves in background (don't await — a failure here is non-fatal)
    updateProfile({
      first_name: firstName.trim(),
      preferences: {
        cabin_preference: cabin,
        taste_setup_complete: true,
      },
    }).catch(e => console.warn("[ProfileSetup] updateProfile:", e.message));
    updateLocale({ locale: "en", currency: "USD" })
      .catch(e => console.warn("[ProfileSetup] updateLocale:", e.message));
    // Reset the stack so the user lands on Tabs and can't swipe back to setup
    navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <LinearGradient colors={[C.gold, C.goldD || "#b8942a"]} style={s.mark}>
            <Text style={{ fontSize: 26 }}>✈</Text>
          </LinearGradient>
          <Text style={s.h}>One last thing.</Text>
          <Text style={s.sub}>
            Tell Wingman a little about how you fly. You can update these any time in Settings.
          </Text>

          {/* Name */}
          <Text style={s.label}>YOUR NAME</Text>
          <TextInput
            style={s.input}
            placeholder="First name"
            placeholderTextColor={C.mut}
            autoCapitalize="words"
            autoComplete="given-name"
            autoCorrect={false}
            autoFocus
            value={firstName}
            onChangeText={setFirstName}
            returnKeyType="done"
          />

          {/* Cabin */}
          <Text style={[s.label, { marginTop: 24 }]}>PREFERRED CABIN</Text>
          <Text style={s.hint}>Wingman uses this to filter upgrade opportunities and lounge access.</Text>
          <View style={s.cabinRow}>
            {CABIN_OPTIONS.map(opt => (
              <Pressable
                key={opt.id}
                style={[s.cabinChip, cabin === opt.id && s.cabinChipActive]}
                onPress={() => setCabin(opt.id)}
              >
                <Text style={[s.cabinLabel, cabin === opt.id && s.cabinLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[s.cabinSub, cabin === opt.id && s.cabinSubActive]}>
                  {opt.sub}
                </Text>
              </Pressable>
            ))}
          </View>

          <Btn
            title={busy ? "Setting up…" : "Let's fly"}
            kind="accent"
            onPress={busy ? undefined : finish}
            style={{ marginTop: 32, alignSelf: "stretch" }}
          />
          <Text style={s.skip} onPress={finish}>Skip for now</Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, padding: 28, paddingTop: 24 },
  mark:   { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  h:      { color: C.ink, fontSize: 26, fontFamily: T.sansB, marginBottom: 8, lineHeight: 32 },
  sub:    { color: C.mut, fontSize: 14, lineHeight: 20, marginBottom: 28 },
  label:  { color: C.mut, fontSize: 11, fontFamily: T.sansB, letterSpacing: 0.8, marginBottom: 10, textTransform: "uppercase" },
  input:  {
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.line,
    borderRadius: 12, padding: 14,
    color: C.ink, fontSize: 17,
  },
  cabinRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cabinChip: {
    flex: 1, minWidth: "45%",
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.line,
    borderRadius: 12, padding: 14,
  },
  cabinChipActive: { borderColor: C.gold, backgroundColor: C.gold + "12" },
  cabinLabel:      { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  cabinLabelActive:{ color: C.gold },
  cabinSub:        { color: C.mut, fontSize: 11, marginTop: 3 },
  cabinSubActive:  { color: C.gold + "99" },
  skip:   { color: C.mut, fontSize: 13, textAlign: "center", marginTop: 16, textDecorationLine: "underline" },
  hint:   { color: C.mut, fontSize: 12, lineHeight: 17, marginBottom: 10, marginTop: -4 },
});
