// ProfileSetupScreen.js — Editorial v3
// Post-auth profile collection: first name, home airport, cabin preference
// EB Garamond serif headline · DM Sans body · gold primary button
// All backend hooks preserved: updateProfile, updateLocale, injectDemoTrip

import React, { useState } from "react";
import {
  SafeAreaView, View, Text, TextInput, ScrollView,
  Pressable, StyleSheet, Platform, KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, T, GRAD } from "../theme";
import { tap } from "../components";
import { updateProfile, updateLocale, createTrip } from "../api";
import * as SecureStore from "expo-secure-store";

const KEY_DEMO_INJECTED = "wingman_demo_injected";
const KEY_PROFILE_DONE  = "wingman_profile_done";

// ─── Demo trip injection ──────────────────────────────────────────────────────

async function injectDemoTrip() {
  try {
    const already = await SecureStore.getItemAsync(KEY_DEMO_INJECTED);
    if (already) return;
    const fmt = (d) => d.toISOString().replace("Z", "+00:00");
    const dep = new Date(Date.now() + 5 * 86400000);
    dep.setHours(8, 30, 0, 0);
    const arr = new Date(dep.getTime() + 7 * 3600000);
    const hotelIn  = new Date(arr); hotelIn.setHours(15, 0, 0, 0);
    const hotelOut = new Date(hotelIn.getTime() + 4 * 86400000); hotelOut.setHours(11, 0, 0, 0);
    const retDep = new Date(hotelOut.getTime() + 86400000); retDep.setHours(11, 30, 0, 0);
    const retArr = new Date(retDep.getTime() + 8 * 3600000);
    await createTrip({
      title: "New York → London",
      mode: "demo",
      legs: [
        { type: "flight", carrier: "BA", flight_number: "178", origin: "JFK", destination: "LHR", departs_at: fmt(dep), arrives_at: fmt(arr), cabin: "economy" },
        { type: "hotel", carrier: "The Ned London", origin: "LHR", destination: "London", destination_city: "London", departs_at: fmt(hotelIn), arrives_at: fmt(hotelOut) },
        { type: "flight", carrier: "BA", flight_number: "177", origin: "LHR", destination: "JFK", departs_at: fmt(retDep), arrives_at: fmt(retArr), cabin: "economy" },
      ],
    });
    await SecureStore.setItemAsync(KEY_DEMO_INJECTED, "1");
  } catch (_) {}
}

// ─── Cabin options ────────────────────────────────────────────────────────────

