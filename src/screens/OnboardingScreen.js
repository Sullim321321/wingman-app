// OnboardingScreen.js — Editorial v3
// Three story slides (horizontal pager) + sign-up slide + push permission
// Dark espresso background · EB Garamond italic headlines · DM Sans body
// All auth/push logic preserved exactly

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
import { tap } from "../components";
import { requestCode, verifyCode, setToken, signInWithAppleToken, registerPushToken } from "../api";

const { width } = Dimensions.get("window");
const KEY_ONBOARDED = "wingman_onboarded";
const KEY_TOKEN     = "wingman_token";

// ─── Fade-in animation wrapper ────────────────────────────────────────────────

function FadeIn({ delay = 0, children }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
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

// ─── Slide 1: Hero ────────────────────────────────────────────────────────────

function SlideHero() {
  return (
    <View style={s.slide}>
      {/* Mark */}
      <FadeIn delay={0}>
        <View style={s.markWrap}>
          <View style={s.markGlow} />
          <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.mark}>
            <Text style={s.markT}>W</Text>
          </LinearGradient>
        </View>
      </FadeIn>

      {/* Headline */}
      <FadeIn delay={180}>
        <Text style={s.hed}>Fully autonomous.{"\n"}Always in control.</Text>
      </FadeIn>

      {/* Sub */}
      <FadeIn delay={300}>
        <Text style={s.sub}>
          Wingman monitors every flight, catches disruptions before the airline tells you, and handles the rebooking — with your approval or automatically.
        </Text>
      </FadeIn>

      {/* Stats */}
      <FadeIn delay={420}>
        <View style={s.statRow}>
          {[["15 min", "check interval"], ["48 hr", "lookahead"], ["24/7", "monitoring"]].map(([v, l], i) => (
            <View key={l} style={[s.stat, i < 2 && s.statBorder]}>
              <Text style={s.statV}>{v}</Text>
              <Text style={s.statL}>{l}</Text>
            </View>
          ))}
        </View>
      </FadeIn>
    </View>
  );
}

// ─── Slide 2: Watch ───────────────────────────────────────────────────────────

function SlideWatch() {
  return (
    <View style={s.slide}>
      {/* Mock intelligence feed */}
      <FadeIn delay={100}>
        <View style={s.mockCard}>
          {[
            { color: C.coral,  label: "DISRUPTION",  t: "UA 412 cancelled",              s: "Rescue options found · 3 alternatives" },
            { color: C.amber,  label: "DELAY",        t: "Weather risk at DEN — 68%",    s: "Snow band on inbound radar" },
            { color: C.teal,   label: "ON TIME",      t: "AA 1847 — On time",            s: "Boarding in 22 min · Gate C14" },
          ].map((item, i) => (
            <View key={i} style={[s.mockRow, i > 0 && s.mockRowBorder]}>
              <View style={[s.mockDot, { backgroundColor: item.color + "18", borderColor: item.color + "30" }]}>
                <View style={[s.mockDotInner, { backgroundColor: item.color }]} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.mockMetaRow}>
                  <Text style={[s.mockLabel, { color: item.color }]}>{item.label}</Text>
                </View>
                <Text style={s.mockT}>{item.t}</Text>
                <Text style={s.mockS}>{item.s}</Text>
              </View>
            </View>
          ))}
        </View>
      </FadeIn>

      <FadeIn delay={220}>
        <Text style={s.hed}>We watch,{"\n"}so you don't have to.</Text>
      </FadeIn>
      <FadeIn delay={340}>
        <Text style={s.sub}>
          Every flight is checked every 15 minutes — delays, gate changes, cancellations, weather risk. You're alerted before it becomes a crisis.
        </Text>
      </FadeIn>
    </View>
  );
}

// ─── Slide 3: Concierge ───────────────────────────────────────────────────────

function SlideConcierge() {
  return (
    <View style={s.slide}>
      {/* Chat preview */}
      <FadeIn delay={100}>
        <View style={s.chatCard}>
          <View style={s.bubbleLeft}>
            <Text style={s.bubbleT}>My flight to Denver was just cancelled — what do I do?</Text>
          </View>
          <View style={s.bubbleRight}>
            <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bubbleGrad}>
              <Text style={[s.bubbleT, { color: C.inkD }]}>
                UA 412 is cancelled. AA 1847 departs JFK at 4:20 PM with 2 seats in your fare class. Want me to rebook you?
              </Text>
            </LinearGradient>
          </View>
          <View style={s.bubbleLeft}>
            <Text style={s.bubbleT}>Yes please</Text>
          </View>
          <View style={s.bubbleRight}>
            <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bubbleGrad}>
              <Text style={[s.bubbleT, { color: C.inkD }]}>Done. Confirmation sent to your email. ✓</Text>
            </LinearGradient>
          </View>
        </View>
      </FadeIn>

      <FadeIn delay={220}>
        <Text style={s.hed}>One tap.{"\n"}Rebooked.</Text>
      </FadeIn>
      <FadeIn delay={340}>
        <Text style={s.sub}>
          When something goes wrong, Wingman surfaces the best rescue options — ranked by cost, points value, and speed — and executes the moment you approve.
        </Text>
      </FadeIn>
    </View>
  );
}

