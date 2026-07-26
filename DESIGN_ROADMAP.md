# Wingman — Design Roadmap v2 · "Evolve the Identity, Polish to Premium"

*Supersedes `DESIGN_AUDIT.md` (DA-1→DA-4, all shipped). This is the next arc: take a
consistent app and make it an **ownable, distinctive, premium object** — not just tidy,
but unmistakably Wingman.*

Mode: **polish existing surfaces to a premium bar** · North star: **evolve the identity**
· Cadence: **review this plan first, then execute batch by batch** (one push per batch,
verified on device).

---

## Where this stands (2026-07-25)

**Identity — LOCKED (Batch 1 decisions):**

- **Signature:** the **Atelier Page** — a quiet dateline + folio number on a hairline
  with one bronze tick; the *headline leads* (small roman "You're in" dropping into an
  oversized italic place-name); facts on open space, not in boxes; a faint monogram
  watermark. (The literal newspaper masthead was tried and rejected as cosplay.)
- **Paper:** Alabaster `#F4F3EE` daytime · **Night (ink)** `#1B1712` reserved for
  in-transit / day-of.
- **Ink** `#17130E` · **Bronze** `#8A6A3E` (accent + folio tick, used rarely).
- **Display type:** Fraunces (italic for place-names / emphasis). Inter stays the
  interface; IBM Plex Mono stays measured values.

**Batch tracker:**

- **B1 · Decide the identity** — ✅ done (locked above).
- **B2 · Foundation** — ✅ shipped. Palette evolved app-wide (all `C.*` tokens), Fraunces
  loaded, `atelier.js` primitives (`Masthead`/`Verdict`/`EditorialStat`/`Watermark`/`Rule`)
  + `ATELIER`/`NIGHT` tokens. *Visible now: the new palette everywhere. Not yet: Fraunces
  or the Atelier layout — wired, not placed.*
- **B3 · Rebuild the flagships** — ✅ done in code. Home hero = verdict (small italic lead
  → oversized Fraunces headline) + watermark; Dossier title, ARC names, stay/leave lines on
  Fraunces; shared `ScreenTitle` on the display face. *Awaiting device verification.*
