import React, { useRef, useEffect } from "react";
import { SafeAreaView, ScrollView, View, Text, Animated, StyleSheet } from "react-native";
import { C } from "../theme";
import { Btn, NtRow, g } from "../components";

export default function PlanDoneScreen({ navigation }) {
  const sc = useRef(new Animated.Value(0.4)).current;
  useEffect(() => { Animated.spring(sc, { toValue: 1, friction: 5, useNativeDriver: true }).start(); }, []);
  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={[g.scroll, { alignItems: "center", justifyContent: "center", flexGrow: 1 }]}>
        <Animated.View style={[s.check, { transform: [{ scale: sc }] }]}><Text style={{ fontSize: 38, color: C.teal }}>✓</Text></Animated.View>
        <Text style={s.doneH}>Trip booked</Text>
        <Text style={s.doneP}>London, Copenhagen and Stockholm — flights, hotels and dinner, all done.</Text>
        <View style={s.newtrip}>
          <Text style={s.ntT}>YOUR TRIP</Text>
          <NtRow ic="🛫" t="LHR → CPH · Tue 9:05a" />
          <NtRow ic="🛏️" t="Coco Hotel, Copenhagen · 1 night" />
          <NtRow ic="🛫" t="CPH → ARN · Wed 4:10p" />
          <NtRow ic="🏨" t="Hotel Ett Hem · 3 nights" />
          <NtRow ic="🍽️" t="Ekstedt · Wed 8:30p (Frantzén waitlisted)" />
          <NtRow ic="💳" t="$1,180 total · card ••42" />
        </View>
        <Btn title="Back to trips" kind="accent" onPress={() => navigation.popToTop()} style={{ marginTop: 18, alignSelf: "stretch" }} />
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
