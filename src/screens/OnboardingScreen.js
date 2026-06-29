// OnboardingScreen — Streamlined: 3 story slides → email sign-up
// Push notifications and Gmail are asked in-context (first trip added, first alert)
// Reduces time-to-value from ~5 taps to 2 taps
import React, { useRef, useState } from "react";
import {
  SafeAreaView, View, Text, ScrollView, Dimensions,
  StyleSheet, Pressable, ActivityIndicator, Animated, Easing, TextInput,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import { C, T, GRAD } from "../theme";
import { SerifText, Btn, tap } from "../components";
import { requestCode, verifyCode, setToken } from "../api";

function SafeBlur({ style, children }) {
  return <View style={[style, { backgroundColor: "rgba(15,13,10,0.92)" }]}>{children}</View>;
}
const { width } = Dimensions.get("window");
const KEY_ONBOARDED = "wingman_onboarded";
const KEY_TOKEN     = "wingman_token";

function SlideIn({ delay = 0, children }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>{children}</Animated.View>;
}

function SlideHero() {
  const SIZES = [210, 170, 130, 90];
  return (
    <View style={s.slide}>
      <SlideIn delay={0}>
        <View style={s.heroMarkWrap}>
          <View style={s.heroGlow} />
          {SIZES.map((sz, i) => (
            <View key={sz} style={[s.ring, { width: sz, height: sz, borderRadius: sz / 2, opacity: 0.06 + i * 0.04 }]} />
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

function SlideWatch() {
  return (
    <View style={s.slide}>
      <SlideIn delay={100}>
        <SafeBlur style={s.featureCard}>
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

function SlideConcierge() {
  return (
    <View style={s.slide}>
      <SlideIn delay={100}>
        <SafeBlur style={s.chatCard}>
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

function SlideSignUp({ onDone }) {
  const [email, setEmail]     = useState("");
  const [code, setCode]       = useState("");
  const [step, setStep]       = useState("email");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) { setError("Enter a valid email address."); return; }
    setLoading(true); setError("");
    try {
      await requestCode(trimmed);
      setStep("code");
    } catch (e) {
      setError(e.message || "Couldn't send code. Try again.");
    } finally { setLoading(false); }
  };

  const verifyAndContinue = async () => {
    const trimmed = code.trim();
    if (!trimmed || trimmed.length < 4) { setError("Enter the 6-digit code from your email."); return; }
    setLoading(true); setError("");
    try {
      const data = await verifyCode(email.trim().toLowerCase(), trimmed);
      const token = data.token || data.access_token;
      if (!token) throw new Error("No token received.");
      setToken(token);
      await SecureStore.setItemAsync(KEY_TOKEN, token);
      await SecureStore.setItemAsync(KEY_ONBOARDED, "1");
      onDone(token);
    } catch (e) {
      setError(e.message || "Invalid code. Check your email and try again.");
    } finally { setLoading(false); }
  };

  return (
    <View style={s.slide}>
      <SlideIn delay={100}>
        <View style={s.signUpCard}>
          <LinearGradient colors={[C.gold + "14", "transparent"]} style={s.permGlow} />
          <View style={s.permIconWrap}>
            <LinearGradient colors={GRAD.gold} style={s.permIconBg}>
              <Text style={[s.permIconText, { color: "#0F0D0A" }]}>{step === "email" ? "✦" : "✉"}</Text>
            </LinearGradient>
          </View>
          <SerifText bold style={s.permTitle}>
            {step === "email" ? "Get started." : "Check your email."}
          </SerifText>
          <Text style={s.permBody}>
            {step === "email"
              ? "Enter your email and we'll send a one-time sign-in code. No password needed."
              : `We sent a 6-digit code to ${email.trim().toLowerCase()}. It expires in 10 minutes.`}
          </Text>
          {step === "email" ? (
            <TextInput
              style={s.signUpInput}
              value={email}
              onChangeText={t => { setEmail(t); setError(""); }}
              placeholder="your@email.com"
              placeholderTextColor={C.mut}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="done"
              onSubmitEditing={sendCode}
            />
          ) : (
            <TextInput
              style={[s.signUpInput, { letterSpacing: 6, fontSize: 22, textAlign: "center" }]}
              value={code}
              onChangeText={t => { setCode(t.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              placeholder="000000"
              placeholderTextColor={C.mut}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={verifyAndContinue}
            />
          )}
          {error ? <Text style={s.signUpError}>{error}</Text> : null}
        </View>
      </SlideIn>
      <SlideIn delay={200}>
        <View style={{ width: width - 52, marginTop: 10 }}>
          {loading ? (
            <View style={s.loadingRow}>
              <ActivityIndicator color={C.gold} />
              <Text style={s.loadingT}>{step === "email" ? "Sending code…" : "Verifying…"}</Text>
            </View>
          ) : (
            <>
              <Btn
                title={step === "email" ? "Send sign-in code →" : "Verify & start →"}
                onPress={step === "email" ? sendCode : verifyAndContinue}
              />
              {step === "code" && (
                <Pressable style={s.skipLink} onPress={() => { setStep("email"); setCode(""); setError(""); }}>
                  <Text style={s.skipLinkT}>← Use a different email</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </SlideIn>
      <SlideIn delay={300}>
        <Text style={s.privacyNote}>
          By continuing you agree to our Terms of Service. We never sell your data or read personal emails.
        </Text>
      </SlideIn>
    </View>
  );
}

export default function OnboardingScreen({ navigation }) {
  const [page, setPage] = useState(0);
  const ref = useRef(null);
  const TOTAL = 4;

  // Update page state immediately — don't rely on onMomentumScrollEnd which
  // never fires for programmatic scrolls when scrollEnabled={false}
  const goToPage = (n) => {
    tap();
    ref.current?.scrollTo({ x: n * width, animated: true });
    setPage(n);
  };
  const next = () => { if (page < TOTAL - 1) goToPage(page + 1); };
  const goSignIn = () => navigation.navigate("SignIn");
  const isSignUpSlide = page === TOTAL - 1;

  const handleSignUpDone = () => {
    navigation.replace("ProfileSetup");
  };

  return (
    <SafeAreaView style={s.app}>
      <LinearGradient colors={["#0F0D0A", "#1A1610", "#0F0D0A"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      {!isSignUpSlide && (
        <Pressable style={s.skipBtn} onPress={() => { tap(); goSignIn(); }}>
          <Text style={s.skipBtnT}>Sign in</Text>
        </Pressable>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <SlideHero />
        <SlideWatch />
        <SlideConcierge />
        <SlideSignUp onDone={handleSignUpDone} />
      </ScrollView>
      </KeyboardAvoidingView>
      {!isSignUpSlide && (
        <View style={s.footer}>
          <View style={s.dots}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <View key={i} style={[s.dot, i === page && s.dotOn]} />
            ))}
          </View>
          <Btn title="Next" onPress={next} style={{ width: 140 }} />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  skipBtn:  { position: "absolute", top: 54, right: 20, zIndex: 10, padding: 8 },
  skipBtnT: { color: C.mut, fontSize: 14, fontFamily: T.sansM },
  slide: { width, alignItems: "center", justifyContent: "center", paddingHorizontal: 26, paddingTop: 10 },
  heroGlow: { position: "absolute", top: -60, alignSelf: "center", width: 280, height: 280, borderRadius: 140, backgroundColor: C.gold + "10" },
  heroMarkWrap: { width: 210, height: 210, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  ring: { position: "absolute", borderWidth: 1.5, borderColor: C.gold },
  heroMark: { width: 88, height: 88, borderRadius: 26, alignItems: "center", justifyContent: "center", shadowColor: C.gold, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24 },
  heroMarkIcon: { color: "#0F0D0A", fontSize: 32, fontFamily: T.sansB },
  heroH:  { color: C.ink, fontSize: 32, textAlign: "center", marginBottom: 12, lineHeight: 40 },
  heroSub:{ color: C.mut, fontSize: 15, fontFamily: T.sans, textAlign: "center", lineHeight: 23, marginBottom: 24 },
  statRow:{ flexDirection: "row", borderWidth: 1, borderColor: C.line, borderRadius: 18, overflow: "hidden", width: "100%", backgroundColor: C.card },
  stat:   { flex: 1, alignItems: "center", paddingVertical: 16 },
  statV:  { color: C.ink, fontSize: 20 },
  statL:  { color: C.mut, fontSize: 10, fontFamily: T.sans, marginTop: 2, letterSpacing: 0.3 },
  slideH:  { color: C.ink, fontSize: 28, textAlign: "center", marginBottom: 10, lineHeight: 36, marginTop: 20 },
  slideSub:{ color: C.mut, fontSize: 14, fontFamily: T.sans, textAlign: "center", lineHeight: 22 },
  featureCard: { width: "100%", borderRadius: 22, borderWidth: 1, borderColor: C.line, overflow: "hidden", borderTopColor: "#FFFFFF0A", borderBottomColor: "#00000050" },
  mockRow:   { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  mockBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center", justifyContent: "center" },
  mockBadgeT:{ fontSize: 9, fontFamily: T.sansB, letterSpacing: 0.8 },
  mockT:     { color: C.ink, fontSize: 13, fontFamily: T.sansM },
  mockS:     { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2 },
  chatCard: { width: "100%", borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10, borderTopColor: "#FFFFFF0A", borderBottomColor: "#00000050", overflow: "hidden" },
  bubbleLeft:  { alignSelf: "flex-start", backgroundColor: C.card2, borderRadius: 16, borderBottomLeftRadius: 4, padding: 12, maxWidth: "82%" },
  bubbleRight: { alignSelf: "flex-end", borderRadius: 16, borderBottomRightRadius: 4, maxWidth: "85%", overflow: "hidden" },
  bubbleGrad:  { padding: 12 },
  bubbleText:  { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 19 },
  signUpCard: { width: "100%", borderRadius: 24, padding: 24, alignItems: "center", borderWidth: 1, borderColor: C.line, borderTopColor: "#FFFFFF0A", borderBottomColor: "#00000050", overflow: "hidden", backgroundColor: "rgba(15,13,10,0.92)" },
  permGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 120 },
  permIconWrap: { marginBottom: 18 },
  permIconBg:   { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  permIconText: { fontSize: 30, fontFamily: T.sansB, color: C.gold },
  permTitle:    { color: C.ink, fontSize: 24, textAlign: "center", marginBottom: 10 },
  permBody:     { color: C.mut, fontSize: 14, fontFamily: T.sans, lineHeight: 21, textAlign: "center", marginBottom: 20 },
  signUpInput: { width: "100%", backgroundColor: C.bg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, color: C.ink, fontSize: 16, fontFamily: T.sans },
  signUpError: { color: C.coral, fontSize: 13, fontFamily: T.sansM, marginTop: 10, textAlign: "center" },
  privacyNote: { color: C.mut, fontSize: 11, fontFamily: T.sans, textAlign: "center", lineHeight: 16, marginTop: 16, paddingHorizontal: 10 },
  loadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 10 },
  loadingT:   { color: C.mut, fontSize: 14, fontFamily: T.sans },
  skipLink:   { marginTop: 14, alignItems: "center", padding: 8 },
  skipLinkT:  { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  footer: { paddingHorizontal: 26, paddingBottom: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dots:   { flexDirection: "row", gap: 6 },
  dot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.line },
  dotOn:  { width: 20, backgroundColor: C.gold },
});
