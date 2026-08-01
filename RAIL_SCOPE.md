# Multi-modal rail — scope

*Epic E candidate. Turns "a travel office" into one that covers how people actually
move, not just fly. High leverage for European and Northeast-Corridor travelers.
Bigger than a single expense slice — scope carefully, ship in a trustworthy wave.*

---

## Where we actually are (grounded in the code, not the aspiration)

Rail is **half-built and dormant**, not absent. The plumbing exists; the spine ignores it.

**Already there**
- **Schema:** `trip_legs.station_from` / `station_to` columns exist (21 refs).
- **Planner:** already emits `type:"train"` legs — an honest rail suggestion is possible today.
- **Live status:** `getTrainStatus(from, to, departsAt)` is fully built — National Rail
  **Darwin (OpenLDBWS)** with a **Huxley2** fallback — and wired to `GET /trains/status`.
- **Ingestion:** Gmail search already pulls the rail operators — Amtrak, Trainline, Avanti,
  ScotRail, South Western, National Rail.
- **Data hygiene:** `flightid.js` knows Amtrak isn't a flight; `document.js` and `regroup.js`
  already treat `train`/`ferry` as transport for the spine and grouping.

**The gap — three specific failures**
1. **No proactive watching.** `getTrainStatus` is called *only* by the on-demand endpoint.
   **No poller calls it.** A cancelled train generates no push, no leave-by, no cascade.
2. **The spine is hard-wired to flights.** `type = 'flight'` appears **~48×** in `server.js`
   across `pollDisruptions` / `pollArrivals` / `pollCheckins`, the arrival plan, the cascade,
   the pre-departure cron, and the "watchable" metrics. Every one of them skips a train leg.
3. **The UI speaks air-only.** **~40** `'flight'` references across the app (TripDetail, Home,
   Dossier, AddTrip, Concierge) → it says *gate / terminal / flight*, never *platform /
   station / train*. And live feeds exist for the **UK only** — Amtrak et al. are unread.

So a rail leg imports and renders as a generic row, but gets no delay watching, no day-of
leave-by, no "your train is cancelled" cascade.

---

## The leap, in three layers

1. **Generalize the spine** from the literal `'flight'` to a **transport leg with a `mode`**
   (`air` | `rail`, later `coach`/`ferry`). One predicate the whole spine keys on.
2. **A status provider per network** behind the same seam as Epic F — Darwin/Huxley for the
   UK (live now), Amtrak and others env-gated and honest-null until connectable.
3. **Mode-aware UI** — station not gate, platform not terminal, "train" not "flight".

---

## Build-ready slices (test-first, one keystone then verified waves)

### R1 · The seam — `transport.js` (pure, tested) ← ✅ DONE
One source of truth for "what is a movement leg, and how do we speak about it." Mirrors the
`arrival.js` / `briefguard.js` pattern: pure, dependency-light, tested, referenced everywhere
so tests and prod can't drift. Shipped:
- `MODE_OF_TYPE` — `flight→air`, `train→rail` (ferry/coach reserved, deliberately unwatched).
- `modeOf` / `isTransportLeg` / `endpointsOf` / `hasEndpoints` — resolve mode and both journey
  ends from either field pair (air: origin/destination; rail: station_from/station_to, with
  fallback so a mixed row still resolves).
- `isWatchable(leg)` — the mode-generalized sibling of `briefguard.isBriefableLeg`: watchable
  mode + both endpoints + a real (non-epoch) departure + time not running backwards. Reuses
  `briefguard.isRealTime` so a train is held to the same sanity as a flight.
- `vocab(mode)` — the single dictionary the UI/copy read from: `{ hub: airport|station,
  node: gate|platform, terminal: terminal|null, vehicle: flight|train, verb, … }`. Unknown
  mode → air (safe default).
- `displayName(leg)` — air delegates to `flightid`; rail names operator + service ("LNER 1E12")
  or falls back to the route.
- **`test-transport.js` — 25/25.** Full API sweep still green (briefguard 25, provenance 16,
  arrival 30, hygiene 9, flightid 13). **Zero behaviour change** — vocabulary only, as intended.

### R2 + R3 · The UK+Amtrak watch vertical (fused) ← ✅ DONE (shipped dark, flag OFF)
Built as one vertical rather than a 48-callsite horizontal sweep — a single train journey
carried end to end through brief → watch → cascade → leave-by, behind a `RAIL_SPINE` flag
that defaults **off** so it ships dark and flips on only after the real-data readout looks
right. Delivered:
- **Flag:** `RAIL_SPINE` (env) → `RAIL_TYPES = ['flight','train']` when on, else `['flight']`.
  With it off, every query and loop is byte-for-byte the old flight behaviour.
