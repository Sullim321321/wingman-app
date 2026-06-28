// Build 76 — Binary search: screens 15-27 imported (second half)
// OnboardingScreen, SignInScreen, AddTripScreen, TripDetailScreen, TasteSetupScreen,
// SubscriptionScreen, LoyaltyScreen, HomeAddressScreen, FlightSearchScreen,
// FlightBookScreen, FlightConfirmScreen, DataSourcesScreen, AutonomySettingsScreen
// (InsightsScreen, ProfileSetupScreen, WingmanWrappedScreen, CompensationScreen,
//  UpgradeBidScreen, GroundTransportScreen NOT included yet — will narrow further)
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

// Screens 15-27
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
        Screens 15-27 OK — Build 76
      </Text>
      <Text style={{ color: "#888", fontSize: 13, marginTop: 8 }}>
        Fonts: {fontsLoaded ? "loaded" : "loading..."}
      </Text>
    </View>
  );
}