- **B4 · Sweep the surfaces** — ✅ done in code. 28 display headings across 21 screens swept
  to Fraunces (only serif styles ≥22px; body/reason prose untouched); Curator's hardcoded
  palette migrated to the evolved values (the one screen B2's tokens missed). All 67 files
  parse.
- **B5 · Night mode** — ⛔ architectural, deferred. The retheme collapsed `ThemeContext`;
  RN styles bind `C.*` at load, so a runtime day↔night switch needs dynamic theming
  reintroduced. `NIGHT` tokens are ready; the mechanism is its own focused effort — NOT a
  blind restyle.
- **B6 · Motion + imagery** — ◑ partial. Motion system already consistent (`FadeRise`
  entrance on flagships + Curator, `ConfirmSheet` the one confirm); broad entrance-motion
  on secondary forms deferred as low-value. **Imagery decision recorded:** minimal / no
  destination photography on core surfaces — type + the dossier metaphor carry it; reserve
  imagery for Explore/Curator only.
- **B7 · Accessibility & last-5%** — ✅ done. Contrast re-audited on the evolved palette and
  it *improved* everywhere (ink 16.6; mut/teal/coral/indigo clear AA; gold 4.49 and mutD
  3.88 up markedly for their label/accent roles). Reduce-motion respected; VoiceOver labels
  broad.

**Next action:** ONE verification build (B2 foundation + B3 flagships + B4 sweep, all now
in the working tree) → look at Home, Dossier, Curator, Trips, Settings on device. If the
Fraunces + evolved palette read premium, this is the single push. B5 (dynamic theming for
Night) is the remaining substantive build; the rest is tuning from screenshots.

---

## The core finding

DA-1→DA-4 fixed the *grammar*: one type ramp, one spacing scale, one component library,
one motion primitive, contrast that passes. The app is now consistent. But consistent is
the floor, not the ceiling. Right now Wingman reads as *tasteful generic* — a well-behaved
ivory/serif app. It could be any premium template.

What it lacks is a **signature**: the one or two moves a person would recognize with the
labels stripped off. Aesop has its apothecary austerity. Monocle has its tight tracked
caps and photography. Aman has its negative space and stillness. Wingman has a strong
*idea* — the private travel office, the honesty architecture, "say each fact once" — but
that idea isn't yet expressed as a look you couldn't mistake for anyone else.

This roadmap evolves the identity to match the intelligence underneath it.

---

## The four lanes

Every batch below belongs to one lane. They interleave in the sequencing, but the lanes
keep the work honest about *what kind* of change each one is.

- **STYLE** — the voice and the surface: identity, color evolution, type personality,
  copy tone, the masthead, the one signature move.
- **DESIGN** — the systems: layout archetypes, depth language, motion vocabulary,
  photography/illustration, the grid.
- **UX** — the flows: information architecture, how the honesty architecture *shows*,
  onboarding, empty/loading/error, the decision and disruption journeys.
- **UI** — the surfaces: each screen, each component, each state, accessibility, the
  last 5%.

---

## STYLE — the signature (decide first)

**S1 · The one signature move.** Pick the single element a person would recognize
Wingman by. Candidates, to choose between: (a) the *masthead* — a newspaper-grade nameplate
+ dateline treatment applied consistently as the app's "voice"; (b) the *dossier object* —
lean fully into the manila-folder / private-file metaphor as a recurring visual; (c) the
*reasons-in-italic* — make Wingman's explanations (already set in italic serif) a visible,
branded register that appears the same way everywhere. Recommendation: (c) + (a) — the
voice, made visual. **This is the decision the rest of STYLE hangs on.**

**S2 · Color evolution.** Today: ivory `#F5F2EC`, one bronze `#96754A`, sage for "known,"
coral for "won't survive." It's pleasant but soft. Evolve toward more *authority*: a deeper
ink, a more precise bronze (or a shift to a single restrained metallic), and a disciplined
rule that color appears rarely and means something. Keep the honesty semantics (sage =
measured/handled, coral = danger). Deliverable: a repointed palette with documented roles,
plus a dark "night/in-transit" variant for the day-of surfaces.

**S3 · Type personality.** Source Serif 4 (voice) + Inter (interface) + IBM Plex Mono
(measured) is a safe trio. To *evolve*, push contrast and character: a higher-contrast
display serif for the biggest moments (the verdict, the greeting), tighter tracked caps for
labels, and a decision on whether mono stays or a more distinctive measured face takes over.
Keep the three-faces / three-jobs rule.

**S4 · Copy & voice pass.** Wingman already has a strong written voice (chief-of-staff,
"say each fact once"). Codify it: a short voice guide, then a sweep so every label, empty
state, button, and error speaks in it — no leftover system-ese.

---

## DESIGN — the systems

**D1 · Layout archetypes.** Define 3–4 reusable page archetypes (the *brief*, the
*document*, the *form*, the *takeover*) so every screen is an instance of one, not a
bespoke layout. Locks rhythm and makes new screens instant.

**D2 · Depth & material language.** The three planes (raised/lifted/inverted) exist. Make
them *mean* something everywhere and add the missing "paper" texture cues that sell the
private-office feel without noise — hairlines, edges, the litEdge highlight, restrained
shadow. One material story, applied consistently.

**D3 · Motion vocabulary.** One entrance (`FadeRise` — done), one confirm, one success,
one transition between the four Dossier readings. Define the set, apply it to the primary
surfaces, and make the day-of / disruption moments feel *urgent* in a way the calm screens
never do (motion as another register held in reserve, like color).

**D4 · Photography / imagery.** Destination imagery is currently Unsplash-backed and
generic. Decide the imagery language (muted, editorial, duotone toward the palette?) or
commit to *no photography* and lean on type + the dossier metaphor. Either is valid; drift
between them is not.

---

## UX — the flows

**U1 · Information architecture review.** Re-examine the tab structure and the Home →
Dossier → Curator → Situation journeys as a whole. Confirm each surface has one clear job
and the honesty architecture (stated vs inferred, proposed vs booked) is legible at every
step.

**U2 · The honesty architecture, made visible.** The provenance work (#98) now guarantees
a sketch never wears a booking's clothes *in the data*. Make that visible in the *design*:
a consistent, quiet visual language for "this is inferred," "this is proposed," "this is
measured" — so a reader learns to trust the distinction without being told.

**U3 · Onboarding & first-run.** A premium first impression: the sub-60s value-first flow
exists; evolve it to carry the new identity from the very first screen.

**U4 · Empty / loading / error, elevated.** They're honest (DA-4); now make them *beautiful*
— the same restrained treatment, on-voice copy, no dead ends.

---

## UI — the surfaces

**I1 · Screen-by-screen premium pass.** With the archetypes (D1) and evolved tokens (S2/S3)
in place, take each primary screen to the bar: Home, Dossier, Curator, Situation, Trips,
Settings, then the booking/flight/stay flows, then the long tail. Screenshot-verified,
one batch of screens per push.

**I2 · Component library v2.** Extend `ui.js` to cover every repeated pattern the premium
pass surfaces, so screens compose and can't drift.

**I3 · Accessibility & the last 5%.** Full contrast re-audit against the *evolved* palette,
Dynamic Type behavior, reduce-motion, VoiceOver labels, and the tiny details (tap targets,
optical alignment, icon weight) that separate good from finished.

---

## Suggested sequencing

1. **Decide the identity (STYLE S1–S3).** Nothing else should move until the signature,
   palette, and type are chosen — everything downstream inherits them. *This is a set of
   decisions from you; I'll bring concrete options to react to.*
2. **Codify (S4 voice guide, D1 archetypes, D2 material).** Write the system down.
3. **Rebuild the flagships (I1: Home, Dossier, Curator, Situation).** The screens you and
   users see most, on the new identity.
4. **Sweep the long tail (I1 continued, U3, U4).**
5. **Motion + imagery (D3, D4).** The shine, once the surfaces deserve it.
6. **Accessibility & last-5% (I3).** Final pass, evolved-palette contrast re-audit.

---

## What I need from you to start

Because this is *evolve the identity*, Batch 1 is decisions, not code. Before I build I'll
bring you concrete, comparable options for:

1. **The signature move** (S1) — 2–3 mocked directions to choose between.
2. **The palette** (S2) — the current ivory/bronze beside 2 evolved directions.
3. **The display type** (S3) — the current serif beside 1–2 higher-contrast alternatives.

Approve a direction on each and the rest of the roadmap executes against it, one verified
batch per push — the way we closed out v1.

---

*The test for every change here is higher than v1's: not "is it consistent?" but "would
someone recognize this as Wingman with the logo removed?" If not, it's polish, not identity.*
