// Wingman App — Root
// Loads Playfair Display + DM Sans via expo-google-fonts
// Custom tab bar: wide-tracked caps labels + hairline Unicode icons + champagne gold

import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";

// Google Fonts — Playfair Display + DM Sans + EB Garamond
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
import {
  EBGaramond_400Regular,
  EBGaramond_400Regular_Italic,
  EBGaramond_500Medium_Italic,
  EBGaramond_600SemiBold_Italic,
} from "@expo-google-fonts/eb-garamond";

import { C, T } from "./src/theme";
import { ThemeProvider, useTheme } from "./src/ThemeContext";
import { setupNotificationHandler, registerForPush, registerNotificationCategories } from "./src/notify";
import { confirmDecision, dismissDecision } from "./src/api";
import { AuthProvider, useAuth } from "./src/auth";
import ErrorBoundary from "./src/ErrorBoundary";

// Screens
import HomeScreen from "./src/screens/HomeScreen";
import ConciergeScreen from "./src/screens/ConciergeScreen";
import ActivityScreen from "./src/screens/ActivityScreen";
import TripsScreen from "./src/screens/TripsScreen";
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
import PrivacyPolicyScreen from "./src/screens/PrivacyPolicyScreen";
import LoyaltyScreen from "./src/screens/LoyaltyScreen";
import HomeAddressScreen from "./src/screens/HomeAddressScreen";
import FlightSearchScreen from "./src/screens/FlightSearchScreen";
import FlightBookScreen from "./src/screens/FlightBookScreen";
import FlightConfirmScreen from "./src/screens/FlightConfirmScreen";
import DataSourcesScreen from "./src/screens/DataSourcesScreen";
import AutonomySettingsScreen from "./src/screens/AutonomySettingsScreen";
import InsightsScreen from "./src/screens/InsightsScreen";
import ProfileSetupScreen from "./src/screens/ProfileSetupScreen";
import WelcomeScreen from "./src/screens/WelcomeScreen";
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
import MemoryScreen from "./src/screens/MemoryScreen";
import PassengerProfileScreen from "./src/screens/PassengerProfileScreen";
import DecisionsScreen from "./src/screens/DecisionsScreen";
import ExpensesScreen from "./src/screens/ExpensesScreen";
import InviteScreen from "./src/screens/InviteScreen";

export const navRef = createNavigationContainerRef();
const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// navTheme is now computed inside Root() using useTheme()

// ─── Tab bar icon — hairline Unicode symbols ──────────────────────────────────
// Deck-matching thin line icons
// \uFE0E = text presentation selector — prevents OS emoji substitution
const TAB_ICONS = {
  Home:         { active: "\u2302\uFE0E", inactive: "\u2302\uFE0E" },
  Trips:        { active: "\u2708\uFE0E", inactive: "\u2708\uFE0E" },
  Intelligence: { active: "\u25CE\uFE0E", inactive: "\u25CB\uFE0E" },
  Insights:     { active: "\u25C6\uFE0E", inactive: "\u25C7\uFE0E" },
};

