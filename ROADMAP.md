# Wingman — Roadmap

_Living document. One ranked list, not three parallel ones._
_Last edited: 15 Jul 2026._

## Scoreboard (15 Jul)

Of the 24 items below: **4 BUILT today**, **1 WIP** (the real trip, happening now),
**2 partial**, **17 not started** — and the 6 craft items at the bottom are deliberately
last. But the number that matters isn't "17 left." It's that **almost nothing is
`VERIFIED`**: the whole app has been built against fixtures, and the one real-trip test
is running for the first time today. The forwarded-email result is the single most
informative thing on this page.

Also shipped today, none of it on the list this morning — because using it on a real
trip found them: the planner had no clock (asked what weekday the 16th was); it did
calendar arithmetic and got it wrong (recorded a Friday as "Thursday"); it inflated
every fact to MUST; it held two contradictory dates with no way to correct either; and
booking would have faked a ticket on a Duffel **test** key. Each of those is a fresh
instance of the one bug, caught the only way it can be — by a real trip, not a test I wrote.

---

## v2 closeout (15 Jul, afternoon)

Built and verified-by-compile since the morning:
- **#6 five tabs → three.** Home · Plan · Trips. Signals folded into Home; the Ledger moved to the masthead (◆). Nav audit clean, nothing orphaned.
- **#7 Situation leads with "I've already handled."** The autonomous decisions on this trip now render at the top of the cascade — the work shown as done before you see the damage. Empty when there's nothing, never invented.
- (morning) #1 env vars, #3 theme sweep, #5 Ledger, plus the five off-list planner/booking fixes.

**Consciously NOT done, and why — because faking "done" is the one banned move:**
- **#10 verify push on device, #2 real trip** — these can only be done by *you*, on hardware, with a real trip. I can't verify them from here; claiming so would be the exact lie the project forbids.
- **#19–24 craft** (wordmark, icon set, photography, App Store assets) — these need design artifacts and human judgment, not code. Writing a placeholder and calling it done would be worse than leaving it open.
- **#4/#15/#16/#17 (elevation, mono, italic, empty-state passes)** — these are *review passes* that need eyes on the running app to do well. Doing them blind produces plausible-looking diffs that miss the actual offenders. They move once you're looking at v2 on the phone.
- **#11–14 (Dossier, Settings collapse, Rescue undo, post-trip loop)** — real, buildable, but each is a screen's worth of work that deserves its own focused pass, not a rushed batch. They lead v3.

---

## How to use this

**One list, ranked.** UI / UX / DESIGN are tags, not sections. Three parallel top-tens is thirty items and no answer to "what do I do Monday" — the ordering *is* the work.

**Status has four values, and one of them is load-bearing:**

- `TODO` — not started.
- `WIP` — in progress.
- `BUILT` — the code exists and compiles.
- `VERIFIED` — **someone watched it work on real data.**

`BUILT` is not `DONE`. This project has shipped a delay monitor that was `BUILT` for months and had never once fired, because the identifier it looked flights up with was malformed and the 404 was read as calm. **Nothing moves to `VERIFIED` because it was written. It moves because it was watched.**

**Every item names its evidence** — the thing you'd have to see to believe it works. If an item can't name one, it isn't ready to be worked on.

---

## P0 — this week

### 1. Set the Render env vars · `BUILT` ✓ · UX
`INBOUND_WEBHOOK_SECRET` (**fresh** — the one we generated appeared in a screenshot and is burned) and `INBOUND_DOMAIN=inbox.wingmantravel.app`.
**Why now:** five minutes, and until it's set the inbound email path is either rejecting everything or accepting anything. We cannot tell which from here, and "cannot tell which" is the condition this whole project exists to eliminate.
**Evidence:** forward a real booking email; watch it become a trip.

### 2. Plan and book a real trip · `WIP` ⟳ · UX
The spine — Plan → Book → Protect — has only ever run against fixtures I wrote myself.
**Why now:** a test against your own fiction proves the code does what you already believed, and nothing else. That is the failure mode behind *every* serious bug in this project. The monitor works for the first time in the app's life. Use it.
**Evidence:** a leg you actually fly, planned in the app, booked through it, watched by it. The booking confirmation should say *"still holding up N things you told me mattered"* — that's the proposal keeping its reasons.

### 3. Theme sweep: `C.gold` → `C.action` · `BUILT` ✓ · DESIGN
42 screens call `C.gold` for buttons and icons. Gold is now a hairline, not an affordance.
**Why now:** the theme is a half-migration — new palette, old jobs. The app currently looks like a mistake rather than a decision, and you can't judge the identity until this lands.
**Evidence:** no brass buttons anywhere. Cream is the only affordance colour.