// ─── Slide 4: Sign Up ─────────────────────────────────────────────────────────

function SlideSignUp({ onDone }) {
  const [email,      setEmail]      = useState("");
  const [code,       setCode]       = useState("");
  const [step,       setStep]       = useState("choose"); // choose | email | code
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
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
      const r = await signInWithAppleToken(credential.identityToken, credential.email, credential.fullName);
      const token = r.token;
      if (!token) throw new Error("No token received.");
      setToken(token);
      await SecureStore.setItemAsync(KEY_TOKEN, token);
      await SecureStore.setItemAsync(KEY_ONBOARDED, "1");
      onDone(token);
    } catch (e) {
      if (e.code !== "ERR_REQUEST_CANCELED") setError("Apple sign-in failed. Try email instead.");
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
      <FadeIn delay={80}>
        <View style={s.signUpCard}>
          {/* Mark */}
          <View style={s.signUpMark}>
            <LinearGradient colors={GRAD.gold} style={s.signUpMarkBg}>
              <Text style={s.signUpMarkT}>{step === "code" ? "✉" : "W"}</Text>
            </LinearGradient>
          </View>

          {/* Title */}
          <Text style={s.signUpHed}>
            {step === "code" ? "Check your email." : "Your Wingman awaits."}
          </Text>
          <Text style={s.signUpSub}>
            {step === "code"
              ? `We sent a 6-digit code to ${email.trim().toLowerCase()}. It expires in 10 minutes.`
              : "Create your account. Your first trip is one paste away."}
          </Text>

          {/* Auth options */}
          {step === "choose" && (
            <View style={s.authOptions}>
              {appleAvail && (
                <Pressable style={s.appleBtn} onPress={() => { tap(); tryApple(); }} disabled={loading}>
                  <Text style={s.appleBtnIcon}></Text>
                  <Text style={s.appleBtnT}>Continue with Apple</Text>
                  {loading && <ActivityIndicator color="#000" size="small" style={{ marginLeft: 8 }} />}
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
              style={s.codeInput}
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
              style={[s.codeInput, { letterSpacing: 8, fontSize: 24, textAlign: "center" }]}
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

          {error ? <Text style={s.errorT}>{error}</Text> : null}
        </View>
      </FadeIn>

      <FadeIn delay={200}>
        <View style={{ width: width - 52, marginTop: 12, gap: 10 }}>
          {loading ? (
            <View style={s.loadingRow}>
              <ActivityIndicator color={C.gold} />
              <Text style={s.loadingT}>{step === "email" ? "Sending code…" : "Verifying…"}</Text>
            </View>
          ) : (
            <>
              {step === "email" && (
                <Pressable style={s.primaryBtn} onPress={sendCode}>
                  <Text style={s.primaryBtnT}>Send sign-in code →</Text>
                </Pressable>
              )}
              {step === "code" && (
                <Pressable style={s.primaryBtn} onPress={verifyAndContinue}>
                  <Text style={s.primaryBtnT}>Verify & start →</Text>
                </Pressable>
              )}
              {step === "code" && (
                <Pressable style={s.backLink} onPress={() => { setStep("email"); setCode(""); setError(""); }}>
                  <Text style={s.backLinkT}>← Use a different email</Text>
                </Pressable>
              )}
              {step === "email" && (
                <Pressable style={s.backLink} onPress={() => { setStep("choose"); setEmail(""); setError(""); }}>
                  <Text style={s.backLinkT}>← Back</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </FadeIn>

      <FadeIn delay={300}>
        <Text style={s.privacyNote}>
          By continuing you agree to our Terms of Service. We never sell your data or read personal emails without your permission.
        </Text>
      </FadeIn>
    </View>
  );
}

// ─── Push Permission Slide ────────────────────────────────────────────────────

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
      <FadeIn delay={0}>
        <View style={s.markWrap}>
          <View style={s.markGlow} />
          <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.mark}>
            <Text style={s.markT}>✦</Text>
          </LinearGradient>
        </View>
      </FadeIn>

      <FadeIn delay={150}>
        <Text style={s.hed}>Stay ahead{"\n"}of every disruption.</Text>
      </FadeIn>
      <FadeIn delay={250}>
        <Text style={s.sub}>
          Wingman sends instant alerts the moment your flight status changes — delays, gate moves, cancellations. Enable notifications to stay ahead.
        </Text>
      </FadeIn>

      <FadeIn delay={350}>
        <View style={s.mockCard}>
          {[
            { color: C.coral, label: "DISRUPTION", t: "Gate change: B22 → B31",      s: "UA 412 · 2h before departure" },
            { color: C.teal,  label: "REBOOKED",   t: "You're rebooked on AA 1847",  s: "Wingman handled it automatically" },
            { color: C.gold,  label: "BRIEFING",   t: "Pre-departure briefing ready", s: "TSA wait, lounge access, Uber ETA" },
          ].map((item, i) => (
            <View key={i} style={[s.mockRow, i > 0 && s.mockRowBorder]}>
              <View style={[s.mockDot, { backgroundColor: item.color + "18", borderColor: item.color + "30" }]}>
                <View style={[s.mockDotInner, { backgroundColor: item.color }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.mockLabel, { color: item.color }]}>{item.label}</Text>
                <Text style={s.mockT}>{item.t}</Text>
                <Text style={s.mockS}>{item.s}</Text>
              </View>
            </View>
          ))}
        </View>
      </FadeIn>

      <FadeIn delay={450}>
        <View style={{ width: width - 52, marginTop: 16, gap: 10 }}>
          {loading ? (
            <View style={s.loadingRow}><ActivityIndicator color={C.gold} /><Text style={s.loadingT}>Enabling…</Text></View>
          ) : (
            <>
              <Pressable style={s.primaryBtn} onPress={requestPush}>
                <Text style={s.primaryBtnT}>Enable notifications →</Text>
              </Pressable>
              <Pressable style={s.backLink} onPress={onDone}>
                <Text style={s.backLinkT}>Skip for now</Text>
              </Pressable>
            </>
          )}
        </View>
      </FadeIn>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OnboardingScreen({ navigation }) {
  const [page,     setPage]     = useState(0);
  const [showPush, setShowPush] = useState(false);
  const ref    = useRef(null);
  const insets = useSafeAreaInsets();
  const TOTAL  = 4;

  const goToPage = (n) => {
    tap();
    ref.current?.scrollTo({ x: n * width, animated: true });
    setPage(n);
  };
  const next       = () => { if (page < TOTAL - 1) goToPage(page + 1); };
  const goSignIn   = () => navigation.navigate("SignIn");
  const isSignUp   = page === TOTAL - 1;

  const handleSignUpDone = () => setShowPush(true);
  const handlePushDone   = () => navigation.replace("ProfileSetup");

  if (showPush) {
    return (
      <SafeAreaView style={s.root}>
        <LinearGradient colors={[C.inkD, "#1A1610", C.inkD]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
            <PushPermissionSlide onDone={handlePushDone} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <LinearGradient colors={[C.inkD, "#1A1610", C.inkD]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

      {/* Top bar */}
      {!isSignUp && (
        <View style={[s.topBar, { paddingTop: insets.top }]}>
          <Pressable style={s.topBtn} onPress={() => { tap(); goToPage(TOTAL - 1); }}>
            <Text style={s.topBtnGold}>Skip intro →</Text>
          </Pressable>
          <Pressable style={s.topBtn} onPress={() => { tap(); goSignIn(); }}>
            <Text style={s.topBtnMut}>Sign in</Text>
          </Pressable>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          scrollEnabled={!isSignUp}
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

      {/* Footer: dots + next */}
      {!isSignUp && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.dots}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <View key={i} style={[s.dot, i === page && s.dotOn]} />
            ))}
          </View>
          <Pressable style={s.nextBtn} onPress={next}>
            <Text style={s.nextBtnT}>Next  →</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Top bar ──
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topBtn:     { padding: 8 },
  topBtnGold: { fontFamily: T.sansM, fontSize: 13, color: C.gold },
  topBtnMut:  { fontFamily: T.sansM, fontSize: 13, color: C.mut },

  // ── Slide container ──
  slide: {
    width,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingTop: 10,
    gap: 0,
  },

  // ── Mark ──
  markWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 110,
    height: 110,
    marginBottom: 28,
  },
  markGlow: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: C.gold + "10",
  },
  mark: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  markT: {
    fontFamily: T.sansB,
    fontSize: 26,
    color: C.inkD,
  },

  // ── Headlines ──
  hed: {
    fontFamily: T.garamondSI,
    fontSize: 38,
    color: C.ink,
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 46,
    marginBottom: 14,
  },
  sub: {
    fontFamily: T.garamond,
    fontSize: 16,
    color: C.mut,
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 28,
    paddingHorizontal: 4,
  },

  // ── Stats ──
  statRow: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    overflow: "hidden",
  },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    gap: 3,
  },
  statBorder: {
    borderRightWidth: 1,
    borderRightColor: C.line,
  },
  statV: {
    fontFamily: T.garamondSI,
    fontSize: 22,
    color: C.gold,
    letterSpacing: -0.3,
  },
  statL: {
    fontFamily: T.sansM,
    fontSize: 9,
    color: C.mut,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  // ── Mock intelligence card ──
  mockCard: {
    width: "100%",
    backgroundColor: "rgba(15,13,10,0.92)",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 24,
  },
  mockRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  mockRowBorder: {
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  mockDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  mockDotInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  mockMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  mockLabel: {
    fontFamily: T.sansB,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  mockT: {
    fontFamily: T.sansM,
    fontSize: 13,
    color: C.ink,
    lineHeight: 18,
  },
  mockS: {
    fontFamily: T.sans,
    fontSize: 11,
    color: C.mut,
    marginTop: 2,
  },

  // ── Chat card ──
  chatCard: {
    width: "100%",
    backgroundColor: "rgba(15,13,10,0.92)",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginBottom: 24,
  },
  bubbleLeft: {
    alignSelf: "flex-start",
    maxWidth: "75%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
  },
  bubbleRight: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    borderRadius: 16,
    borderBottomRightRadius: 4,
    overflow: "hidden",
  },
  bubbleGrad: {
    padding: 12,
  },
  bubbleT: {
    fontFamily: T.sans,
    fontSize: 13,
    color: C.ink,
    lineHeight: 19,
  },

  // ── Sign-up card ──
  signUpCard: {
    width: "100%",
    backgroundColor: "rgba(15,13,10,0.92)",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  signUpMark: {
    marginBottom: 16,
  },
  signUpMarkBg: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  signUpMarkT: {
    fontFamily: T.sansB,
    fontSize: 20,
    color: C.inkD,
  },
  signUpHed: {
    fontFamily: T.garamondSI,
    fontSize: 26,
    color: C.ink,
    textAlign: "center",
    letterSpacing: -0.3,
    lineHeight: 32,
    marginBottom: 8,
  },
  signUpSub: {
    fontFamily: T.garamond,
    fontSize: 14,
    color: C.mut,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },

  // Auth options
  authOptions: {
    width: "100%",
    gap: 10,
  },
  appleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  appleBtnIcon: {
    fontSize: 18,
    color: "#000",
  },
  appleBtnT: {
    fontFamily: T.sansM,
    fontSize: 15,
    color: "#000",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.line,
    opacity: 0.5,
  },
  dividerT: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
  },
  emailBtn: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  emailBtnT: {
    fontFamily: T.sansM,
    fontSize: 14,
    color: C.gold,
  },

  // Code input
  codeInput: {
    width: "100%",
    fontFamily: T.garamondI,
    fontSize: 18,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  errorT: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.coral,
    marginTop: 8,
    textAlign: "center",
  },

  // ── Buttons ──
  primaryBtn: {
    width: "100%",
    backgroundColor: C.gold,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnT: {
    fontFamily: T.sansB,
    fontSize: 15,
    color: C.inkD,
    letterSpacing: 0.3,
  },
  backLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backLinkT: {
    fontFamily: T.sansM,
    fontSize: 13,
    color: C.mut,
  },

  // Loading
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  loadingT: {
    fontFamily: T.sansM,
    fontSize: 13,
    color: C.mut,
  },

  // Privacy note
  privacyNote: {
    fontFamily: T.sans,
    fontSize: 11,
    color: C.mut,
    textAlign: "center",
    lineHeight: 17,
    opacity: 0.6,
    paddingHorizontal: 8,
    marginTop: 12,
  },

  // ── Footer ──
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 16,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.line,
  },
  dotOn: {
    backgroundColor: C.gold,
    width: 16,
    borderRadius: 2.5,
  },
  nextBtn: {
    flex: 1,
    backgroundColor: C.gold,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: "center",
  },
  nextBtnT: {
    fontFamily: T.sansB,
    fontSize: 14,
    color: C.inkD,
    letterSpacing: 0.3,
  },
});
