import React, { useRef, useEffect } from "react";
import { SafeAreaView, ScrollView, View, Text, Animated, StyleSheet } from "react-native";
import { C, T } from "../theme";
import { Btn, NtRow, g } from "../components";

export default function DoneScreen({ navigation, route }) {
  const sc = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.spring(sc, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, []);

  // Real rescue data passed from AlertScreen via ExecScreen doneParams
  const {
    option,          // the accepted rescue option object
    dep,             // origin IATA
    arr,             // destination IATA
    flightLabel,     // e.g. "AA 412"
    valueSaved,      // numeric value protected
    currency,        // currency code
  } = route.params || {};

  // Build itinerary rows from real option data
  const itineraryRows = [];
  if (option) {
    if (option.type === "flight" || option.label?.toLowerCase().includes("flight")) {
      itineraryRows.push({ ic: "🛫", t: option.label || `${dep} → ${arr} · ${flightLabel}` });
    }
    if (option.label?.toLowerCase().includes("hotel") || option.hotel) {
      itineraryRows.push({ ic: "🏨", t: option.hotel || "Hotel confirmed · arrival noted" });
    }
    if (option.type === "award" || option.label?.toLowerCase().includes("points")) {
      itineraryRows.push({ ic: "⭐", t: option.label || "Award redemption confirmed" });
    }
    if (option.downstream_value_protected && option.downstream_value_protected > 0) {
      const sym = currency === "EUR" ? "€" : "$";
      itineraryRows.push({ ic: "💳", t: `${sym}${option.downstream_value_protected.toLocaleString()} downstream value protected` });
    }
    if (valueSaved && valueSaved > 0) {
      const sym = currency === "EUR" ? "€" : "$";
      itineraryRows.push({ ic: "✦", t: `${sym}${valueSaved.toLocaleString()} total value saved` });
    }
  } else {
    // Fallback if no params (e.g. navigated directly)
    itineraryRows.push({ ic: "✓", t: "Your rescue has been confirmed" });
  }

  const headline = option?.label
    ? `You're rerouted — ${option.label}`
    : dep && arr
    ? `You're rerouted: ${dep} → ${arr}`
    : "You're sorted";

  const subtext = option
    ? "Wingman handled it before you left the gate. Check your email for confirmation."
    : "Sorted before you even left the gate.";

  return (
    <SafeAreaView style={s.app}>
      <ScrollView
        contentContainerStyle={[g.scroll, { alignItems: "center", justifyContent: "center", flexGrow: 1 }]}
      >
        <Animated.View style={[s.check, { transform: [{ scale: sc }] }]}>
          <Text style={{ fontSize: 38, color: C.teal }}>✓</Text>
        </Animated.View>
        <Text style={s.doneH}>{headline}</Text>
        <Text style={s.doneP}>{subtext}</Text>
        {itineraryRows.length > 0 && (
          <View style={s.newtrip}>
            <Text style={s.ntT}>UPDATED ITINERARY</Text>
            {itineraryRows.map((row, i) => (
              <NtRow key={i} ic={row.ic} t={row.t} />
            ))}
          </View>
        )}
        <Btn
          title="Back to trip"
          kind="accent"
          onPress={() => navigation.popToTop()}
          style={{ marginTop: 18, alignSelf: "stretch" }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  check: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(34,211,166,0.12)",
    borderWidth: 2, borderColor: C.teal,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  doneH: { color: C.ink, fontSize: 22, fontFamily: T.sansB, textAlign: "center", paddingHorizontal: 16 },
  doneP: { color: C.mut, fontSize: 14, textAlign: "center", marginVertical: 12, lineHeight: 20, paddingHorizontal: 10 },
  newtrip: {
    alignSelf: "stretch", backgroundColor: C.card,
    borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14,
  },
  ntT: { fontSize: 11, color: C.mut, letterSpacing: 1, marginBottom: 10 },
});
