import React, { useRef, useState } from "react";
import {
  SafeAreaView, View, Text, ScrollView, Dimensions,
  StyleSheet, Pressable, ActivityIndicator, Animated, Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { C, T, GRAD } from "../theme";
import { SerifText, Btn, tap } from "../components";
import { getGmailConnectUrl, registerPushToken } from "../api";
// Safe BlurView fallback
let _BlurView = null;
try { _BlurView = require("expo-blur").BlurView; } catch (_) {}
function SafeBlur({ intensity, tint, style, children }) {
  if (_BlurView) { const BV = _BlurView; return <BV intensity={intensity} tint={tint} style={style}>{children}</BV>; }
  return <View style={[style, { backgroundColor: "rgba(15,13,10,0.92)" }]}>{children}</View>;
}

const { width } = Dimensions.get("window");
const KEY_ONBOARDED = "wingman_onboarded";

// ─── Animated mount wrapper ───────────────────────────────────────────────────
function SlideIn({ delay = 0, children }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  useRef(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  });
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>{children}</Animated.View>;
}

// ─── Slide 1: Hero ────────────────────────────────────────────────────────────
function SlideHero() {
  return (
    <View style={s.slide}>
      {/* Ambient glow */}
      <View style={s.heroGlow} />

      <SlideIn delay={100}>
        {/* Icon mark */}
        <View style={s.heroMarkWrap}>
          {[200, 150, 100].map((sz, i) => (
            <View key={i} style={[s.ring, { width: sz, height: sz, borderRadius: sz / 2, opacity: 0.06 + i * 0.04 }]} />
          ))}
          <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroMark}>
            <Text style={s.heroMarkIcon}>✦</Text>
          </LinearGradient>
        </View>
      </SlideIn>

      <SlideIn delay={200}>
        <SerifText bold style={s.heroH}>Your personal{"\n"}flight intelligence.</SerifText>
      </SlideIn>

      <SlideIn delay={300}>
        <Text style={s.heroSub}>
          Wingman watches every flight, catches disruptions hours before the airline tells you, and handles the rebooking — automatically.
        </Text>
      </SlideIn>

      <SlideIn delay={400}>
        <View style={s.statRow}>
          {[["15 min", "check interval"], ["48 hr", "lookahead"], ["24/7", "monitoring"]].map(([v, l], i) => (
            <View key={l} style={[s.stat, i < 2 && { borderRightWidth: 1, borderRightColor: C.line }]}>
              <SerifText bold style={s.statV}>{v}</SerifText>
              <Text style={s.statL}>{l}</Text>
            </View>
          ))}
        </View>
      </SlideIn>
    </View>
  );
}

