import React, { useState, useRef } from "react";
import {
  SafeAreaView, KeyboardAvoidingView, View, Text, TextInput,
  Platform, StyleSheet, Animated, Easing, Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, T, GRAD } from "../theme";
import { SerifText, Btn, tap } from "../components";
import { requestCode, verifyCode } from "../api";
import { useAuth } from "../auth";
// SafeBlur — expo-blur removed; plain semi-opaque View
function SafeBlur({ style, children }) {
  return <View style={[style, { backgroundColor: "rgba(15,13,10,0.92)" }]}>{children}</View>;
}

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [stage, setStage]   = useState("email");
  const [email, setEmail]   = useState("");
  const [code, setCode]     = useState("");
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState("");
  const [hint, setHint]     = useState("");

  // Fade-in animation on mount
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const sendCode = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await requestCode(email.trim());
      setStage("code");
      if (r.devCode) { setCode(r.devCode); setHint("Dev mode: code auto-filled."); }
    } catch (e) {
      setErr("Couldn't reach the server. Check your connection.");
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await verifyCode(email.trim(), code.trim());
      await signIn(r.token, r.email);
    } catch (e) {
      setErr("That code didn't work. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={s.app}>
      {/* Background gradient */}
      <LinearGradient
        colors={["#0F0D0A", "#1A1610", "#0F0D0A"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient gold glow */}
      <View style={s.glowTop} />

      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Icon mark */}
          <View style={s.markWrap}>
            <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.markGrad}>
              <Text style={s.markIcon}>✦</Text>
            </LinearGradient>
          </View>

          {/* Headline */}
          <SerifText bold style={s.h}>
            {stage === "email" ? "Welcome back." : "Check your inbox."}
          </SerifText>
          <Text style={s.sub}>
            {stage === "email"
              ? "Sign in with your email — no password required."
              : `We sent a 6-digit code to ${email}`}
          </Text>

          {/* Input */}
          <SafeBlur intensity={20} tint="dark" style={s.inputWrap}>
            {stage === "email" ? (
              <TextInput
                style={s.input}
                placeholder="your@email.com"
                placeholderTextColor={C.mut}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                autoFocus
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={sendCode}
                returnKeyType="go"
              />
            ) : (
              <TextInput
                style={[s.input, s.code]}
                placeholder="• • • • • •"
                placeholderTextColor={C.mut}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                maxLength={6}
                autoFocus
                onSubmitEditing={verify}
                returnKeyType="go"
              />
            )}
          </SafeBlur>

          {hint ? <Text style={s.hint}>{hint}</Text> : null}
          {err  ? <Text style={s.err}>{err}</Text>  : null}

          {/* Primary CTA */}
          <Btn
            title={busy ? "…" : stage === "email" ? "Send code" : "Verify & continue"}
            onPress={busy ? undefined : (stage === "email" ? sendCode : verify)}
            disabled={busy}
            style={{ marginTop: 16, alignSelf: "stretch" }}
          />

          {stage === "code" ? (
            <Pressable style={s.backLink} onPress={() => { tap(); setStage("email"); }}>
              <Text style={s.backLinkT}>‹ Use a different email</Text>
            </Pressable>
          ) : null}

        </Animated.View>
      </KeyboardAvoidingView>

      {/* Footer wordmark */}
      <Text style={s.wordmark}>WINGMAN</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:      { flex: 1, backgroundColor: C.bg },
  glowTop:  {
    position: "absolute", top: -80, alignSelf: "center",
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: C.gold + "14",
  },
  wrap:     { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  content:  { alignItems: "center" },

  // Icon mark
  markWrap: { marginBottom: 28 },
  markGrad: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    shadowColor: C.gold, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20,
  },
  markIcon: { color: "#0F0D0A", fontSize: 28, fontFamily: T.sansB },

  // Typography
  h:   { color: C.ink, fontSize: 30, textAlign: "center", marginBottom: 8, letterSpacing: -0.5 },
  sub: { color: C.mut, fontSize: 15, fontFamily: T.sans, textAlign: "center", marginBottom: 28, lineHeight: 22 },

  // Input
  inputWrap: {
    alignSelf: "stretch",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 4,
  },
  input: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: C.ink,
    fontSize: 16,
    fontFamily: T.sansM,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  code: { letterSpacing: 10, textAlign: "center", fontSize: 22, fontFamily: T.sansB },

  hint:     { color: C.teal, fontSize: 12, fontFamily: T.sans, marginTop: 8, alignSelf: "flex-start" },
  err:      { color: C.coral, fontSize: 12.5, fontFamily: T.sans, marginTop: 8, lineHeight: 17, alignSelf: "flex-start" },
  backLink: { marginTop: 18, padding: 8 },
  backLinkT:{ color: C.mut, fontSize: 13, fontFamily: T.sansM },

  wordmark: {
    position: "absolute", bottom: 32, alignSelf: "center",
    color: C.mut + "60", fontSize: 10, fontFamily: T.sansB,
    letterSpacing: 6,
  },
});
