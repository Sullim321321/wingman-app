# Wingman — Expo SDK 53 → 56 migration plan

**Why:** Live Activities require `expo-widgets`, which needs **SDK 54+**. You're on **53**. The upgrade is a prerequisite, not the feature.

**The actual risk isn't the version numbers.** It's this line in `app.json`:

```json
"newArchEnabled": false
```

You are on the **Legacy Architecture**. SDK 55 makes the **New Architecture mandatory** and removes the flag entirely. That flip — not the SDK bump — is what can break the app. So we isolate it first.

---

## Step 0 — Flip the New Architecture on SDK 53 (do this first, alone)

The single highest-value move. SDK 53 supports New Arch; you opted out. Turning it on **without upgrading anything else** tests the scariest change in isolation, and it's one flag to revert.

1. `app.json` → `"newArchEnabled": true`
2. Bump `react-native-view-shot` **4.0.3 → ^5.1.0** (see below — this is the one library most likely to break)
3. Build, install, and exercise: **share cards** (view-shot), Stripe, notifications, biometrics, calendar.

**If it works:** the rest of the migration is mostly mechanical. **If it breaks:** you've found the real problem while still on a known-good SDK, and you can revert with one line.

Do not skip this by going straight to 54.

---

## The one library that will break: `react-native-view-shot`

You're on **4.0.3**. New Arch requires **5.x**, which is the Fabric/TurboModule rewrite and has its own breaking changes. It's the classic New Arch casualty.

Used in exactly one place — `src/components/ShareCard.js`:

```js
import { captureRef } from "react-native-view-shot";
const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
```

Small blast radius. Test share cards immediately after the flip.

---

## Then upgrade one SDK at a time — never jump 53 → 56

Expo's own guidance: *"We recommend upgrading SDK versions incrementally, one at a time."* With a New Arch flip in 55 and a react-navigation fork in 56, a direct jump would leave you unable to tell which SDK caused which failure.

```bash
npx expo install expo@^54.0.0 --fix && npx expo-doctor@latest   # RN 0.81, React 19.1
npx expo install expo@^55.0.0 --fix && npx expo-doctor@latest   # RN 0.83, New Arch MANDATORY
npx expo install expo@^56.0.0 --fix && npx expo-doctor@latest   # RN 0.85, React 19.2.3
```

Build and smoke-test after **each** step.

---

## What breaks in YOUR code, audited file by file

### SDK 54

| Issue | Where | Fix |
|---|---|---|
| **`expo-file-system` default export swapped.** Old API moved to `/legacy`. | `src/screens/ExpensesScreen.js:136-137` — uses `cacheDirectory`, `writeAsStringAsync`, `EncodingType` (all legacy API) | `import * as FileSystem from "expo-file-system/legacy"` |
| RN `<SafeAreaView>` deprecated | **9 screens** import it from `react-native` | Warning only, not fatal. Migrate to `react-native-safe-area-context` when convenient. |
| `@expo/vector-icons` families updated; some names renamed/removed | `Ionicons` used across **~10 screens** | Typecheck + eyeball the icons after upgrading |
| Unhandled promise rejections now log as errors | everywhere | Expect new red boxes that are **not** new bugs |
| JSC removed — Hermes only | — | You're already on Hermes |

### SDK 55 — the hard one

| Issue | Impact |
|---|---|
| **New Architecture mandatory**, `newArchEnabled` removed | This is why Step 0 exists |
| `notification` field in `app.json` now **throws** in prebuild | ✅ **You're clean** — already using the `expo-notifications` config plugin |
| `expo-av` removed | ✅ Not used |
| `expo-clipboard`: `content` property removed from listeners | ✅ You only use `setStringAsync` |
| `eas update` requires `--environment` | Will silently break CI if you use it |
| All Expo packages renumbered to match SDK major | Handled by `--fix` |

### SDK 56

| Issue | Where | Fix |
|---|---|---|
| **`expo-calendar` silent import swap.** `"."` now resolves to the NEW object-oriented API; old one moved to `/legacy`. Expo filed this under "Deprecations," not "Breaking changes" — it **compiles fine and misbehaves.** | `src/screens/TripDetailScreen.js:16`, `src/screens/ConnectionsScreen.js:9` | `import * as Calendar from "expo-calendar/legacy"` |
| `expo` no longer depends on `@expo/vector-icons` | ~10 screens | Add `@expo/vector-icons` to `package.json` explicitly |
| **iOS deployment target 15.1 → 16.4**; Xcode 26.4 required | — | Drops iPhone 7/6s/SE-1. Acceptable. |
| expo-router forked from react-navigation | — | ✅ **Not affected** — you use React Navigation directly, not expo-router |
| `expo/fetch` becomes `globalThis.fetch` | `src/api.js` | Watch for subtle behavior differences |
| Reanimated + Hermes V1: **25–30% memory regression** even if unused | — | Unresolved upstream. You don't use Reanimated — verify it isn't pulled in transitively. |

---

## Your custom Podfile patches — revisit, don't assume

`plugins/withFmtFix.js` currently patches two things by hand:

1. `FMT_USE_CONSTEVAL` → 0 (Xcode 26 / Apple Clang consteval error)
2. Strips `@throw`/`@catch` from `RCTNativeModule.mm` / `RCTTurboModule.mm` (SIGABRT on iOS 26)

These exist because **SDK 53 + Xcode 26 is an unsupported combination.** SDK 54+ officially requires Xcode 26, so both are likely fixed upstream. After each SDK step, **try the build with these patches disabled.** Carrying hand-rolled Podfile surgery you no longer need is how you end up debugging a phantom.

The `withRCTTurboModuleFix.js` plugin is already a no-op passthrough — safe to delete once `withFmtFix` goes.

---

## Also needs bumping

- `@stripe/stripe-react-native` **0.45.0** → whatever SDK 56 pins (`--fix` handles it)
- `expo-dev-client` — needed to test Live Activities locally; you already have it

---

## Only after all of the above: Live Activities

Then, and only then:

```bash
npx expo install expo-widgets
```

Layouts are written in **JSX** with `@expo/ui/swift-ui` components — no Swift. Configure via the `expo-widgets` config plugin in `app.json` with `enablePushNotifications: true`.

**The catch:** a Live Activity that reacts to a delay while the phone is in your pocket needs a push **direct to APNs** — Expo's push service cannot do it. That means an Apple `.p8` key and hand-rolled APNs calls from `server.js`. Expo's documentation for this is [an open issue](https://github.com/expo/expo/issues/43591), filed March 2026 and still unwritten.

**But the countdown needs no push at all.** iOS renders relative timers natively, so *"boards in 1h 42m — Gate B12"* ticks down on the lock screen by itself. That's a real, shippable milestone before touching APNs.

### Suggested Live Activity phasing
1. **Start on day-of, countdown + gate.** No push. Updates when the app opens. Ships value immediately.
2. **APNs remote updates.** Delay and gate changes hit the lock screen unprompted. This is the magic — and the undocumented part.

---

## Sources

- [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54)
- [Expo SDK 55 changelog](https://expo.dev/changelog/sdk-55)
- [Expo SDK 56 changelog](https://expo.dev/changelog/sdk-56)
- [Upgrading Expo SDK walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [expo-widgets (Live Activities)](https://docs.expo.dev/versions/latest/sdk/widgets/)
- [SDK 56 version compatibility table](https://docs.expo.dev/versions/v56.0.0)
- [Live Activity APNs docs — open issue](https://github.com/expo/expo/issues/43591)
