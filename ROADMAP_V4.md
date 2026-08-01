# Wingman — Roadmap v4 · "From built to trusted"

*v1 fixed the grammar. v2 evolved the identity (Atelier, Fraunces, the Arrival Concierge).
v3 made Wingman **do** — dark mode, the proactive Operator, the acting concierge, the
provider seam. Every core capability now exists. v4 is not about new pillars; it's about
the distance between "the feature exists" and "I trust it with my trip." That distance is
where products are actually won or lost.*

**Why this, why now.** The moment we walked the app on a real device this week, it surfaced
a cluster of bugs no compile check caught: the arrival card firing 15h early, a flight
mistaken for a meeting, "null → null" briefings, a bright-white card in dark mode, content
bleeding off the edge, a crowded Home. None were logic-deep — they were the *last mile*.
That's the signal: the build is done; the trust pass hasn't happened. v4 is that pass, plus
the groundwork to put Wingman in real hands and learn.

Cadence unchanged: **review this plan, then execute in verified waves** — device-checked,
one push per wave.

---

## Epic A · The trust pass (polish + hardening)  ← start here

The device walk is the method, not an afterthought. Walk every surface, in light and dark,
in each state (no-trip, pre-trip, day-of, in-air, at-destination, post-trip), and fix what
only a real screen reveals.

- **A1 · Finish the device walk** — every screen, both themes, all states, against
  `ATELIER_QA.md`. Screenshot, log, fix. This is where the arrival/Home-class bugs live.
- **A2 · Theme the shared components** — the screen sweep converted *screens*; shared
  render modules still freeze light. **Audit done** — 10 modules found frozen (static `C`
  import + `StyleSheet.create`, no `makeStyles`). Progress:
  - ✅ **9 of 10 done** (all verified: babel + hook-validator + orphan-scan): `tripdoc.js`,
    `atelier.js`, `components/InferredTravel.js`, `components/ui.js` (7 primitives),
    `ConfirmSheet.js`, `UpgradeSheet.js`, `OfflineBanner.js`, `PlanCard.js`,
    `DestinationImage.js`, `ShareCard.js`.
  - ⏳ **Remaining: `components.js` ONLY** (var `dcS`, 22 components — WMark, FadeRise,
    buttons, SerifText; rendered on every screen). Highest blast radius → convert WITH the
    device walk in hand, not unattended. Adapt the codemod for the `dcS` var + `"./ThemeContext"`
    path, run all three validators, then screenshot-check a few screens before shipping.
  - Import-path nuance confirmed: `src/*.js` → `"./ThemeContext"`, `src/components/*.js` →
    `"../ThemeContext"`.
