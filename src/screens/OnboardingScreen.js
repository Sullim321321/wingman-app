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
        <LinearGradient colors={[C.gold, C.goldD]} style={s.heroIcon}>
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
          { ic: "⚠️", c: C.coral,  t: "UA 412 Delayed 45m", s: "Gate B22 → B31 · New dep 3:15 PM" },
          { ic: "🌨️", c: C.gold,   t: "Weather risk: DEN 68%", s: "Snow band on inbound radar" },
          { ic: "✅", c: C.teal,   t: "AA 1847 On Time", s: "Boarding in 22 min · Gate C14" },
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

// ─── Slide 4: Push Notifications (single ask, high acceptance) ──────────────

function SlideNotifications({ onDone, onSkip }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const enable = async () => {
    setLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        const t = await Notifications.getExpoPushTokenAsync({
          projectId: "4a6e7311-c1fa-4c7a-a5a8-0fc8a041ac41",
        });
        if (t?.data) await registerPushToken(t.data);
      }
    } catch (e) {}
    setLoading(false);
    setDone(true);
    setTimeout(onDone, 600);
  };

  return (
    <View style={s.slide}>
      <LinearGradient colors={[C.amber + "18", "transparent"]} style={s.permCard}>
        <View style={s.permIconWrap}>
          <LinearGradient colors={[C.amber + "33", C.amber + "11"]} style={s.permIconBg}>
            <Text style={{ fontSize: 36 }}>{done ? "✅" : "🔔"}</Text>
          </LinearGradient>
        </View>
        <Text style={s.permTitle}>Don't miss a thing</Text>
        <Text style={s.permBody}>
          Wingman needs permission to send you alerts when a flight is delayed, cancelled, or your gate changes. You'll only hear from us when it matters.
        </Text>

        <View style={s.permBullets}>
          {[
            "Delay & cancellation alerts",
            "Gate change notifications",
            "Disruption rescue prompts",
          ].map(b => (
            <View key={b} style={s.permBulletRow}>
              <Text style={{ color: C.teal, fontSize: 13 }}>✓</Text>
              <Text style={s.permBulletT}>{b}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <View style={{ width: "100%", marginTop: 8 }}>
        {loading ? (
          <View style={s.loadingRow}>
            <ActivityIndicator color={C.teal} />
            <Text style={{ color: C.mut, fontSize: 14, marginLeft: 10 }}>Enabling alerts…</Text>
          </View>
        ) : done ? (
          <View style={s.doneRow}>
            <Text style={{ color: C.teal, fontSize: 15, fontWeight: "700" }}>✓ Alerts enabled</Text>
          </View>
        ) : (
          <>
            <Btn title="Enable disruption alerts" onPress={enable} />
            <Pressable style={{ marginTop: 14, alignItems: "center" }} onPress={onSkip}>
              <Text style={s.skipLink}>Not now</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Slide 5: Gmail (separate step, after user is invested) ─────────────────

function SlideGmail({ onDone }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const connect = async () => {
    setLoading(true);
    try {
      const { url } = await getGmailConnectUrl();
      if (url) await Linking.openURL(url);
      setDone(true);
    } catch (e) {
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  const finish = async () => {
    try { await SecureStore.setItemAsync(KEY_ONBOARDED, "1"); } catch (e) {}
    onDone();
  };

  return (
    <View style={s.slide}>
      <LinearGradient colors={[C.gold + "14", "transparent"]} style={s.permCard}>
        <View style={s.permIconWrap}>
          <LinearGradient colors={[C.gold + "33", C.gold + "11"]} style={s.permIconBg}>
            <Text style={{ fontSize: 36 }}>{done ? "✅" : "📧"}</Text>
          </LinearGradient>
        </View>
        <Text style={s.permTitle}>Import trips automatically</Text>
        <Text style={s.permBody}>
          Connect Gmail and Wingman will scan for flight and hotel confirmations — no manual entry needed. We only read booking emails, nothing else.
        </Text>

        <View style={s.permBullets}>
          {[
            "Auto-import flight confirmations",
            "Hotel & car rental bookings",
            "Read-only · never sends email",
          ].map(b => (
            <View key={b} style={s.permBulletRow}>
              <Text style={{ color: C.teal, fontSize: 13 }}>✓</Text>
              <Text style={s.permBulletT}>{b}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <View style={{ width: "100%", marginTop: 8 }}>
        {loading ? (
          <View style={s.loadingRow}>
            <ActivityIndicator color={C.teal} />
            <Text style={{ color: C.mut, fontSize: 14, marginLeft: 10 }}>Opening Gmail…</Text>
          </View>
        ) : done ? (
          <>
            <View style={s.doneRow}>
              <Text style={{ color: C.teal, fontSize: 15, fontWeight: "700" }}>✓ Gmail connected</Text>
            </View>
            <Btn title="Start using Wingman →" onPress={finish} style={{ marginTop: 14 }} />
          </>
        ) : (
          <>
            <Btn title="Connect Gmail" onPress={connect} />
            <Pressable style={{ marginTop: 14, alignItems: "center" }} onPress={finish}>
              <Text style={s.skipLink}>Skip — I'll add trips manually</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function OnboardingScreen({ navigation }) {
  const [page, setPage] = useState(0);
  const ref = useRef(null);
  const TOTAL = 5; // Hero, Watch, Concierge, Notifications, Gmail

  const onScroll = (e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  const next = () => {
    if (page < TOTAL - 1) ref.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  const goSignIn = () => navigation.navigate("SignIn");

  // Slides 4 and 5 have their own CTAs — hide the shared Next/footer buttons
  const isPermSlide = page === 3 || page === 4;

  return (
    <SafeAreaView style={s.app}>
      {/* Skip button — only on info slides */}
      {!isPermSlide && (
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
        <SlideNotifications onDone={next} onSkip={next} />
        <SlideGmail onDone={goSignIn} />
      </ScrollView>

      {/* Footer dots + Next button — only on info slides */}
      {!isPermSlide && (
        <View style={s.footer}>
          <View style={s.dots}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <View key={i} style={[s.dot, i === page && s.dotOn]} />
            ))}
          </View>
          <Btn title="Next" onPress={next} />
        </View>
      )}

      {/* Dots only on permission slides */}
      {isPermSlide && (
        <View style={[s.footer, { paddingBottom: 20 }]}>
          <View style={s.dots}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <View key={i} style={[s.dot, i === page && s.dotOn]} />
            ))}
          </View>
        </View>
      )}
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
  ring: { position: "absolute", borderWidth: 1.5, borderColor: C.gold, opacity: 0.18 },
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
  bubbleRight: { alignSelf: "flex-end", backgroundColor: C.gold, borderRadius: 14, borderBottomRightRadius: 4, padding: 11, maxWidth: "85%" },
  bubbleText: { color: C.mut, fontSize: 12.5, lineHeight: 18 },

  // Permission slides
  permCard: { width: "100%", borderRadius: 24, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 8 },
  permIconWrap: { marginBottom: 18 },
  permIconBg: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  permTitle: { color: C.ink, fontSize: 22, fontWeight: "700", letterSpacing: -0.4, marginBottom: 10, textAlign: "center" },
  permBody: { color: C.mut, fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 20 },
  permBullets: { width: "100%", gap: 10 },
  permBulletRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  permBulletT: { color: C.ink, fontSize: 14, fontWeight: "500" },

  loadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  doneRow: { alignItems: "center", paddingVertical: 14 },
  skipLink: { color: C.mut, fontSize: 14 },

  // Shared
  title: { color: C.ink, fontSize: 25, fontWeight: "700", marginBottom: 10, textAlign: "center", letterSpacing: -0.4 },
  body: { color: C.mut, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 320 },
  footer: { paddingHorizontal: 24, paddingBottom: 34, paddingTop: 6 },
  dots: { flexDirection: "row", gap: 7, justifyContent: "center", marginBottom: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.line },
  dotOn: { backgroundColor: C.gold, width: 22 },
});
