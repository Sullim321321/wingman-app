import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useEffect } from "react";
import { registerPushToken } from "./api";

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
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
    // Register token with backend so server can send push alerts
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

export async function scheduleDisruption(flight = null) {
  const route = flight?.origin && flight?.destination
    ? `${flight.origin} → ${flight.destination}`
    : "DEN → ASE";
  const flightLabel = flight
    ? [(flight.carrier || ""), (flight.flight_number || "")].filter(Boolean).join(" ") || route
    : "UA 5821";
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Heads up — act before takeoff",
      body: `Conditions on ${route} are deteriorating. ${flightLabel} has a high disruption risk. Tap to review your options.`,
      data: { route: "Alert" },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
  });
}
