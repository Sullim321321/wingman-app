import React, { useState } from "react";
import {
  SafeAreaView, ScrollView, View, Text, TextInput, Pressable,
  StyleSheet, Alert, ActivityIndicator, TouchableOpacity,
} from "react-native";
import { C } from "../theme";
import { BackBar, g, tap } from "../components";
import { createTrip } from "../api";

const MODES = [
  { id: "solo", label: "Solo", icon: "🧳", desc: "Efficiency mode" },
  { id: "client", label: "Client", icon: "💼", desc: "Prestige & optics" },
  { id: "partner", label: "Partner", icon: "❤️", desc: "Leisure & romance" },
];

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ""}
        placeholderTextColor={C.mut}
        keyboardType={keyboardType || "default"}
        autoCapitalize="characters"
      />
    </View>
  );
}

export default function AddTripScreen({ navigation }) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState("solo");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [flightNum, setFlightNum] = useState("");
  const [carrier, setCarrier] = useState("");
  const [depDate, setDepDate] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert("Trip name required", "Give your trip a name like 'Aspen Trip' or 'NYC Weekend'.");
      return;
    }
    setLoading(true);
    try {
      const legs = [];
      if (origin || destination || flightNum) {
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
        <View style={g.group}>
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
        </View>

        {/* Flight */}
        <Text style={g.sectionT}>FLIGHT (OPTIONAL)</Text>
        <View style={g.group}>
          <Field label="From (airport code)" value={origin} onChangeText={setOrigin} placeholder="JFK" />
          <Field label="To (airport code)" value={destination} onChangeText={setDestination} placeholder="ASE" />
          <Field label="Airline" value={carrier} onChangeText={setCarrier} placeholder="United" />
          <Field label="Flight Number" value={flightNum} onChangeText={setFlightNum} placeholder="UA 412" />
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

        <Pressable style={[s.saveBtn, loading && { opacity: 0.6 }]} onPress={save} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnT}>Save Trip</Text>}
        </Pressable>
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
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1.5, borderColor: "transparent",
  },
  modeBtnOn: { borderColor: C.teal, backgroundColor: "#0D2A22" },
  modeIcon: { fontSize: 22, marginBottom: 4 },
  modeLabel: { color: C.mut, fontSize: 13, fontWeight: "700" },
  modeLabelOn: { color: C.teal },
  modeDesc: { color: C.mut, fontSize: 10, marginTop: 2, textAlign: "center" },
  modeHint: { color: C.mut, fontSize: 12, paddingHorizontal: 20, marginBottom: 16, lineHeight: 17 },

  // Fields
  field: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  label: { color: C.mut, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { color: C.ink, fontSize: 16, fontWeight: "500" },

  // Save button
  saveBtn: { backgroundColor: C.accent, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 20 },
  saveBtnT: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