- **A3 · Kill the "over-eager surface" bug class** — ◑ IN PROGRESS.
  - ✅ Audited every state-gated surface; root cause confirmed = ad-hoc thresholds scattered
    per surface (30m / 3h / 18h / 48h / 14d on Home, 4h on the server), free to drift apart.
  - ✅ Built `src/timewindows.js` — ONE source of truth: named `WINDOWS` constants + a pure,
    tested `flightPhase(leg, now)` predicate (12/12 boundary tests incl. the "30h out →
    pre_trip, NOT day_of" regression). HomeScreen's four state computations now reference
    `WINDOWS.*` instead of magic numbers (zero behaviour change, single source now).
  - ⏳ **Remaining (device walk):** refactor the four states to *derive from* `flightPhase`
    (not just borrow its constants), align the server `/arrival` + `pollArrivals`/`pollCheckins`
    windows to the same numbers, and adopt in Concierge/Trips/Activity which still hand-roll.
- **A4 · Empty / loading / error honesty, end to end** — confirm every surface distinguishes
  "nothing here" from "I couldn't load it" (the Home brief already does; propagate it).

### Known bugs logged (fix first in A)
- ✅ **`[today-events] column "message" does not exist`** — FIXED. The `/today-events` query
  selected a nonexistent `message` column from `activity_events` (its columns are
  `title`/`body`); it threw on every load. Now selects `title`/`body` and reads the event
  name from those. Server change — pending push.

### Device-surfaced bugs (live screenshots, this session)
- ✅ **Flight times 4 hours early (timezone) — trust-critical.** The email parser emitted
  local airport time as a naive ISO string; cast to `timestamptz` on a UTC server it stored
  4h+ early, so the day-of state believed a 7:29 PM flight had already departed and the
  traveler had "arrived" hours early. FIXED at the source: `flighttz.js` (airport→IANA tz +
  wall-time→UTC converter, 19 tests) wired into `sanitizeLegDates` so all new imports store
  true UTC. **Backfill for existing legs:** `/admin/backfill-flight-tz` (dry-run, idempotent
  via a `tz_fixed` marker) + a one-tap **Settings → FLIGHT TIMES** Preview/Apply. ⏳ Pending:
  user runs Preview→Apply to correct the ~existing flights.
- ⏳ **Duplicate flight** — Trips lists AA 4611 (JFK→PIT) while the email + Dossier show the
  real UA 3403 (EWR→PIT) for the same trip. Task #228. Diagnose from the flight-tz preview
  leg dump (real data) before touching grouping code.
- ◑ **Pull-to-refresh / Concierge-typing / TripDetail-intel** — FIXED earlier this session
  (arg-shape bugs + composer re-render isolation). Shipped.
- ◑ **Dark coloration of shared cards (`components.js`) — STOPGAP shipped, proper fix parked.**
  `components.js` builds styles once at load from a static palette (frozen LIGHT), so shared
  cards render cream in dark mode. Stopgap: point its static import at `C_DARK` — fixes dark
  (the primary experience); explicit light mode would show dark shared cards. The PROPER fix
  (live theming without touching the ~91 `g.*` consumers) was attempted via JS `Proxy` and
  **crashed on-device** ("Property 'Pressable' doesn't exist") — Hermes-level failure the
  render gate could NOT catch because the gate evaluates against a react-native MOCK. Reverted.
  Retry only after verifying the approach on the real engine (getter-based, or the slow
  consumer-by-consumer hook conversion). **Gate gap logged: it can't catch runtime RN errors.**

## Epic B · Reliability + observability (know before the user tells you)

Right now a bad screen is found by looking. That doesn't scale past one device.

- **B1 · Client error tracking** — a crash/error reporter so the next "the tab is blank"
  is a stack trace, not a screenshot. (The `ErrorBoundary` exists; wire it to a sink.)
- **B2 · Render-safety in CI** — ✅ DONE. `scripts/check-themed-hooks.js` (AST-based:
  hook-placement + orphan `s`/`C`) now runs inside `npm run check`, which `npm run ota`
  already gates on. So every OTA is blocked if a themed hook is misplaced or a component
  references an undefined `s`/`C` — the exact two crashes the sweep introduced. Passing on
  the current tree (67 modules). This is the safety net for the `components.js` conversion.
- **B3 · Server observability** — ✅ DONE. `pollDisruptions` / `pollArrivals` / `pollCheckins`
  now stamp a heartbeat (last run, run/error counts, last error) via `beat()`, and `/health`
  reports `pollersHealthy` + per-poller `stale` (no run in 2.5× its interval). A silently
  dead watcher now shows as `stale:true` instead of a reassuring 200. (Crons + a real alert
  on stale still to wire.)
- **B4 · Graceful degradation audit** — ✅ AUDITED. Every user-facing external helper fails
  honestly: flight status (FlightAware/AviationStack) → `null` with a named reason, weather
  (OpenWeather) → `null`, routing (`travelTime`) → `{error}`, provider seam → `link`/`none`.
  No fabricated values anywhere; the surfaces already render the null/error states. Fix
  made: added an 8s timeout to the AeroAPI fetch inside `pollDisruptions` (it lacked one) so
  a hanging flight API can't stall the watcher → timeout is caught → honest null. Residual:
  a few non-critical fetches (Twilio/Resend/Perplexity) could take blanket timeouts later.

## Epic C · Test coverage on the spines

The new machinery is untested where it matters most.

- **C1 · Unit tests for the Operator + act-tool** — ◑ MOSTLY DONE. The Operator's timing
  logic is now pure + tested in `arrival.js` / `test-arrival.js` (**25/25**), and the
  endpoints/poll loops call the helpers so tests and prod can't drift:
  - `isArrivalActive` / `pickActiveFlight` — the `/arrival` active window (incl. the
    "departs in 15h → not active" regression).
  - `retimedArrival` — O2's delay→new-landing shift (estimate wins, else +delay, ≤5m = no-op).
  - `shouldNudgeLeaveBy` — the "imminent" leave-by window (next 90m, ≤15m past).
  - `normalizeAction` — already tested (7/7).
  - Remaining: `pollCheckins` arrival-gating (DB-coupled — extract the pure predicate) and
    a couple of Operator cascade paths.
- **C2 · Data-hygiene invariants as tests** — ✅ DONE. The sketch-identity invariant was
  already tested (`provenance.js`, 16/16). The gap was the **briefing/signal** guards, which
  lived only inside SQL WHERE clauses — untested and free to drift. Extracted `briefguard.js`
  (pure): `isRealTime` / `hasRoute` / `isMalformedLeg` / `isBriefableLeg` / `briefableLegs`,
  stating the "a routeless or time-corrupt leg must never be briefed" rule once. Tested in
  `test-briefguard.js` (**25/25**, incl. the exact "null → null departs in 24h" regression and
  the epoch/pre-2015 departure artefact). Wired into `runPreDepartureCron` as a shared guard
  (SELECT now carries `type`/`status`; `if (!briefguard.isBriefableLeg(leg)) continue;`) so the
  cron and the test hold the same predicate. Remaining C2 nicety: adopt the same guard in
  `/today-events` + the signal builder (both already SQL-filter route; a JS pass is belt-only).

## Epic D · Activation + the first-run "aha"

Nothing above matters if a new person doesn't reach the moment Wingman earns trust.

- **D1 · Instrument the aha** — ✅ DONE (v1). Aha defined: *the first disruption decision
  Wingman surfaces* — the moment it catches something for you. `/metrics/activation`
  computes the funnel from existing data (no new event pipeline, works retroactively,
  admin-gated): signed_up → engaged (trip added / calendar connected) → watchable_flight →
  aha_caught → actioned, with conversion % at each step. Enough to watch activation the day
  real users arrive; a proper event pipeline can come later if the funnel needs finer steps.
- **D2 · 60-second value-first onboarding, verified** — the scaffolding exists (R2);
  confirm it delivers a concrete win before asking for anything, on a real cold start.
- **D3 · Retention loop** — the weekly digest + morning brief exist; close the loop so
  they pull the user back with something true and specific, not a nag.

## Epic E · The next product leap (pick one, deliberately)

Only after A–C are solid. Candidates, roughly in order of leverage:

- **Expense + reimbursement** — ★ CHOSEN LEAP. Today `ExpensesScreen` is client-only: it
  maps a trip's legs → items (category from leg type, amount from `leg.price_total`), lets
  you tap to fill missing amounts, and shares a plain-text CSV. The chain from that to a
  real reimbursement flow, in build-ready slices:
  - **E1 · Receipt-total auto-capture** *(mostly ALREADY BUILT — verify + finish)* — the
    parser schema already extracts `price_total` + `currency` and the insert paths persist
    them, so confirmation/receipt emails (incl. the Uber/Lyft receipt Gmail searches) already
    fill the report. Remaining: (a) drop the stale "Soon: …inbox" copy on `ExpensesScreen`,
    (b) confirm ride-receipt legs attach to the right trip with their total, (c) a light
    backfill/normalizer for currency. So E2 is really the first *new* build.
  - **E2 · Reimbursement-ready export** — ✅ DONE. The export writes a finance-ready CSV:
    a header block (trip · date range · currency), the itemised table (date, category,
    vendor, amount, currency), **per-category subtotals**, then the grand total, with a
    dated filename. Gated behind Pro. Also done here: E1's stale "Soon: …inbox" copy
    replaced — amounts already auto-fill from booking/receipt email.
    *(PDF one-pager: CUT — the CSV covers reimbursement; a PDF adds no real value.)*
  - **E3 · Real categories + multi-currency** — ✅ DONE. Categories were already real buckets
    (Flights/Lodging/Ground/Rail/Dining/…). Added true multi-currency: each item carries its
    own currency, totals are computed **per currency** (never summed across), the headline
    shows the primary currency with the others honestly alongside, and the CSV/report carry
    per-(category,currency) subtotals + a TOTAL per currency.
  - **E4 · Report metadata** — ✅ DONE. Purpose + project/cost-code fields on the Expenses
    screen, persisted per trip in `trips.metadata.expense` (new `GET`/`PATCH
    /trips/:id/expense-meta`, owner-gated), and carried into both the CSV and report headers
    so the export drops straight into a reimbursement system.
  - Slice status: E1 ✅ · E2 ✅ (CSV; PDF cut) · E3 ✅ · E4 ✅. **Epic E complete.**
- **Companion / multi-traveler** — trips with other people (the "two rooms in Asia" the
  graph already models); shared itineraries and per-traveler constraints.
- **Deeper proactive intelligence** — the tight-connection watch, bags, lounge routing
  the Operator deferred; richer "what could ruin my day" reasoning.
- **Multi-modal: rail as a first-class leg** — Wingman is flight-centric. Trains are
  *half* present today: the planner already emits `type:"train"` legs and there's a UK
  National Rail (Huxley) fetch, but the entire proactive spine is gated to
  `type='flight'` (~41 checks server-side in the poller / Operator / arrival / cascade,
  ~27 more across the app's screens). So a rail leg imports and renders as a generic row
  but gets **no** delay watching, no day-of leave-by, no "your train is cancelled"
  cascade, and Amtrak/most international systems have no live feed wired at all. The leap:
  (1) generalize the watcher + Operator + arrival timing from "flight" to a transport leg
  with a `mode`, (2) a status provider per network behind the same seam as Epic F
  (Huxley/National Rail for the UK; Amtrak + others as they're connectable), (3) UI that
  says "train" not "flight" (station not gate, platform not terminal). High value for
  European and Northeast-Corridor travelers, and it turns "a travel office" into one that
  covers how people actually move, not just fly. Bigger than the others — scope carefully.

Don't build more than one at a time. Let A–D and real usage decide which.

## Epic F · Real data & connectors (carry-over)

The v3 provider seam is ready; the feeds aren't connectable yet. Watch the registry: the
moment a rideshare-dispatch, live-security, terminal-map, or ground-transit connector
appears, flip the env and it's live — no rewrite. (Uber estimate MCP already suggested.)

---

## Sequencing

1. **Epic A — the trust pass.** Nothing ships on top of a screen that's visibly wrong.
2. **Epic B + C — reliability, observability, tests.** So trust holds without a person watching.
3. **Epic D — activation.** Get it into real hands and measure the aha.
4. **Epic E — one new leap**, chosen from what D and usage reveal.
5. **Epic F — real feeds** whenever they become connectable.

## The through-line

v3 asked "can Wingman act?" — yes. v4 asks "would you let it?" The answer isn't another
feature; it's a product that's clean on every screen, honest when something breaks, caught
before you have to report it, and worth opening again next trip. Build the trust, then earn
the next leap.
