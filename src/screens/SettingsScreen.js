import React, { useState } from "react";
import { SafeAreaView, ScrollView, View, Text, Switch, StyleSheet } from "react-native";
import { C } from "../theme";
import { BackBar, Segmented, SetRow, Chip, Btn, g } from "../components";
import { useAuth } from "../auth";

export default function SettingsScreen({ navigation }) {
  const { email, signOut } = useAuth();
  const [cap, setCap] = useState("$250");
  const [style, setStyle] = useState("Alert + options");
  const [weather, setWeather] = useState(true);
  const [drops, setDrops] = useState(true);
  const [quiet, setQuiet] = useState(false);
  const sw = (v, set) => (
    <Switch value={v} onValueChange={set} trackColor={{ true: C.teal, false: "#1A2035" }} thumbColor="#fff" ios_backgroundColor="#1A2035" />
  );

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Trust controls" />

        <View style={g.trustNote}>
          <Text style={g.trustNoteT}>You're always in control. <Text style={{ color: C.teal, fontWeight: "700" }}>Wingman never moves money or books above your limit without an explicit "yes."</Text></Text>
        </View>

        <Text style={g.sectionT}>AUTO-APPROVE THRESHOLD</Text>
        <Segmented options={["$100", "$250", "$500", "$1,000"]} value={cap} onChange={setCap} />
        <Text style={s.cap}>Below {cap}, Wingman can rebook instantly during a disruption. Above it, you'll be asked first.</Text>

        <Text style={g.sectionT}>WHEN RISK CROSSES YOUR LINE</Text>
        <Segmented options={["Just alert", "Alert + options", "Auto-fix"]} value={style} onChange={setStyle} />

        <Text style={g.sectionT}>MONITORING</Text>
        <View style={g.group}>
          <SetRow ic="🌨️" t="Weather & delay watch" sub="Predict disruptions before the airline" right={sw(weather, setWeather)} />
          <SetRow ic="🪑" t="Price & seat-drop alerts" sub="Better seats or fares on booked trips" right={sw(drops, setDrops)} />
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic="🌙" t="Quiet hours" sub="Hold non-urgent pings 10p–7a" right={sw(quiet, setQuiet)} />
          </View>
        </View>

        <Text style={g.sectionT}>CONNECTED ACCOUNTS</Text>
        <View style={g.group}>
          <SetRow ic="✉️" iconColor="#FF6B5E" t="Inbox" sub="maddie@…  · syncing" right={<Chip color={C.teal}>Connected</Chip>} />
          <SetRow ic="💳" iconColor={C.teal} t="Payment & trip protection" sub="Visa ••42 · covered rebookings" right={<Chip>Manage</Chip>} />
          <SetRow ic="📡" t="All channels & privacy" sub="Email, Calendar, WhatsApp, Messages" right={<Chip color={C.accent}>Manage ›</Chip>} onPress={() => navigation.navigate("Connections")} />
        </View>

        <Text style={g.sectionT}>BOOK FLIGHTS</Text>
        <View style={g.group}>
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic="✈️" iconColor={C.accent} t="Search & book flights" sub="Powered by Duffel — 300+ airlines" right={<Chip color={C.accent}>Search ›</Chip>} onPress={() => navigation.navigate("FlightSearch")} />
          </View>
        </View>

        <Text style={g.sectionT}>TASTE PROFILE</Text>
        <View style={g.group}>
          <SetRow ic="✨" t="Editorial sources & preferences" sub="Sources, hotel soft-specs, seat prefs, dietary" right={<Chip color={C.accent}>Edit ›</Chip>} onPress={() => navigation.navigate("TasteSetup", { fromSettings: true })} />
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic="🏠" t="Home address" sub="Pre-filled as Uber dropoff when you land" right={<Chip color={C.teal}>Set ›</Chip>} onPress={() => navigation.navigate("HomeAddress")} />
          </View>
        </View>

        <Text style={g.sectionT}>LOYALTY PROGRAMS</Text>
        <View style={g.group}>
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic="🏆" t="Frequent flyer & hotel programs" sub="Marriott, Hilton, United, Delta, Hyatt & more" right={<Chip color={C.teal}>Manage ›</Chip>} onPress={() => navigation.navigate("Loyalty")} />
          </View>
        </View>

        <Text style={g.sectionT}>SUBSCRIPTION</Text>
        <View style={g.group}>
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic="⚡" t="Wingman Pro / Elite" sub="Manage your subscription and billing" right={<Chip color="#818CF8">Manage ›</Chip>} onPress={() => navigation.navigate("Subscription")} />
          </View>
        </View>

        <Text style={g.sectionT}>ACCOUNT</Text>
        <Text style={s.acct}>Signed in as {email || "—"}</Text>
        <Btn title="Sign out" kind="ghost" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  cap: { color: C.mut, fontSize: 13, marginTop: 12, lineHeight: 20 },
  acct: { color: C.mut, fontSize: 14, marginBottom: 14, letterSpacing: 0.1 },
});