- **`railStatus(leg)` dispatcher** (the Epic F seam): UK National Rail → Darwin/Huxley (live);
  Amtrak → only if `AMTRAK_STATUS_URL` is configured, else an honest "unknown" — and even
  with a feed, only an *explicit* recognised status is trusted, never "On Time" inferred from
  silence; unrecognised network → unwatched. **No fabricated status, ever.**
- **`pollDisruptions`** now selects `type = ANY(RAIL_TYPES)`; a train branch runs
  `isWatchable` → `railStatus` → `railNarrative` and routes a delay/cancel into the **same**
  `triggerCascadeCheck` + `arrival.retimedArrival` leave-by re-time a flight uses, spoken in
  rail vocab (platform/station/train).
- **Pre-departure briefing** broadened to `RAIL_TYPES` with mode-aware copy (station/platform,
  not gate/TSA) and endpoint guard that accepts either field pair.
- **Pure + tested:** `transport.networkOf` + `transport.railNarrative` carry all the decision
  logic (13 new tests → `test-transport.js` 38/38). Server parses; full sweep green.

### R2b · Broaden the remaining reads — ✅ DONE (the one that mattered)
Audited the long tail per-callsite. The high-value, genuinely mode-agnostic one was the
**cascade edge source**: `ensureTripEdges` gated the disruptable leg to flights, so a train
could never propagate to the hotel/meeting hanging off its arrival. Now gated to `RAIL_TYPES`
(flight + train under `RAIL_SPINE`), so a cancelled train cascades exactly as a flight does.
Deliberately left flight-only (would be churn or need station-specific logic, not a blind
broaden): `pollArrivals` leave-by (keys off `AIRPORT_COORDS` by IATA — trains need station
geocoding, a separate item), the tight-connection detector (flight-to-flight at one airport),
and the FlightAware/seat/gate paths (genuinely air-only). The activation "watchable_flight"
metric is analytics — left as-is to keep its meaning clean.

### R4 · Provider-per-network — ✅ DONE. Amtrak now LIVE.
`railStatus` dispatches by network. UK → Darwin (live). **Amtrak → the community Amtraker
feed (`api.amtraker.com/v3`), live by default** — no key needed. A pure adapter (`amtrak.js`,
21 tests) matches the leg to the running train by number + station + date and reads status
from the stop's delay comment ("45 MIN LATE") or the sched-vs-actual gap. The honesty rule is
enforced in code and tested: a not-yet-departed train (empty comment) returns **Unknown**, and
a zero time-gap is never turned into a confident "On Time" — only an explicit signal yields
Delayed / Cancelled / On Time. Config: on by default; `AMTRAK_STATUS_URL` points at a custom
feed instead; `AMTRAK_FEED=off` disables. `/metrics/rail` now reports Amtrak as live.

### R5 · Mode-aware UI vocabulary
Drive the ~40 app references off `transport.vocab(mode)` (mirrored app-side): station/platform/
train across TripDetail, Home, Dossier, AddTrip, Concierge. Verified on device.

### R6 · Ingestion confidence + backfill — ✅ DONE
Confirmed the parser writes `station_from`/`station_to`/`departs_at` for rail imports (both
insert paths). There is no leg-level `mode` column — mode is derived from `type`, so nothing
to backfill there. For legacy rows whose endpoints landed in `origin`/`destination` (or only
one pair set), added `POST /admin/backfill-rail-endpoints` (dry-run by default, `?apply=true`
to write): it normalizes both field pairs so every train leg names where it starts and ends —
the precondition for `isWatchable`. Readiness is visible without SQL via `GET /metrics/rail`
and the in-app **Settings → RAIL WATCHING** readout.

---

## Honesty guardrails (non-negotiable)
- **Never watch a network we can't read.** No feed → honest `null`, never a fake "on time."
- **Amtrak et al. stay link-only** until a live feed is connectable.
- **No autonomous rail booking** beyond the existing hold-then-confirm path.

## Sequencing & risk
- **Trustworthy MVP = R1 → R2 → R3**: a UK rail traveler gets real proactive coverage. Ship
  that wave, then broaden with R4 (networks) / R5 (UI) / R6 (ingestion).
- **Highest risk is R2** (48 callsites). Mitigation: the seam predicate + `isWatchable` guard +
  the render-safety/test gate + per-callsite review + optional `RAIL_SPINE` flag for gradual rollout.
- **Size:** larger than one expense slice. Treat R1–R3 as the first shippable wave, not a
  weekend. Don't start a second Epic-E leap alongside it.
