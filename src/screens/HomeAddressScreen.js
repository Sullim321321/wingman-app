import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  StyleSheet, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { C } from "../theme";
import { BackBar, g } from "../components";
import { getProfile, updateProfile } from "../api";

export default function HomeAddressScreen({ navigation }) {
  const [address, setAddress] = useState("");
  const [homeAirport, setHomeAirport] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrefs();
  }, []);

  async function loadPrefs() {
    try {
      const data = await getProfile();
      const prefs = data.preferences || {};
      setAddress(prefs.home_address || "");
      setHomeAirport(prefs.home_airport || "");
    } catch (e) {
      console.warn("HomeAddressScreen load error:", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({
        home_address: address.trim(),
        home_airport: homeAirport.trim().toUpperCase(),
      });
      Alert.alert(
        "Saved ✓",
        "Your home address is set. Wingman will pre-fill it as your Uber dropoff when you land.",
        [{ text: "Done", onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={s.app}>
        <ActivityIndicator color={C.teal} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={g.scroll} keyboardShouldPersistTaps="handled">
          <BackBar nav={navigation} label="Home address" />

          {/* Hero card */}
          <View style={s.heroCard}>
            <Text style={s.heroIc}>🚗</Text>
            <Text style={s.heroT}>Uber dropoff, pre-filled</Text>
            <Text style={s.heroSub}>
              When you land, Wingman sends a push notification that opens Uber with your airport as pickup and your home address as dropoff — one tap to get home.
            </Text>
          </View>

          {/* Home address */}
          <Text style={g.sectionT}>HOME ADDRESS</Text>
          <View style={s.inputCard}>
            <Text style={s.inputLabel}>Street address</Text>
            <TextInput
              style={s.input}
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. 123 Main St, New York, NY 10001"
              placeholderTextColor={C.mut}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Text style={s.inputHint}>
              Used only as your Uber dropoff destination. Never shared.
            </Text>
          </View>

          {/* Home airport */}
          <Text style={[g.sectionT, { marginTop: 20 }]}>HOME AIRPORT (OPTIONAL)</Text>
          <View style={s.inputCard}>
            <Text style={s.inputLabel}>IATA code</Text>
            <TextInput
              style={[s.input, s.inputMono]}
              value={homeAirport}
              onChangeText={(t) => setHomeAirport(t.toUpperCase())}
              placeholder="e.g. JFK"
              placeholderTextColor={C.mut}
              autoCorrect={false}
              autoCapitalize="characters"
              maxLength={3}
              returnKeyType="done"
            />
            <Text style={s.inputHint}>
              Wingman uses this to recognise when you're arriving home vs. departing.
            </Text>
          </View>

          {/* How it works */}
          <Text style={[g.sectionT, { marginTop: 20 }]}>HOW IT WORKS</Text>
          <View style={s.stepsCard}>
            {[
              { ic: "✈️", t: "Flight lands", sub: "Wingman detects your arrival via FlightAware" },
              { ic: "📲", t: "Push notification", sub: "You get a notification — tap it to open Uber" },
              { ic: "🚗", t: "Uber opens", sub: "Airport as pickup, your home address as dropoff, ready to request" },
            ].map((step, i) => (
              <View key={i} style={[s.stepRow, i < 2 && s.stepRowBorder]}>
                <View style={s.stepIcWrap}>
                  <Text style={{ fontSize: 20 }}>{step.ic}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepT}>{step.t}</Text>
                  <Text style={s.stepSub}>{step.sub}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Save button */}
          <Pressable
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={s.saveBtnT}>Save address</Text>
            )}
          </Pressable>

          {address.trim() !== "" && (
            <Pressable
              style={s.clearBtn}
              onPress={() => {
                setAddress("");
                setHomeAirport("");
              }}
            >
              <Text style={s.clearBtnT}>Clear address</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  heroCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  heroIc: { fontSize: 40, marginBottom: 10 },
  heroT: { color: C.ink, fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  heroSub: { color: C.mut, fontSize: 13, textAlign: "center", lineHeight: 19 },
  inputCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginBottom: 4,
  },
  inputLabel: { color: C.mut, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8 },
  input: {
    color: C.ink,
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#0A0E1C",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
  },
  inputMono: { fontVariant: ["tabular-nums"], letterSpacing: 2 },
  inputHint: { color: C.mut, fontSize: 12, marginTop: 8, lineHeight: 16 },
  stepsCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
    marginBottom: 24,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  stepRowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  stepIcWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.teal + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  stepT: { color: C.ink, fontSize: 14, fontWeight: "600", marginBottom: 2 },
  stepSub: { color: C.mut, fontSize: 12, lineHeight: 16 },
  saveBtn: {
    backgroundColor: C.teal,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  saveBtnT: { color: "#000", fontSize: 15, fontWeight: "700" },
  clearBtn: { alignItems: "center", paddingVertical: 12, marginBottom: 16 },
  clearBtnT: { color: C.mut, fontSize: 14 },
});
