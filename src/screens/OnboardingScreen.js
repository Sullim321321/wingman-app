import React, { useRef, useState } from "react";
import { SafeAreaView, View, Text, ScrollView, Dimensions, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { Btn } from "../components";

const { width } = Dimensions.get("window");

const SLIDES = [
  { icon: "✈", title: "Meet Wingman", body: "Your travel agent in your pocket — solving problems as they happen, and thinking ahead of you." },
  { icon: "🔮", title: "We watch, so you don't", body: "Wingman tracks weather, delays and seats across your whole trip — and warns you hours before the gate agent." },
  { icon: "🛡", title: "Always in your control", body: "It shows its reasoning and never books or moves money above your limit without an explicit yes." },
];

export default function OnboardingScreen({ navigation }) {
  const [page, setPage] = useState(0);
  const ref = useRef(null);
  const onScroll = (e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  const next = () => {
    if (page < SLIDES.length - 1) ref.current?.scrollTo({ x: (page + 1) * width, animated: true });
    else navigation.navigate("SignIn");
  };
  return (
    <SafeAreaView style={s.app}>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll}>
        {SLIDES.map((sl, i) => (
          <View key={i} style={[s.slide, { width }]}>
            <LinearGradient colors={[C.accent, C.teal]} style={s.bigMark}><Text style={{ fontSize: 42 }}>{sl.icon}</Text></LinearGradient>
            <Text style={s.title}>{sl.title}</Text>
            <Text style={s.body}>{sl.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={s.footer}>
        <View style={s.dots}>
          {SLIDES.map((_, i) => <View key={i} style={[s.dot, i === page && s.dotOn]} />)}
        </View>
        <Btn title={page < SLIDES.length - 1 ? "Next" : "Get started"} onPress={next} />
        <Text style={s.skip} onPress={() => navigation.navigate("SignIn")}>Skip</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  slide: { alignItems: "center", justifyContent: "center", paddingHorizontal: 36, flex: 1 },
  bigMark: { width: 96, height: 96, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 26 },
  title: { color: C.ink, fontSize: 26, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  body: { color: C.mut, fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 300 },
  footer: { padding: 24, paddingBottom: 30 },
  dots: { flexDirection: "row", gap: 7, justifyContent: "center", marginBottom: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.line },
  dotOn: { backgroundColor: C.accent, width: 22 },
  skip: { color: C.mut, fontSize: 13, textAlign: "center", marginTop: 14 },
});
