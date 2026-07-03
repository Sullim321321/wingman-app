// WelcomeScreen — shown once after ProfileSetup
// Bridges the gap between sign-up and first trip — prompts Gmail import or manual add
import React, { useEffect, useRef } from "react";
import {
  SafeAreaView, View, Text, Pressable,
  StyleSheet, Animated, Easing, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, T, GRAD } from "../theme";
import { SerifText, tap } from "../components";

const { width } = Dimensions.get("window");
const KEY_SEEN_WELCOME = "wingman_seen_welcome";

function FadeIn({ delay = 0, children }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      {children}
    </Animated.View>
  );
}

export default function WelcomeScreen({ navigation, route }) {
  const firstName = route?.params?.firstName || "";
  const insets = useSafeAreaInsets();

  const markSeen = async () => {
    try { await SecureStore.setItemAsync(KEY_SEEN_WELCOME, "1"); } catch (_) {}
  };

  const goGmail = async () => {
    tap();
    await markSeen();
    navigation.replace("Connections");
  };

  const goAddTrip = async () => {
    tap();
    await markSeen();
    navigation.replace("AddTrip");
  };

  const goSkip = async () => {
    tap();
    await markSeen();
    navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
  };

  return (
    <SafeAreaView style={s.root}>
      <LinearGradient
        colors={[C.inkD, "#1A1610", C.inkD]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[s.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>

        {/* Mark — gold W */}
        <FadeIn delay={0}>
          <View style={s.markWrap}>
            <View style={s.glow} />
            <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.mark}>
              <Text style={s.markText}>W</Text>
            </LinearGradient>
          </View>
        </FadeIn>

        {/* Greeting */}
        <FadeIn delay={150}>
          <SerifText bold style={s.heading}>
            {firstName ? `Welcome, ${firstName}.` : "Welcome aboard."}
          </SerifText>
        </FadeIn>

        <FadeIn delay={250}>
          <Text style={s.sub}>
            Wingman is ready. Add your first trip and I'll start watching it — delays, gate changes, cancellations, and rescue options if anything goes wrong.
          </Text>
        </FadeIn>

        {/* Primary CTAs */}
        <FadeIn delay={380}>
          <View style={s.ctaBlock}>

            {/* Gmail import — primary */}
            <Pressable style={s.ctaPrimary} onPress={goGmail}>
              <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ctaPrimaryGrad}>
                <View style={s.ctaIcon}>
                  <Text style={s.ctaIconText}>✉</Text>
                </View>
                <View style={s.ctaText}>
                  <Text style={s.ctaPrimaryTitle}>Import from Gmail</Text>
                  <Text style={s.ctaPrimarySub}>Wingman finds your bookings automatically</Text>
                </View>
                <Text style={s.ctaArrow}>→</Text>
              </LinearGradient>
            </Pressable>

            {/* Manual add — secondary */}
            <Pressable style={s.ctaSecondary} onPress={goAddTrip}>
              <View style={s.ctaIcon}>
                <Text style={[s.ctaIconText, { color: C.gold }]}>+</Text>
              </View>
              <View style={s.ctaText}>
                <Text style={s.ctaSecondaryTitle}>Add a trip manually</Text>
                <Text style={s.ctaSecondarySub}>Enter a flight number or confirmation code</Text>
              </View>
              <Text style={[s.ctaArrow, { color: C.mut }]}>→</Text>
            </Pressable>

          </View>
        </FadeIn>

        {/* What Wingman watches — compact preview */}
        <FadeIn delay={500}>
          <View style={s.watchCard}>
            {[
              { icon: "!", color: C.coral,  label: "Delays & cancellations" },
              { icon: "✓", color: C.teal,   label: "Automatic rebooking options" },
              { icon: "✦", color: C.gold,   label: "Pre-departure briefings" },
            ].map((item, i) => (
              <View key={i} style={[s.watchRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                <View style={[s.watchBadge, { backgroundColor: item.color + "18" }]}>
                  <Text style={{ color: item.color, fontSize: 12 }}>{item.icon}</Text>
                </View>
                <Text style={s.watchLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </FadeIn>

        {/* Skip */}
        <FadeIn delay={600}>
          <Pressable style={s.skipBtn} onPress={goSkip}>
            <Text style={s.skipBtnT}>I'll add trips later</Text>
          </Pressable>
        </FadeIn>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1, alignItems: "center", paddingHorizontal: 26, justifyContent: "center", gap: 0 },

  // Mark
  markWrap: { alignItems: "center", justifyContent: "center", width: 120, height: 120, marginBottom: 24 },
  glow:     { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: C.gold + "12" },
  mark:     { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", shadowColor: C.gold, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24 },
  markText: { fontSize: 28, color: C.inkD, fontFamily: T.sansB },

  // Heading
  heading: { color: C.ink, fontSize: 34, textAlign: "center", marginBottom: 12, letterSpacing: -0.5, lineHeight: 42 },
  sub:     { color: C.mut, fontSize: 15, fontFamily: T.sans, textAlign: "center", lineHeight: 23, marginBottom: 32, paddingHorizontal: 8 },

  // CTAs
  ctaBlock: { width: "100%", gap: 10, marginBottom: 20 },

  ctaPrimary: { width: "100%", borderRadius: 18, overflow: "hidden", shadowColor: C.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
  ctaPrimaryGrad: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 18, gap: 14 },
  ctaPrimaryTitle: { color: C.inkD, fontSize: 16, fontFamily: T.sansB },
  ctaPrimarySub:   { color: "rgba(15,13,10,0.65)", fontSize: 12, fontFamily: T.sans, marginTop: 2 },

  ctaSecondary: { width: "100%", flexDirection: "row", alignItems: "center", borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 18, paddingVertical: 18, gap: 14 },
  ctaSecondaryTitle: { color: C.ink, fontSize: 16, fontFamily: T.sansM },
  ctaSecondarySub:   { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 2 },

  ctaIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  ctaIconText: { fontSize: 18, color: C.inkD, fontFamily: T.sansB },
  ctaText:  { flex: 1 },
  ctaArrow: { fontSize: 18, color: C.inkD, fontFamily: T.sansM },

  // Watch card
  watchCard: { width: "100%", borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, overflow: "hidden", marginBottom: 20 },
  watchRow:  { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  watchBadge:{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  watchLabel:{ color: C.ink, fontSize: 14, fontFamily: T.sansM, flex: 1 },

  // Skip
  skipBtn:  { padding: 12 },
  skipBtnT: { color: C.mut, fontSize: 13, fontFamily: T.sansM, textAlign: "center" },
});
