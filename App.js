// Wingman App — Root
// Loads Playfair Display + DM Sans via expo-google-fonts
// Custom tab bar: wide-tracked caps labels + hairline Unicode icons + champagne gold

import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";

// Google Fonts — Playfair Display + DM Sans
import {
  useFonts,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";

import { C, T } from "./src/theme";
import { ThemeProvider, useTheme } from "./src/ThemeContext";
import { setupNotificationHandler, registerForPush } from "./src/notify";
import { AuthProvider, useAuth } from "./src/auth";
import ErrorBoundary from "./src/ErrorBoundary";

// Screens
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
import LoyaltyScreen from "./src/screens/LoyaltyScreen";
import HomeAddressScreen from "./src/screens/HomeAddressScreen";
import FlightSearchScreen from "./src/screens/FlightSearchScreen";
import FlightBookScreen from "./src/screens/FlightBookScreen";
import FlightConfirmScreen from "./src/screens/FlightConfirmScreen";
import DataSourcesScreen from "./src/screens/DataSourcesScreen";
import AutonomySettingsScreen from "./src/screens/AutonomySettingsScreen";
import InsightsScreen from "./src/screens/InsightsScreen";
import ProfileSetupScreen from "./src/screens/ProfileSetupScreen";
import WingmanWrappedScreen from "./src/screens/WingmanWrappedScreen";
import CompensationScreen from "./src/screens/CompensationScreen";
import UpgradeBidScreen from "./src/screens/UpgradeBidScreen";
import GroundTransportScreen from "./src/screens/GroundTransportScreen";
import WingmanPointsScreen from "./src/screens/WingmanPointsScreen";
import DestinationScreen from "./src/screens/DestinationScreen";
import AirportDiningScreen from "./src/screens/AirportDiningScreen";
import AirportNavigationScreen from "./src/screens/AirportNavigationScreen";
import LoungeCardsScreen from "./src/screens/LoungeCardsScreen";
import DisruptionScreen from "./src/screens/DisruptionScreen";
import JourneySimulatorScreen from "./src/screens/JourneySimulatorScreen";
import TravelProfileScreen from "./src/screens/TravelProfileScreen";

export const navRef = createNavigationContainerRef();
const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// navTheme is now computed inside Root() using useTheme()

// ─── Tab bar icon — hairline Unicode symbols ──────────────────────────────────
// Deck-matching thin line icons
const TAB_ICONS = {
  Home:      { active: "⌂", inactive: "⌂" },
  Trips:     { active: "☒", inactive: "☐" },
  Alerts:    { active: "◎", inactive: "○" },
  Concierge: { active: "✦", inactive: "✧" },
  Insights:  { active: "◈", inactive: "◇" },
};

// Tab labels — wide-tracked all-caps (kept short to prevent bleed)
const TAB_LABELS = {
  Home:      "HOME",
  Trips:     "TRIPS",
  Alerts:    "ALERTS",
  Concierge: "CHAT",
  Insights:  "INSIGHTS",
};

function TabIcon({ name, focused }) {
  const icons = TAB_ICONS[name] || { active: "·", inactive: "·" };
  return (
    <View style={[tb.iconWrap, focused && tb.iconWrapActive]}>
      <Text style={[tb.icon, focused && tb.iconActive]}>
        {focused ? icons.active : icons.inactive}
      </Text>
    </View>
  );
}

// ─── Tab navigator ────────────────────────────────────────────────────────────

function Tabs() {
  const { C: TC, isDark } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneContainerStyle: { backgroundColor: TC.bg },
        tabBarActiveTintColor:   TC.gold,
        tabBarInactiveTintColor: TC.mut,
        tabBarStyle: {
          backgroundColor: TC.bg,
          borderTopColor:  TC.line,
          borderTopWidth:  0.5,
          height: 88,
          paddingTop: 10,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize:      9,
          fontFamily:    T.sansB,
          letterSpacing: 1.2,
          marginTop:     2,
          numberOfLines: 1,
        },
        tabBarLabel: TAB_LABELS[route.name] || route.name.toUpperCase(),
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home"      component={HomeScreen} />
      <Tab.Screen name="Trips"     component={ActivityScreen} />
      <Tab.Screen name="Alerts"    component={AlertScreen} />
      <Tab.Screen name="Concierge" component={ConciergeScreen} />
      <Tab.Screen name="Insights"  component={InsightsScreen} />
    </Tab.Navigator>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────

const KEY_PROFILE_DONE = "wingman_profile_done";

function withTimeout(promise, ms = 3000, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function Root() {
  const { token, ready } = useAuth();
  const { C: TC, isDark } = useTheme();
  const navTheme = {
    ...(isDark ? DarkTheme : { dark: false, colors: {} }),
    colors: {
      ...(isDark ? DarkTheme.colors : {}),
      background: TC.bg,
      card:       TC.bg,
      text:       TC.ink,
      border:     TC.line,
      primary:    TC.gold,
      notification: TC.gold,
    },
  };
  const [onboarded, setOnboarded]     = useState(null);
  const [profileDone, setProfileDone] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const val = await withTimeout(SecureStore.getItemAsync("wingman_onboarded"));
        setOnboarded(!!val);
      } catch {
        setOnboarded(false);
      }
    })();
  }, []);

  // Check if new user needs profile setup
  useEffect(() => {
    if (!token) { setProfileDone(null); return; }
    (async () => {
      try {
        const val = await withTimeout(SecureStore.getItemAsync(KEY_PROFILE_DONE));
        setProfileDone(!!val);
      } catch {
        setProfileDone(false);
      }
    })();
  }, [token]);

  useEffect(() => { setupNotificationHandler(); }, []);

  useEffect(() => {
    if (token) registerForPush();
  }, [token]);

  useEffect(() => {
    const resp = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data || {};
      if (!navRef.isReady()) return;
      const route = data.route || "Alert";
      // Pass tripId / legId / flightIdent through to the target screen
      const params = {};
      if (data.tripId)      params.tripId      = data.tripId;
      if (data.legId)       params.legId       = data.legId;
      if (data.flightIdent) params.flightIdent = data.flightIdent;
      if (data.prefill)     params.prefill     = data.prefill;
      if (data.iata)        params.iata        = data.iata;
      if (data.gate)        params.gate        = data.gate;
      // All deep-linkable routes — pass params where relevant
      const PARAM_ROUTES = [
        "Alert", "TripDetail", "Concierge",
        "AirportDining", "AirportNavigation", "GroundTransport",
        "Destination", "WingmanPoints", "InsightsFull",
        "Compensation", "UpgradeBid",
      ];
      if (PARAM_ROUTES.includes(route)) {
        navRef.navigate(route, Object.keys(params).length ? params : undefined);
      } else {
        navRef.navigate(route);
      }
    });

    // Foreground notification — navigate to Alert tab
    const recv = Notifications.addNotificationReceivedListener((n) => {
      const data = n.request.content.data || {};
      const route = data.route || "Alert";
      setTimeout(() => {
        if (!navRef.isReady()) return;
        const params = {};
        if (data.tripId)      params.tripId      = data.tripId;
        if (data.legId)       params.legId       = data.legId;
        if (data.flightIdent) params.flightIdent = data.flightIdent;
        if (data.iata)        params.iata        = data.iata;
        if (data.gate)        params.gate        = data.gate;
        if (data.prefill)     params.prefill     = data.prefill;
        navRef.navigate(route, Object.keys(params).length ? params : undefined);
      }, 600);
    });

    return () => { resp.remove(); recv.remove(); };
  }, []);

  if (!ready || onboarded === null || (token && profileDone === null)) {
    return (
      <View style={{ flex: 1, backgroundColor: TC.bg, alignItems: "center", justifyContent: "center" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ActivityIndicator color={TC.gold} />
      </View>
    );
  }

  return (
    <>
    <StatusBar style={isDark ? "light" : "dark"} />
    <NavigationContainer ref={navRef} theme={navTheme} key={isDark ? "dark" : "light"}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: TC.bg },
          animation: "slide_from_right",
        }}
      >
        {token ? (
          <>
            {!profileDone && (
              <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
            )}
            <Stack.Screen name="Tabs"         component={Tabs} />
            <Stack.Screen name="Alert"        component={AlertScreen} />
            <Stack.Screen name="Reason"       component={ReasonScreen} />
            <Stack.Screen name="Track"        component={TrackScreen} />
            <Stack.Screen name="Exec"         component={ExecScreen}         options={{ gestureEnabled: false }} />
            <Stack.Screen name="Done"         component={DoneScreen}         options={{ gestureEnabled: false }} />
            <Stack.Screen name="Plan"         component={PlanScreen} />
            <Stack.Screen name="Detour"       component={DetourScreen} />
            <Stack.Screen name="PlanDone"     component={PlanDoneScreen}     options={{ gestureEnabled: false }} />
            <Stack.Screen name="Settings"     component={SettingsScreen} />
            <Stack.Screen name="Connections"  component={ConnectionsScreen} />
            <Stack.Screen name="Signal"       component={SignalScreen} />
            <Stack.Screen name="AddTrip"      component={AddTripScreen} />
            <Stack.Screen name="TripDetail"   component={TripDetailScreen} />
            <Stack.Screen name="TasteSetup"   component={TasteSetupScreen} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} />
            <Stack.Screen name="Loyalty"      component={LoyaltyScreen} />
            <Stack.Screen name="HomeAddress"  component={HomeAddressScreen} />
            <Stack.Screen name="FlightSearch" component={FlightSearchScreen} />
            <Stack.Screen name="FlightBook"   component={FlightBookScreen} />
            <Stack.Screen name="FlightConfirm" component={FlightConfirmScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="DataSources"  component={DataSourcesScreen} />
            <Stack.Screen name="Autonomy"     component={AutonomySettingsScreen} />
            <Stack.Screen name="InsightsFull" component={InsightsScreen} />
            <Stack.Screen name="Wrapped"      component={WingmanWrappedScreen} />
            <Stack.Screen name="Compensation"     component={CompensationScreen} />
            <Stack.Screen name="UpgradeBid"         component={UpgradeBidScreen} />
            <Stack.Screen name="GroundTransport"    component={GroundTransportScreen} />
            <Stack.Screen name="WingmanPoints"     component={WingmanPointsScreen} />
            <Stack.Screen name="Destination"       component={DestinationScreen} />
            <Stack.Screen name="AirportDining"      component={AirportDiningScreen} />
            <Stack.Screen name="AirportNavigation"  component={AirportNavigationScreen} />
            <Stack.Screen name="LoungeCards"          component={LoungeCardsScreen} />
            <Stack.Screen name="DisruptionScreen"     component={DisruptionScreen} />
            <Stack.Screen name="JourneySimulator"     component={JourneySimulatorScreen} />
            <Stack.Screen name="TravelProfile"        component={TravelProfileScreen} />
            <Stack.Screen name="Main"         component={Tabs} />
          </>
        ) : (
          <>
            {!onboarded && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
            <Stack.Screen name="SignIn" component={SignInScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </>
  );
}

// ─── App root — loads fonts before rendering ──────────────────────────────────

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  // Safety timeout: if fonts haven't loaded after 5 s (e.g. native module stuck on iOS 26),
  // proceed with system fonts rather than showing a permanent black screen.
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // Show a warm splash while fonts load
  // fontError / fontTimeout: proceed with system fonts if loading fails
  if (!fontsLoaded && !fontError && !fontTimeout) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <StatusBar style="light" />
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ErrorBoundary>
              <Root />
            </ErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// ─── Tab bar styles ───────────────────────────────────────────────────────────

const tb = StyleSheet.create({
  iconWrap: {
    width: 32,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {},  // no pill bg — deck is clean
  icon: {
    fontSize: 18,
    color: C.mut,
    opacity: 0.55,
  },
  iconActive: {
    color: C.gold,
    opacity: 1,
  },
});
