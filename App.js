import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { C } from "./src/theme";
import { setupNotificationHandler, registerForPush } from "./src/notify";
import { AuthProvider, useAuth } from "./src/auth";
import * as SecureStore from "expo-secure-store";
import ErrorBoundary from "./src/ErrorBoundary";
import HomeScreen from "./src/screens/HomeScreen";
import ConciergeScreen from "./src/screens/ConciergeScreen";
import ActivityScreen from "./src/screens/ActivityScreen";
import AlertScreen from "./src/screens/AlertScreen";
import ReasonScreen from "./src/screens/ReasonScreen";
import TrackScreen from "./src/screens/TrackScreen";
import ExecScreen from "./src/screens/ExecScreen";
import DoneScreen from "./src/screens/DoneScreen";
import PlanScreen from "./src/screens/PlanScreen";
import DetourScreen from "./src/screens/DetourScreen";
import PlanDoneScreen from "./src/screens/PlanDoneScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import ConnectionsScreen from "./src/screens/ConnectionsScreen";
import SignalScreen from "./src/screens/SignalScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import SignInScreen from "./src/screens/SignInScreen";
import AddTripScreen from "./src/screens/AddTripScreen";
import TripDetailScreen from "./src/screens/TripDetailScreen";
import TasteSetupScreen from "./src/screens/TasteSetupScreen";
import SubscriptionScreen from "./src/screens/SubscriptionScreen";

export const navRef = createNavigationContainerRef();
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.ink, border: C.line, primary: C.teal },
};

const TAB_ICON = { Trips: "🧭", Concierge: "💬", Activity: "⚡" };

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.mut,
        sceneContainerStyle: { backgroundColor: C.bg },
        tabBarStyle: { backgroundColor: "#0A0E1C", borderTopColor: C.line, height: 84, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.55 }}>{TAB_ICON[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Trips" component={HomeScreen} />
      <Tab.Screen name="Concierge" component={ConciergeScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { token, ready } = useAuth();
  const [onboarded, setOnboarded] = useState(null); // null = loading

  useEffect(() => {
    (async () => {
      try {
        const val = await SecureStore.getItemAsync("wingman_onboarded");
        setOnboarded(!!val);
      } catch {
        setOnboarded(false);
      }
    })();
  }, []);

  // Set up notification handler inside useEffect (required for iOS 26 / New Arch)
  useEffect(() => {
    setupNotificationHandler();
  }, []);

  // Register for push notifications and send token to backend after login
  useEffect(() => {
    if (token) {
      registerForPush();
    }
  }, [token]);

  useEffect(() => {
    const resp = Notifications.addNotificationResponseReceivedListener((r) => {
      const route = r.notification.request.content.data?.route || "Alert";
      if (navRef.isReady()) navRef.navigate(route);
    });
    const recv = Notifications.addNotificationReceivedListener(() => {
      setTimeout(() => { if (navRef.isReady()) navRef.navigate("Alert"); }, 600);
    });
    return () => { resp.remove(); recv.remove(); };
  }, []);

  if (!ready || onboarded === null) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.teal} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navRef} theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: "slide_from_right" }}>
        {token ? (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="Alert" component={AlertScreen} />
            <Stack.Screen name="Reason" component={ReasonScreen} />
            <Stack.Screen name="Track" component={TrackScreen} />
            <Stack.Screen name="Exec" component={ExecScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="Done" component={DoneScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="Plan" component={PlanScreen} />
            <Stack.Screen name="Detour" component={DetourScreen} />
            <Stack.Screen name="PlanDone" component={PlanDoneScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Connections" component={ConnectionsScreen} />
            <Stack.Screen name="Signal" component={SignalScreen} />
            <Stack.Screen name="AddTrip" component={AddTripScreen} />
            <Stack.Screen name="TripDetail" component={TripDetailScreen} />
            <Stack.Screen name="TasteSetup" component={TasteSetupScreen} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} />
            <Stack.Screen name="Main" component={Tabs} />
          </>
        ) : (
          <>
            {!onboarded && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
            <Stack.Screen name="SignIn" component={SignInScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <ErrorBoundary>
            <Root />
          </ErrorBoundary>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
