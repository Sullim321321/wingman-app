import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  Switch, Alert, ActivityIndicator, Linking,
} from "react-native";
import { C, T } from "../theme";
import { BackBar, g, tap } from "../components";
import { getMe, getGmailConnectUrl, triggerGmailScan, syncCalendar } from "../api";

const SOURCE_ICONS = {
  gmail:    "✉",
  calendar: "◫",
  messages: "◻",
};

function SourceRow({ icon, title, subtitle, connected, onToggle, loading, badge }) {
  return (
    <View style={s.row}>
      <View style={s.rowIcon}>
        <Text style={s.rowIconT}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={s.rowTitle}>{title}</Text>
          {badge ? <View style={s.badge}><Text style={s.badgeT}>{badge}</Text></View> : null}
        </View>
        <Text style={s.rowSub}>{subtitle}</Text>
      </View>
      {loading
        ? <ActivityIndicator size="small" color={C.gold} />
        : <Switch
            value={connected}
            onValueChange={onToggle}
            trackColor={{ false: C.line, true: "rgba(201,169,110,0.4)" }}
            thumbColor={connected ? C.gold : C.mut}
          />
      }
    </View>
  );
}

export default function DataSourcesScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [loadingCal, setLoadingCal] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);

  useEffect(() => {
    getMe().then(setProfile).catch(() => {});
  }, []);

  const gmailConnected = profile?.gmail_connected || false;

  const handleGmailToggle = async (val) => {
    if (val) {
      // Connect Gmail
      setLoadingGmail(true);
      try {
        const data = await getGmailConnectUrl();
        if (data.url) {
          await Linking.openURL(data.url);
        }
      } catch (e) {
        Alert.alert("Gmail", e.message);
      } finally {
        setLoadingGmail(false);
      }
    } else {
      Alert.alert("Disconnect Gmail", "Wingman will stop scanning for new bookings. Existing trips will remain.", [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: () => {} },
      ]);
    }
  };

  const handleCalendarToggle = async (val) => {
    if (val) {
      setLoadingCal(true);
      try {
        // On a real device, use expo-calendar to request permissions and read events
        // For now, show instructions
        Alert.alert(
          "Calendar Access",
          "Wingman will read your calendar to find travel invites and itineraries. Grant access in Settings > Privacy > Calendars.",
          [
            { text: "Open Settings", onPress: () => Linking.openURL("app-settings:") },
            { text: "Cancel", style: "cancel" },
          ]
        );
      } finally {
        setLoadingCal(false);
      }
    }
  };

  const handleScan = async () => {
    if (!gmailConnected) {
      Alert.alert("Connect Gmail first", "Toggle Gmail on to scan your inbox.");
      return;
    }
    setScanning(true);
    try {
      const data = await triggerGmailScan();
      const count = data.trips_created || 0;
      setLastScan(new Date());
      tap("medium");
      Alert.alert(
        count > 0 ? `${count} trip${count > 1 ? "s" : ""} found` : "Inbox scanned",
        count > 0
          ? "New bookings have been added to your trips."
          : "No new bookings found. Wingman will keep watching."
      );
    } catch (e) {
      Alert.alert("Scan failed", e.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Data Sources" />

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroH}>Wingman reads the room.</Text>
          <Text style={s.heroSub}>
            Connect your inbox, calendar, and messages so Wingman can find your trips automatically — no manual entry required.
          </Text>
          <Text style={s.heroDisclaimer}>
            All integrations are opt-in. Your data is never used for advertising or sold to third parties.
          </Text>
        </View>

        {/* Sources */}
        <Text style={g.sectionT}>CONNECTED SOURCES</Text>
        <View style={g.group}>
          <SourceRow
            icon={SOURCE_ICONS.gmail}
            title="Gmail"
            subtitle="Extracts confirmations and booking details from your inbox"
            connected={gmailConnected}
            onToggle={handleGmailToggle}
            loading={loadingGmail}
            badge={gmailConnected ? "Active" : null}
          />
          <SourceRow
            icon={SOURCE_ICONS.calendar}
            title="Calendar"
            subtitle="Parses travel invites and itineraries to understand where you're going"
            connected={false}
            onToggle={handleCalendarToggle}
            loading={loadingCal}
          />
          <SourceRow
            icon={SOURCE_ICONS.messages}
            title="Messages"
            subtitle="Reads shared plans and reservations to keep you aligned with travel companions"
            connected={false}
            onToggle={() => Alert.alert("Coming soon", "Messages integration is coming in the next update.")}
            loading={false}
          />
        </View>

        {/* Manual scan */}
        {gmailConnected && (
          <View>
            <Text style={g.sectionT}>INBOX SCAN</Text>
            <View style={g.group}>
              <View style={s.scanRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.scanT}>Scan inbox now</Text>
                  <Text style={s.scanSub}>
                    {lastScan
                      ? `Last scanned ${lastScan.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                      : "Wingman scans automatically every 4 hours"
                    }
                  </Text>
                </View>
                <Pressable style={[s.scanBtn, scanning && { opacity: 0.6 }]} onPress={handleScan} disabled={scanning}>
                  {scanning
                    ? <ActivityIndicator size="small" color={C.bg} />
                    : <Text style={s.scanBtnT}>Scan →</Text>
                  }
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* How it works */}
        <Text style={g.sectionT}>HOW IT WORKS</Text>
        <View style={g.group}>
          {[
            { icon: "◎", title: "Zero-friction input", body: "Connect once and Wingman monitors continuously — no manual uploads or forwarding required." },
            { icon: "◈", title: "Structured extraction", body: "Every confirmation email is parsed into a structured itinerary with flight numbers, gates, and confirmation codes." },
            { icon: "◆", title: "Downstream awareness", body: "Wingman maps the full trip graph — flights, transfers, hotels — so it can calculate the cascade impact of any disruption." },
          ].map((item, i) => (
            <View key={i} style={[s.howRow, i === 2 && { borderBottomWidth: 0 }]}>
              <Text style={s.howIcon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.howTitle}>{item.title}</Text>
                <Text style={s.howBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  hero: { marginBottom: 24 },
  heroH: { color: C.ink, fontSize: 28, fontFamily: "PlayfairDisplay_700Bold", lineHeight: 36, marginBottom: 10 },
  heroSub: { color: C.mut, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  heroDisclaimer: { color: C.mut, fontSize: 11, lineHeight: 16, fontStyle: "italic" },

  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(201,169,110,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(201,169,110,0.2)" },
  rowIconT: { fontSize: 18, color: C.gold },
  rowTitle: { color: C.ink, fontSize: 15, fontFamily: T.sansB },
  rowSub: { color: C.mut, fontSize: 12, lineHeight: 17, marginTop: 2 },

  badge: { backgroundColor: "rgba(201,169,110,0.12)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(201,169,110,0.25)" },
  badgeT: { color: C.gold, fontSize: 10, fontFamily: T.sansB },

  scanRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  scanT: { color: C.ink, fontSize: 15, fontFamily: T.sansB },
  scanSub: { color: C.mut, fontSize: 12, marginTop: 2 },
  scanBtn: { backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  scanBtnT: { color: C.bg, fontSize: 14, fontFamily: T.sansB },

  howRow: { flexDirection: "row", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  howIcon: { fontSize: 18, color: C.gold, marginTop: 2 },
  howTitle: { color: C.ink, fontSize: 14, fontFamily: T.sansB, marginBottom: 3 },
  howBody: { color: C.mut, fontSize: 13, lineHeight: 19 },
});
