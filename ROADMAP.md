# Wingman — Roadmap

_Living document. One ranked list, not three parallel ones._
_Last edited: 14 Jul 2026._

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

### 1. Set the Render env vars · `TODO` · UX
`INBOUND_WEBHOOK_SECRET` (**fresh** — the one we generated appeared in a screenshot and is burned) and `INBOUND_DOMAIN=inbox.wingmantravel.app`.
**Why now:** five minutes, and until it's set the inbound email path is either rejecting everything or accepting anything. We cannot tell which from here, and "cannot tell which" is the condition this whole project exists to eliminate.
**Evidence:** forward a real booking email; watch it become a trip.

### 2. Plan and book a real trip · `TODO` · UX
The spine — Plan → Book → Protect — has only ever run against fixtures I wrote myself.
**Why now:** a test against your own fiction proves the code does what you already believed, and nothing else. That is the failure mode behind *every* serious bug in this project. The monitor works for the first time in the app's life. Use it.
**Evidence:** a leg you actually fly, planned in the app, booked through it, watched by it. The booking confirmation should say *"still holding up N things you told me mattered"* — that's the proposal keeping its reasons.

### 3. Theme sweep: `C.gold` → `C.action` · `TODO` · DESIGN
42 screens call `C.gold` for buttons and icons. Gold is now a hairline, not an affordance.
**Why now:** the theme is a half-migration — new palette, old jobs. The app currently looks like a mistake rather than a decision, and you can't judge the identity until this lands.
**Evidence:** no brass buttons anywhere. Cream is the only affordance colour.

### 4. Three elevation planes on every card · `TODO` · DESIGN
`SHADOW.soft` + `litEdge` on resting cards; `SHADOW.sheet` on the one thing that needs you.
**Why:** depth was one of the two things you named. Elevation must *mean* urgency — the most important object on screen is literally closest to the thumb. Right now most cards are flat rectangles with a border.
**Evidence:** hold the phone. Does the alarm feel closer than the ledger?

---

## P1 — next

### 5. Build the Ledger; delete Insights · `TODO` · UI
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

### 8. Booking gaps surface in Plan, not at checkout · `TODO` · UX
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
