import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { registerPushToken } from "./api";

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// ─── Actionable notifications (Roadmap 2, UI #5) ─────────────────────────────
// A chief of staff shouldn't make you open an app to say yes. Decision pushes
// carry Approve / Not now buttons that act straight from the lock screen.
export const DECISION_CATEGORY = "wingman_decision";

export async function registerNotificationCategories() {
  try {
    await Notifications.setNotificationCategoryAsync(DECISION_CATEGORY, [
      {
        identifier: "approve",
        buttonTitle: "Approve",
        options: { opensAppToForeground: false },
      },
      {
        identifier: "dismiss",
        buttonTitle: "Not now",
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);
  } catch (e) {
    console.warn("[push] category registration failed:", e.message);
  }
}

export async function registerForPush() {
  try {
    if (!Device.isDevice) return null;
    const { status } = await Notifications.getPermissionsAsync();
    let final = status;
    if (status !== "granted") {
      final = (await Notifications.requestPermissionsAsync()).status;
    }
    if (final !== "granted") return null;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;
    try {
      await registerPushToken(pushToken);
      console.log("[push] token registered:", pushToken);
    } catch (e) {
      console.warn("[push] failed to register token with backend:", e.message);
    }
    return pushToken;
  } catch (e) {
    console.warn("[push] registerForPush error:", e.message);
    return null;
  }
}

/**
 * Schedule a local disruption alert notification (demo/test mode).
 * Fires after 3 seconds with the full deep-link payload.
 */
export async function scheduleDisruption(flight = null, tripId = null, legId = null) {
  const route = flight?.origin && flight?.destination
    ? `${flight.origin} → ${flight.destination}`
    : "DEN → ASE";
  const flightLabel = flight
    ? [(flight.carrier || ""), (flight.flight_number || "")].filter(Boolean).join("") || route
    : "UA5821";
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Heads up — act before takeoff",
      body: `Conditions on ${route} are deteriorating. ${flightLabel} has a high disruption risk. Tap to review your options.`,
      data: {
        route: "Alert",
        tripId: tripId ? String(tripId) : null,
        legId: legId ? String(legId) : null,
        flightIdent: flightLabel,
      },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
  });
}

/**
 * Schedule a local pre-departure briefing notification (demo/test mode).
 * Fires after 5 seconds.
 */
export async function schedulePreDepartureBriefing(flight = null, tripId = null, legId = null) {
  const route = flight?.origin && flight?.destination
    ? `${flight.origin} → ${flight.destination}`
    : "your flight";
  const flightLabel = flight
    ? [(flight.carrier || ""), (flight.flight_number || "")].filter(Boolean).join("") || route
    : "your flight";
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${flightLabel} departs in 3 hours`,
      body: `Time to head to the airport. Tap for your live gate, TSA wait, and Uber ETA.`,
      data: {
        route: "Concierge",
        tripId: tripId ? String(tripId) : null,
        legId: legId ? String(legId) : null,
        prefill: `Live status for my ${route} flight departing in 3 hours`,
      },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
}

/**
 * Schedule a local post-trip debrief notification (demo/test mode).
 * Fires after 5 seconds.
 */
export async function schedulePostTripDebrief(tripTitle = "your trip", tripId = null) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `You've landed ✓`,
      body: `How did ${tripTitle} go? Tap to rate and see the value Wingman protected.`,
      data: {
        route: "TripDetail",
        tripId: tripId ? String(tripId) : null,
      },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
}
