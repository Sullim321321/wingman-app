// ConnectionsScreen — Ambient Sync / Connections
// Warm espresso palette + champagne gold + DM Sans

import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  Alert, ActivityIndicator, TextInput, Linking,
} from "react-native";
import * as Calendar from "expo-calendar";
import { C, T } from "../theme";
import { BackBar, Btn, SerifText, g } from "../components";
import { getMe, getGmailConnectUrl, triggerGmailScan, scanEmailBody } from "../api";

// ─── Hairline icon labels for each channel ────────────────────────────────────
// Using clean Unicode characters instead of emoji
const CHANNEL_ICONS = {
  gmail:     { char: "@",  bg: C.gold + "12" },
  calendar:  { char: "#",  bg: C.gold + "12" },
  uber:      { char: "U",  bg: C.card2 },
  whatsapp:  { char: "W",  bg: C.card2 },
  imessage:  { char: "M",  bg: C.card2 },
  paste:     { char: "P",  bg: C.gold + "12" },
};

// ─── Feature bullet ───────────────────────────────────────────────────────────

function Feat({ ic, t, color }) {
  return (
    <View style={g.feat}>
      <View style={s.featIcon}>
        <Text style={{ color: color || C.gold, fontSize: 12, fontFamily: T.sansB }}>{ic}</Text>
      </View>
      <Text style={{ color: C.ink, fontSize: 13, fontFamily: T.sans, flex: 1, lineHeight: 19 }}>{t}</Text>
    </View>
  );
}

// ─── Connection row ───────────────────────────────────────────────────────────