### 4. Three elevation planes on every card · `PARTIAL` · DESIGN
`SHADOW.soft` + `litEdge` on resting cards; `SHADOW.sheet` on the one thing that needs you.
**Why:** depth was one of the two things you named. Elevation must *mean* urgency — the most important object on screen is literally closest to the thumb. Right now most cards are flat rectangles with a border.
**Evidence:** hold the phone. Does the alarm feel closer than the ledger?

---

## P1 — next

### 5. Build the Ledger; delete Insights · `BUILT` ✓ · UI
**The single biggest unrealised asset in the codebase.** The `deliberations` table already stores every decision Wingman made, why it made it, and *what it was protecting*. **Nothing renders it.** Meanwhile Insights shows accept rates and trend charts — the vanity metrics v1 explicitly said should die.
The proof that this product works is one screen away, and we are showing a bar chart instead.
**Evidence:** a real rescue appears in the ledger with the constraint it defended.

### 6. Five tabs → three · `TODO` · UI
**Brief · Plan · Trips.** Chat floats. Settings behind the avatar.
**Why:** the product has three verbs. Signals and Insights are both *look at things* tabs that never ask you to do anything — and a second inbox is a second place to miss something. Home already answers "what needs me" better than Signals does.
**Evidence:** nothing is unreachable afterwards. Run the navigation audit.

### 7. Situation opens with what Wingman already did · `TODO` · UI
The deck's promise is that the work is done *before* you arrive. The screen currently opens with the damage.
**Evidence:** a real delay where Wingman moved something on its own, and the screen leads with it.

### 8. Booking gaps surface in Plan, not at checkout · `PARTIAL` (gaps now tappable chips) · UX
`readiness()` already knows what's missing — the date, the origin, the passport name. Those are conversation questions, not a wall at the moment you try to buy.
**Evidence:** the planner asks for your passport name in the chat, once, and never again.

### 9. The Delegation Dial, in English, in onboarding · `TODO` · UX
The dial is meaningless. The panel underneath is the product: *rebook under $500 → I just do it. Cancelling a booking → I wake you.*
**Evidence:** you can read your own autonomy setting as a sentence.

### 10. Verify push → Situation on device · `TODO` · UX
Rewired today: every disruption notification now routes to Situation. Untested on hardware.
**Why it's here and not lower:** the failure mode is *silence*. It looks identical to nothing having gone wrong. (Exactly what we found in the API today: three push routes pointed at a screen named `"Activity"` that has never existed.)
**Evidence:** fire the delay simulator, tap the push, land on the cascade.

---

## P2 — then

### 11. The Trip Dossier · `TODO` · UI
Trip detail becomes one document — **Plan · Prepare · In motion · After** — with *"depends on JL 623, 40 minutes of slack"* under every booking that hangs off a flight. The graph already computes this. No other travel app can.

### 12. Collapse the Settings archipelago · `TODO` · UI
Seven screens for "who I am and what you may do." Should be two.

### 13. Rescue: one tap, and a way back · `TODO` · UI
*"Reversible for 30 minutes. Every action is logged."* The undo window exists in the decision spine; it isn't wired to Rescue.

### 14. The post-trip loop · `TODO` · UX
Trip ends → Wingman proposes what it learned → you confirm or correct. The only mechanism that makes year two better than year one.

### 15. Enforce the mono rule · `TODO` · DESIGN
IBM Plex Mono is reserved for numbers the system **measured**. Audit every number the app renders: *could this be wrong?* If yes, it doesn't get mono. This is the honesty architecture made visible, and it only works if it is never violated.

### 16. Italic carries every reason · `TODO` · DESIGN
Source Serif italic wherever Wingman explains itself. A distinct register for the system justifying itself is worth more than any colour.

### 17. Honest empty states · `TODO` · UI
"No trips yet" and "I couldn't reach the server" are different facts. Rendering them identically is the same class of bug as the dark monitor.

### 18. Delete the remaining orphans · `TODO` · UI
`PlanDone`, `AirportDining` — registered, unreachable. `Destination`, `GroundTransport`, `LoungeCards` — the concierge answers these in one sentence better than a screen does in a hundred lines.

---

## P3 — craft (deliberately last)

An icon set on a product whose spine is untested is a beautiful thing wrapped around a guess.

