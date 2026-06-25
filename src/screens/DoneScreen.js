import React, { useRef, useEffect } from "react";
import { SafeAreaView, ScrollView, View, Text, Animated, StyleSheet } from "react-native";
import { C } from "../theme";
import { Btn, NtRow, g } from "../components";

export default function DoneScreen({ navigation }) {
  const sc = useRef(new Animated.Value(0.4)).current;
  useEffect(() => { Animated.spring(sc, { toValue: 1, friction: 5, useNativeDriver: true }).start(); }, []);
  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={[g.scroll, { alignItems: "center", justifyContent: "center", flexGrow: 1 }]}>
        <Animated.View style={[s.check, { transform: [{ scale: sc }] }]}><Text style={{ fontSize: 38, color: C.teal }}>✓</Text></Animated.View>
        <Text style={s.doneH}>You're rerouted to Aspen</Text>
        <Text style={s.doneP}>Sorted before you even left the gate. Your driver meets you at DEN baggage claim.</Text>
        <View style={s.newtrip}>
          <Text style={s.ntT}>UPDATED ITINERARY</Text>
          <NtRow ic="🛫" t="JFK → DEN · UA 412 · 11:05a" />
          <NtRow ic="🚙" t="Private car DEN → Aspen · 2:30p" />
          <NtRow ic="🏨" t="Hotel Jerome · arrival noted" />
          <NtRow ic="💳" t="$214 refunded for the flight" />
        </View>
        <Btn title="Back to trip" kind="accent" onPress={() => navigation.popToTop()} style={{ marginTop: 18, alignSelf: "stretch" }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  check: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(34,211,166,0.12)", borderWidth: 2, borderColor: C.teal, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  doneH: { color: C.ink, fontSize: 22, fontWeight: "700", textAlign: "center" },
  doneP: { color: C.mut, fontSize: 14, textAlign: "center", marginVertical: 12, lineHeight: 20, paddingHorizontal: 10 },
  newtrip: { alignSelf: "stretch", backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14 },
  ntT: { fontSize: 11, color: C.mut, letterSpacing: 1, marginBottom: 10 },
});
