# Wingman — Roadmap v3 · "From Guardian to Operator"

*v1 fixed the grammar. v2 (`DESIGN_ROADMAP.md`) evolved the identity — the Atelier look,
Fraunces, the evolved palette, the Arrival Concierge, the present-moment Ask Wingman. v3 is
about **doing**: dark mode done properly, and Wingman moving from something that *watches
and advises* to something that *operates the journey you're in*.*

Cadence unchanged: **review this plan, then execute in verified waves** — one push per wave,
device-checked before the next. Nothing here is a blind sweep.

---

## Epic 1 · Dark mode, done right (the one true dark)  ✅ COMPLETE

Not a toggle — a phased refactor, because 43 screens freeze their colours at import.

- **1a · Foundation** — ✅ `C_DARK` (full key-for-key dark palette) in `theme.js`.
- **1b · The mechanism** — ✅ `useThemedStyles(makeStyles)` hook + `ThemeContext` resolving
  light/dark; Settings toggle live. ("system" → light until the sweep completes.)
- **1c · Flagship wave** — ✅ Home, Dossier, Situation, Curator converted & verified in dark.
- **1d · Core wave** — ✅ Concierge, Ledger, Plan, Trips, Settings. **Every screen you
  navigate day-to-day now flips light↔dark.** (Lesson banked: sub-components defined after
  the main one — and arrow components — also need the hook; that's what crashed Plan.)
- **1e–1f · Long tail** — ✅ DONE. All 34 remaining screens converted via a
  formatting-preserving codemod; 43/43 screen files themed, 0 `StyleSheet.create` left.
  Hook-safety validator + orphan scan passed (and caught two *pre-existing* latent crashes
  — `EmptyState`/`HeadlineText` used `s` with no hook — now fixed). Residual: 53 inline
  accent hex on low-traffic screens that don't flip (polish, see `ATELIER_QA.md`).
- **1g · Auto + polish** — ✅ DONE. `"system"` now follows the device appearance (which
  honours the OS night schedule) instead of the phased-conversion pin to light; Settings
  "Auto" is live. The in-transit Night card reconciled: the near-black NIGHT skin is
  light-mode-only (it only pops against cream), while the "IN THE AIR" eyebrow + bronze
  carry the state in dark mode, where the card uses the already-dark themed palette instead
  of dark-on-dark mud. Contrast re-audit of `C_DARK` done in Epic 5.

## Epic 2 · The Operator (proactive day-of, not just a card)  ✅ SHIPPED (server)

The Arrival Concierge proved the chain. Now it *acts on its own*, within the rails:

- **O1 · `pollArrivals()`** ✅ — every 10 min, lands→next in-person meeting→leave-by→
  one-tap car nudge, fired when the door time is imminent.
- **O2 · Delay re-runs the leave-by** ✅ — on Delayed, `arrives_at` is shifted to the new
  estimated landing (`estimatedArrival` now returned by both status sources; falls back to
  +delay), and the `arrival_plan` dedup is cleared so the next `pollArrivals()` recomputes
  and re-pushes the updated door time + car timing.
- **O3 · Propose the reroute before she asks** ✅ — `createDisruptionDecision` already fires
  on Cancelled/Delayed: a decision card with same-cabin alternatives *ranked by arrival*,
  recommended option, and an actionable push (Approve / Not now from the lock screen).
- **O4 · Right-moment prep** ✅ — car at the curb on Landed (`dispatchUberOnLanding`, by trip
  mode) + new `pollCheckins()`: a hotel check-in nudge fired on actual arrival (inbound
  landed, or drive-trip check-in imminent), offering early check-in — never acting.
- All surfaced proactively; all money still hold-then-confirm. (Bags / tight-connection
  watch deferred — no live feeds yet; Epic 4.)

## Epic 3 · Ask Wingman that *acts*  ✅ SHIPPED

Today it advised. Now, when the person clearly asks to DO the thing, it hands them a
one-tap authorisation wired to the real booking machinery:

- **E3-1 · The act tool (server)** ✅ — `converse()` gained an `act` tool the model calls
  ONLY on execute-intent ("book it", "re-route me", "change my hotel", "hold that"). It
  proposes ONE concrete action (`rebook_flight` / `change_stay` / `hold_flight` /
  `hold_stay`) with a plain-words summary — never a fare, flight number, or PNR
  (`normalizeAction()` strips any the model smuggles; 7/7 unit tests). `/plan/message`
  resolves the leg it points at and returns the proposal + a route hint.
- **E3-2 · ActionCard (app)** ✅ — Ask Wingman renders the proposal as a bronze-edged card:
  one tap opens the *existing* confirm-gated flow (BookLeg / Rescue / FlightSearch /
  StayBook), pre-pointed at the leg or stay. The money confirm still lives one screen
  deeper — the card explicitly says nothing is charged by the tap.
- **Rails held**: no autonomous spend, the model can't state a price, and every real
  charge still passes the existing confirm gate + ledger. One tap to *start*, never to buy.

## Epic 4 · Real data & connectors (as they become available)  ◑ SEAM SHIPPED

Registry recon (2026-07): the only relevant real feed is an **Uber estimate** connector
(price + ETA, *no dispatch* — which happens to fit the no-autonomous-spend rail). There is
still **no** server-callable security-wait, terminal-map, or ground-transit feed. So the
honest state is: fallbacks stay, but the wiring is now ready.

- **`providers.js` seam** ✅ — one module resolves ride / security / terminal, each tagged
  with a `source` the UI can badge honestly: `live` / `estimate` / `link` / `none`. Today
  everything returns `link` (deep-link + authoritative source), exactly as before. The
  `/arrival` block now flows through it. 9/9 fallback + labelling tests.
- **Drop-in ready** ✅ — an env-gated `UBER_ESTIMATE_TOKEN` slot attaches a real Uber
  price/ETA to the ride (still a tap to order, never auto); guarded so an unconfigured prod
  can't reach the network. Security/terminal have the same documented slot.
- **Suggested to the user** ✅ — the Uber estimate connector, for live estimates in Cowork.
- **Drop-in fetchers written** ✅ — `securityInfo` and `terminalMap` now resolve a real
  feed when an env endpoint is configured (documented JSON contracts: `SECURITY_WAIT_URL`
  → `{wait_min, checkpoint?}`, `TERMINAL_MAP_URL` template with `{airport}`), badging
  `source:"live"`; unset → today's honest link, and a bad endpoint falls back gracefully.
  5/5 tests. So it's now truly key-and-go: point the env var at a feed, no code change.
- **Still blocked on access** — a real ride *dispatch* / estimate needs an Uber Rides
  **server** token; security/terminal/transit need a connectable data provider (none in the
  registry, TSA has no public API). The code is ready; this is procurement, not a build.

## Epic 5 · Atelier QA & tune  ◑ FIRST PASS DONE (device walk ongoing)

- **Code-level pass** ✅ — WCAG contrast audit of both palettes (all body/label text AA;
  `mutD` and light-gold correctly confined to large/UI use). Colour-freeze scan of the nine
  day-to-day screens: clean except Curator's dead light-locked consts + one hardcoded error
  red — **fixed** (removed, and error → `C.coral`; Curator now flips fully).
- **Device walk** — checklist lives in `ATELIER_QA.md`; tick each surface in light + dark as
  you screenshot them. The paused long-tail screens read light in dark mode by design until
  Epic 1e–1f.

---

## Sequencing

1. ~~Epic 1 — dark mode, whole app + system-auto~~ ✅ COMPLETE (1b–1g).
2. ~~Epic 2 — the proactive Operator~~ ✅ SHIPPED (server).
3. ~~Epic 3 — Ask Wingman that acts~~ ✅ SHIPPED (server + app).
4. ~~Epic 4 — real-data connector seam~~ ◑ SEAM SHIPPED; real feeds as they connect.
5. **Epic 5** — Atelier QA: code-level pass done; device walk ongoing (`ATELIER_QA.md`).

---

## Where we are (2026-07)

All five epics of v3 are built. Shipped and live: Atelier v2 (identity + Fraunces +
palette), the Arrival Concierge, present-moment Ask Wingman, **dark mode across the entire
app with system-auto**, the proactive **Operator** (Epic 2), the **acting concierge**
(Epic 3), and the real-data **provider seam** (Epic 4, ready for feeds as they connect).

**What's genuinely left:** only the *ongoing* disciplines — Epic 5's device walk (screenshot
each surface in light + dark, `ATELIER_QA.md`), the 53 inline accent hex on low-traffic
screens as a polish pass, and Epic 4's real feeds the moment a rideshare/security/transit
connector becomes available. The build roadmap is complete.