- **19.** A real wordmark. The `W` is a letter in a box — a placeholder, not an identity. · DESIGN
- **20.** Replace the Unicode tab icons (`⌂ ✦ ✈ ◎ ◇`). They render inconsistently across iOS versions and they are not a system. · DESIGN
- **21.** Decide about photography. City-derived images are fine for Kyoto and fatal for Cleveland. Curate, or drop imagery and let type carry it — but don't leave it to chance. · DESIGN
- **22.** Scale contrast: 10px tracked label above a 34px serif headline. `TR` encodes it; the screens don't use it. · DESIGN
- **23.** App icon, App Store screenshots, preview video — in the new identity. · DESIGN
- **24.** Google OAuth. **Recommendation: do not file for `gmail.readonly`.** It's a RESTRICTED scope → mandatory annual CASA assessment ($500–$5,000+, every 12 months). The forwarding path does the same job with zero Google scopes.

---

## Done

`VERIFIED` means someone watched it work.

| Item | Status | Note |
|---|---|---|
| Home is the Brief | `BUILT` | Chat removed; one persistent thread behind a floating icon. Not yet seen on device. |
| Situation — the cascade | `BUILT` | Graph-walked, three honest verdicts. Never fired on a real delay. |
| Rescue — ranked by what it protects | `BUILT` | Price is a tiebreak. Refuses to recommend when it can't stand behind the answer. |
| The constraint graph | `VERIFIED` | 26 tests. Survived the hardness-laundering and scope bugs. |
| The planner (Plan tab) | `VERIFIED` | 13/17 on the real Asia transcript. Caught lying about LANY dates; fixed. |
| Booking — promote in place | `BUILT` | 19 tests. **Never executed against real money.** |
| Flight identity (`flightid.js`) | `VERIFIED` | UA1 returned a live gate. The monitor has a pulse for the first time. |
| Standing constraints → Settings | `BUILT` | With provenance. "You told me" vs "I worked it out." |
| 52 screens → 42 | `BUILT` | Four disruption surfaces became one. |
| The Family Office theme | `BUILT` | Tokens only. **Semantics not swept — see P0.3.** |

---

## v3 — the next 30

Ten UI, ten UX, ten DESIGN. Still one ranked idea, just tagged. Same rule as always:
each names the **evidence** you'd have to watch to believe it works, and nothing counts
as done until someone watches it on real data.

**The through-line for v3:** v2 made the app *honest and coherent*. v3 has to make it
*proven and deep* — verified on real trips, then the two screens that turn a clean app
into a chief of staff (the Dossier and the post-trip loop).

### UX — behaviour (the half that decides whether it's real)

1. **The real trip, end to end.** `WIP`. Plan → forward → watch → cascade, on a trip you fly. Everything else is theatre until this happens once. _Evidence: a delay you didn't stage fires the cascade on a flight you're on._
2. **Forwarding, verified.** `WIP`. A forwarded confirmation becomes a trip with a real flight identifier. _Evidence: the email lands, the leg appears, FlightAware starts watching it._
3. **Verify push → Situation on device.** Rewired in v2, never tapped on hardware. Failure mode is silence. _Evidence: fire the simulator, tap the push, land on the cascade._
4. **The post-trip loop.** Trip ends → Wingman proposes what it learned → you confirm or correct. The only thing that makes year two better than year one. _Evidence: after a trip, a real inference appears for you to accept._
5. **The Brief says what it did overnight.** "While you slept I moved your car — the flight shifted 40 minutes." The ledger, surfaced where it lands. _Evidence: an autonomous action shows up on the Brief the next morning._
6. **Confirm-a-constraint from the Brief, one tap.** Proposed constraints need a trip context today; they should be answerable from the briefing. _Evidence: an inferred "must" gets confirmed without opening Plan._
7. **Booking gaps surface in Plan, once.** `readiness()` knows the passport name is missing — ask in the chat, not at a checkout wall. _Evidence: it asks for your DOB in conversation and never again._
8. **Delegation dial in English, in onboarding.** *Rebook under $500 → I just do it. Cancel a booking → I wake you.* Read your autonomy as a sentence. _Evidence: you can state your own setting from memory after seeing it._
9. **The live-key booking walk.** When Duffel flips to live, the real `proposed → booked` path — with the confirmation-and-consequence dialog, on real money. _Evidence: one real leg booked through the app, reasons intact._
10. **Every autonomous action explains itself.** A push AND a ledger row, in Wingman's voice, the moment it acts alone: what it did, and what it was protecting. _Evidence: an auto-rebook produces a push you'd actually trust._

### UI — surfaces

