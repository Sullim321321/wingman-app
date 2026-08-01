// timewindows.js — ONE source of truth for "what phase is this flight, relative to now".
//
// The over-eager-surface bug class (Roadmap v4, A3): the arrival card fired 15h early and
// the day-of panel fired for a next-day flight, because every surface invented its own
// threshold — 30m here, 18h there, 4h on the server. When those numbers drift apart, two
// surfaces disagree about what "now" is and the app contradicts itself. So the windows
// live here, named once, and `flightPhase()` is the single predicate every surface uses.
//
// Pure and dependency-free on purpose, so it's unit-testable in plain node.

export const WINDOWS = {
  inAirGraceMs:        30 * 60000,     // still "in the air" for 30m past scheduled arrival
  noArrivalFallbackMs:  3 * 3600000,   // assume a 3h flight when arrives_at is missing
  dayOfMs:             18 * 3600000,   // "day of" opens 18h before departure
  boardingMs:           4 * 3600000,   // "heading to the airport" — the arrival surface window
  justLandedMs:        48 * 3600000,   // post-trip debrief stays available 48h after landing
  preTripMaxDays:      14,             // anticipatory prep looks out at most two weeks
};

// The canonical phase. Every state-gated surface should derive from this rather than
// hand-rolling a comparison — that's what keeps them from disagreeing.
//   "in_air"   — departed, not yet landed (+grace)
//   "boarding" — before departure, inside the head-to-the-airport window (≤4h)
//   "day_of"   — before departure, same-day-ish (≤18h) but outside boarding
//   "pre_trip" — before departure, further out
//   "landed"   — arrived within the last 48h
//   "past"     — arrived more than 48h ago
//   null       — not a dated flight leg
export function flightPhase(leg, nowMs = Date.now()) {
  if (!leg || leg.type !== "flight" || !leg.departs_at) return null;
  const dep = new Date(leg.departs_at).getTime();
  if (isNaN(dep)) return null;
  const arr = leg.arrives_at ? new Date(leg.arrives_at).getTime() : dep + WINDOWS.noArrivalFallbackMs;

  if (nowMs >= dep && nowMs <= arr + WINDOWS.inAirGraceMs) return "in_air";
  if (nowMs < dep) {
    const untilDep = dep - nowMs;
    if (untilDep <= WINDOWS.boardingMs) return "boarding";
    if (untilDep <= WINDOWS.dayOfMs)    return "day_of";
    return "pre_trip";
  }
  return (nowMs - arr <= WINDOWS.justLandedMs) ? "landed" : "past";
}
