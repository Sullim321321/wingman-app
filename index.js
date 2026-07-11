import { registerRootComponent } from "expo";
import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

// ─── Crash screen component ───────────────────────────────────────────────────
// Renders error details directly on screen — used when the native bridge may be
// too broken to show an Alert (iOS 26 / RCTFatalException swallowed state).
let _setCrashInfo = null;

function CrashScreen({ error, phase, probe }) {
  const failed = (probe || []).filter(r => !r.ok);
  return (
    <View style={cs.container}>
      <Text style={cs.title}>⚠ {phase === "import" ? "Startup Error" : "Fatal JS Error"}</Text>

      {/* The minified stack names no module, so we probe each native dependency
          individually and print the ones that actually blew up. This is the part
          worth reading. */}
      {probe ? (
        failed.length ? (
          <View style={cs.probeBox}>
            <Text style={cs.probeHed}>FAILING MODULES ({failed.length} of {probe.length})</Text>
            {failed.map(r => (
              <Text key={r.name} style={cs.probeBad}>✗ {r.name}{"\n"}   {r.detail}</Text>
            ))}
          </View>
        ) : (
          <View style={cs.probeBox}>
            <Text style={cs.probeHed}>ALL {probe.length} NATIVE MODULES LOADED CLEANLY</Text>
            <Text style={cs.probeOk}>
              So the crash is in app code, not a native module. Read the stack below.
            </Text>
          </View>
        )
      ) : null}

      <Text style={cs.name}>{String(error?.name)}: {String(error?.message)}</Text>
      <ScrollView style={cs.scroll}>
        <Text style={cs.stack}>{String(error?.stack || "")}</Text>
      </ScrollView>
    </View>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a0000", padding: 20, paddingTop: 60 },
  title:     { color: "#ff6b6b", fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  hint:      { color: "#ff9f9f", fontSize: 12, lineHeight: 17, marginBottom: 12 },
  name:      { color: "#ffcc00", fontSize: 13, marginBottom: 8 },
  scroll:    { flex: 1 },
  stack:     { color: "#ccc", fontSize: 11, lineHeight: 16 },

  probeBox:  { backgroundColor: "#2a0a0a", borderRadius: 8, padding: 12, marginBottom: 14 },
  probeHed:  { color: "#ff6b6b", fontSize: 11, fontWeight: "bold", letterSpacing: 1, marginBottom: 8 },
  probeBad:  { color: "#ffd7d7", fontSize: 12, lineHeight: 17, marginBottom: 8 },
  probeOk:   { color: "#9fe8b0", fontSize: 12, lineHeight: 17 },
});

// ─── Global JS error handler ──────────────────────────────────────────────────
// Installed BEFORE ./App is loaded. Previously this ran after `import App from
// "./App"` — but ES imports hoist, so App's entire module graph was evaluated
// first. Anything throwing at module scope (e.g. a native module with no
// TurboModule under the New Architecture) killed index.js before the handler or
// the crash screen existed: a white screen with no way to see the cause.
if (global.ErrorUtils) {
  const prevHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal && _setCrashInfo) {
      try { _setCrashInfo(error); } catch (_) {}
    }
    if (prevHandler) prevHandler(error, isFatal);
  });
}

// ─── Load the app, catching import-time explosions ────────────────────────────
// require() (not import) so this executes HERE, in order, inside the try — rather
// than being hoisted above everything above it.
let App = null;
let importError = null;
let probeResults = null;
try {
  App = require("./App").default;
} catch (e) {
  importError = e;
  // Also log it: if the screen somehow can't render, this still reaches Console/Metro.
  console.error("[index] App failed to load at import time:", e);

  // Only on failure: walk every native dependency one at a time and find out which
  // one actually throws. Costs nothing on the happy path.
  try {
    probeResults = require("./src/moduleProbe").runModuleProbe();
  } catch (pe) {
    console.error("[index] module probe itself failed:", pe);
  }
}

function Root() {
  const [crashError, setCrashError] = useState(null);
  _setCrashInfo = setCrashError;

  if (importError) return <CrashScreen error={importError} phase="import" probe={probeResults} />;
  if (crashError)  return <CrashScreen error={crashError} phase="runtime" />;
  if (!App)        return <CrashScreen error={new Error("App module resolved to nothing.")} phase="import" />;

  return <App />;
}

registerRootComponent(Root);
