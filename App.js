// Build 73 — Minimal diagnostic: no native modules, just View/Text
import React from "react";
import { View, Text } from "react-native";

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0F0D0A", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#D4AF37", fontSize: 28, fontWeight: "bold" }}>
        Wingman
      </Text>
      <Text style={{ color: "#fff", fontSize: 16, marginTop: 12 }}>
        Bridge OK — Build 73
      </Text>
    </View>
  );
}
