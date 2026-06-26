import React, { useState, useEffect } from "react";
import { SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, Linking } from "react-native";
import { C } from "../theme";
import { BackBar, g } from "../components";
import { getMe, getGmailConnectUrl, triggerGmailScan, getUberConnectUrl, getUberStatus, disconnectUber } from "../api";

function Feat({ ic, t, color }) {
  return (
    <View style={g.feat}>
      <Text style={{ color: color || C.teal, fontSize: 14 }}>{ic}</Text>
      <Text style={{ color: C.ink, fontSize: 13, flex: 1, lineHeight: 18 }}>{t}</Text>
    </View>
  );
}

export default function ConnectionsScreen({ navigation }) {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [uberConnected, setUberConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectingUber, setConnectingUber] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    Promise.all([
      getMe().catch(() => ({})),
      getUberStatus().catch(() => ({ connected: false })),
    ]).then(([me, uberStatus]) => {
      setGmailConnected(me.gmail_connected || false);
      setUberConnected(uberStatus.connected || false);
    }).finally(() => setLoading(false));
  }, []);

  const connectGmail = async () => {
    setConnecting(true);
    try {
      const data = await getGmailConnectUrl();
      if (data.url) {
        await Linking.openURL(data.url);
        setTimeout(async () => {
          try {
            const me = await getMe();
            setGmailConnected(me.gmail_connected || false);
            if (me.gmail_connected) {
              Alert.alert("Gmail connected!", "Wingman is scanning your inbox for travel bookings. Pull to refresh on the Trips tab in a moment.");
            }
          } catch {}
        }, 3000);
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setConnecting(false);
    }
  };

  const connectUber = async () => {
    setConnectingUber(true);
    try {
      const data = await getUberConnectUrl();
      if (data.url) {
        await Linking.openURL(data.url);
        setTimeout(async () => {
          try {
            const status = await getUberStatus();
            setUberConnected(status.connected || false);
            if (status.connected) {
              Alert.alert("Uber connected!", "Wingman will auto-dispatch a ride when you land. Your payment method and account are used — Wingman never charges you directly.");
            }
          } catch {}
        }, 4000);
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setConnectingUber(false);
    }
  };

  const disconnectUberAccount = async () => {
    Alert.alert(
      "Disconnect Uber?",
      "Wingman will no longer auto-dispatch rides on landing.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnectUber();
              setUberConnected(false);
            } catch (e) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  };

  const rescan = async () => {
    setScanning(true);
    try {
      await triggerGmailScan();
      Alert.alert("Scan started", "Wingman is re-scanning your inbox. Pull to refresh on the Trips tab in about 30 seconds.");
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Connections" />
        <View style={g.trustNote}>
          <Text style={g.trustNoteT}>Wingman connects through <Text style={{ color: C.teal, fontWeight: "700" }}>official APIs</Text> and reads only travel-relevant details — encrypted, scoped, and revocable anytime.</Text>
        </View>

        <Text style={g.sectionT}>YOUR CHANNELS</Text>
        <View style={g.group}>
          {/* Gmail */}
          <View style={s.row}>
            <View style={[s.iconBox, { backgroundColor: "rgba(255,107,94,0.12)" }]}>
              <Text style={{ fontSize: 18 }}>✉️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowT}>Gmail</Text>
              <Text style={s.rowS}>{loading ? "Checking..." : gmailConnected ? "Connected — scanning for bookings" : "Connect to import flight & hotel confirmations"}</Text>
            </View>
            {loading ? (
              <ActivityIndicator color={C.teal} size="small" />
            ) : gmailConnected ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable style={s.rescanBtn} onPress={rescan} disabled={scanning}>
                  {scanning ? <ActivityIndicator color={C.teal} size="small" /> : <Text style={s.rescanT}>Re-scan</Text>}
                </Pressable>
                <View style={s.connectedBadge}><Text style={s.connectedT}>✓ On</Text></View>
              </View>
            ) : (
              <Pressable style={s.connectBtn} onPress={connectGmail} disabled={connecting}>
                {connecting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.connectBtnT}>Connect</Text>}
              </Pressable>
            )}
          </View>

          {/* Uber */}
          <View style={s.row}>
            <View style={[s.iconBox, { backgroundColor: "rgba(0,0,0,0.3)" }]}>
              <Text style={{ fontSize: 18 }}>🚗</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowT}>Uber</Text>
              <Text style={s.rowS}>{loading ? "Checking..." : uberConnected ? "Connected — auto-dispatch on landing" : "Connect to auto-dispatch a ride when you land"}</Text>
            </View>
            {loading ? (
              <ActivityIndicator color={C.teal} size="small" />
            ) : uberConnected ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable style={s.rescanBtn} onPress={disconnectUberAccount}>
                  <Text style={s.rescanT}>Disconnect</Text>
                </Pressable>
                <View style={s.connectedBadge}><Text style={s.connectedT}>✓ On</Text></View>
              </View>
            ) : (
              <Pressable style={s.connectBtn} onPress={connectUber} disabled={connectingUber}>
                {connectingUber ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.connectBtnT}>Connect</Text>}
              </Pressable>
            )}
          </View>

          {/* Calendar — coming soon */}
          <View style={[s.row, { opacity: 0.5 }]}>
            <View style={[s.iconBox, { backgroundColor: "rgba(91,140,255,0.12)" }]}>
              <Text style={{ fontSize: 18 }}>📅</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowT}>Calendar</Text>
              <Text style={s.rowS}>Trip dates & meetings — coming soon</Text>
            </View>
            <View style={s.soonBadge}><Text style={s.soonT}>Soon</Text></View>
          </View>

          {/* WhatsApp — coming soon */}
          <View style={[s.row, { opacity: 0.5 }]}>
            <View style={[s.iconBox, { backgroundColor: "rgba(37,211,102,0.12)" }]}>
              <Text style={{ fontSize: 18 }}>💬</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowT}>WhatsApp</Text>
              <Text style={s.rowS}>Group-chat trip plans — coming soon</Text>
            </View>
            <View style={s.soonBadge}><Text style={s.soonT}>Soon</Text></View>
          </View>

          {/* iMessage — coming soon */}
          <View style={[s.row, { borderBottomWidth: 0, opacity: 0.5 }]}>
            <View style={[s.iconBox, { backgroundColor: "rgba(34,211,166,0.12)" }]}>
              <Text style={{ fontSize: 18 }}>📱</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowT}>iMessage</Text>
              <Text style={s.rowS}>"We're delayed" texts — coming soon</Text>
            </View>
            <View style={s.soonBadge}><Text style={s.soonT}>Soon</Text></View>
          </View>
        </View>

        <Text style={g.sectionT}>WHAT WINGMAN READS</Text>
        <View style={[g.group, { paddingVertical: 12 }]}>
          <Feat ic="✈️" t="Booking & flight confirmations" />
          <Feat ic="📆" t="Dates, times & destinations" />
          <Feat ic="🚗" t="Your Uber account — for auto-dispatch on landing" />
          <Feat ic="⦸" color="#FF6B5E" t="Nothing personal or off-topic — ever." />
        </View>
        <Text style={s.note}>Revoke any connection in one tap. Your data is never sold.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowT: { color: C.ink, fontSize: 14, fontWeight: "600" },
  rowS: { color: C.mut, fontSize: 12, marginTop: 2 },
  connectBtn: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  connectBtnT: { color: "#fff", fontSize: 13, fontWeight: "700" },
  connectedBadge: { backgroundColor: "rgba(34,211,166,0.15)", borderWidth: 1, borderColor: "rgba(34,211,166,0.3)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  connectedT: { color: C.teal, fontSize: 12, fontWeight: "700" },
  rescanBtn: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  rescanT: { color: C.ink, fontSize: 12, fontWeight: "600" },
  soonBadge: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  soonT: { color: C.mut, fontSize: 12 },
  note: { color: C.mut, fontSize: 12, textAlign: "center", marginTop: 10 },
});
