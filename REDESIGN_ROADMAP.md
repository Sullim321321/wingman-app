# Wingman — Complete Redesign

*Built against the Pre-Seed Deck, July 2026*

---

## The gap

The deck sells one thing: **Wingman resolves the disruption cascade before you know it started.**

The app ships something else: four tabs of a travel database. Trips, signals, insights, points — a well-built filing cabinet. The cascade, the thing the deck calls "the real value," is buried behind a tab called Alerts and rendered as a list item.

Slide 6 is the whole product and it isn't the centre of the app. That is the redesign.

**The thesis: the app is not a place you keep your trips. It is a thing that watches them and intervenes.** Everything below follows from that.

---

## The four pillars become the app

The deck's architecture (slide 3) is already the information architecture. Adopt it literally.

| Pillar | Deck promise | Surface | State today |
|---|---|---|---|
| **PLAN** | Ambient ingestion — reads calendar, Gmail, SMS | **Trips → the Dossier** | Ingestion works. Presentation is a database. |
| **MONITOR** | Proactive watch, auto return-leg tracking | **Home → the Brief** | Home is a dashboard of everything. Should be one sentence and one card. |
| **PROTECT** | Disruption cascade, one-tap rescue | **The Situation** (full takeover) | Exists as a screen. Is not the centre of gravity. |
| **LEARN** | Persistent memory, taste profile | **Insights → Memory & Ledger** | Was gamification. Points are now deleted. Rebuild as memory. |

Navigation stays as the deck shows it — **Home · Trips · Alerts · Insights** — but Alerts stops being a feed and becomes a decision inbox, and the Situation is a full-screen takeover that can be pushed from anywhere.

---

## The seven surfaces

Mockups are in `/redesign`. Each one is drawn in the deck's own language: espresso `#1A1714`, champagne `#C9A96E`, parchment `#F5EDD8`, Playfair Display for statement, EB Garamond italic for voice, DM Sans for chrome.

### 1. Home — the Brief
One greeting. One line telling you whether you're needed. One parchment card counting down to the only thing that matters right now, with the promise underneath it: *"Everything downstream is watched."* Then the trips being watched, quietly, with a single status each. Then a place to ask.

That is the whole screen. Everything currently on Home that isn't one of those things comes off.

### 2. The Situation — the cascade takeover
The product. A delay isn't a notification, it's an event with a dependency graph.

The screen leads with the delay, then a spine — seaplane, hotel, dinner, return leg — each node marked with what it does to *that* booking, not with a generic severity chip. Then, in teal, **what Wingman already did without asking**. Then, and only then, the one decision that still needs a human.

Two things make this luxury rather than an alarm: it opens with *"I've already worked out what this breaks"* — the work is done before you arrive — and it closes with *"Reversible for 30 minutes. Every action is logged."* Confidence plus a way back.

### 3. Rescue options
Ranked by **what they protect**, not by price. Each option says in plain English what survives and what dies. The recommended one is bordered gold. One tap.

### 4. Trip Dossier
Not cards inside cards. One document with four chapters — **Plan · Prepare · In motion · After** — and a timeline that shows *dependency*, which no other travel app does. Under each booking that hangs on a flight: *"depends on JL 623."* At the bottom, in Wingman's voice, what that actually means.

### 5. Memory & Ledger
Replaces the points screen. Two halves. What Wingman knows about you — the standing instruction, quoted, with where it's been applied. And what it has been worth — three numbers, no charts, no streaks. Explicitly: *"No streaks. No points. No badges."*

### 6. The Delegation Dial
Promoted out of Settings into onboarding. The dial itself is meaningless; what makes it work is the panel underneath translating the position into plain sentences — *rebook under $500 → I just do it. Cancelling a booking → I wake you.* You should be able to read your own autonomy setting as English.

### 7. Ambient — lock screen
Where Wingman lives most of the time. Live Activity counting down (already built, SDK 56). Morning briefing. And the one that pays for the subscription: the disruption push with **Handle it** inline, so the rescue happens without opening the app.

---

## What dies

- The Signals feed as a stream of imports. Nobody wants a changelog of their own inbox.
- Points, tiers, streaks, badges. **Done.**
- Vanity metrics ("46 trips protected," "100% accept rate"). The ledger replaces them with three true numbers.
- Trips as a chronological database. It becomes a dossier.
- Any screen that shows a fact without saying what it *means for this trip*.

---

## Sequencing

**Phase 1 — the spine (highest value, most at risk)**
Rebuild the Situation screen as a full takeover with a real dependency graph. The graph must be computed server-side and be honest: if we don't know whether the seaplane is affected, the node says *unknown*, not *at risk*. Wire the inline push actions.

**Phase 2 — collapse Home to the Brief**
Delete everything that isn't the greeting, the next-up card, and the watch list. Adaptive states (pre-trip / day-of / in-transit / post-trip) already exist — keep them, restyle them.

**Phase 3 — the Dossier**
Trip detail becomes one document. Add the dependency line under each booking. This needs the same graph as Phase 1, so it comes after.

**Phase 4 — Memory & the Dial**
Rebuild Insights around standing instructions. Promote the dial into onboarding.

**Phase 5 — craft**
App Store screenshots (which are now just these mockups, rendered from the real app), icon, preview video. Google OAuth verification remains the one hard launch blocker.

---

## The rule the redesign has to hold

Every prior failure in this app — the 266-night stay, the New York mega-trip, "46 trips protected," the false all-clear — was the same failure: **the system acted confidently on weak evidence and reported success while lying.**

A cascade graph is the most dangerous surface yet built, because it makes claims about things it hasn't observed. *"Your seaplane will be missed"* had better be true.

So: **no node on the dependency spine may assert an impact it cannot evidence.** If Wingman doesn't have the seaplane's departure time, it says so. Every one of these screens is a promise, and the invariants exist to make sure we can keep them.

*We protect what depends on them.* That has to be literally true.
