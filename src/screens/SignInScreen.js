// SignInScreen — multi-method auth
// Methods: Sign in with Apple (primary), Face ID/Touch ID (returning users),
//          SMS OTP, Email OTP (fallback)
import React, { useState, useRef, useEffect } from "react";
import {
  SafeAreaView, KeyboardAvoidingView, View, Text, TextInput,
  Platform, StyleSheet, Animated, Easing, Pressable, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as LocalAuthentication from "expo-local-authentication";
import * as AppleAuthentication from "expo-apple-authentication";
import * as SecureStore from "expo-secure-store";
import { C, T, GRAD } from "../theme";
import { SerifText, Btn, tap } from "../components";
import { requestCode, verifyCode, signInWithAppleToken, requestSmsCode, verifySmsCode } from "../api";
import { useAuth } from "../auth";

const KEY_T = "wingman_token";
const KEY_E = "wingman_email";

function SafeBlur({ style, children }) {
  return <View style={[style, { backgroundColor: "rgba(15,13,10,0.92)" }]}>{children}</View>;
}

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [method, setMethod]   = useState("choose"); // choose | email | sms
  const [stage, setStage]     = useState("input");  // input | code
  const [email, setEmail]     = useState("");
  const [phone, setPhone]     = useState("");
  const [code, setCode]       = useState("");
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState("");
  const [biometricAvail, setBiometricAvail] = useState(false);
  const [appleAvail, setAppleAvail]         = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // Check biometric availability — only useful for returning users who have a stored token
    (async () => {
      try {
        const has = await LocalAuthentication.hasHardwareAsync();
        if (has) {
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          if (enrolled) {
            const t = await SecureStore.getItemAsync(KEY_T);
            if (t) setBiometricAvail(true); // only show if there's a stored session
          }
        }
      } catch (_) {}
    })();

    // Check Sign in with Apple availability (iOS 13+)
    AppleAuthentication.isAvailableAsync().then(setAppleAvail).catch(() => {});
  }, []);

  // ── Biometric unlock ────────────────────────────────────────────────────────
  const tryBiometric = async () => {
    setBusy(true); setErr("");
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Wingman",
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
      });
      if (!result.success) { setBusy(false); return; }
      const t = await SecureStore.getItemAsync(KEY_T);
      const e = await SecureStore.getItemAsync(KEY_E);
      if (!t) { setErr("No saved session found. Please sign in again."); setBusy(false); return; }
      await signIn(t, e);
    } catch (_) {
      setErr("Biometric authentication failed.");
    } finally { setBusy(false); }
  };

  // ── Sign in with Apple ──────────────────────────────────────────────────────
  const tryApple = async () => {
    setBusy(true); setErr("");
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
      await signIn(r.token, r.email);
    } catch (e) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        setErr("Apple sign-in failed. Try another method.");
      }
    } finally { setBusy(false); }
  };

  // ── Email OTP ───────────────────────────────────────────────────────────────
  const sendEmailCode = async () => {
    setErr(""); setBusy(true);
    try {
      await requestCode(email.trim());
      setStage("code");
    } catch (_) {
      setErr("Couldn't send code. Check your connection.");
    } finally { setBusy(false); }
  };

  const verifyEmailCode = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await verifyCode(email.trim(), code.trim());
      await signIn(r.token, r.email);
    } catch (_) {
      setErr("That code didn't work. Try again.");
    } finally { setBusy(false); }
  };

  // ── SMS OTP ─────────────────────────────────────────────────────────────────
  const sendSmsCode = async () => {
    setErr(""); setBusy(true);
    try {
      await requestSmsCode(phone.trim());
      setStage("code");
    } catch (_) {
      setErr("Couldn't send SMS. Check your number.");
    } finally { setBusy(false); }
  };

  const verifySmsCodeFn = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await verifySmsCode(phone.trim(), code.trim());
      await signIn(r.token, r.email);
    } catch (_) {
      setErr("That code didn't work. Try again.");
    } finally { setBusy(false); }
  };

  const reset = () => { setMethod("choose"); setStage("input"); setCode(""); setErr(""); };

  return (
    <SafeAreaView style={s.app}>
      <LinearGradient colors={["#0F0D0A", "#1A1610", "#0F0D0A"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.glowTop} />
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          <View style={s.markWrap}>
            <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.markGrad}>
              <Text style={s.markIcon}>✦</Text>
            </LinearGradient>
          </View>

          <SerifText bold style={s.h}>Welcome back.</SerifText>
          <Text style={s.sub}>Sign in to your Wingman account.</Text>

          {err ? <Text style={s.err}>{err}</Text> : null}

          {/* ── Method chooser ── */}
          {method === "choose" && (
            <SafeBlur style={s.card}>
              {biometricAvail && (
                <Pressable style={s.authRow} onPress={() => { tap(); tryBiometric(); }} disabled={busy}>
                  <View style={[s.authIcon, { backgroundColor: C.card2 }]}>
                    <Text style={s.authIconText}>🔒</Text>
                  </View>
                  <View style={s.authInfo}>
                    <Text style={s.authTitle}>Face ID / Touch ID</Text>
                    <Text style={s.authSub}>Unlock with biometrics</Text>
                  </View>
                  {busy ? <ActivityIndicator color={C.gold} size="small" /> : <Text style={s.authChev}>›</Text>}
                </Pressable>
              )}

              {appleAvail && (
                <Pressable style={[s.authRow, biometricAvail && s.authRowBorder]} onPress={() => { tap(); tryApple(); }} disabled={busy}>
                  <View style={[s.authIcon, { backgroundColor: "#fff" }]}>
                    <Text style={[s.authIconText, { color: "#000" }]}></Text>
                  </View>
                  <View style={s.authInfo}>
                    <Text style={s.authTitle}>Sign in with Apple</Text>
                    <Text style={s.authSub}>Use your Apple ID</Text>
                  </View>
                  {busy ? <ActivityIndicator color={C.gold} size="small" /> : <Text style={s.authChev}>›</Text>}
                </Pressable>
              )}

              <Pressable style={[s.authRow, (biometricAvail || appleAvail) && s.authRowBorder]} onPress={() => { tap(); setMethod("sms"); }}>
                <View style={[s.authIcon, { backgroundColor: "#1A8C7A22" }]}>
                  <Text style={s.authIconText}>💬</Text>
                </View>
                <View style={s.authInfo}>
                  <Text style={s.authTitle}>Text message</Text>
                  <Text style={s.authSub}>One-time code via SMS</Text>
                </View>
                <Text style={s.authChev}>›</Text>
              </Pressable>

              <Pressable style={[s.authRow, s.authRowBorder]} onPress={() => { tap(); setMethod("email"); }}>
                <View style={[s.authIcon, { backgroundColor: C.gold + "22" }]}>
                  <Text style={s.authIconText}>✉</Text>
                </View>
                <View style={s.authInfo}>
                  <Text style={s.authTitle}>Email code</Text>
                  <Text style={s.authSub}>One-time code to your inbox</Text>
                </View>
                <Text style={s.authChev}>›</Text>
              </Pressable>
            </SafeBlur>
          )}

          {/* ── Email OTP flow ── */}
          {method === "email" && (
            <SafeBlur style={s.card}>
              <Text style={s.cardTitle}>{stage === "input" ? "Enter your email" : "Check your inbox"}</Text>
              <Text style={s.cardSub}>
                {stage === "input"
                  ? "We'll send a one-time sign-in code."
                  : `Code sent to ${email.trim()}. Expires in 10 minutes.`}
              </Text>
              <View style={s.inputWrap}>
                {stage === "input" ? (
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={t => { setEmail(t); setErr(""); }}
                    placeholder="your@email.com"
                    placeholderTextColor={C.mut}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    returnKeyType="done"
                    onSubmitEditing={sendEmailCode}
                  />
                ) : (
                  <TextInput
                    style={[s.input, s.codeInput]}
                    value={code}
                    onChangeText={t => { setCode(t.replace(/\D/g, "").slice(0, 6)); setErr(""); }}
                    placeholder="000000"
                    placeholderTextColor={C.mut}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    onSubmitEditing={verifyEmailCode}
                    autoFocus
                  />
                )}
              </View>
              <View style={s.btnGroup}>
                {busy ? (
                  <ActivityIndicator color={C.gold} style={{ marginVertical: 8 }} />
                ) : (
                  <Btn
                    title={stage === "input" ? "Send code →" : "Verify & sign in →"}
                    onPress={stage === "input" ? sendEmailCode : verifyEmailCode}
                    style={{ marginHorizontal: 4 }}
                  />
                )}
                <Pressable style={s.backLink} onPress={reset}>
                  <Text style={s.backLinkT}>← Other sign-in options</Text>
                </Pressable>
              </View>
            </SafeBlur>
          )}

          {/* ── SMS OTP flow ── */}
          {method === "sms" && (
            <SafeBlur style={s.card}>
              <Text style={s.cardTitle}>{stage === "input" ? "Enter your number" : "Check your texts"}</Text>
              <Text style={s.cardSub}>
                {stage === "input"
                  ? "We'll text you a one-time sign-in code."
                  : `Code sent to ${phone.trim()}. Expires in 10 minutes.`}
              </Text>
              <View style={s.inputWrap}>
                {stage === "input" ? (
                  <TextInput
                    style={s.input}
                    value={phone}
                    onChangeText={t => { setPhone(t); setErr(""); }}
                    placeholder="+1 555 000 0000"
                    placeholderTextColor={C.mut}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    returnKeyType="done"
                    onSubmitEditing={sendSmsCode}
                  />
                ) : (
                  <TextInput
                    style={[s.input, s.codeInput]}
                    value={code}
                    onChangeText={t => { setCode(t.replace(/\D/g, "").slice(0, 6)); setErr(""); }}
                    placeholder="000000"
                    placeholderTextColor={C.mut}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    onSubmitEditing={verifySmsCodeFn}
                    autoFocus
                  />
                )}
              </View>
              <View style={s.btnGroup}>
                {busy ? (
                  <ActivityIndicator color={C.gold} style={{ marginVertical: 8 }} />
                ) : (
                  <Btn
                    title={stage === "input" ? "Send code →" : "Verify & sign in →"}
                    onPress={stage === "input" ? sendSmsCode : verifySmsCodeFn}
                    style={{ marginHorizontal: 4 }}
                  />
                )}
                <Pressable style={s.backLink} onPress={reset}>
                  <Text style={s.backLinkT}>← Other sign-in options</Text>
                </Pressable>
              </View>
            </SafeBlur>
          )}

          <Text style={s.privacy}>
            By signing in you agree to our Terms of Service.{"\n"}We never sell your data.
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
      <Text style={s.wordmark}>WINGMAN</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:        { flex: 1, backgroundColor: C.bg },
  glowTop:    { position: "absolute", top: -80, alignSelf: "center", width: 300, height: 300, borderRadius: 150, backgroundColor: C.gold + "08" },
  wrap:       { flex: 1, justifyContent: "center", paddingHorizontal: 26 },
  content:    { alignItems: "center" },
  markWrap:   { marginBottom: 24 },
  markGrad:   { width: 68, height: 68, borderRadius: 21, alignItems: "center", justifyContent: "center", shadowColor: C.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 18 },
  markIcon:   { color: "#0F0D0A", fontSize: 26, fontFamily: T.sansB },
  h:          { color: C.ink, fontSize: 30, marginBottom: 6, letterSpacing: -0.5 },
  sub:        { color: C.mut, fontSize: 14, fontFamily: T.sans, marginBottom: 20, textAlign: "center" },
  err:        { color: C.coral, fontSize: 13, fontFamily: T.sansM, marginBottom: 12, textAlign: "center" },
  card:       { width: "100%", borderRadius: 24, borderWidth: 1, borderColor: C.line, overflow: "hidden", paddingVertical: 4 },
  cardTitle:  { color: C.ink, fontSize: 17, fontFamily: T.sansB, paddingHorizontal: 16, paddingTop: 14, marginBottom: 4 },
  cardSub:    { color: C.mut, fontSize: 13, fontFamily: T.sans, paddingHorizontal: 16, marginBottom: 12, lineHeight: 19 },
  authRow:    { flexDirection: "row", alignItems: "center", padding: 14, gap: 14 },
  authRowBorder: { borderTopWidth: 1, borderTopColor: C.line },
  authIcon:   { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  authIconText: { fontSize: 20 },
  authInfo:   { flex: 1 },
  authTitle:  { color: C.ink, fontSize: 15, fontFamily: T.sansM },
  authSub:    { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 2 },
  authChev:   { color: C.mut, fontSize: 20, fontFamily: T.sansM },
  inputWrap:  { paddingHorizontal: 14, marginBottom: 4 },
  input:      { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, color: C.ink, fontSize: 16, fontFamily: T.sans },
  codeInput:  { letterSpacing: 8, fontSize: 22, textAlign: "center", fontFamily: T.sansB },
  btnGroup:   { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  backLink:   { alignItems: "center", padding: 6 },
  backLinkT:  { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  privacy:    { color: C.mut, fontSize: 11, fontFamily: T.sans, textAlign: "center", lineHeight: 16, marginTop: 20, paddingHorizontal: 10 },
  wordmark:   { position: "absolute", bottom: 32, alignSelf: "center", color: C.mut + "60", fontSize: 10, fontFamily: T.sansB, letterSpacing: 6 },
});
