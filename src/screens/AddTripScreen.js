import React, { useState, useRef } from "react";
import {
  SafeAreaView, ScrollView, View, Text, TextInput, Pressable,
  StyleSheet, Alert, ActivityIndicator, TouchableOpacity, Animated, Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { BackBar, Btn, g, tap } from "../components";
import { createTrip, getFlightStatus } from "../api";

const MODES = [
  { id: "solo",    label: "Solo",    icon: "🧳", desc: "Efficiency mode" },
  { id: "client",  label: "Client",  icon: "💼", desc: "Prestige & optics" },
  { id: "partner", label: "Partner", icon: "❤️",  desc: "Leisure & romance" },
];

// Parse "UA 412", "UA412", "united 412" → { carrier: "UA", number: "412" }
function parseFlightInput(raw) {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m = s.match(/^([A-Z]{2,3})(\d{1,4})$/);
  if (m) return { carrier: m[1], number: m[2] };
  return null;
}

function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, editable = true, right }) {
  return (
    <View style={s.field}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Text style={s.label}>{label}</Text>
        {right}
      </View>
      <TextInput
        style={[s.input, !editable && { color: C.mut }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ""}
        placeholderTextColor={C.mut}
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize || "characters"}
        editable={editable}
      />
    </View>
  );
}

