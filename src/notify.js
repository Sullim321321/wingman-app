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

export async function scheduleDisruption() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Heads up — act before takeoff",
      body: "Denver weather is deteriorating. Your DEN to Aspen flight has a high cancellation risk. Tap to review your options.",
      data: { route: "Alert" },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
  });
}
