import React, { useState } from "react";
import { SafeAreaView, KeyboardAvoidingView, View, Text, TextInput, Platform, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { Btn } from "../components";
import { requestCode, verifyCode } from "../api";
import { useAuth } from "../auth";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [stage, setStage] = useState("email"); // email | code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hint, setHint] = useState("");

  const sendCode = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await requestCode(email.trim());
      setStage("code");
      if (r.devCode) { setCode(r.devCode); setHint("Dev mode: code auto-filled from the server."); }
    } catch (e) {
      setErr("Couldn't reach the server. Check API_BASE in src/config.js and that the API is running.");
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
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <LinearGradient colors={[C.gold, C.goldD]} style={s.mark}><Text style={{ fontSize: 26 }}>✈</Text></LinearGradient>
        <Text style={s.h}>{stage === "email" ? "Sign in to Wingman" : "Enter your code"}</Text>
        <Text style={s.sub}>
          {stage === "email" ? "We'll email you a one-time code — no password." : `Sent to ${email}`}
        </Text>

        {stage === "email" ? (
          <TextInput
            style={s.input} placeholder="you@email.com" placeholderTextColor={C.mut}
            autoCapitalize="none" keyboardType="email-address" autoComplete="email"
            value={email} onChangeText={setEmail} onSubmitEditing={sendCode} returnKeyType="go"
          />
        ) : (
          <TextInput
            style={[s.input, s.code]} placeholder="123456" placeholderTextColor={C.mut}
            keyboardType="number-pad" value={code} onChangeText={setCode} maxLength={6}
            onSubmitEditing={verify} returnKeyType="go"
          />
        )}

        {hint ? <Text style={s.hint}>{hint}</Text> : null}
        {err ? <Text style={s.err}>{err}</Text> : null}

        <Btn
          title={busy ? "…" : stage === "email" ? "Send code" : "Verify & continue"}
          kind="accent" onPress={busy ? undefined : (stage === "email" ? sendCode : verify)}
          style={{ marginTop: 16, alignSelf: "stretch" }}
        />
        {stage === "code" ? <Text style={s.link} onPress={() => setStage("email")}>‹ Use a different email</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  wrap: { flex: 1, justifyContent: "center", padding: 28 },
  mark: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  h: { color: C.ink, fontSize: 24, fontWeight: "700", marginBottom: 6 },
  sub: { color: C.mut, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.ink, fontSize: 16 },
  code: { letterSpacing: 8, textAlign: "center", fontSize: 22 },
  hint: { color: C.teal, fontSize: 12, marginTop: 10 },
  err: { color: C.coral, fontSize: 12.5, marginTop: 10, lineHeight: 17 },
  link: { color: C.mut, fontSize: 13, textAlign: "center", marginTop: 16 },
});