// Tab labels — wide-tracked all-caps (kept short to prevent bleed)
const TAB_LABELS = {
  Home:         "HOME",
  Trips:        "TRIPS",
  Intelligence: "SIGNALS",
  Insights:     "INSIGHTS",
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

function Tabs({ navigation }) {
  const { C: TC, isDark } = useTheme();
  const [signalBadge, setSignalBadge] = React.useState(null);
  const [activeRoute, setActiveRoute] = React.useState("Home");

  // Poll for active signals every 5 min to keep the badge fresh
  React.useEffect(() => {
    const refresh = async () => {
      try {
        const { getActivity } = require("./src/api");
        const data = await getActivity(50);
        const events = data?.events || [];
        const now = Date.now();
        const active = events.filter(e => {
          const diff = now - new Date(e.created_at).getTime();
          return diff < 24 * 3600000 && (e.type === "disruption" || e.type === "delay" || e.type === "weather");
        });
        setSignalBadge(active.length > 0 ? active.length : null);
      } catch {}
    };
    refresh();
    const t = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      screenListeners={{
        state: (e) => {
          try {
            const st = e.data?.state;
            if (st) setActiveRoute(st.routes[st.index].name);
          } catch {}
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneContainerStyle: { backgroundColor: TC.bg },
        tabBarActiveTintColor:   TC.gold,
        tabBarInactiveTintColor: TC.mut,
        tabBarStyle: {
          backgroundColor: TC.glassTab || TC.bg,
          borderTopColor:  TC.line,
          borderTopWidth:  StyleSheet.hairlineWidth,
          height: 88,
          paddingTop: 10,
          paddingBottom: 8,
          elevation: 0,
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
      <Tab.Screen name="Home"         component={HomeScreen} />
      <Tab.Screen name="Trips"        component={TripsScreen} />
      <Tab.Screen
        name="Intelligence"
        component={ActivityScreen}
        options={{
          tabBarBadge: signalBadge ?? undefined,
          tabBarBadgeStyle: { backgroundColor: C.coral, fontSize: 9, minWidth: 16, height: 16, borderRadius: 8 },
        }}
      />
      <Tab.Screen name="Insights"     component={InsightsScreen} />
    </Tab.Navigator>

    {/* Always-present concierge affordance (UI #1) — hidden on Home, which already
        has the concierge input inline (avoids covering the send button). */}
    {activeRoute !== "Home" && (
      <Pressable
        onPress={() => { try { require("./src/components").tap?.(); } catch {} navigation.navigate("Concierge"); }}
        style={({ pressed }) => [
          fab.pill,
          { backgroundColor: TC.card, borderColor: TC.gold, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityLabel="Ask Wingman"
      >
        <Ionicons name="chatbubbles-outline" size={16} color={TC.gold} />
        <Text style={[fab.label, { color: TC.gold }]}>Ask Wingman</Text>
      </Pressable>
    )}
    </View>
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
    // react-navigation v7 requires fonts.regular/medium/bold/heavy
    // Without this, NavigationContainer crashes: "Cannot read property 'regular' of undefined"
    fonts: {
      regular: { fontFamily: T.sans,  fontWeight: "400" },
      medium:  { fontFamily: T.sansM, fontWeight: "500" },
      bold:    { fontFamily: T.sansB, fontWeight: "700" },
      heavy:   { fontFamily: T.sansB, fontWeight: "700" },
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

  useEffect(() => { setupNotificationHandler(); registerNotificationCategories(); }, []);

  useEffect(() => {
    if (token) registerForPush();
  }, [token]);

  useEffect(() => {
    const resp = Notifications.addNotificationResponseReceivedListener(async (r) => {
      const data = r.notification.request.content.data || {};

      // ── Inline decision actions (UI #5) — approve/dismiss straight from the
      // notification, without opening the app. A chief of staff shouldn't make
      // you launch an app to say yes.
      const action = r.actionIdentifier;
      if (data.decision_id && (action === "approve" || action === "dismiss")) {
        try {
          if (action === "approve") await confirmDecision(data.decision_id, data.option_id);
          else await dismissDecision(data.decision_id);
        } catch (e) {
          console.warn("[push-action]", e.message);
        }
        return; // handled without navigating
      }

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
        "Disruption",
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
        if (data.ident)       params.ident       = data.ident;
        if (data.iata)        params.iata        = data.iata;
        if (data.gate)        params.gate        = data.gate;
        if (data.prefill)     params.prefill     = data.prefill;
        const FG_PARAM_ROUTES = [
          "Alert", "TripDetail", "Concierge",
          "AirportDining", "AirportNavigation", "GroundTransport",
          "Destination", "WingmanPoints", "InsightsFull",
          "Compensation", "UpgradeBid", "Disruption",
        ];
        if (FG_PARAM_ROUTES.includes(route)) {
          navRef.navigate(route, Object.keys(params).length ? params : undefined);
        } else {
          navRef.navigate(route);
        }
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
    <NavigationContainer
        ref={navRef}
        theme={navTheme}
        key={isDark ? "dark" : "light"}
        linking={{
          prefixes: [Linking.createURL("/"), "wingman://"],
          config: {
            screens: {
              MainTabs: {
                screens: {
                  Home: "home",
                  Concierge: "concierge",
                },
              },
              Connections: "connections",
              TripDetail: "trip/:tripId",
            },
          },
        }}
      >
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
            <Stack.Screen name="Welcome"      component={WelcomeScreen} />
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
            <Stack.Screen name="Autonomy"          component={AutonomySettingsScreen} />
            <Stack.Screen name="PassengerProfile"   component={PassengerProfileScreen} />
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
            <Stack.Screen name="Concierge"            component={ConciergeScreen} />
            <Stack.Screen name="Disruption"           component={DisruptionScreen} />
            <Stack.Screen name="JourneySimulator"     component={JourneySimulatorScreen} />
            <Stack.Screen name="TravelProfile"        component={TravelProfileScreen} />
            <Stack.Screen name="Memory"               component={MemoryScreen} />
            <Stack.Screen name="Decisions"            component={DecisionsScreen} />
            <Stack.Screen name="Expenses"             component={ExpensesScreen} />
            <Stack.Screen name="Invite"               component={InviteScreen} />
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
    EBGaramond_400Regular,
    EBGaramond_400Regular_Italic,
    EBGaramond_500Medium_Italic,
    EBGaramond_600SemiBold_Italic,
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

// ─── Floating "Ask Wingman" pill ──────────────────────────────────────────────
const fab = StyleSheet.create({
  pill: {
    position: "absolute",
    right: 18,
    bottom: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  label: {
    fontFamily: T.sansB,
    fontSize: 12.5,
    letterSpacing: 0.3,
  },
});
