# Getting Wingman onto TestFlight

You have an Apple Developer account and EAS — here's the exact path. ~1 hour of work, then ~15 min of Apple processing.

## 0. Install & log in
```bash
npm i -g eas-cli
eas login                 # your Expo account
```

## 1. Put the backend on a public HTTPS URL  ⚠️ do this first
A TestFlight build runs on a real phone, so it **cannot reach `localhost`**, and iOS blocks plain `http`. The app will silently fall back to the offline sample unless the API is public + HTTPS.

Easiest path (free): push `wingman-api/` to GitHub → Render.com → **New → Blueprint** (it reads the included `render.yaml`) → deploy. You'll get a URL like `https://wingman-api.onrender.com`. (Railway, Fly.io, or Cloud Run work too.)

Then set it in the app:
```js
// wingman-app/src/config.js
export const API_BASE = "https://wingman-api.onrender.com";
```

## 2. Link the project & fill credentials
```bash
cd wingman-app
eas init                  # writes extra.eas.projectId into app.json
```
Edit `eas.json` → `submit.production.ios`:
- `appleId` — your Apple Developer email
- `appleTeamId` — developer.apple.com → Membership → Team ID
- `ascAppId` — leave as-is for now; `eas submit` can create the app and tell you the ID (or create the app manually in App Store Connect and copy the "Apple ID" number)

Bundle ID is already set: `club.welcometothefight.wingman`.

## 3. Build the iOS app (EAS handles all signing)
```bash
eas build -p ios --profile production
```
First run prompts you to log into Apple; EAS **auto-creates** the distribution certificate and provisioning profile. Build runs in the cloud (~10–20 min).

> Want it on *your own* device faster, before TestFlight? `eas build -p ios --profile preview` makes an internal-distribution build you install via a QR link (the device must be registered — EAS walks you through it).

## 4. Submit to App Store Connect
```bash
eas submit -p ios --latest
```
If the app record doesn't exist yet, accept the prompt to create it. This uploads the build to App Store Connect.

## 5. Turn on TestFlight
In **App Store Connect → your app → TestFlight**:
- Build processes for ~5–15 min (you'll get an email when ready).
- Export-compliance question is already answered in `app.json` (`ITSAppUsesNonExemptEncryption: false`), so it won't block you.
- **Internal testers** (up to 100, must be in your team) → available instantly.
- **External testers** (up to 10,000, invite by email/public link) → require a one-time **Beta App Review** (usually <24h).
- Testers install the **TestFlight** app and tap your invite link.

Sign-in works out of the box: the beta backend returns the one-time code and the app auto-fills it (no email provider needed yet).

## 6. Ship updates
- JS-only change? If you add `expo-updates`, push instantly with `eas update` — no rebuild.
- Native change (new dependency, config)? Bump and rebuild: the `production` profile auto-increments the build number, so just `eas build -p ios --profile production && eas submit -p ios --latest`.

## Before a *public* launch (not needed for beta)
- Wire a real email sender for sign-in codes and set the API's `NODE_ENV=production` (stops returning the dev code).
- Move auth tokens/sessions to a real database (currently in-memory).
- Add remote push via APNs for server-driven alerts (the app uses local notifications today).
