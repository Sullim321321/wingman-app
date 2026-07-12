// liveActivity.js — when Wingman appears on your lock screen, and when it leaves.
//
// A Live Activity is the most intrusive surface we have: it sits on the lock screen
// and in the Dynamic Island, and the user cannot ignore it. So the rules here are
// conservative on purpose.
//
//   • It appears only on the day of a flight, inside a real window (4h before
//     departure). Not "you have a trip in March".
//   • It shows ONE flight — the next one. Never a queue.
//   • It ends itself when the plane leaves. A countdown that has hit zero and is
//     still sitting there is clutter pretending to be a service.
//
// Every call is wrapped: a Live Activity failing must never break the app. It is a
// courtesy, not a dependency.

import { Platform } from "react-native";

const HOURS = 3600000;

// Show from this far out. Long enough to be useful getting to the airport; short
// enough that it isn't decoration.
const WINDOW_BEFORE_DEPARTURE = 4 * HOURS;

// Typical boarding lead time when the airline hasn't told us. We label it honestly
// as "until departure" in that case rather than inventing a boarding time.
const ASSUMED_BOARDING_LEAD = 40 * 60 * 1000;

let _activity = null;      // the running instance, if any
let _legId = null;         // which leg it's for

function supported() {
  // iOS 16.2+. On anything else this module is a no-op.
  return Platform.OS === "ios";
}

// Lazy require: importing expo-widgets pulls a native module, and we don't want a
// missing/older binary (e.g. an old TestFlight build) to take the whole app down at
// import time. That failure mode cost a day already.
function factory() {
  try {
    return require("./widgets/FlightActivity").default;
  } catch (e) {
    console.log("[live-activity] module unavailable:", e.message);
    return null;
  }
}

function statusLabel(leg) {
  const s = (leg.status || "").toLowerCase();
  if (s.includes("cancel")) return "Cancelled";
  if (s.includes("board"))  return "Boarding";
  if (s.includes("delay")) {
    const mins = Number(leg.delay_minutes) || 0;
    return mins ? `Delayed ${mins}m` : "Delayed";
  }
  return "On time";
}

function statusKey(leg) {
  const s = (leg.status || "").toLowerCase();
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("board"))  return "boarding";
  if (s.includes("delay"))  return "delayed";
  return "on_time";
}

function propsFor(leg) {
  const departs = new Date(leg.departs_at);
  // Prefer a real boarding time. If we don't have one, count down to DEPARTURE and
  // say so — rather than inventing a boarding time and being confidently wrong,
  // which is the failure mode we've been chasing all week.
  const boarding = leg.boarding_time ? new Date(leg.boarding_time) : null;
  const target = boarding || departs;

  return {
    carrier: leg.carrier || "",
    flightNumber: leg.flight_number || leg.carrier || "Flight",
    origin: leg.origin || "",
    destination: leg.destination || "",
    gate: leg.gate || "",
    terminal: leg.terminal || "",
    status: statusKey(leg),
    statusLabel: statusLabel(leg),
    countdownFrom: new Date(),
    countdownTo: target,
    countdownLabel: boarding ? "until boarding" : "until departure",
  };
}

/**
 * Given the user's legs, decide what (if anything) belongs on the lock screen.
 * Idempotent: safe to call on every focus/refresh.
 */
export async function syncFlightActivity(legs = []) {
  if (!supported()) return;

  const Activity = factory();
  if (!Activity) return;

  const now = Date.now();

  // The next flight that's within the window and hasn't left yet.
  const candidate = legs
    .filter((l) => l.type === "flight" && l.departs_at)
    .map((l) => ({ leg: l, t: new Date(l.departs_at).getTime() }))
    .filter(({ t }) => t > now && t - now <= WINDOW_BEFORE_DEPARTURE)
    .sort((a, b) => a.t - b.t)[0];

  try {
    // Nothing to show — make sure nothing is showing.
    if (!candidate) {
      await endActivity("immediate");
      return;
    }

    const { leg } = candidate;

    // Already running for this leg → update in place (gate change, delay, boarding).
    if (_activity && _legId === leg.id) {
      await _activity.update(propsFor(leg));
      return;
    }

    // Running for a DIFFERENT leg (connection) → retire the old one first.
    if (_activity && _legId !== leg.id) {
      await endActivity("immediate");
    }

    _activity = Activity.start(propsFor(leg), `wingman://trip/${leg.trip_id}`);
    _legId = leg.id;
  } catch (e) {
    console.log("[live-activity] sync failed:", e.message);
  }
}

/**
 * End it. `dismissal` controls how long the finished card lingers.
 * Departure has happened → get off the lock screen. Don't linger at zero.
 */
export async function endActivity(dismissal = "default") {
  if (!_activity) return;
  try {
    await _activity.end(dismissal);
  } catch (e) {
    console.log("[live-activity] end failed:", e.message);
  } finally {
    _activity = null;
    _legId = null;
  }
}

/**
 * The push-to-start / per-activity tokens, for a later phase.
 *
 * A gate change while the phone is in your pocket needs a push STRAIGHT to APNs —
 * Expo's push service cannot deliver Live Activity updates. That means an Apple .p8
 * key and hand-rolled APNs calls from server.js, and Expo's own documentation for it
 * is still an open issue. The countdown works without any of that; the facts do not.
 */
export async function getActivityPushToken() {
  if (!_activity) return null;
  try {
    return await _activity.getPushToken();
  } catch {
    return null;
  }
}
