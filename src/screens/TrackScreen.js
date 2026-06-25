import React, { useRef, useEffect } from "react";
import { SafeAreaView, ScrollView, View, Text, Animated, Easing, StyleSheet } from "react-native";
import { C } from "../theme";
import { BackBar, useCountUp, g } from "../components";

const BANDS = [
  { label: "20%", pred: 20, act: 22 },
  { label: "40%", pred: 40, act: 37 },
  { label: "60%", pred: 60, act: 63 },
  { label: "80%", pred: 80, act: 78 },
  { label: "95%", pred: 95, act: 92 },
];
const MAXH = 120;

function CalBars() {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: 900, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, []);
  return (
    <View style={s.cbars}>
      {BANDS.map((b, i) => (
        <View key={i} style={s.cb}>
          <View style={s.pair}>
            <Animated.View style={[s.pred, { height: p.interpolate({ inputRange: [0, 1], outputRange: [0, (b.pred / 100) * MAXH] }) }]} />
            <Animated.View style={[s.act, { height: p.interpolate({ inputRange: [0, 1], outputRange: [0, (b.act / 100) * MAXH] }) }]} />
          </View>
          <Text style={s.bl}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function TrackScreen({ navigation }) {
  const n = useCountUp(142, true, 6, 16);
  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Track record" />

        <View style={s.stats}>
          <Stat n={n} l="disruptions called" />
          <Stat n="88%" l="hit rate" />
          <Stat n="3.2h" l="avg lead time" />
        </View>

        <View style={s.calib}>
          <Text style={s.calT}>CALIBRATION</Text>
          <Text style={s.calS}>When Wingman says 70%, it happens ~70% of the time. Predicted vs. what actually occurred, by confidence band.</Text>
          <CalBars />
          <View style={s.leg}>
            <View style={s.legItem}><View style={[s.legDot, { backgroundColor: "#2A3354" }]} /><Text style={s.legT}>Predicted</Text></View>
            <View style={s.legItem}><View style={[s.legDot, { backgroundColor: C.teal }]} /><Text style={s.legT}>Actual</Text></View>
          </View>
        </View>

        <Text style={s.note}>Every call is logged against what actually happened — the dataset that compounds into better predictions over time.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ n, l }) {
  return (
    <View style={s.stat}>
      <Text style={s.statN}>{n}</Text>
      <Text style={s.statL}>{l}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  stats: { flexDirection: "row", gap: 10, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 13, alignItems: "center" },
  statN: { fontSize: 24, fontWeight: "800", color: C.teal },
  statL: { fontSize: 10, color: C.mut, marginTop: 3, textAlign: "center" },
  calib: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, marginBottom: 12 },
  calT: { fontSize: 11, color: C.mut, letterSpacing: 1, marginBottom: 4 },
  calS: { fontSize: 11.5, color: C.mut, marginBottom: 14, lineHeight: 16 },
  cbars: { flexDirection: "row", alignItems: "flex-end", gap: 10, height: MAXH + 20, paddingHorizontal: 4 },
  cb: { flex: 1, alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" },
  pair: { flexDirection: "row", gap: 3, alignItems: "flex-end", height: MAXH },
  pred: { flex: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: "#2A3354" },
  act: { flex: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: C.teal },
  bl: { fontSize: 9.5, color: C.mut },
  leg: { flexDirection: "row", gap: 16, justifyContent: "center", marginTop: 12 },
  legItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legDot: { width: 9, height: 9, borderRadius: 2 },
  legT: { fontSize: 10.5, color: C.mut },
  note: { color: C.mut, fontSize: 12, lineHeight: 18, paddingHorizontal: 2 },
});
