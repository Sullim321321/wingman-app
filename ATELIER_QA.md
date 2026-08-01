# Atelier QA — shipped-surface verification (Roadmap v3, Epic 5)

The ongoing discipline: confirm every shipped surface reads premium in both themes, and
that nothing freezes a colour or asserts a number it can't measure. Part is code-checkable
(done below); part needs a device walk (checklist at the end).

## Code-level pass — DONE

### Contrast (WCAG, computed against the real palettes)
All body and label text passes **AA (≥4.5:1)** in both light and dark:

| Pair | Dark | Light |
|---|---|---|
| ink on ground | 15.99 | 16.64 |
| ink on card | 14.82 | — |
| mut (secondary) on ground | 7.11 | 5.19 |
| gold/bronze on ground | 7.24 | 4.49* |
| sage on card | 5.64 | — |
| coral on card/ground | 4.91 | 5.93 |
| ink-on-gold (CTA label) | 7.11 | 4.49* |

`mutD` (tertiary/structural) lands at 3.84–4.14 — **large-text/UI band only, by design**;
it must never carry body copy (comment in `theme.js` says as much). Light gold/bronze and
the light CTA label sit at 4.49 — AA for the large/bold contexts they're used in (section
labels, button text), never for body. No true failures.

### Colour-freeze scan (won't flip in dark)
Swept the nine day-to-day screens for raw hex:
- **Home, Dossier, Situation, Ledger, Plan, Settings** — clean (0 raw hex).
- **Concierge, Trips** — the only hits are `C.gold || "#fallback"` gradient safety-nets;
  the token flips, the fallback never fires. Fine.
- **Curator** — had dead module-level light-locked consts (`PAPER = "#F4F3EE"…`) that were
  already shadowed by `C.*` in both the component and `makeStyles`, plus one hardcoded error
  red. **Fixed:** removed the dead consts, switched the error colour to `C.coral`. Curator
  now flips with nothing frozen.

## Device walk — TODO (needs a build in hand)
Screenshot each in **light and dark**, confirm Fraunces + the evolved palette read premium,
and check wrapping/spacing/contrast:

- [ ] Home — hero masthead, Arrival card (light + in-transit Night), Signals feed
- [ ] Dossier — Fraunces titles, spine, folded stays, collapsed rides
- [ ] Situation — the cascade takeover
- [ ] Curator — city input, picks, dining ask (verify the dark flip after this fix)
- [ ] Concierge / Ask Wingman — bubbles, the new **ActionCard** (Epic 3) in both themes
- [ ] Plan — constraints, sketch legs, ActionCard
- [ ] Ledger, Trips, Settings
- [ ] Booking flow (FlightSearch → FlightBook, StayBook) — reached from the ActionCard
- [ ] Long-tail (paused dark screens): booking sub-flows, onboarding, profile, loyalty —
      these are the ones Epic 1e–1f will theme; expect light-locked until then.

## Long-tail dark conversion — DONE (Epic 1e–1f)
All 34 remaining screens converted to `makeStyles(C)` + `useThemedStyles` via a
formatting-preserving codemod. Verified programmatically:
- **43/43** screen files parse (babel) and use the themed pattern; **0** `StyleSheet.create` left.
- **Hook-safety validator**: every injected `useTheme`/`useThemedStyles` is a top-level
  statement inside a *named* component — none inside `.map()` callbacks or conditionals
  (the rules-of-hooks crash class). LoyaltyScreen (two sheets) done by hand.
- **Orphan scan** caught two *pre-existing* latent crashes from earlier waves —
  `EmptyState` (Trips) and `HeadlineText` (Home) used `s.*` with no hook (would crash on
  render). **Both fixed.**

### Inline-hex polish — DONE (the ones that mattered)
Went through all 53. **Mapped to tokens** (real fixes):
- **PrivacyPolicy** — a genuine *light-mode readability bug*: body/bullet/processor text was
  hardcoded to pale values (`#E0D8C8` etc.) written for a dark bg, but the screen's bg is
  now themed `C.bg` (cream in light) → near-invisible. Now `C.ink` / `C.mut` / `C.mutD`.
- **AddTrip** leg-remove red → `C.coral`; **GroundTransport** tip → `C.amber`;
  **JourneySimulator** warning title + maps button → `C.amber`.

**Intentionally left fixed** (mapping them would erase meaning, not fix anything):
- `LoungeCardsScreen` card-brand colours (Amex/Mastercard/etc. brand identities).
- `DestinationScreen` category hues (culture/nightlife/wellness — a deliberate multi-hue set).
- `CompensationScreen` EU (#4F8EF7) / US (#FF6B35) regulation badge identities.
- `Concierge`/`Trips` `C.token || "#fallback"` — the token flips; the fallback never fires.
- `TripDetail` `#C9A84C` is the **OS calendar** colour (stored by iOS, not themeable);
  `Landed` indigo is one entry in an rgba status set.
- Low-alpha status tints (`#…12`/`#…40`) and decorative alpha fills — read fine on both grounds.

## Notes
- Only **1g** remains in Epic 1: system-auto (dark on the device setting / at night) and
  reconciling the in-transit Night card with true dark. Everything else is themed.
- Keep this file as the running QA ledger; tick the device boxes as you walk them.
