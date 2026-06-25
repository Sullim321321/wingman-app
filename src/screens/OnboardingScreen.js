import React, { useRef, useState } from "react";
import {
  SafeAreaView, View, Text, ScrollView, Dimensions,
  StyleSheet, Pressable, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { C } from "../theme";
import { Btn } from "../components";
import { getGmailConnectUrl, registerPushToken } from "../api";

const { width } = Dimensions.get("window");
const KEY_ONBOARDED = "wingman_onboarded";

// ─── Slide 1: Hero ──────────────────────────────────────────────────────────

function SlideHero() {
  return (
    <View style={s.slide}>
      <View style={s.heroWrap}>
        {[180, 130, 82].map((sz, i) => (
          <View key={i} style={[s.ring, { width: sz, height: sz, borderRadius: sz / 2 }]} />
        ))}
        <LinearGradient colors={[C.accent, C.teal]} style={s.heroIcon}>
          <Text style={{ fontSize: 38 }}>✈️</Text>
        </LinearGradient>
      </View>
      <Text style={s.title}>Meet Wingman</Text>
      <Text style={s.body}>
        The only travel app that watches your flights, catches disruptions hours early, and tells you exactly what to do — before the airline does.
      </Text>
      <View style={s.statRow}>
        {[["15 min", "check interval"], ["48 hr", "lookahead"], ["24/7", "monitoring"]].map(([v, l], i) => (
          <View key={l} style={[s.stat, i < 2 && { borderRightWidth: 1, borderRightColor: C.line }]}>
            <Text style={s.statV}>{v}</Text>
            <Text style={s.statL}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Slide 2: We watch ──────────────────────────────────────────────────────

function SlideWatch() {
  return (
    <View style={s.slide}>
      <View style={s.featureCard}>
        {[
          { ic: "⚠️", c: C.coral, t: "UA 412 Delayed 45m", s: "Gate B22 → B31 · New dep 3:15 PM" },
          { ic: "🌨️", c: C.accent, t: "Weather risk: DEN 68%", s: "Snow band on inbound radar" },
          { ic: "✅", c: C.teal,  t: "AA 1847 On Time", s: "Boarding in 22 min · Gate C14" },
        ].map((item, i) => (
          <View key={i} style={[s.mockRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
            <View style={[s.mockIc, { backgroundColor: item.c + "22" }]}>
              <Text style={{ fontSize: 15 }}>{item.ic}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.mockT}>{item.t}</Text>
              <Text style={s.mockS}>{item.s}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={s.title}>We watch, so you don't</Text>
      <Text style={s.body}>
        Wingman checks every flight on your itinerary every 15 minutes — delays, gate changes, cancellations, weather risk — and alerts you before it becomes a crisis.
      </Text>
    </View>
  );
}

// ─── Slide 3: Concierge ─────────────────────────────────────────────────────

function SlideConcierge() {
  return (
    <View style={s.slide}>
      <View style={s.chatCard}>
        <View style={s.bubbleLeft}>
          <Text style={s.bubbleText}>My flight to Denver was just cancelled — what do I do?</Text>
        </View>
        <View style={s.bubbleRight}>
          <Text style={[s.bubbleText, { color: "#fff" }]}>
            UA 412 is cancelled. AA 1847 departs JFK at 4:20 PM with 2 seats in your fare class. Want me to pull up the rebooking link?
          </Text>
        </View>
        <View style={s.bubbleLeft}>
          <Text style={s.bubbleText}>Yes please</Text>
        </View>
      </View>
      <Text style={s.title}>Your Concierge, on call</Text>
      <Text style={s.body}>
        Ask Wingman anything about your trip — live flight status, rebooking options, weather risk, gate info — and get a direct answer, not a search result.
      </Text>
    </View>
  );
}

// ─── Slide 4: Setup ─────────────────────────────────────────────────────────

function SlideSetup({ onDone }) {
  const [gmailDone, setGmailDone] = useState(false);
  const [notifDone, setNotifDone] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);

  const connectGmail = async () => {
    setGmailLoading(true);
    try {
      const { url } = await getGmailConnectUrl();
      if (url) await Linking.openURL(url);
      setGmailDone(true);
    } catch (e) {
      setGmailDone(true);
    } finally {
      setGmailLoading(false);
    }
  };

  const enableNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        const t = await Notifications.getExpoPushTokenAsync({
          projectId: "4a6e7311-c1fa-4c7a-a5a8-0fc8a041ac41",
        });
        if (t?.data) await registerPushToken(t.data);
      }
    } catch (e) {}
    setNotifDone(true);
  };

  const finish = async () => {
    try { await SecureStore.setItemAsync(KEY_ONBOARDED, "1"); } catch (e) {}
    onDone();
  };

  return (
    <View style={s.slide}>
      <LinearGradient colors={[C.accent + "22", "transparent"]} style={s.setupHeader}>
        <Text style={{ fontSize: 36 }}>🛡</Text>
        <Text style={s.setupHeadT}>You're almost protected</Text>
        <Text style={s.setupHeadS}>Two quick steps and Wingman is fully active.</Text>
      </LinearGradient>

      <Pressable
        style={[s.setupRow, gmailDone && s.setupRowDone]}
        onPress={gmailDone ? undefined : connectGmail}
      >
        <View style={[s.setupIc, { backgroundColor: gmailDone ? C.teal + "22" : C.accent + "22" }]}>
          {gmailLoading
            ? <ActivityIndicator color={C.accent} size="small" />
            : <Text style={{ fontSize: 20 }}>{gmailDone ? "✅" : "📧"}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.setupT}>{gmailDone ? "Gmail connected" : "Connect Gmail"}</Text>
          <Text style={s.setupS}>
            {gmailDone
              ? "Booking confirmations will import automatically"
              : "Auto-import flight & hotel confirmations from your inbox"}
          </Text>
        </View>
        {!gmailDone && <Text style={s.arrow}>›</Text>}
      </Pressable>

      <Pressable
        style={[s.setupRow, notifDone && s.setupRowDone]}
        onPress={notifDone ? undefined : enableNotifications}
      >
        <View style={[s.setupIc, { backgroundColor: notifDone ? C.teal + "22" : C.amber + "22" }]}>
          <Text style={{ fontSize: 20 }}>{notifDone ? "✅" : "🔔"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.setupT}>{notifDone ? "Alerts enabled" : "Enable disruption alerts"}</Text>
          <Text style={s.setupS}>
            {notifDone
              ? "You'll be notified the moment something changes"
              : "Get notified the moment a flight is delayed or cancelled"}
          </Text>
        </View>
        {!notifDone && <Text style={s.arrow}>›</Text>}
      </Pressable>

      <View style={{ marginTop: 20, width: "100%" }}>
        <Btn title="Start using Wingman →" onPress={finish} />
        <Text style={s.skip} onPress={finish}>Skip for now</Text>
      </View>
    </View>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function OnboardingScreen({ navigation }) {
  const [page, setPage] = useState(0);
  const ref = useRef(null);
  const TOTAL = 4;

  const onScroll = (e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  const next = () => {
    if (page < TOTAL - 1) ref.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  const goSignIn = () => navigation.navigate("SignIn");
  const isLast = page === TOTAL - 1;

  return (
    <SafeAreaView style={s.app}>
      {!isLast && (
        <Pressable style={s.skipBtn} onPress={goSignIn}>
          <Text style={s.skipBtnT}>Skip</Text>
        </Pressable>
      )}

      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        <SlideHero />
        <SlideWatch />
        <SlideConcierge />
        <SlideSetup onDone={goSignIn} />
      </ScrollView>

      <View style={s.footer}>
        <View style={s.dots}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <View key={i} style={[s.dot, i === page && s.dotOn]} />
          ))}
        </View>
        {!isLast && <Btn title="Next" onPress={next} />}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  skipBtn: { position: "absolute", top: 54, right: 20, zIndex: 10, padding: 8 },
  skipBtnT: { color: C.mut, fontSize: 14 },

  slide: { width, alignItems: "center", justifyContent: "center", paddingHorizontal: 26, paddingTop: 10 },

  // Hero
  heroWrap: { width: 190, height: 190, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  ring: { position: "absolute", borderWidth: 1.5, borderColor: C.accent, opacity: 0.18 },
  heroIcon: { width: 80, height: 80, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  statRow: { flexDirection: "row", marginTop: 24, borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: "hidden", width: "100%" },
  stat: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statV: { color: C.ink, fontSize: 18, fontWeight: "700" },
  statL: { color: C.mut, fontSize: 11, marginTop: 2 },

  // Watch
  featureCard: { width: "100%", backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, marginBottom: 24, overflow: "hidden" },
  mockRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  mockIc: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  mockT: { color: C.ink, fontSize: 13, fontWeight: "600" },
  mockS: { color: C.mut, fontSize: 11, marginTop: 2 },

  // Concierge
  chatCard: { width: "100%", backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10, marginBottom: 24 },
  bubbleLeft: { alignSelf: "flex-start", backgroundColor: C.card2, borderRadius: 14, borderBottomLeftRadius: 4, padding: 11, maxWidth: "82%" },
  bubbleRight: { alignSelf: "flex-end", backgroundColor: C.accent, borderRadius: 14, borderBottomRightRadius: 4, padding: 11, maxWidth: "85%" },
  bubbleText: { color: C.mut, fontSize: 12.5, lineHeight: 18 },

  // Setup
  setupHeader: { width: "100%", borderRadius: 18, padding: 20, alignItems: "center", marginBottom: 20 },
  setupHeadT: { color: C.ink, fontSize: 20, fontWeight: "700", marginTop: 8, marginBottom: 4 },
  setupHeadS: { color: C.mut, fontSize: 13, textAlign: "center" },
  setupRow: { flexDirection: "row", alignItems: "center", gap: 14, width: "100%", backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 12 },
  setupRowDone: { borderColor: C.teal + "55", backgroundColor: C.teal + "0A" },
  setupIc: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  setupT: { color: C.ink, fontSize: 14, fontWeight: "600" },
  setupS: { color: C.mut, fontSize: 12, marginTop: 2, lineHeight: 16 },
  arrow: { color: C.mut, fontSize: 24, fontWeight: "300" },

  // Shared
  title: { color: C.ink, fontSize: 25, fontWeight: "700", marginBottom: 10, textAlign: "center" },
  body: { color: C.mut, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 320 },
  footer: { paddingHorizontal: 24, paddingBottom: 34, paddingTop: 6 },
  dots: { flexDirection: "row", gap: 7, justifyContent: "center", marginBottom: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.line },
  dotOn: { backgroundColor: C.accent, width: 22 },
  skip: { color: C.mut, fontSize: 13, textAlign: "center", marginTop: 14 },
});