function ConnRow({ iconKey, title, sub, right, onPress, disabled, last }) {
  const icon = CHANNEL_ICONS[iconKey] || { char: "·", bg: C.card2 };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[s.row, last && { borderBottomWidth: 0 }]}
    >
      <View style={[s.iconBox, { backgroundColor: icon.bg }]}>
        <Text style={{ fontSize: 14, color: C.gold, fontFamily: T.sansB }}>{icon.char}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowT}>{title}</Text>
        <Text style={s.rowS}>{sub}</Text>
      </View>
      {right}
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ConnectionsScreen({ navigation }) {
  const [gmailConnected,  setGmailConnected]  = useState(false);
  const [calendarGranted, setCalendarGranted] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [scanning,   setScanning]   = useState(false);
  const [calGranting,setCalGranting]= useState(false);

  const [showPaste,   setShowPaste]   = useState(false);
  const [pasteText,   setPasteText]   = useState("");
  const [pasteLoading,setPasteLoading]= useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await getMe();
        setGmailConnected(data.gmail_connected || false);
      } catch {}
      try {
        const { status } = await Calendar.getCalendarPermissionsAsync();
        setCalendarGranted(status === "granted");
      } catch {}
      setLoading(false);
    };
    init();
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
              Alert.alert("Gmail connected", "Wingman is scanning your inbox for travel bookings. Pull to refresh on the Trips tab in a moment.");
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

  const submitPaste = async () => {
    if (!pasteText.trim()) return;
    setPasteLoading(true);
    try {
      const result = await scanEmailBody(pasteText.trim(), "paste");
      if (result.trips_created > 0) {
        Alert.alert(
          `${result.trips_created} trip${result.trips_created > 1 ? "s" : ""} imported`,
          "Pull to refresh on the Trips tab to see them.",
          [{ text: "Done", onPress: () => { setPasteText(""); setShowPaste(false); } }]
        );
      } else {
        Alert.alert("No trips found", "Wingman couldn't find a flight or hotel confirmation in that text. Try pasting the full booking confirmation email.");
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setPasteLoading(false);
    }
  };

  const connectCalendar = async () => {
    setCalGranting(true);
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === "granted") {
        setCalendarGranted(true);
        Alert.alert("Calendar connected", "Wingman will now read your calendar to detect travel events and pre-fill trip dates.");
      } else {
        Alert.alert("Permission denied", "You can enable Calendar access in Settings → Privacy → Calendars → Wingman.");
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setCalGranting(false);
    }
  };

  const ConnBadge = ({ on }) => on ? (
    <View style={s.connectedBadge}><Text style={s.connectedT}>ON</Text></View>
  ) : null;

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Connections" />

        {/* Trust note */}
        <View style={g.trustNote}>
          <Text style={g.trustNoteT}>
            Wingman connects through{" "}
            <Text style={{ color: C.gold, fontFamily: T.sansB }}>official APIs and on-device permissions</Text>
            {" "}— reading only travel-relevant details. Encrypted, scoped, and revocable anytime.
          </Text>
        </View>

        {/* ── Ambient sources ──────────────────────────────────────────────── */}
        <Text style={g.sectionT}>AMBIENT SOURCES</Text>
        <Text style={s.ambientNote}>
          With your permission, Wingman watches these sources silently in the background. Your trips appear automatically — no manual entry needed.
        </Text>

        <View style={g.group}>
          {/* Gmail */}
          <ConnRow
            iconKey="gmail"
            title="Gmail"
            sub={
              loading ? "Checking..." :
              gmailConnected ? "Connected — scanning for bookings" :
              "Import flight and hotel confirmations automatically"
            }
            right={
              loading ? (
                <ActivityIndicator color={C.gold} size="small" />
              ) : gmailConnected ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={s.rescanBtn} onPress={rescan} disabled={scanning}>
                    {scanning
                      ? <ActivityIndicator color={C.gold} size="small" />
                      : <Text style={s.rescanT}>Re-scan</Text>}
                  </Pressable>
                  <ConnBadge on />
                </View>
              ) : (
                <Pressable style={s.connectBtn} onPress={connectGmail} disabled={connecting}>
                  {connecting
                    ? <ActivityIndicator color={C.inkD} size="small" />
                    : <Text style={s.connectBtnT}>Connect</Text>}
                </Pressable>
              )
            }
          />

          {/* Calendar */}
          <ConnRow
            iconKey="calendar"
            title="Calendar"
            sub={
              calendarGranted
                ? "Connected — reading travel events and flight dates"
                : "Detect trip dates and pre-fill itinerary from your calendar"
            }
            right={
              calendarGranted ? (
                <ConnBadge on />
              ) : (
                <Pressable style={s.connectBtn} onPress={connectCalendar} disabled={calGranting}>
                  {calGranting
                    ? <ActivityIndicator color={C.inkD} size="small" />
                    : <Text style={s.connectBtnT}>Connect</Text>}
                </Pressable>
              )
            }
          />

          {/* Uber */}
          <ConnRow
            iconKey="uber"
            title="Uber"
            sub="Auto-opens Uber with airport pickup when you land — no account needed"
            right={<ConnBadge on />}
          />

          {/* WhatsApp */}
          <ConnRow
            iconKey="whatsapp"
            title="WhatsApp"
            sub="Group-chat trip plans — coming soon"
            right={<View style={s.soonBadge}><Text style={s.soonT}>SOON</Text></View>}
            disabled
          />

          {/* iMessage */}
          <ConnRow
            iconKey="imessage"
            title="iMessage"
            sub='"We\'re delayed" texts — coming soon'
            right={<View style={s.soonBadge}><Text style={s.soonT}>SOON</Text></View>}
            disabled
            last
          />
        </View>

        {/* ── Manual import ─────────────────────────────────────────────────── */}
        <Text style={g.sectionT}>MANUAL IMPORT</Text>
        <View style={g.group}>
          <ConnRow
            iconKey="paste"
            title="Paste a confirmation email"
            sub="Copy a booking confirmation and paste it here — Wingman extracts the trip instantly"
            right={
              <Pressable style={s.connectBtn} onPress={() => setShowPaste(v => !v)}>
                <Text style={s.connectBtnT}>{showPaste ? "Cancel" : "Paste"}</Text>
              </Pressable>
            }
            last
          />
        </View>

        {showPaste && (
          <View style={s.pasteWrap}>
            <TextInput
              style={s.pasteInput}
              placeholder="Paste your booking confirmation here…"
              placeholderTextColor={C.mut}
              value={pasteText}
              onChangeText={setPasteText}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
            <Btn
              title={pasteLoading ? "Scanning…" : "Import trip"}
              onPress={submitPaste}
              style={{ marginTop: 10 }}
            />
          </View>
        )}

        {/* ── What Wingman reads ────────────────────────────────────────────── */}
        <Text style={g.sectionT}>WHAT WINGMAN READS</Text>
        <View style={[g.group, { paddingVertical: 12 }]}>
          <Feat ic="+" t="Booking and flight confirmations from Gmail" />
          <Feat ic="#" t="Trip dates and flight times from Calendar" />
          <Feat ic="H" t="Hotel check-in and check-out confirmations" />
          <Feat ic="U" t="Opens Uber on landing — no account linking required" />
          <Feat ic="L" t="Read-only access — Wingman never sends emails or edits events" />
          <Feat ic="X" color={C.coral} t="Nothing personal or off-topic — ever." />
        </View>

        <Text style={s.note}>Revoke any connection in one tap. Your data is never sold or shared.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  app:         { flex: 1, backgroundColor: C.bg },
  ambientNote: { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 20, marginBottom: 14 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 0.5, borderBottomColor: C.line,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, borderColor: C.line,
    alignItems: "center", justifyContent: "center",
  },
  rowT: { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  rowS: { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 2, lineHeight: 17 },

  connectBtn:  { backgroundColor: C.gold, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  connectBtnT: { color: C.inkD, fontSize: 12, fontFamily: T.sansB, letterSpacing: 0.3 },

  connectedBadge: {
    backgroundColor: C.gold + "15", borderWidth: 1,
    borderColor: C.gold + "40", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  connectedT: { color: C.gold, fontSize: 10, fontFamily: T.sansB, letterSpacing: T.trackMed },

  rescanBtn: {
    backgroundColor: C.card2, borderWidth: 1, borderColor: C.line,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  rescanT: { color: C.ink, fontSize: 12, fontFamily: T.sansM },

  soonBadge: {
    backgroundColor: C.card2, borderWidth: 1, borderColor: C.line,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  soonT: { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: T.trackMed },

  pasteWrap: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1,
    borderColor: C.line, padding: 16, marginBottom: 14,
  },
  pasteInput: {
    color: C.ink, fontSize: 14, fontFamily: T.sans, lineHeight: 22,
    minHeight: 140, backgroundColor: C.card2,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.line,
  },

  featIcon: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: C.gold + "10", borderWidth: 1, borderColor: C.gold + "25",
    alignItems: "center", justifyContent: "center",
  },

  note: { color: C.mut, fontSize: 12, fontFamily: T.sans, textAlign: "center", marginTop: 10 },
});
