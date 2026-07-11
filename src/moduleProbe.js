// moduleProbe.js — TEMPORARY New Architecture diagnostic.
//
// The New Arch white screen gave us "TypeError: Object is not a function" thrown
// during module evaluation, with a stack of minified bundle offsets that name no
// module. Rather than guess, we import every native-backed dependency in its own
// try/catch and report exactly which one explodes.
//
// Metro requires STATIC require() calls — it cannot resolve require(someVariable)
// — so each probe is written out longhand. Tedious, deliberate.
//
// DELETE THIS FILE once the culprit is fixed.

const results = [];

function probe(name, fn) {
  try {
    const mod = fn();
    if (mod === undefined || mod === null) {
      results.push({ name, ok: false, detail: "resolved to undefined/null" });
    } else {
      results.push({ name, ok: true });
    }
  } catch (e) {
    results.push({ name, ok: false, detail: (e && e.message) || String(e) });
  }
}

export function runModuleProbe() {
  results.length = 0;

  // ── The prime suspects: version-jumped or known New Arch trouble ────────────
  probe("react-native-view-shot", () => require("react-native-view-shot"));
  probe("@stripe/stripe-react-native", () => require("@stripe/stripe-react-native"));
  probe("@react-native-community/datetimepicker", () => require("@react-native-community/datetimepicker"));

  // ── Navigation / gesture / screens ──────────────────────────────────────────
  probe("react-native-gesture-handler", () => require("react-native-gesture-handler"));
  probe("react-native-screens", () => require("react-native-screens"));
  probe("react-native-safe-area-context", () => require("react-native-safe-area-context"));
  probe("@react-navigation/native", () => require("@react-navigation/native"));
  probe("@react-navigation/native-stack", () => require("@react-navigation/native-stack"));
  probe("@react-navigation/bottom-tabs", () => require("@react-navigation/bottom-tabs"));

  // ── Storage / auth ──────────────────────────────────────────────────────────
  probe("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage"));
  probe("expo-secure-store", () => require("expo-secure-store"));
  probe("expo-apple-authentication", () => require("expo-apple-authentication"));
  probe("expo-local-authentication", () => require("expo-local-authentication"));

  // ── Expo surface used at module scope ───────────────────────────────────────
  probe("expo-font", () => require("expo-font"));
  probe("expo-notifications", () => require("expo-notifications"));
  probe("expo-linear-gradient", () => require("expo-linear-gradient"));
  probe("expo-haptics", () => require("expo-haptics"));
  probe("expo-clipboard", () => require("expo-clipboard"));
  probe("expo-sharing", () => require("expo-sharing"));
  probe("expo-calendar", () => require("expo-calendar"));
  probe("expo-location", () => require("expo-location"));
  probe("expo-device", () => require("expo-device"));
  probe("expo-speech", () => require("expo-speech"));
  probe("expo-document-picker", () => require("expo-document-picker"));
  probe("expo-asset", () => require("expo-asset"));
  probe("expo-linking", () => require("expo-linking"));
  probe("expo-status-bar", () => require("expo-status-bar"));
  // Transitive via `expo` rather than direct deps, but they resolve and the app
  // imports them today. (Note: SDK 56 drops @expo/vector-icons from expo's deps —
  // it'll need adding to package.json explicitly at that step.)
  probe("expo-file-system", () => require("expo-file-system"));
  probe("@expo/vector-icons", () => require("@expo/vector-icons"));

  // ── Fonts ───────────────────────────────────────────────────────────────────
  probe("@expo-google-fonts/playfair-display", () => require("@expo-google-fonts/playfair-display"));
  probe("@expo-google-fonts/dm-sans", () => require("@expo-google-fonts/dm-sans"));
  probe("@expo-google-fonts/eb-garamond", () => require("@expo-google-fonts/eb-garamond"));

  return results;
}
