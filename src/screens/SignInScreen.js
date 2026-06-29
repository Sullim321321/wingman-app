// SignInScreen — multi-method auth — Build 87
// Methods: Face ID / Touch ID, Sign in with Apple, SMS OTP, Email OTP
// Full error states: resend cooldown, expired code, rate limit, wrong number, email fallback
import React, { useState, useRef, useEffect, useCallback } from "react";
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
const RESEND_COOLDOWN = 30; // seconds

function SafeBlur({ style, children }) {
  return <View style={[style, { backgroundColor: "rgba(15,13,10,0.92)" }]}>{children}</View>;
}

function ResendTimer({ seconds, onResend, busy }) {
  if (seconds > 0) {
    return (
      <Text style={s.resendTimer}>
        Resend code in <Text style={{ color: C.gold }}>{seconds}s</Text>
      </Text>
    );
  }
  return (
    <Pressable style={s.resendBtn} onPress={onResend} disabled={busy}>
      <Text style={s.resendBtnT}>Resend code</Text>
    </Pressable>
  );
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
  const [errType, setErrType] = useState(""); // "wrong_code" | "expired" | "rate_limit" | "network" | ""
  const [attempts, setAttempts] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [biometricAvail, setBiometricAvail] = useState(false);
  const [appleAvail, setAppleAvail]         = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const timerRef  = useRef(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    (async () => {
      try {
        const has = await LocalAuthentication.hasHardwareAsync();
        if (has) {
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          if (enrolled) {
            const t = await SecureStore.getItemAsync(KEY_T);
            if (t) setBiometricAvail(true);
          }
        }
      } catch (_) {}
    })();

    AppleAuthentication.isAvailableAsync().then(setAppleAvail).catch(() => {});

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startResendTimer = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Error message mapping ──────────────────────────────────────────────────
  const parseError = (e, context = "") => {
    const msg = (e?.message || "").toLowerCase();
    if (msg.includes("rate") || msg.includes("too many") || msg.includes("429")) {
      setErrType("rate_limit");
      return "Too many attempts. Please wait a few minutes before trying again.";
    }
    if (msg.includes("expired") || msg.includes("invalid") || msg.includes("not found")) {
      if (context === "verify") {
        setErrType("wrong_code");
        return "That code didn't match. Double-check and try again, or request a new one.";
      }
    }
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("connect")) {
      setErrType("network");
      return "Connection error. Check your internet and try again.";
    }
    if (msg.includes("phone") || msg.includes("number") || msg.includes("invalid")) {
      setErrType("wrong_number");
      return "Invalid phone number. Make sure to include your country code (e.g. +1 555 000 0000).";
    }
    setErrType("");
    return e?.message || "Something went wrong. Please try again.";
  };

  // ── Biometric unlock ────────────────────────────────────────────────────────
  const tryBiometric = async () => {
    setBusy(true); setErr(""); setErrType("");
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Wingman",
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
      });
      if (!result.success) { setBusy(false); return; }
      const t = await SecureStore.getItemAsync(KEY_T);
      const e = await SecureStore.getItemAsync(KEY_E);
      if (!t) { setErr("No saved session found. Please sign in again."); setErrType(""); setBusy(false); return; }
      await signIn(t, e);
    } catch (_) {
      setErr("Biometric authentication failed. Try another sign-in method.");
    } finally { setBusy(false); }
  };

  // ── Sign in with Apple ──────────────────────────────────────────────────────
  const tryApple = async () => {
    setBusy(true); setErr(""); setErrType("");
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
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setErr("Enter a valid email address."); setErrType(""); return;
    }
    setErr(""); setErrType(""); setBusy(true);
    try {
      await requestCode(trimmed);
      setStage("code");
      setAttempts(0);
      startResendTimer();
    } catch (e) {
      setErr(parseError(e));
    } finally { setBusy(false); }
  };

  const verifyEmailCode = async () => {
    if (!code.trim() || code.trim().length < 6) {
      setErr("Enter the 6-digit code from your email."); setErrType(""); return;
    }
    setErr(""); setErrType(""); setBusy(true);
    try {
      const r = await verifyCode(email.trim().toLowerCase(), code.trim());
      await signIn(r.token, r.email);
    } catch (e) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setErr(parseError(e, "verify"));
      if (newAttempts >= 3) {
        setErrType("too_many_attempts");
      }
    } finally { setBusy(false); }
  };

  const resendEmailCode = async () => {
    setErr(""); setErrType(""); setCode(""); setBusy(true);
    try {
      await requestCode(email.trim().toLowerCase());
      setAttempts(0);
      startResendTimer();
    } catch (e) {
      setErr(parseError(e));
    } finally { setBusy(false); }
  };

  // ── SMS OTP ─────────────────────────────────────────────────────────────────
  const sendSmsCode = async () => {
    const trimmed = phone.trim();
    if (!trimmed || trimmed.length < 7) {
      setErr("Enter a valid phone number with country code (e.g. +1 555 000 0000)."); setErrType(""); return;
    }
    setErr(""); setErrType(""); setBusy(true);
    try {
      await requestSmsCode(trimmed);
      setStage("code");
      setAttempts(0);
      startResendTimer();
    } catch (e) {
      setErr(parseError(e));
    } finally { setBusy(false); }
  };

  const verifySmsCodeFn = async () => {
    if (!code.trim() || code.trim().length < 6) {
      setErr("Enter the 6-digit code from your text message."); setErrType(""); return;
    }
    setErr(""); setErrType(""); setBusy(true);
    try {
      const r = await verifySmsCode(phone.trim(), code.trim());
      await signIn(r.token, r.email);
    } catch (e) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setErr(parseError(e, "verify"));
      if (newAttempts >= 3) {
        setErrType("too_many_attempts");
      }
    } finally { setBusy(false); }
  };

  const resendSmsCode = async () => {
    setErr(""); setErrType(""); setCode(""); setBusy(true);
    try {
      await requestSmsCode(phone.trim());
      setAttempts(0);
      startResendTimer();
    } catch (e) {
      setErr(parseError(e));
    } finally { setBusy(false); }
  };

  const reset = () => {
    setMethod("choose"); setStage("input"); setCode(""); setErr(""); setErrType("");
    setAttempts(0); setResendCooldown(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const switchToEmail = () => {
    setMethod("email"); setStage("input"); setCode(""); setErr(""); setErrType("");
    setAttempts(0); setResendCooldown(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

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

          {err ? (
            <View style={[s.errBox, errType === "rate_limit" && { borderColor: C.coral + "60" }]}>
              <Text style={s.errText}>{err}</Text>
              {errType === "too_many_attempts" && method === "sms" && (
                <Pressable onPress={switchToEmail} style={s.errAction}>
                  <Text style={s.errActionT}>Try email sign-in instead →</Text>
                </Pressable>
              )}
            </View>
          ) : null}

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
                  : `Code sent to ${email.trim().toLowerCase()}. Expires in 10 minutes.`}
              </Text>
              <View style={s.inputWrap}>
                {stage === "input" ? (
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={t => { setEmail(t); setErr(""); setErrType(""); }}
                    placeholder="your@email.com"
                    placeholderTextColor={C.mut}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    returnKeyType="done"
                    onSubmitEditing={sendEmailCode}
                    autoFocus
                  />
                ) : (
                  <TextInput
                    style={[s.input, s.codeInput]}
                    value={code}
                    onChangeText={t => { setCode(t.replace(/\D/g, "").slice(0, 6)); setErr(""); setErrType(""); }}
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
                {stage === "code" && !busy && (
                  <ResendTimer seconds={resendCooldown} onResend={resendEmailCode} busy={busy} />
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
                  ? "We'll text you a one-time sign-in code. Include country code."
                  : `Code sent to ${phone.trim()}. Expires in 10 minutes.`}
              </Text>
              <View style={s.inputWrap}>
                {stage === "input" ? (
                  <TextInput
                    style={s.input}
                    value={phone}
                    onChangeText={t => { setPhone(t); setErr(""); setErrType(""); }}
                    placeholder="+1 555 000 0000"
                    placeholderTextColor={C.mut}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    returnKeyType="done"
                    onSubmitEditing={sendSmsCode}
                    autoFocus
                  />
                ) : (
                  <TextInput
                    style={[s.input, s.codeInput]}
                    value={code}
                    onChangeText={t => { setCode(t.replace(/\D/g, "").slice(0, 6)); setErr(""); setErrType(""); }}
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
                {stage === "code" && !busy && (
                  <ResendTimer seconds={resendCooldown} onResend={resendSmsCode} busy={busy} />
                )}
                {stage === "code" && !busy && (
                  <Pressable style={s.switchMethod} onPress={switchToEmail}>
                    <Text style={s.switchMethodT}>Not getting texts? Try email instead →</Text>
                  </Pressable>
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
  markGrad:   { width: 68, height: 68, borderRadius: 21, alignItems: "center", justifyContent: "center", shadowColor: C.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 18 },
  markIcon:   { color: "#0F0D0A", fontSize: 26, fontFamily: T.sansB },
  h:          { color: C.ink, fontSize: 28, marginBottom: 6 },
  sub:        { color: C.mut, fontSize: 14, fontFamily: T.sans, marginBottom: 24 },
  errBox:     { width: "100%", backgroundColor: C.coral + "18", borderRadius: 14, borderWidth: 1, borderColor: C.coral + "40", padding: 14, marginBottom: 14 },
  errText:    { color: C.coral, fontSize: 13, fontFamily: T.sansM, lineHeight: 19 },
  errAction:  { marginTop: 8 },
  errActionT: { color: C.gold, fontSize: 13, fontFamily: T.sansM },
  card:       { width: "100%", borderRadius: 22, borderWidth: 1, borderColor: C.line, overflow: "hidden", marginBottom: 16 },
  cardTitle:  { color: C.ink, fontSize: 16, fontFamily: T.sansB, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  cardSub:    { color: C.mut, fontSize: 13, fontFamily: T.sans, paddingHorizontal: 18, paddingBottom: 14, lineHeight: 19 },
  inputWrap:  { paddingHorizontal: 14, paddingBottom: 14 },
  input:      { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.line, color: C.ink, fontSize: 16, fontFamily: T.sans },
  codeInput:  { letterSpacing: 6, fontSize: 22, textAlign: "center" },
  btnGroup:   { paddingHorizontal: 14, paddingBottom: 16, gap: 10 },
  backLink:   { alignItems: "center", padding: 6 },
  backLinkT:  { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  resendTimer:{ color: C.mut, fontSize: 13, fontFamily: T.sans, textAlign: "center", paddingVertical: 4 },
  resendBtn:  { alignItems: "center", padding: 6 },
  resendBtnT: { color: C.teal, fontSize: 13, fontFamily: T.sansM },
  switchMethod:{ alignItems: "center", padding: 4 },
  switchMethodT:{ color: C.gold, fontSize: 13, fontFamily: T.sansM },
  authRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  authRowBorder: { borderTopWidth: 1, borderTopColor: C.line },
  authIcon:   { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  authIconText: { fontSize: 18 },
  authInfo:   { flex: 1 },
  authTitle:  { color: C.ink, fontSize: 15, fontFamily: T.sansM },
  authSub:    { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 2 },
  authChev:   { color: C.mut, fontSize: 20, fontFamily: T.sans },
  privacy:    { color: C.mut, fontSize: 11, fontFamily: T.sans, textAlign: "center", lineHeight: 17, marginTop: 8 },
  wordmark:   { position: "absolute", bottom: 24, alignSelf: "center", color: C.line, fontSize: 10, fontFamily: T.sansB, letterSpacing: 6 },
});