// ─── Slide 2: We watch ────────────────────────────────────────────────────────
function SlideWatch() {
  return (
    <View style={s.slide}>
      <SlideIn delay={100}>
        <SafeBlur intensity={18} tint="dark" style={s.featureCard}>
          {[
            { color: C.coral,  label: "DELAYED",   t: "UA 412 — 45 min delay", s: "Gate B22 → B31 · New dep 3:15 PM" },
            { color: C.gold,   label: "RISK",       t: "Weather risk at DEN — 68%", s: "Snow band on inbound radar" },
            { color: C.teal,   label: "ON TIME",    t: "AA 1847 — On time", s: "Boarding in 22 min · Gate C14" },
          ].map((item, i) => (
            <View key={i} style={[s.mockRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
              <View style={[s.mockBadge, { backgroundColor: item.color + "22" }]}>
                <Text style={[s.mockBadgeT, { color: item.color }]}>{item.label}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.mockT}>{item.t}</Text>
                <Text style={s.mockS}>{item.s}</Text>
              </View>
            </View>
          ))}
        </SafeBlur>
      </SlideIn>

      <SlideIn delay={200}>
        <SerifText bold style={s.slideH}>We watch, so{"\n"}you don't have to.</SerifText>
      </SlideIn>
      <SlideIn delay={300}>
        <Text style={s.slideSub}>
          Every flight on your itinerary is checked every 15 minutes — delays, gate changes, cancellations, weather risk — and you're alerted before it becomes a crisis.
        </Text>
      </SlideIn>
    </View>
  );
}

// ─── Slide 3: Concierge ───────────────────────────────────────────────────────
function SlideConcierge() {
  return (
    <View style={s.slide}>
      <SlideIn delay={100}>
        <SafeBlur intensity={18} tint="dark" style={s.chatCard}>
          <View style={s.bubbleLeft}>
            <Text style={s.bubbleText}>My flight to Denver was just cancelled — what do I do?</Text>
          </View>
          <View style={s.bubbleRight}>
            <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bubbleGrad}>
              <Text style={[s.bubbleText, { color: "#0F0D0A" }]}>
                UA 412 is cancelled. AA 1847 departs JFK at 4:20 PM with 2 seats in your fare class. Want me to rebook you?
              </Text>
            </LinearGradient>
          </View>
          <View style={s.bubbleLeft}>
            <Text style={s.bubbleText}>Yes please</Text>
          </View>
          <View style={s.bubbleRight}>
            <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bubbleGrad}>
              <Text style={[s.bubbleText, { color: "#0F0D0A" }]}>Done. Confirmation sent to your email. ✓</Text>
            </LinearGradient>
          </View>
        </SafeBlur>
      </SlideIn>

      <SlideIn delay={200}>
        <SerifText bold style={s.slideH}>Your concierge,{"\n"}on call 24/7.</SerifText>
      </SlideIn>
      <SlideIn delay={300}>
        <Text style={s.slideSub}>
          Ask Wingman anything about your trip — live status, rebooking options, weather risk, gate info — and get a direct answer, not a search result.
        </Text>
      </SlideIn>
    </View>
  );
}

// ─── Slide 4: Push Notifications ─────────────────────────────────────────────
function SlideNotifications({ onDone, onSkip }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const enable = async () => {
    setLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        const t = await Notifications.getExpoPushTokenAsync({ projectId: "4a6e7311-c1fa-4c7a-a5a8-0fc8a041ac41" });
        if (t?.data) await registerPushToken(t.data);
      }
    } catch (e) {}
    setLoading(false);
    setDone(true);
    setTimeout(onDone, 600);
  };

  return (
    <View style={s.slide}>
      <SlideIn delay={100}>
        <SafeBlur intensity={18} tint="dark" style={s.permCard}>
          <LinearGradient colors={[C.amber + "20", "transparent"]} style={s.permGlow} />
          <View style={s.permIconWrap}>
            <LinearGradient colors={[C.amber + "40", C.amber + "15"]} style={s.permIconBg}>
              <Text style={s.permIconText}>{done ? "✓" : "◎"}</Text>
            </LinearGradient>
          </View>
          <SerifText bold style={s.permTitle}>Don't miss a thing.</SerifText>
          <Text style={s.permBody}>
            Wingman needs permission to alert you when a flight is delayed, cancelled, or your gate changes. You'll only hear from us when it matters.
          </Text>
          <View style={s.permBullets}>
            {["Delay & cancellation alerts", "Gate change notifications", "Disruption rescue prompts"].map(b => (
              <View key={b} style={s.permBulletRow}>
                <Text style={s.permCheck}>✓</Text>
                <Text style={s.permBulletT}>{b}</Text>
              </View>
            ))}
          </View>
        </SafeBlur>
      </SlideIn>

      <SlideIn delay={200}>
        <View style={{ width: width - 52, marginTop: 8 }}>
          {loading ? (
            <View style={s.loadingRow}><ActivityIndicator color={C.gold} /><Text style={s.loadingT}>Enabling alerts…</Text></View>
          ) : done ? (
            <View style={s.doneRow}><Text style={s.doneT}>✓  Alerts enabled</Text></View>
          ) : (
            <>
              <Btn title="Enable disruption alerts" onPress={enable} />
              <Pressable style={s.skipLink} onPress={() => { tap(); onSkip(); }}>
                <Text style={s.skipLinkT}>Not now</Text>
              </Pressable>
            </>
          )}
        </View>
      </SlideIn>
    </View>
  );
}

