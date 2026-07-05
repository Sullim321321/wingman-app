// WelcomeScreen.js — Editorial v3
// One-time bridge after ProfileSetup — prompts Gmail import or manual add
// EB Garamond italic serif headline · prose body · minimal tappable rows
// All navigation hooks preserved: Connections, AddTrip, Connections+paste, Tabs

import React, { useEffect, useRef } from "react";
import {
  SafeAreaView, View, Text, Pressable,
  StyleSheet, Animated, Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, T, GRAD } from "../theme";
import { tap } from "../components";

const KEY_SEEN_WELCOME = "wingman_seen_welcome";

// ─── Fade-in animation ────────────────────────────────────────────────────────

function FadeIn({ delay = 0, children }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WelcomeScreen({ navigation, route }) {
  const firstName = route?.params?.firstName || "";
  const insets    = useSafeAreaInsets();

  const markSeen = async () => {
    try { await SecureStore.setItemAsync(KEY_SEEN_WELCOME, "1"); } catch (_) {}
  };

  const goGmail = async () => {
    tap(); await markSeen();
    navigation.replace("Connections");
  };

  const goPaste = async () => {
    tap(); await markSeen();
    navigation.replace("Connections", { tab: "paste" });
  };

  const goAddTrip = async () => {
    tap(); await markSeen();
    navigation.replace("AddTrip");
  };

  const goSkip = async () => {
    tap(); await markSeen();
    navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
  };

  return (
    <SafeAreaView style={s.root}>
      <LinearGradient
        colors={[C.inkD, "#1A1610", C.inkD]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[s.inner, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>

        {/* Masthead */}
        <FadeIn delay={0}>
          <View style={s.masthead}>
            <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.markBg}>
              <Text style={s.markT}>W</Text>
            </LinearGradient>
            <Text style={s.mastLabel}>WINGMAN</Text>
          </View>
        </FadeIn>

        {/* Edition line */}
        <FadeIn delay={120}>
          <View style={s.editionRow}>
            <View style={[s.editionDot, { backgroundColor: C.gold }]} />
            <Text style={s.editionT}>WELCOME EDITION</Text>
          </View>
        </FadeIn>

        {/* Headline */}
        <FadeIn delay={220}>
          <Text style={s.hed}>
            {firstName ? `Welcome, ${firstName}.` : "Welcome aboard."}
          </Text>
        </FadeIn>

        {/* Prose briefing */}
        <FadeIn delay={320}>
          <Text style={s.briefing}>
            Your travel intelligence is active. Connect Gmail and Wingman will import every booking automatically — flights, hotels, trains — and start watching them immediately. Or add a trip manually to get started.
          </Text>
        </FadeIn>

        {/* Demo trip notice */}
        <FadeIn delay={380}>
          <View style={s.demoNotice}>
            <View style={[s.demoDot, { backgroundColor: C.gold }]} />
            <Text style={s.demoNoticeT}>A sample trip has been added so you can explore Wingman right away.</Text>
          </View>
        </FadeIn>

        {/* Rule */}
        <FadeIn delay={400}>
          <View style={s.rule} />
        </FadeIn>

        {/* Tappable rows */}
        <FadeIn delay={460}>
          <View style={s.rowBlock}>

            {/* Gmail */}
            <Pressable style={s.row} onPress={goGmail}>
              <View style={[s.rowDot, { backgroundColor: C.teal + "18", borderColor: C.teal + "30" }]}>
                <View style={[s.rowDotInner, { backgroundColor: C.teal }]} />
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowTitle}>Connect Gmail</Text>
                <Text style={s.rowSub}>Import all bookings automatically</Text>
              </View>
              <Text style={s.rowArrow}>›</Text>
            </Pressable>

            <View style={s.rowDivider} />

            {/* Paste confirmation */}
            <Pressable style={s.row} onPress={goPaste}>
              <View style={[s.rowDot, { backgroundColor: C.gold + "18", borderColor: C.gold + "30" }]}>
                <View style={[s.rowDotInner, { backgroundColor: C.gold }]} />
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowTitle}>Paste a confirmation email</Text>
                <Text style={s.rowSub}>Copy & paste any booking — Wingman reads it</Text>
              </View>
              <Text style={s.rowArrow}>›</Text>
            </Pressable>

            <View style={s.rowDivider} />

            {/* Manual add */}
            <Pressable style={s.row} onPress={goAddTrip}>
              <View style={[s.rowDot, { backgroundColor: C.mut + "18", borderColor: C.mut + "20" }]}>
                <View style={[s.rowDotInner, { backgroundColor: C.mut }]} />
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowTitle}>Add a flight manually</Text>
                <Text style={s.rowSub}>Enter a flight number or confirmation code</Text>
              </View>
              <Text style={s.rowArrow}>›</Text>
            </Pressable>

          </View>
        </FadeIn>

        {/* Skip */}
        <FadeIn delay={560}>
          <Pressable style={s.skipBtn} onPress={goSkip}>
            <Text style={s.skipBtnT}>I'll add trips later</Text>
          </Pressable>
        </FadeIn>

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 0,
  },

  // ── Masthead ──
  masthead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  markBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  markT: {
    fontFamily: T.sansB,
    fontSize: 14,
    color: C.inkD,
  },
  mastLabel: {
    fontFamily: T.sansB,
    fontSize: 11,
    letterSpacing: 3,
    color: C.ink,
    opacity: 0.5,
  },

  // ── Edition line ──
  editionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  editionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  editionT: {
    fontFamily: T.sansM,
    fontSize: 9,
    letterSpacing: 2.5,
    color: C.mut,
    opacity: 0.6,
  },

  // ── Headline ──
  hed: {
    fontFamily: T.garamondSI,
    fontSize: 36,
    color: C.ink,
    letterSpacing: -0.3,
    lineHeight: 42,
    marginBottom: 14,
  },

  // ── Briefing ──
  briefing: {
    fontFamily: T.garamondI,
    fontSize: 17,
    color: C.mut,
    lineHeight: 28,
    marginBottom: 10,
  },

  // ── Demo trip notice ──
  demoNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  demoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  demoNoticeT: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.gold,
    opacity: 0.8,
    flex: 1,
    lineHeight: 18,
  },

  // ── Rule ──
  rule: {
    height: 1,
    backgroundColor: C.line,
    opacity: 0.4,
    marginBottom: 20,
  },

  // ── Row block ──
  rowBlock: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  rowDivider: {
    height: 1,
    backgroundColor: C.line,
    marginLeft: 46,
    opacity: 0.5,
  },
  rowDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: T.sansM,
    fontSize: 14,
    color: C.ink,
    lineHeight: 20,
  },
  rowSub: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
    lineHeight: 17,
  },
  rowArrow: {
    fontFamily: T.sansM,
    fontSize: 18,
    color: C.mut,
    opacity: 0.5,
  },

  // ── Skip ──
  skipBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  skipBtnT: {
    fontFamily: T.sansM,
    fontSize: 13,
    color: C.mut,
    opacity: 0.6,
  },
});
