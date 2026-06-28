// Build 74 — Diagnostic: all non-screen imports loaded, no screen components
// Tests: react-navigation, expo-notifications, expo-secure-store, expo-linking,
//        expo-google-fonts, theme, notify, auth, ErrorBoundary
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
        Imports OK — Build 74
      </Text>
      <Text style={{ color: "#888", fontSize: 13, marginTop: 8 }}>
        Fonts: {fontsLoaded ? "loaded" : "loading..."}
      </Text>
    </View>
  );
}
