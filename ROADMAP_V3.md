# Wingman — Roadmap v3 · "From Guardian to Operator"

*v1 fixed the grammar. v2 (`DESIGN_ROADMAP.md`) evolved the identity — the Atelier look,
Fraunces, the evolved palette, the Arrival Concierge, the present-moment Ask Wingman. v3 is
about **doing**: dark mode done properly, and Wingman moving from something that *watches
and advises* to something that *operates the journey you're in*.*

Cadence unchanged: **review this plan, then execute in verified waves** — one push per wave,
device-checked before the next. Nothing here is a blind sweep.

---

## Epic 1 · Dark mode, done right (the one true dark)

Not a toggle — a phased refactor, because 43 screens freeze their colours at import.

- **1a · Foundation** — ✅ started. `C_DARK` (full key-for-key dark palette) is in
  `theme.js`; `ThemeContext` already carries appearance (system/dark/light) + persistence.
- **1b · The mechanism** — a `useThemedStyles(makeStyles)` hook: screens move their
  `StyleSheet.create({…C…})` into a `makeStyles(C)` factory the hook resolves against the
  *active* palette at render. One helper, memoised per theme. Additive — unconverted
  screens keep working.
- **1c · Flagship wave** — convert Home, Dossier, Curator, Situation onto the hook; wire the
  Settings toggle live; verify light↔dark on device. This is the go/no-go on the mechanism.
- **1d–1f · Sweep waves** — core screens, then booking flows, then the long tail — a wave
  per push, screenshot-verified. Tab bar + floating pill (the 2 `useTheme` consumers)
  fold in so nothing "disagrees with itself" mid-conversion.
- **1g · Auto + polish** — system-driven default (dark at night / on the device setting),
  contrast re-audit of `C_DARK`, and the in-transit Night card reconciled with true dark.

## Epic 2 · The Operator (proactive day-of, not just a card)

The Arrival Concierge proved the chain. Make it *act on its own*, within the rails:

- Gate change / delay push that **re-runs the leave-by** and updates the car timing.
- On a disruption, **propose the reroute** (existing rebooking spine) before she asks.
- The car **prepped at the right moment** (approaching the curb), not just on demand.
- Hotel check-in / late-arrival nudge; bags; the tight-connection watch.
- All surfaced proactively; all money still hold-then-confirm.

## Epic 3 · Ask Wingman that *acts*

Today it advises. Wire the concierge to the booking/hold machinery so "re-route me" or
"book it" actually **executes** — rebook a flight, change a hotel, place a refundable hold —
through the existing confirm gate and ledger. No autonomous spend; one tap to authorise.

## Epic 4 · Real data & connectors (as they become available)

The registry has no rideshare / security / airport feeds today. Replace deep-links and
labelled estimates with real integrations the moment they're connectable: Uber/Lyft API
(auto-order instead of a link), live security waits, terminal maps, ground transit.

## Epic 5 · Atelier QA & tune

The ongoing verification pass: walk every shipped surface on device, confirm Fraunces +
the evolved palette read premium, fix wrapping/spacing/contrast from screenshots. Not a
build so much as the discipline that keeps the bar.

---

## Sequencing

1. **Epic 1b–1c** — the dark-mode mechanism + flagship wave (the highest-demand thing,
   and it gates the rest of dark mode).
2. **Epic 5** in parallel — QA the already-shipped Atelier surfaces as we go.
3. **Epic 1d–1g** — finish the dark sweep in waves.
4. **Epic 3** — make Ask Wingman act (biggest product leap after dark mode).
5. **Epic 2** — proactive Operator on top of the acting concierge.
6. **Epic 4** — connectors as they land.

---

## What I need from you

Confirm the epic order (or reshuffle), and I start **Epic 1b** — the `useThemedStyles`
mechanism + converting Home as the first flagship — then verify light↔dark on device
before sweeping. Dark mode is real work done safely, not a switch flipped blind.