11. **The Trip Dossier.** Trip detail → one document: Plan · Prepare · In motion · After, with "depends on JL 623, 40 min of slack" under each hanging booking. The graph already computes it. _Evidence: open a trip, see the dependency line no other app can draw._
12. **Collapse the Settings archipelago.** Seven "who I am / what you may do" screens → two. _Evidence: nav audit shows the seven gone, nothing unreachable._
13. **Rescue: one tap, and a way back.** Wire the 30-minute undo from the decision spine into Rescue. "Reversible for 30 minutes. Every action is logged." _Evidence: book a rescue, undo it inside the window._
14. **Ledger detail.** Tap a decision → the full deliberation, the options it weighed, and undo if still in the window. _Evidence: a ledger row opens into the reasoning behind it._
15. **Signals feed on Home.** Folded Signals into Home in v2 — now actually render the attention feed inline under the brief, not just the tab removal. _Evidence: a dismissed-import and a live signal both appear on Home._
16. **Honest empty states, everywhere.** "No trips yet" ≠ "couldn't reach the server." Same class of bug as the dark monitor. _Evidence: kill the network, see a different screen than when there's genuinely nothing._
17. **Delete the remaining orphans.** `PlanDone`, `AirportDining`, `LoungeCards`, `Destination`, `GroundTransport` — the concierge answers these in a sentence. _Evidence: screen count drops, nav audit clean._
18. **Situation → Rescue continuity.** The "handled" block and the open decisions should be one flow: what's done, what's left, one tap to the choice. _Evidence: a real cascade reads top-to-bottom as done → tight → your call._
19. **Trips as dossiers, not a list.** Group by in-motion / upcoming / past with the dependency-aware summary, not a flat chronological feed. _Evidence: an active trip surfaces its fragile leg without tapping in._
20. **The masthead is the command bar.** Ledger (◆) landed there in v2; give it siblings — a real menu behind the avatar, not a jump straight to Settings. _Evidence: Ledger, Signals, Settings all reachable from one considered surface._

### DESIGN — identity

21. **A real wordmark.** The `W` is a letter in a box. A family office IS its monogram. _Evidence: it reads as a mark, not a glyph, at 16px and at 120px._
22. **A custom icon set.** Replace the Unicode tab glyphs (`⌂ ✦ ✈`) — they render differently across iOS versions and aren't a system. _Evidence: same weight, same grid, no OS substitution._
23. **Decide photography.** City-derived images are fine for Kyoto, fatal for Cleveland. Curate a set, or drop imagery and let type carry it. Don't leave it to a bad stock photo. _Evidence: no trip ever renders a wrong or ugly image._
24. **Verify the light theme.** v2 built a full LIGHT palette (cream ground, ink accent) that no one has ever seen. It could be entirely broken. _Evidence: flip to Light on device; every screen holds, no invisible buttons._
25. **Three-plane elevation, swept.** `SHADOW.soft` + `litEdge` on every resting card, `SHADOW.sheet` on the one that needs you — done properly, screen by screen, with eyes on it. _Evidence: hold the phone; the alarm sits closer than the ledger._
26. **Enforce the mono rule.** Audit every number the app renders: could it be wrong? If yes, it doesn't get mono. The honesty architecture made visible. _Evidence: no estimated or guessed number appears in IBM Plex Mono._
27. **Italic carries every reason.** Source Serif italic wherever Wingman explains itself, consistently. _Evidence: reasons read in one register app-wide, distinct from interface text._
28. **Motion in the new identity.** The entrance animations were tuned to the old palette and pace. Re-time them to the editorial feel — slower, fewer, heavier. _Evidence: transitions feel like paper turning, not a web app._
29. **The app icon.** In the Family Office identity. First thing anyone sees. _Evidence: it sits on a home screen next to Amex and Aman and belongs._
30. **App Store craft.** Screenshots and preview in the new identity — rendered from the real app, not mockups. _Evidence: the store page looks like the product, because it is the product._

---

## Dead — decided against

- **Points, tiers, streaks, badges.** Gone, and not coming back.
- **Vanity metrics** ("46 trips protected," "100% accept rate"). The Ledger replaces them with things that are true.
- **The Signals feed as a stream of imports.** Nobody wants a changelog of their own inbox.
- **`gmail.readonly`.** See item 24.
- **Espresso / champagne / parchment / Playfair.** The v1 identity. Retired 14 Jul.

---

## The rule

Every failure this project has produced is one failure wearing different clothes: **the system reported confidently on evidence it never checked.**

The 266-night stay. The New York mega-trip. "46 trips protected." The backfill that printed 0-of-0 as a pass. The eval that graded the wrong row. The test stub that answered questions nobody asked. The `sourced` badge that laundered a wrong fact into a verified one. The booking endpoint that charged a card and then threw. And the monitor that polled a malformed identifier for months, got a 404 every time, and called it calm.

**When this system reports success, the first question is whether the check could have failed. If it couldn't, the green light means nothing.**

That is why `BUILT` and `VERIFIED` are different words in this document, and why moving between them requires a person watching.
