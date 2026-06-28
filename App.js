// Build 75 — Binary search: screens 1-14 of 27 imported
// HomeScreen, ConciergeScreen, ActivityScreen, AlertScreen, ReasonScreen,
// TrackScreen, ExecScreen, DoneScreen, PlanScreen, DetourScreen,
// PlanDoneScreen, SettingsScreen, ConnectionsScreen, SignalScreen
import React from "react";
import { View, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";

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
import { setupNotificationHandler, registerForPush } from "./src/notify";
import { AuthProvider, useAuth } from "./src/auth";
import ErrorBoundary from "./src/ErrorBoundary";

// Screens 1-14
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

export const navRef = createNavigationContainerRef();
const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#0F0D0A", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#D4AF37", fontSize: 28, fontWeight: "bold" }}>
        Wingman
      </Text>
      <Text style={{ color: "#fff", fontSize: 16, marginTop: 12 }}>
        Screens 1-14 OK — Build 75
      </Text>
      <Text style={{ color: "#888", fontSize: 13, marginTop: 8 }}>
        Fonts: {fontsLoaded ? "loaded" : "loading..."}
      </Text>
    </View>
  );
}
