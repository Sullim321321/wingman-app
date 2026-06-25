# Wingman — Expo app (starter)

A runnable React Native / Expo port of Wingman's **hero rescue flow**: trips dashboard → predictive alert (with the live weather-radar + animated risk score) → reasoning (contribution breakdown + sources) → one-tap execution → confirmation. It also fires a **real local notification** so you can feel the proactive-alert moment on a device.

This is the UX shell to build on, wired and configured for **EAS Build → TestFlight**.

---

## 1. Run it locally (5 min)

```bash
# 1) start the backend (separate terminal) — see ../wingman-api/README.md
cd ../wingman-api && npm install && npm start      # http://localhost:4000

# 2) point the app at it: edit src/config.js → API_BASE
#    simulator: http://localhost:4000   ·   phone: http://<your-LAN-IP>:4000

# 3) run the app
cd wingman-app
npm install
npx expo install react-native-screens react-native-safe-area-context expo-secure-store   # align native deps
npx expo start
```

On first launch you'll see **onboarding → email sign-in** (the backend prints/returns a dev code, which the app auto-fills). After sign-in, the rescue alert pulls a **live prediction** from the backend; if the API is unreachable it falls back to a sample so the demo never breaks.

Then press **i** for the iOS simulator, or scan the QR code with the **Expo Go** app on your iPhone. Tap **"Simulate a disruption"** — a notification schedules and the rescue flow opens.

> Local notifications work in Expo Go. The full app build (below) is what you'll send to testers.

## 2. One-time config

- **Bundle ID** is set to `club.welcometothefight.wingman` in `app.json` — change if you prefer.
- Link the project to your Expo account and get a project ID:
  ```bash
  npm i -g eas-cli      # if you don't have it
  eas login
  eas init              # writes extra.eas.projectId into app.json
  ```
- In `eas.json`, fill the `submit.production.ios` fields:
  - `appleId` — your Apple Developer email
  - `appleTeamId` — from developer.apple.com → Membership
  - `ascAppId` — the app's ID in App Store Connect (create the app there first)

## 3. Build & test on device

**Fastest — internal build you can install directly (no review):**
```bash
eas build -p ios --profile preview
```
EAS returns a QR/link; install straight onto registered test devices.

**TestFlight (for outside testers):**
```bash
eas build -p ios --profile production
eas submit -p ios --latest
```
Then in **App Store Connect → TestFlight**, add testers (internal are instant; external need a quick Beta App Review). They install via the TestFlight app.

---

## What's included vs. next

**Included (now at parity with the web prototype's core):** **bottom-tab navigation** (Trips · Concierge · Activity) nested in a root stack; **rescue flow** (alert → reasoning → execute → done); **plan-&-book flow** (Stockholm → Copenhagen detour → booking → confirmation); **track-record / calibration** screen; **ambient catch** (trip spotted in a WhatsApp message → drafts the trip); **connections / privacy**; **trust controls / settings** (auto-approve cap, intervention style, monitoring toggles); concierge chat; activity feed; animated radar; risk count-up; contribution bars; reusable execution stepper; local notifications; haptics; dark theme; app icon + splash.

**Next (production, post-seed):** real backend (prediction engine, flight/weather feeds), Duffel booking, payments, remote APNs push, and onboarding/auth.

**For the real product (post-seed):** a backend for the prediction engine + flight/weather feeds, booking via Duffel, payments, and **remote push via APNs** (this starter uses local notifications to demo the moment; production alerts come from your server). Push beyond Expo Go also needs a development build (`eas build --profile development`).

## Project map

```
wingman-app/
  App.js                  # navigation container + stack + notification routing
  index.js                # entry
  app.json / eas.json     # Expo + iOS config, build/submit profiles
  babel.config.js
  assets/                 # icon, splash
  src/
    theme.js              # colors
    notify.js             # push permission + scheduled disruption
    components.js         # Btn, Radar, ContribRow, Opt, Leg, ExecStepper, ...
    screens/
      HomeScreen.js  ConciergeScreen.js  ActivityScreen.js              # bottom tabs
      AlertScreen.js  ReasonScreen.js  TrackScreen.js                   # rescue + intelligence
      ExecScreen.js   DoneScreen.js                                     # shared execute / done
      PlanScreen.js   DetourScreen.js  PlanDoneScreen.js                # plan & book
      SignalScreen.js                                                   # ambient catch
      ConnectionsScreen.js  SettingsScreen.js                           # channels + trust controls
```

`App.js` holds a bottom-tab navigator (`Tabs`) for Trips/Concierge/Activity, nested inside a root stack that pushes the flow screens over the tabs. To add a flow: drop a screen in `src/screens/`, reuse pieces from `components.js`, and register it in the stack (or add a tab).