// ─── Slide 5: Gmail ───────────────────────────────────────────────────────────
function SlideGmail({ onDone }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const connect = async () => {
    setLoading(true);
    try {
      const { url } = await getGmailConnectUrl();
      if (url) await Linking.openURL(url);
      setDone(true);
    } catch (e) { setDone(true); }
    finally { setLoading(false); }
  };

  const finish = async () => {
    try { await SecureStore.setItemAsync(KEY_ONBOARDED, "1"); } catch (e) {}
    onDone();
  };

  return (
    <View style={s.slide}>
      <SlideIn delay={100}>
        <SafeBlur intensity={18} tint="dark" style={s.permCard}>
          <LinearGradient colors={[C.gold + "18", "transparent"]} style={s.permGlow} />
          <View style={s.permIconWrap}>
            <LinearGradient colors={GRAD.gold} style={s.permIconBg}>
              <Text style={[s.permIconText, { color: "#0F0D0A" }]}>{done ? "✓" : "@"}</Text>
            </LinearGradient>
          </View>
          <SerifText bold style={s.permTitle}>Import trips automatically.</SerifText>
          <Text style={s.permBody}>
            Connect Gmail and Wingman will scan for flight and hotel confirmations — no manual entry needed. We only read booking emails, nothing else.
          </Text>
          <View style={s.permBullets}>
            {["Auto-import flight confirmations", "Hotel & car rental bookings", "Read-only · never sends email"].map(b => (
              <View key={b} style={s.permBulletRow}>
                <Text style={s.permCheck}>✓</Text>
                <Text style={s.permBulletT}>{b}</Text>
              </View>
            ))}
          </View>
        </SafeBlur>
      </SlideIn>

      <SlideIn delay={200}>
        <View style={{ width: width - 52, marginTop: 8 }}>
          {loading ? (
            <View style={s.loadingRow}><ActivityIndicator color={C.gold} /><Text style={s.loadingT}>Opening Gmail…</Text></View>
          ) : done ? (
            <>
              <View style={s.doneRow}><Text style={s.doneT}>✓  Gmail connected</Text></View>
              <Btn title="Start using Wingman" onPress={finish} style={{ marginTop: 14 }} />
            </>
          ) : (
            <>
              <Btn title="Connect Gmail" onPress={connect} />
              <Pressable style={s.skipLink} onPress={() => { tap(); finish(); }}>
                <Text style={s.skipLinkT}>Skip — I'll add trips manually</Text>
              </Pressable>
            </>
          )}
        </View>
      </SlideIn>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const [page, setPage] = useState(0);
  const ref = useRef(null);
  const TOTAL = 5;

  const onScroll = (e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  const next = () => {
    if (page < TOTAL - 1) ref.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };
  const goSignIn = () => navigation.navigate("SignIn");
  const isPermSlide = page === 3 || page === 4;

  return (
    <SafeAreaView style={s.app}>
      {/* Background */}
      <LinearGradient colors={["#0F0D0A", "#1A1610", "#0F0D0A"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

      {/* Skip */}
      {!isPermSlide && (
        <Pressable style={s.skipBtn} onPress={() => { tap(); goSignIn(); }}>
          <Text style={s.skipBtnT}>Sign in</Text>
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

      {/* Footer */}
      {!isPermSlide && (
        <View style={s.footer}>
          <View style={s.dots}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <View key={i} style={[s.dot, i === page && s.dotOn]} />
            ))}
          </View>
          <Btn title="Next" onPress={next} style={{ width: 140 }} />
        </View>
      )}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  skipBtn:  { position: "absolute", top: 54, right: 20, zIndex: 10, padding: 8 },
  skipBtnT: { color: C.mut, fontSize: 14, fontFamily: T.sansM },

  slide: { width, alignItems: "center", justifyContent: "center", paddingHorizontal: 26, paddingTop: 10 },

  // Hero
  heroGlow: {
    position: "absolute", top: -60, alignSelf: "center",
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: C.gold + "10",
  },
  heroMarkWrap: { width: 210, height: 210, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  ring: { position: "absolute", borderWidth: 1.5, borderColor: C.gold },
  heroMark: {
    width: 88, height: 88, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
    shadowColor: C.gold, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24,
  },
  heroMarkIcon: { color: "#0F0D0A", fontSize: 32, fontFamily: T.sansB },
  heroH:  { color: C.ink, fontSize: 32, textAlign: "center", marginBottom: 12, lineHeight: 40 },
  heroSub:{ color: C.mut, fontSize: 15, fontFamily: T.sans, textAlign: "center", lineHeight: 23, marginBottom: 24 },
  statRow:{ flexDirection: "row", borderWidth: 1, borderColor: C.line, borderRadius: 18, overflow: "hidden", width: "100%", backgroundColor: C.card },
  stat:   { flex: 1, alignItems: "center", paddingVertical: 16 },
  statV:  { color: C.ink, fontSize: 20 },
  statL:  { color: C.mut, fontSize: 10, fontFamily: T.sans, marginTop: 2, letterSpacing: 0.3 },

  // Slide headlines
  slideH:  { color: C.ink, fontSize: 28, textAlign: "center", marginBottom: 10, lineHeight: 36, marginTop: 20 },
  slideSub:{ color: C.mut, fontSize: 14, fontFamily: T.sans, textAlign: "center", lineHeight: 22 },

  // Watch slide
  featureCard: {
    width: "100%", borderRadius: 22, borderWidth: 1, borderColor: C.line, overflow: "hidden",
    borderTopColor: "#FFFFFF0A", borderBottomColor: "#00000050",
  },
  mockRow:   { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  mockBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center", justifyContent: "center" },
  mockBadgeT:{ fontSize: 9, fontFamily: T.sansB, letterSpacing: 0.8 },
  mockT:     { color: C.ink, fontSize: 13, fontFamily: T.sansM },
  mockS:     { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2 },

  // Concierge slide
  chatCard: {
    width: "100%", borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10,
    borderTopColor: "#FFFFFF0A", borderBottomColor: "#00000050", overflow: "hidden",
  },
  bubbleLeft:  { alignSelf: "flex-start", backgroundColor: C.card2, borderRadius: 16, borderBottomLeftRadius: 4, padding: 12, maxWidth: "82%" },
  bubbleRight: { alignSelf: "flex-end", borderRadius: 16, borderBottomRightRadius: 4, maxWidth: "85%", overflow: "hidden" },
  bubbleGrad:  { padding: 12 },
  bubbleText:  { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 19 },

  // Permission slides
  permCard: {
    width: "100%", borderRadius: 24, padding: 24, alignItems: "center",
    borderWidth: 1, borderColor: C.line,
    borderTopColor: "#FFFFFF0A", borderBottomColor: "#00000050",
    overflow: "hidden",
  },
  permGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 120 },
  permIconWrap: { marginBottom: 18 },
  permIconBg:   { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  permIconText: { fontSize: 30, fontFamily: T.sansB, color: C.gold },
  permTitle:    { color: C.ink, fontSize: 24, textAlign: "center", marginBottom: 10 },
  permBody:     { color: C.mut, fontSize: 14, fontFamily: T.sans, lineHeight: 21, textAlign: "center", marginBottom: 20 },
  permBullets:  { width: "100%", gap: 10 },
  permBulletRow:{ flexDirection: "row", alignItems: "center", gap: 10 },
  permCheck:    { color: C.teal, fontSize: 13, fontFamily: T.sansB },
  permBulletT:  { color: C.ink, fontSize: 14, fontFamily: T.sansM },

  loadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 10 },
  loadingT:   { color: C.mut, fontSize: 14, fontFamily: T.sans },
  doneRow:    { alignItems: "center", paddingVertical: 14 },
  doneT:      { color: C.teal, fontSize: 15, fontFamily: T.sansB },
  skipLink:   { marginTop: 14, alignItems: "center", padding: 8 },
  skipLinkT:  { color: C.mut, fontSize: 13, fontFamily: T.sansM },

  // Footer
  footer: { paddingHorizontal: 26, paddingBottom: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dots:   { flexDirection: "row", gap: 6 },
  dot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.line },
  dotOn:  { width: 20, backgroundColor: C.gold },
});
