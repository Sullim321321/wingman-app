import { registerRootComponent } from "expo";
import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import App from "./App";

// ─── Crash screen component ───────────────────────────────────────────────────
// Renders error details directly on screen — used when the native bridge may be
// too broken to show an Alert (iOS 26 / RCTFatalException swallowed state).
let _setCrashInfo = null;

function CrashScreen({ error }) {
  return (
    <View style={cs.container}>
      <Text style={cs.title}>⚠ Fatal JS Error (Build 79)</Text>
      <ScrollView style={cs.scroll}>
        <Text style={cs.name}>{String(error?.name)}: {String(error?.message)}</Text>
        <Text style={cs.stack}>{String(error?.stack || "")}</Text>
      </ScrollView>
    </View>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a0000", padding: 20, paddingTop: 60 },
  title:     { color: "#ff6b6b", fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  name:      { color: "#ffcc00", fontSize: 13, marginBottom: 8 },
  scroll:    { flex: 1 },
  stack:     { color: "#ccc", fontSize: 11, lineHeight: 16 },
});

function Root() {
  const [crashError, setCrashError] = useState(null);
  _setCrashInfo = setCrashError;
  if (crashError) return <CrashScreen error={crashError} />;
  return <App />;
}

// Global JS error handler — captures fatal JS errors and renders them on screen
if (global.ErrorUtils) {
  const prevHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal && _setCrashInfo) {
      try { _setCrashInfo(error); } catch (_) {}
    }
    if (prevHandler) prevHandler(error, isFatal);
  });
}

registerRootComponent(Root);