export default function AddTripScreen({ navigation }) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState("solo");

  // Flight lookup state
  const [flightQuery, setFlightQuery] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [looked, setLooked] = useState(false);

  // Pre-filled flight fields
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [carrier, setCarrier] = useState("");
  const [flightNum, setFlightNum] = useState("");
  const [depDate, setDepDate] = useState("");
  const [confirmation, setConfirmation] = useState("");

  // Email paste tab
  const [tab, setTab] = useState("manual"); // "manual" | "paste"
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);

  const [loading, setLoading] = useState(false);

  // Shake animation for validation errors
  const shake = useRef(new Animated.Value(0)).current;
  const doShake = () => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Auto-lookup when user types a valid flight number
  const onFlightQueryChange = async (text) => {
    setFlightQuery(text);
    setLooked(false);
    const parsed = parseFlightInput(text);
    if (!parsed) return;
    const ident = parsed.carrier + parsed.number;
    setLookingUp(true);
    try {
      const data = await getFlightStatus(ident);
      if (data) {
        if (data.origin) setOrigin(data.origin);
        if (data.destination) setDestination(data.destination);
        if (data.carrier || parsed.carrier) setCarrier(data.carrier || parsed.carrier);
        if (data.flight_number || parsed.number) setFlightNum(data.flight_number || parsed.number);
        if (data.departs_at) {
          const d = new Date(data.departs_at);
          setDepDate(d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
        }
        if (!title && data.origin && data.destination) {
          setTitle(`${data.origin} → ${data.destination}`);
        }
        setLooked(true);
      }
    } catch (_) {
      // Silent — user can fill manually
      setCarrier(parsed.carrier);
      setFlightNum(parsed.number);
    } finally {
      setLookingUp(false);
    }
  };

  // Parse a pasted confirmation email using the backend concierge
  const parsePaste = async () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    try {
      // Use the concierge endpoint with a structured extraction prompt
      const res = await fetch(require("../config").API_BASE + "/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Extract the flight details from this booking confirmation and return ONLY a JSON object with keys: title, origin, destination, carrier, flight_number, departs_at (ISO string), confirmation. No other text.\n\n${pasteText}`,
          history: [],
        }),
      });
      const json = await res.json();
      const reply = json.reply || "";
      // Try to parse JSON from the reply
      const match = reply.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.origin) setOrigin(parsed.origin.toUpperCase());
        if (parsed.destination) setDestination(parsed.destination.toUpperCase());
        if (parsed.carrier) setCarrier(parsed.carrier.toUpperCase());
        if (parsed.flight_number) setFlightNum(parsed.flight_number);
        if (parsed.departs_at) {
          const d = new Date(parsed.departs_at);
          if (!isNaN(d)) setDepDate(d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
        }
        if (parsed.confirmation) setConfirmation(parsed.confirmation.toUpperCase());
        setTab("manual");
        Alert.alert("Details extracted", "Review and save when ready.");
      } else {
        Alert.alert("Couldn't parse", "Try copying just the flight details section of the email.");
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setParsing(false);
    }
  };

  const save = async () => {
    if (!title.trim()) {
      doShake();
      Alert.alert("Trip name required", "Give your trip a name like 'Aspen Trip' or 'NYC Weekend'.");
      return;
    }
    setLoading(true);
    try {
      const legs = [];
      if (origin || destination || flightNum || flightQuery) {
        legs.push({
          type: "flight",
          carrier: carrier.trim() || null,
          flight_number: flightNum.trim() || null,
          origin: origin.trim().toUpperCase() || null,
          destination: destination.trim().toUpperCase() || null,
          departs_at: depDate.trim() ? new Date(depDate.trim()).toISOString() : null,
          confirmation: confirmation.trim() || null,
        });
      }
      await createTrip({ title: title.trim(), legs, mode });
      tap("medium");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll} keyboardShouldPersistTaps="handled">
        <BackBar nav={navigation} label="Add Trip" />

        {/* Trip Mode */}
        <Text style={g.sectionT}>TRIP MODE</Text>
        <View style={s.modeRow}>
          {MODES.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[s.modeBtn, mode === m.id && s.modeBtnOn]}
              onPress={() => { tap(); setMode(m.id); }}
              activeOpacity={0.8}
            >
              <Text style={s.modeIcon}>{m.icon}</Text>
              <Text style={[s.modeLabel, mode === m.id && s.modeLabelOn]}>{m.label}</Text>
              <Text style={s.modeDesc}>{m.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.modeHint}>
          {mode === "solo" && "Wingman optimizes for speed and efficiency."}
          {mode === "client" && "Wingman prioritizes prestige venues, private dining, and car service."}
          {mode === "partner" && "Wingman suggests romantic boutique hotels, chef's table dinners, and no 6am flights."}
        </Text>

        {/* Trip Name */}
        <Text style={g.sectionT}>TRIP NAME</Text>
        <Animated.View style={[g.group, { transform: [{ translateX: shake }] }]}>
          <View style={[s.field, { borderBottomWidth: 0 }]}>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Tokyo Client Trip, Paris Weekend"
              placeholderTextColor={C.mut}
              autoCapitalize="words"
            />
          </View>
        </Animated.View>

        {/* Flight — tab switcher */}
        <Text style={g.sectionT}>FLIGHT (OPTIONAL)</Text>
        <View style={s.tabRow}>
          <Pressable style={[s.tabBtn, tab === "manual" && s.tabBtnOn]} onPress={() => { tap(); setTab("manual"); }}>
            <Text style={[s.tabT, tab === "manual" && s.tabTOn]}>Enter manually</Text>
          </Pressable>
          <Pressable style={[s.tabBtn, tab === "paste" && s.tabBtnOn]} onPress={() => { tap(); setTab("paste"); }}>
            <Text style={[s.tabT, tab === "paste" && s.tabTOn]}>Paste confirmation</Text>
          </Pressable>
        </View>

        {tab === "manual" ? (
          <View style={g.group}>
            {/* Smart flight number lookup */}
            <View style={s.field}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={s.label}>Flight Number</Text>
                {lookingUp && <ActivityIndicator size="small" color={C.teal} />}
                {looked && !lookingUp && (
                  <View style={s.lookedBadge}>
                    <Text style={s.lookedT}>✓ Found</Text>
                  </View>
                )}
              </View>
              <TextInput
                style={s.input}
                value={flightQuery}
                onChangeText={onFlightQueryChange}
                placeholder="UA 412 — we'll look it up"
                placeholderTextColor={C.mut}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <Field label="From (airport code)" value={origin} onChangeText={setOrigin} placeholder="JFK" editable={!looked} />
            <Field label="To (airport code)" value={destination} onChangeText={setDestination} placeholder="ASE" editable={!looked} />
            <Field label="Airline" value={carrier} onChangeText={setCarrier} placeholder="UA" editable={!looked} />
            <View style={s.field}>
              <Text style={s.label}>Departure Date</Text>
              <TextInput
                style={s.input}
                value={depDate}
                onChangeText={setDepDate}
                placeholder="Jan 15 2026 or 2026-01-15"
                placeholderTextColor={C.mut}
                autoCapitalize="none"
              />
            </View>
            <View style={[s.field, { borderBottomWidth: 0 }]}>
              <Text style={s.label}>Confirmation #</Text>
              <TextInput
                style={s.input}
                value={confirmation}
                onChangeText={setConfirmation}
                placeholder="ABC123"
                placeholderTextColor={C.mut}
                autoCapitalize="characters"
              />
            </View>
          </View>
        ) : (
          <View style={g.group}>
            <View style={[s.field, { borderBottomWidth: 0 }]}>
              <Text style={s.label}>Paste your confirmation email</Text>
              <TextInput
                style={[s.input, s.pasteInput]}
                value={pasteText}
                onChangeText={setPasteText}
                placeholder={"Paste the text from your booking confirmation email here — Wingman will extract the flight details automatically."}
                placeholderTextColor={C.mut}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Pressable
              style={[s.parseBtn, (!pasteText.trim() || parsing) && { opacity: 0.5 }]}
              onPress={parsePaste}
              disabled={!pasteText.trim() || parsing}
            >
              {parsing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.parseBtnT}>Extract flight details →</Text>
              }
            </Pressable>
          </View>
        )}

        {/* Save */}
        <Btn
          title={loading ? "Saving…" : "Save Trip"}
          onPress={save}
          style={{ marginTop: 20 }}
        />

        {/* Email import CTA */}
        <View style={s.importCard}>
          <LinearGradient colors={["rgba(74,114,255,0.08)", "rgba(20,201,153,0.06)"]} style={s.importGrad}>
            <Text style={s.importIc}>📧</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.importT}>Import all trips automatically</Text>
              <Text style={s.importS}>Connect Gmail and Wingman finds every booking in your inbox.</Text>
            </View>
            <Pressable style={s.importBtn} onPress={() => navigation.navigate("Connections")}>
              <Text style={s.importBtnT}>Connect →</Text>
            </Pressable>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  // Mode selector
  modeRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 10 },
  modeBtn: {
    flex: 1, alignItems: "center", backgroundColor: C.card,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1.5, borderColor: "transparent",
  },
  modeBtnOn: { borderColor: C.teal, backgroundColor: "#091A12" },
  modeIcon: { fontSize: 22, marginBottom: 4 },
  modeLabel: { color: C.mut, fontSize: 13, fontWeight: "700" },
  modeLabelOn: { color: C.teal },
  modeDesc: { color: C.mut, fontSize: 10, marginTop: 2, textAlign: "center" },
  modeHint: { color: C.mut, fontSize: 13, paddingHorizontal: 4, marginBottom: 4, lineHeight: 19 },

  // Tab switcher
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  tabBtnOn: { borderColor: C.gold, backgroundColor: "rgba(74,114,255,0.08)" },
  tabT: { color: C.mut, fontSize: 13, fontWeight: "600" },
  tabTOn: { color: C.gold },

  // Fields
  field: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  label: { color: C.mut, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { color: C.ink, fontSize: 16, fontWeight: "500" },
  pasteInput: { minHeight: 120, marginTop: 8, lineHeight: 22 },

  // Lookup badge
  lookedBadge: { backgroundColor: "rgba(20,201,153,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(20,201,153,0.25)" },
  lookedT: { color: C.teal, fontSize: 11, fontWeight: "700" },

  // Parse button inside paste tab
  parseBtn: { margin: 12, backgroundColor: C.gold, borderRadius: 14, padding: 14, alignItems: "center" },
  parseBtnT: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Email import card
  importCard: { marginTop: 20, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: C.line },
  importGrad: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  importIc: { fontSize: 24 },
  importT: { color: C.ink, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  importS: { color: C.mut, fontSize: 12, lineHeight: 17 },
  importBtn: { backgroundColor: "rgba(74,114,255,0.15)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(74,114,255,0.3)" },
  importBtnT: { color: C.gold, fontSize: 13, fontWeight: "700" },
});
