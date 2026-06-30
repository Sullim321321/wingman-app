// OnboardingScreen — Build 87 polish
// 3 story slides → sign-up (email + Apple) → push permission prompt
// Premium, editorial feel — luxury travel intelligence positioning
import React, { useRef, useState, useEffect } from "react";
import {
  SafeAreaView, View, Text, ScrollView, Dimensions,
  StyleSheet, Pressable, ActivityIndicator, Animated, Easing, TextInput,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { C, T, GRAD } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SerifText, Btn, tap } from "../components";
import { requestCode, verifyCode, setToken, signInWithAppleToken, registerPushToken } from "../api";

function SafeBlur({ style, children }) {
  return <View style={[style, { backgroundColor: "rgba(15,13,10,0.92)" }]}>{children}</View>;
}
const { width } = Dimensions.get("window");
const KEY_ONBOARDED = "wingman_onboarded";
const KEY_TOKEN     = "wingman_token";

function SlideIn({ delay = 0, children }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>{children}</Animated.View>;
}

// ── Slide 1: Hero ──────────────────────────────────────────────────────────
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

// ── Slide 2: Watch ─────────────────────────────────────────────────────────
function SlideWatch() {
  return (
    <View style={s.slide}>
      <SlideIn delay={100}>
        <SafeBlur style={s.featureCard}>
          {[
            { color: C.coral,  label: "DELAYED",  t: "UA 412 — 45 min delay",        s: "Gate B22 → B31 · New dep 3:15 PM" },
            { color: C.gold,   label: "RISK",      t: "Weather risk at DEN — 68%",    s: "Snow band on inbound radar" },
            { color: C.teal,   label: "ON TIME",   t: "AA 1847 — On time",            s: "Boarding in 22 min · Gate C14" },
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

// ── Slide 3: Concierge ─────────────────────────────────────────────────────
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

// ── Slide 4: Sign Up ───────────────────────────────────────────────────────
function SlideSignUp({ onDone }) {
  const [email, setEmail]       = useState("");
  const [code, setCode]         = useState("");
  const [step, setStep]         = useState("choose"); // choose | email | code
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [appleAvail, setAppleAvail] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvail).catch(() => {});
  }, []);

  const tryApple = async () => {
    setError(""); setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const r = await signInWithAppleToken(
        credential.identityToken,
        credential.email,
        credential.fullName,
      );
      const token = r.token;
      if (!token) throw new Error("No token received.");
      setToken(token);
      await SecureStore.setItemAsync(KEY_TOKEN, token);
      await SecureStore.setItemAsync(KEY_ONBOARDED, "1");
      onDone(token);
    } catch (e) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        setError("Apple sign-in failed. Try email instead.");
      }
    } finally { setLoading(false); }
  };

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
              <Text style={[s.permIconText, { color: "#0F0D0A" }]}>
                {step === "code" ? "✉" : "✦"}
              </Text>
            </LinearGradient>
          </View>
          <SerifText bold style={s.permTitle}>
            {step === "code" ? "Check your email." : "Get started."}
          </SerifText>
          <Text style={s.permBody}>
            {step === "code"
              ? `We sent a 6-digit code to ${email.trim().toLowerCase()}. It expires in 10 minutes.`
              : "Create your account to start tracking flights."}
          </Text>

          {/* Choose method */}
          {step === "choose" && (
            <View style={s.authOptions}>
              {appleAvail && (
                <Pressable style={s.appleBtn} onPress={() => { tap(); tryApple(); }} disabled={loading}>
                  <Text style={s.appleBtnIcon}></Text>
                  <Text style={s.appleBtnT}>Continue with Apple</Text>
                  {loading ? <ActivityIndicator color="#000" size="small" style={{ marginLeft: 8 }} /> : null}
                </Pressable>
              )}
              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerT}>or</Text>
                <View style={s.dividerLine} />
              </View>
              <Pressable style={s.emailBtn} onPress={() => { tap(); setStep("email"); }}>
                <Text style={s.emailBtnT}>Continue with email →</Text>
              </Pressable>
            </View>
          )}

          {/* Email input */}
          {step === "email" && (
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
              autoFocus
            />
          )}

          {/* Code input */}
          {step === "code" && (
            <TextInput
              style={[s.signUpInput, { letterSpacing: 6, fontSize: 22, textAlign: "center" }]}
              value={code}
              onChangeText={t => { setCode(t.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              placeholder="000000"
              placeholderTextColor={C.mut}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={verifyAndContinue}
              autoFocus
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
              {step === "email" && <Btn title="Send sign-in code →" onPress={sendCode} />}
              {step === "code" && <Btn title="Verify & start →" onPress={verifyAndContinue} />}
              {step === "code" && (
                <Pressable style={s.skipLink} onPress={() => { setStep("email"); setCode(""); setError(""); }}>
                  <Text style={s.skipLinkT}>← Use a different email</Text>
                </Pressable>
              )}
              {step === "email" && (
                <Pressable style={s.skipLink} onPress={() => { setStep("choose"); setEmail(""); setError(""); }}>
                  <Text style={s.skipLinkT}>← Back</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </SlideIn>

      <SlideIn delay={300}>
        <Text style={s.privacyNote}>
          By continuing you agree to our Terms of Service. We never sell your data or read personal emails without your permission.
        </Text>
      </SlideIn>
    </View>
  );
}

// ── Push Permission Prompt ─────────────────────────────────────────────────
function PushPermissionSlide({ onDone }) {
  const [loading, setLoading] = useState(false);

  const requestPush = async () => {
    setLoading(true);
    try {
      if (Device.isDevice) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === "granted") {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          try { await registerPushToken(tokenData.data); } catch (_) {}
        }
      }
    } catch (_) {}
    setLoading(false);
    onDone();
  };

  return (
    <View style={s.slide}>
      <SlideIn delay={0}>
        <View style={s.pushIconWrap}>
          <View style={s.pushGlow} />
          <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.pushMark}>
            <Text style={s.pushMarkIcon}>🔔</Text>
          </LinearGradient>
        </View>
      </SlideIn>
      <SlideIn delay={150}>
        <SerifText bold style={s.heroH}>Never miss{"\n"}a disruption.</SerifText>
      </SlideIn>
      <SlideIn delay={250}>
        <Text style={s.heroSub}>
          Wingman sends instant alerts the moment your flight status changes — delays, gate moves, cancellations. Enable notifications to stay ahead.
        </Text>
      </SlideIn>
      <SlideIn delay={350}>
        <SafeBlur style={s.pushPreviewCard}>
          {[
            { icon: "⚠", color: C.coral,  t: "Gate change: B22 → B31",     s: "UA 412 · 2h before departure" },
            { icon: "✓", color: C.teal,   t: "You're rebooked on AA 1847",  s: "Wingman handled it automatically" },
            { icon: "✦", color: C.gold,   t: "Pre-departure briefing ready", s: "TSA wait, lounge access, Uber ETA" },
          ].map((item, i) => (
            <View key={i} style={[s.pushRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
              <View style={[s.pushIconBadge, { backgroundColor: item.color + "20" }]}>
                <Text style={{ color: item.color, fontSize: 14 }}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.pushRowT}>{item.t}</Text>
                <Text style={s.pushRowS}>{item.s}</Text>
              </View>
            </View>
          ))}
        </SafeBlur>
      </SlideIn>
      <SlideIn delay={450}>
        <View style={{ width: width - 52, marginTop: 16, gap: 10 }}>
          {loading ? (
            <View style={s.loadingRow}><ActivityIndicator color={C.gold} /><Text style={s.loadingT}>Enabling…</Text></View>
          ) : (
            <>
              <Btn title="Enable notifications →" onPress={requestPush} />
              <Pressable style={s.skipLink} onPress={onDone}>
                <Text style={s.skipLinkT}>Skip for now</Text>
              </Pressable>
            </>
          )}
        </View>
      </SlideIn>
    </View>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const [page, setPage]             = useState(0);
  const [showPush, setShowPush]     = useState(false);
  const ref = useRef(null);
  const TOTAL = 4;

  const goToPage = (n) => {
    tap();
    ref.current?.scrollTo({ x: n * width, animated: true });
    setPage(n);
  };
  const next = () => { if (page < TOTAL - 1) goToPage(page + 1); };
  const insets = useSafeAreaInsets();
  const goSignIn = () => navigation.navigate("SignIn");
  const isSignUpSlide = page === TOTAL - 1;

  const handleSignUpDone = () => {
    // Show push permission prompt before going to ProfileSetup
    setShowPush(true);
  };

  const handlePushDone = () => {
    navigation.replace("ProfileSetup");
  };

  if (showPush) {
    return (
      <SafeAreaView style={s.app}>
        <LinearGradient colors={["#0F0D0A", "#1A1610", "#0F0D0A"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
            <PushPermissionSlide onDone={handlePushDone} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <LinearGradient colors={["#0F0D0A", "#1A1610", "#0F0D0A"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      {!isSignUpSlide && (
        <View style={[s.topBar, { paddingTop: insets.top }]}>
          <Pressable style={s.skipIntroBtn} onPress={() => { tap(); goToPage(TOTAL - 1); }}>
            <Text style={s.skipIntroBtnT}>Skip intro →</Text>
          </Pressable>
          <Pressable style={s.skipBtn} onPress={() => { tap(); goSignIn(); }}>
            <Text style={s.skipBtnT}>Sign in</Text>
          </Pressable>
        </View>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          scrollEnabled={!isSignUpSlide}
          onMomentumScrollEnd={e => {
            const newPage = Math.round(e.nativeEvent.contentOffset.x / width);
            if (newPage !== page) setPage(newPage);
          }}
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
  topBar:       { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20 },
  skipIntroBtn:  { padding: 8 },
  skipIntroBtnT: { color: C.gold, fontSize: 14, fontFamily: T.sansM },
  skipBtn:       { padding: 8 },
  skipBtnT:      { color: C.mut, fontSize: 14, fontFamily: T.sansM },
  slide: { width, alignItems: "center", justifyContent: "center", paddingHorizontal: 26, paddingTop: 10 },
  heroGlow: { position: "absolute", top: -60, alignSelf: "center", width: 280, height: 280, borderRadius: 140, backgroundColor: C.gold + "10" },
  heroMarkWrap: { width: 210, height: 210, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  ring: { position: "absolute", borderWidth: 1.5, borderColor: C.gold },
  heroMark: { width: 88, height: 88, borderRadius: 26, alignItems: "center", justifyContent: "center", shadowColor: C.gold, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.6, shadowRadius: 32 },
  heroMarkIcon: { color: "#000000", fontSize: 36, fontFamily: T.sansB },
  heroH:  { color: C.ink, fontSize: 36, textAlign: "center", marginBottom: 14, lineHeight: 44, letterSpacing: -0.5 },
  heroSub:{ color: C.mut, fontSize: 16, fontFamily: T.sans, textAlign: "center", lineHeight: 24, marginBottom: 28 },
  statRow:{ flexDirection: "row", borderWidth: 1, borderColor: C.line, borderRadius: 12, overflow: "hidden", width: "100%", backgroundColor: C.card },
  stat:   { flex: 1, alignItems: "center", paddingVertical: 18 },
  statV:  { color: C.ink, fontSize: 22, fontFamily: T.sansB },
  statL:  { color: C.mut, fontSize: 10, fontFamily: T.sans, marginTop: 3, letterSpacing: 1.5 },
  slideH:  { color: C.ink, fontSize: 30, textAlign: "center", marginBottom: 12, lineHeight: 38, marginTop: 20, letterSpacing: -0.4 },
  slideSub:{ color: C.mut, fontSize: 15, fontFamily: T.sans, textAlign: "center", lineHeight: 23 },
  featureCard: { width: "100%", borderRadius: 22, borderWidth: 1, borderColor: C.line, overflow: "hidden", borderTopColor: "#FFFFFF0A", borderBottomColor: "#00000050" },
  mockRow:   { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  mockBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center", justifyContent: "center" },
  mockBadgeT:{ fontSize: 9, fontFamily: T.sansB, letterSpacing: 0.8 },
  mockT:     { color: C.ink, fontSize: 13, fontFamily: T.sansM },
  mockS:     { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2 },
  chatCard: { width: "100%", borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10, borderTopColor: "#FFFFFF0A", borderBottomColor: "#00000050", overflow: "hidden" },
  bubbleLeft:  { alignSelf: "flex-start", backgroundColor: C.card2, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10, maxWidth: "80%" },
  bubbleRight: { alignSelf: "flex-end", maxWidth: "80%" },
  bubbleGrad:  { borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText:  { fontSize: 13, fontFamily: T.sans, lineHeight: 19, color: C.ink },
  // Sign-up slide — deck exact
  signUpCard: { width: "100%", borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: "hidden", padding: 24, backgroundColor: C.card },
  permGlow:   { position: "absolute", top: 0, left: 0, right: 0, height: 100 },
  permIconWrap: { alignItems: "center", marginBottom: 20 },
  permIconBg: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  permIconText: { fontSize: 28, fontFamily: T.sansB },
  permTitle:  { color: C.ink, fontSize: 26, marginBottom: 10, textAlign: "center", letterSpacing: -0.4 },
  permBody:   { color: C.mut, fontSize: 14, fontFamily: T.sans, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  authOptions:{ gap: 14, width: "100%" },
  appleBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 16, gap: 8 },
  appleBtnIcon: { fontSize: 18, color: "#000" },
  appleBtnT:  { color: "#000", fontSize: 16, fontFamily: T.sansB },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine:{ flex: 1, height: 1, backgroundColor: C.line },
  dividerT:   { color: C.mut, fontSize: 12, fontFamily: T.sans },
  emailBtn:   { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  emailBtnT:  { color: C.ink, fontSize: 15, fontFamily: T.sansM },
  signUpInput:{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.line, color: C.ink, fontSize: 16, fontFamily: T.sans, width: "100%" },
  signUpError:{ color: C.coral, fontSize: 13, fontFamily: T.sansM, marginTop: 8, textAlign: "center" },
  loadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14 },
  loadingT:   { color: C.mut, fontSize: 14, fontFamily: T.sans },
  skipLink:   { alignItems: "center", padding: 10 },
  skipLinkT:  { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  privacyNote:{ color: C.mut, fontSize: 11, fontFamily: T.sans, textAlign: "center", lineHeight: 17, marginTop: 8, paddingHorizontal: 10 },
  // Push permission slide
  pushIconWrap: { width: 160, height: 160, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  pushGlow:     { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.gold + "10" },
  pushMark:     { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", shadowColor: C.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 18 },
  pushMarkIcon: { fontSize: 32 },
  pushPreviewCard: { width: "100%", borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: "hidden", marginTop: 8 },
  pushRow:    { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  pushIconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pushRowT:   { color: C.ink, fontSize: 13, fontFamily: T.sansM },
  pushRowS:   { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2 },
  // Footer
  footer: { paddingHorizontal: 26, paddingBottom: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dots:   { flexDirection: "row", gap: 6 },
  dot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.line },
  dotOn:  { backgroundColor: C.gold, width: 18 },
});
