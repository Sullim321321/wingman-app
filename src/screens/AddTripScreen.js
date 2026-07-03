import React, { useState, useRef } from "react";
import {
  SafeAreaView, ScrollView, View, Text, TextInput, Pressable,
  StyleSheet, Alert, ActivityIndicator, TouchableOpacity, Animated,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, T } from "../theme";
import { BackBar, Btn, g, tap } from "../components";
import { createTrip, getFlightStatus, draftTripFromText } from "../api";

const MODES = [
  { id: "solo",    label: "Solo",    icon: "◆", desc: "Efficiency mode" },
  { id: "client",  label: "Client",  icon: "◈", desc: "Prestige & optics" },
  { id: "partner", label: "Partner", icon: "◇", desc: "Leisure & romance" },
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

  // Tab: "ai" | "manual" | "paste"
  const [tab, setTab] = useState("ai");

  // AI / NL drafting
  const [nlText, setNlText] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted] = useState(false);

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

  const [loading, setLoading] = useState(false);

  const shake = useRef(new Animated.Value(0)).current;
  const doShake = () => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Natural language trip drafting
  const draftFromNL = async () => {
    if (!nlText.trim()) return;
    setDrafting(true);
    try {
      const data = await draftTripFromText(nlText.trim());
      // data: { title, origin, destination, carrier, flight_number, departs_at, confirmation, legs }
      if (data.title) setTitle(data.title);
      if (data.origin) setOrigin(data.origin.toUpperCase());
      if (data.destination) setDestination(data.destination.toUpperCase());
      if (data.carrier) setCarrier(data.carrier.toUpperCase());
      if (data.flight_number) setFlightNum(String(data.flight_number));
      if (data.departs_at) {
        const d = new Date(data.departs_at);
        if (!isNaN(d)) setDepDate(d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
      }
      if (data.confirmation) setConfirmation(data.confirmation.toUpperCase());
      setDrafted(true);
      setTab("manual");
      tap("medium");
      Alert.alert("Trip drafted", "Review the details below and save when ready.");
    } catch (e) {
      Alert.alert("Couldn't draft trip", e.message || "Try being more specific, e.g. 'UA 412 from JFK to ASE on Jan 15'.");
    } finally {
      setDrafting(false);
    }
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
          setTitle(`${data.origin} \u2192 ${data.destination}`);
        }
        setLooked(true);
      }
    } catch (_) {
      setCarrier(parsed.carrier);
      setFlightNum(parsed.number);
    } finally {
      setLookingUp(false);
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
      const result = await createTrip({ title: title.trim(), legs, mode });
      tap("medium");
      // Navigate directly to TripDetail so the user sees their trip immediately
      const tripId = result?.trip?.id;
      if (tripId) {
        navigation.replace("TripDetail", { tripId });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.app}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={g.scroll} keyboardShouldPersistTaps="handled">
        <BackBar nav={navigation} label="Add Trip" />

        {/* Tab switcher */}
        <View style={s.tabRow}>
          <Pressable style={[s.tabBtn, tab === "ai" && s.tabBtnOn]} onPress={() => { tap(); setTab("ai"); }}>
            <Text style={[s.tabT, tab === "ai" && s.tabTOn]}>Ask Wingman</Text>
          </Pressable>
          <Pressable style={[s.tabBtn, tab === "manual" && s.tabBtnOn]} onPress={() => { tap(); setTab("manual"); }}>
            <Text style={[s.tabT, tab === "manual" && s.tabTOn]}>Enter manually</Text>
          </Pressable>
        </View>

        {/* AI / NL drafting tab */}
        {tab === "ai" && (
          <View>
            <LinearGradient
              colors={[C.card2, C.card]}
              style={s.aiCard}
            >
              <Text style={s.aiHeadline}>One sentence.{"\n"}A complete trip drafted.</Text>
              <Text style={s.aiSub}>Tell Wingman where you're going and when — it will handle the rest.</Text>
              <TextInput
                style={s.aiInput}
                value={nlText}
                onChangeText={setNlText}
                placeholder={"e.g. Flying UA 412 from JFK to Aspen on January 15th for a client trip"}
                placeholderTextColor={C.mut}
                multiline
                autoCapitalize="sentences"
                autoCorrect
                returnKeyType="done"
              />
              <Pressable
                style={[s.aiBtn, (!nlText.trim() || drafting) && { opacity: 0.5 }]}
                onPress={draftFromNL}
                disabled={!nlText.trim() || drafting}
              >
                {drafting
                  ? <ActivityIndicator color={C.bg} size="small" />
                  : <Text style={s.aiBtnT}>Draft trip →</Text>
                }
              </Pressable>
            </LinearGradient>

            {/* Quick examples */}
            <Text style={[s.label, { paddingHorizontal: 0, marginTop: 20, marginBottom: 10 }]}>EXAMPLES</Text>
            {[
              "AA 100 JFK to LAX on March 3rd, solo",
              "Flying to Tokyo for a client meeting, departing Feb 12 on JAL",
              "Weekend in Paris with my partner, leaving Friday on Air France",
            ].map((ex, i) => (
              <Pressable key={i} style={s.exRow} onPress={() => { tap(); setNlText(ex); }}>
                <Text style={s.exT}>{ex}</Text>
                <Text style={s.exArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Manual tab */}
        {tab === "manual" && (
          <View>
            {drafted && (
              <View style={s.draftedBanner}>
                <Text style={s.draftedT}>✓ Drafted by Wingman — review and save</Text>
              </View>
            )}
            {!drafted && !origin && !title && (
              <Pressable
                style={s.sampleBtn}
                onPress={() => {
                  tap();
                  setTitle("New York → London");
                  setOrigin("JFK");
                  setDestination("LHR");
                  setCarrier("BA");
                  setFlightNum("112");
                  setFlightQuery("BA112");
                  setDepDate("Jul 15 2026");
                  setConfirmation("WNGMN1");
                }}
              >
                <Text style={s.sampleBtnT}>Load sample trip →</Text>
              </Pressable>
            )}

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
                  <Text style={[s.modeIcon, mode === m.id && { color: C.gold }]}>{m.icon}</Text>
                  <Text style={[s.modeLabel, mode === m.id && s.modeLabelOn]}>{m.label}</Text>
                  <Text style={s.modeDesc}>{m.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

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

            {/* Flight fields */}
            <Text style={g.sectionT}>FLIGHT (OPTIONAL)</Text>
            <View style={g.group}>
              <View style={s.field}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={s.label}>Flight Number</Text>
                  {lookingUp && <ActivityIndicator size="small" color={C.gold} />}
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

            <Btn
              title={loading ? "Saving…" : "Save Trip"}
              onPress={save}
              style={{ marginTop: 20 }}
            />
          </View>
        )}

        {/* Connect / Forward CTA */}
        <View style={s.importCard}>
          <View style={s.importInner}>
            <Text style={s.importIc}>✉</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.importT}>Import trips automatically</Text>
              <Text style={s.importS}>Connect Gmail or forward any booking email to import@wingmantravel.app</Text>
            </View>
            <Pressable style={s.importBtn} onPress={() => navigation.navigate("Connections")}>
              <Text style={s.importBtnT}>Set up →</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  // Tab switcher
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  tabBtnOn: { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.08)" },
  tabT: { color: C.mut, fontSize: 12, fontFamily: T.sansM, letterSpacing: 0.3 },
  tabTOn: { color: C.gold },

  // AI card
  aiCard: { borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.line, marginBottom: 4 },
  aiHeadline: { color: C.ink, fontSize: 26, fontFamily: T.serifB, lineHeight: 34, marginBottom: 10 },
  aiSub: { color: C.mut, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  aiInput: {
    color: C.ink, fontSize: 16, lineHeight: 24, minHeight: 80,
    backgroundColor: C.bg, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.line, marginBottom: 16,
  },
  aiBtn: { backgroundColor: C.gold, borderRadius: 14, padding: 16, alignItems: "center" },
  aiBtnT: { color: C.bg, fontSize: 15, fontFamily: T.sansB, letterSpacing: 0.5 },

  // Examples
  exRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  exT: { color: C.mut, fontSize: 13, flex: 1, lineHeight: 19 },
  exArrow: { color: C.gold, fontSize: 18, marginLeft: 8 },

  // Drafted banner
  draftedBanner: {
    backgroundColor: "rgba(201,169,110,0.12)", borderRadius: 12,
    padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "rgba(201,169,110,0.25)",
  },
  draftedT: { color: C.gold, fontSize: 13, fontFamily: T.sansM },

  // Sample trip
  sampleBtn:  { alignSelf: "flex-end", paddingVertical: 6, paddingHorizontal: 4, marginBottom: 12 },
  sampleBtnT: { color: C.gold, fontSize: 12, fontFamily: T.sansM, letterSpacing: 0.2 },

  // Mode selector
  modeRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  modeBtn: {
    flex: 1, alignItems: "center", backgroundColor: C.card,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1.5, borderColor: "transparent",
  },
  modeBtnOn: { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.06)" },
  modeIcon: { fontSize: 18, marginBottom: 4, color: C.mut },
  modeLabel: { color: C.mut, fontSize: 13, fontFamily: T.sansB },
  modeLabelOn: { color: C.gold },
  modeDesc: { color: C.mut, fontSize: 10, marginTop: 2, textAlign: "center" },

  // Fields
  field: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  label: { color: C.mut, fontSize: 11, fontFamily: T.sansB, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { color: C.ink, fontSize: 16, fontFamily: T.sansM },
  pasteInput: { minHeight: 120, marginTop: 8, lineHeight: 22 },

  // Lookup badge
  lookedBadge: { backgroundColor: "rgba(201,169,110,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(201,169,110,0.25)" },
  lookedT: { color: C.gold, fontSize: 11, fontFamily: T.sansB },

  // Parse button inside paste tab
  parseBtn: { margin: 12, backgroundColor: C.gold, borderRadius: 14, padding: 14, alignItems: "center" },
  parseBtnT: { color: C.bg, fontSize: 15, fontFamily: T.sansB },

  // Email import card
  importCard: { marginTop: 24, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  importInner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: C.card },
  importIc: { fontSize: 22, color: C.gold },
  importT: { color: C.ink, fontSize: 14, fontFamily: T.sansB, marginBottom: 2 },
  importS: { color: C.mut, fontSize: 12, lineHeight: 17 },
  importBtn: { backgroundColor: "rgba(201,169,110,0.12)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(201,169,110,0.25)" },
  importBtnT: { color: C.gold, fontSize: 13, fontFamily: T.sansB },
});