const CABIN_OPTIONS = [
  { id: "economy",         label: "Economy",         sub: "Best value" },
  { id: "premium_economy", label: "Premium Economy", sub: "Extra legroom" },
  { id: "business",        label: "Business",        sub: "Lie-flat & lounge" },
  { id: "first",           label: "First Class",     sub: "The full experience" },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileSetupScreen({ navigation }) {
  const [firstName,   setFirstName]   = useState("");
  const [homeAirport, setHomeAirport] = useState("");
  const [cabin,       setCabin]       = useState("economy");
  const [busy,        setBusy]        = useState(false);

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try { await SecureStore.setItemAsync(KEY_PROFILE_DONE, "1"); } catch (_) {}
    const homeCode = homeAirport.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    updateProfile({
      first_name: firstName.trim(),
      preferences: {
        cabin_preference: cabin,
        taste_setup_complete: true,
        ...(homeCode ? { home_airport: homeCode } : {}),
      },
    }).catch(e => console.warn("[ProfileSetup] updateProfile:", e.message));
    updateLocale({ locale: "en", currency: "USD" })
      .catch(e => console.warn("[ProfileSetup] updateLocale:", e.message));
    injectDemoTrip();
    navigation.replace("Welcome", { firstName: firstName.trim() });
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Mark */}
          <View style={s.markWrap}>
            <View style={s.markGlow} />
            <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.mark}>
              <Text style={s.markT}>W</Text>
            </LinearGradient>
          </View>

          {/* Headline */}
          <Text style={s.hed}>How do you fly?</Text>
          <Text style={s.sub}>
            Tell Wingman your preferences so it can filter the right upgrades, lounges, and rescue options for you.
          </Text>

          <View style={s.rule} />

          {/* Name */}
          <Text style={s.fieldLabel}>YOUR NAME</Text>
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

          {/* Home airport */}
          <Text style={[s.fieldLabel, { marginTop: 24 }]}>HOME AIRPORT</Text>
          <Text style={s.hint}>Wingman uses this to pre-fill ground transport and lounge searches.</Text>
          <TextInput
            style={s.input}
            placeholder="IATA code — e.g. JFK, LHR, SYD"
            placeholderTextColor={C.mut}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={4}
            value={homeAirport}
            onChangeText={v => setHomeAirport(v.toUpperCase().replace(/[^A-Z]/g, ""))}
            returnKeyType="done"
          />

          {/* Cabin preference */}
          <Text style={[s.fieldLabel, { marginTop: 24 }]}>PREFERRED CABIN</Text>
          <Text style={s.hint}>Wingman uses this to filter upgrade opportunities and lounge access.</Text>
          <View style={s.cabinGrid}>
            {CABIN_OPTIONS.map(opt => (
              <Pressable
                key={opt.id}
                style={[s.cabinChip, cabin === opt.id && s.cabinChipActive]}
                onPress={() => { tap(); setCabin(opt.id); }}
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

          {/* CTA */}
          <Pressable
            style={[s.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={busy ? undefined : finish}
          >
            <Text style={s.primaryBtnT}>{busy ? "Setting up…" : "Let's fly  →"}</Text>
          </Pressable>

          <Pressable style={s.skipLink} onPress={finish}>
            <Text style={s.skipLinkT}>Skip for now</Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 26, paddingTop: 32, paddingBottom: 32 },

  // ── Mark ──
  markWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 90,
    height: 90,
    marginBottom: 24,
    alignSelf: "center",
  },
  markGlow: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: C.gold + "10",
  },
  mark: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  markT: {
    fontFamily: T.sansB,
    fontSize: 22,
    color: C.inkD,
  },

  // ── Headline ──
  hed: {
    fontFamily: T.garamondSI,
    fontSize: 34,
    color: C.ink,
    letterSpacing: -0.3,
    lineHeight: 40,
    marginBottom: 10,
    textAlign: "center",
  },
  sub: {
    fontFamily: T.garamondI,
    fontSize: 16,
    color: C.mut,
    lineHeight: 26,
    textAlign: "center",
    marginBottom: 24,
  },

  // ── Rule ──
  rule: {
    height: 1,
    backgroundColor: C.line,
    opacity: 0.5,
    marginBottom: 24,
  },

  // ── Field label ──
  fieldLabel: {
    fontFamily: T.sansM,
    fontSize: 9,
    letterSpacing: 2.5,
    color: C.mut,
    textTransform: "uppercase",
    marginBottom: 8,
    opacity: 0.7,
  },
  hint: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
    lineHeight: 18,
    marginBottom: 10,
    opacity: 0.7,
  },

  // ── Text input ──
  input: {
    fontFamily: T.garamondI,
    fontSize: 18,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.card,
  },

  // ── Cabin chips ──
  cabinGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  cabinChip: {
    width: "47%",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
  },
  cabinChipActive: {
    backgroundColor: "rgba(201,169,110,0.08)",
    borderColor: "rgba(201,169,110,0.35)",
  },
  cabinLabel: {
    fontFamily: T.sansM,
    fontSize: 14,
    color: C.ink,
    marginBottom: 3,
  },
  cabinLabelActive: {
    color: C.gold,
  },
  cabinSub: {
    fontFamily: T.sans,
    fontSize: 11,
    color: C.mut,
  },
  cabinSubActive: {
    color: C.gold,
    opacity: 0.7,
  },

  // ── Buttons ──
  primaryBtn: {
    backgroundColor: C.gold,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
  },
  primaryBtnT: {
    fontFamily: T.sansB,
    fontSize: 15,
    color: C.inkD,
    letterSpacing: 0.3,
  },
  skipLink: {
    alignItems: "center",
    paddingVertical: 14,
  },
  skipLinkT: {
    fontFamily: T.sansM,
    fontSize: 13,
    color: C.mut,
  },
});
