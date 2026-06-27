import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  Alert, ActivityIndicator, TextInput, Linking, Platform,
} from "react-native";
import * as Calendar from "expo-calendar";
import { C } from "../theme";
import { BackBar, Btn, g } from "../components";
import { getMe, getGmailConnectUrl, triggerGmailScan, scanEmailBody } from "../api";

// ─── Feature bullet ──────────────────────────────────────────────────────────

function Feat({ ic, t, color }) {
  return (
    <View style={g.feat}>
      <Text style={{ color: color || C.teal, fontSize: 14 }}>{ic}</Text>
      <Text style={{ color: C.ink, fontSize: 13, flex: 1, lineHeight: 18 }}>{t}</Text>
    </View>
  );
}

// ─── Connection row ───────────────────────────────────────────────────────────

function ConnRow({ ic, iconBg, title, sub, right, onPress, disabled, last }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[s.row, last && { borderBottomWidth: 0 }]}
    >
      <View style={[s.iconBox, { backgroundColor: iconBg || "rgba(255,255,255,0.06)" }]}>
        <Text style={{ fontSize: 18 }}>{ic}</Text>
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
  const [gmailConnected, setGmailConnected] = useState(false);
  const [calendarGranted, setCalendarGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [calGranting, setCalGranting] = useState(false);

  // Email paste import
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteLoading, setPasteLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await getMe();
        setGmailConnected(data.gmail_connected || false);
      } catch {}
      // Check calendar permission status
      try {
        const { status } = await Calendar.getCalendarPermissionsAsync();
        setCalendarGranted(status === "granted");
      } catch {}
      setLoading(false);
    };
    init();
  }, []);

  // ── Gmail ──────────────────────────────────────────────────────────────────

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
              Alert.alert(
                "Gmail connected!",
                "Wingman is scanning your inbox for travel bookings. Pull to refresh on the Trips tab in a moment."
              );
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
      Alert.alert(
        "Scan started",
        "Wingman is re-scanning your inbox. Pull to refresh on the Trips tab in about 30 seconds."
      );
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setScanning(false);
    }
  };

  // ── Email paste import ─────────────────────────────────────────────────────

  const submitPaste = async () => {
    if (!pasteText.trim()) return;
    setPasteLoading(true);
    try {
      const result = await scanEmailBody(pasteText.trim(), "paste");
      if (result.trips_created > 0) {
        Alert.alert(
          `${result.trips_created} trip${result.trips_created > 1 ? "s" : ""} imported!`,
          "Pull to refresh on the Trips tab to see them.",
          [{ text: "Done", onPress: () => { setPasteText(""); setShowPaste(false); } }]
        );
      } else {
        Alert.alert(
          "No trips found",
          "Wingman couldn't find a flight or hotel confirmation in that text. Try pasting the full booking confirmation email."
        );
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setPasteLoading(false);
    }
  };

  // ── Calendar ───────────────────────────────────────────────────────────────

  const connectCalendar = async () => {
    setCalGranting(true);
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === "granted") {
        setCalendarGranted(true);
        Alert.alert(
          "Calendar connected!",
          "Wingman will now read your calendar to detect travel events and pre-fill trip dates."
        );
      } else {
        Alert.alert(
          "Permission denied",
          "You can enable Calendar access in Settings → Privacy → Calendars → Wingman."
        );
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setCalGranting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const ConnBadge = ({ on }) => on ? (
    <View style={s.connectedBadge}><Text style={s.connectedT}>✓ On</Text></View>
  ) : null;

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Connections" />

        <View style={g.trustNote}>
          <Text style={g.trustNoteT}>
            Wingman connects through{" "}
            <Text style={{ color: C.teal, fontWeight: "700" }}>official APIs and on-device permissions</Text>
            {" "}— reading only travel-relevant details. Encrypted, scoped, and revocable anytime.
          </Text>
        </View>

        {/* ── Ambient sources ─────────────────────────────────────────────── */}
        <Text style={g.sectionT}>AMBIENT SOURCES</Text>
        <Text style={s.ambientNote}>
          With your permission, Wingman watches these sources silently in the background. Your trips appear automatically — no manual entry needed.
        </Text>

        <View style={g.group}>
          {/* Gmail */}
          <ConnRow
            ic="✉️"
            iconBg="rgba(255,107,94,0.12)"
            title="Gmail"
            sub={
              loading ? "Checking..." :
              gmailConnected ? "Connected — scanning for bookings" :
              "Import flight & hotel confirmations automatically"
            }
            right={
              loading ? (
                <ActivityIndicator color={C.teal} size="small" />
              ) : gmailConnected ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={s.rescanBtn} onPress={rescan} disabled={scanning}>
                    {scanning
                      ? <ActivityIndicator color={C.teal} size="small" />
                      : <Text style={s.rescanT}>Re-scan</Text>}
                  </Pressable>
                  <ConnBadge on />
                </View>
              ) : (
                <Pressable style={s.connectBtn} onPress={connectGmail} disabled={connecting}>
                  {connecting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.connectBtnT}>Connect</Text>}
                </Pressable>
              )
            }
          />

          {/* Calendar */}
          <ConnRow
            ic="📅"
            iconBg="rgba(74,114,255,0.12)"
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
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.connectBtnT}>Connect</Text>}
                </Pressable>
              )
            }
          />

          {/* Uber */}
          <ConnRow
            ic="🚗"
            iconBg="rgba(0,0,0,0.3)"
            title="Uber"
            sub="Auto-opens Uber with airport pickup when you land — no account needed"
            right={<ConnBadge on />}
          />

          {/* WhatsApp */}
          <ConnRow
            ic="💬"
            iconBg="rgba(37,211,102,0.12)"
            title="WhatsApp"
            sub="Group-chat trip plans — coming soon"
            right={<View style={s.soonBadge}><Text style={s.soonT}>Soon</Text></View>}
            disabled
          />

          {/* iMessage */}
          <ConnRow
            ic="📱"
            iconBg="rgba(34,211,166,0.12)"
            title="iMessage"
            sub='"We\'re delayed" texts — coming soon'
            right={<View style={s.soonBadge}><Text style={s.soonT}>Soon</Text></View>}
            disabled
            last
          />
        </View>

        {/* ── Manual import ────────────────────────────────────────────────── */}
        <Text style={g.sectionT}>MANUAL IMPORT</Text>
        <View style={g.group}>
          <ConnRow
            ic="📋"
            iconBg="rgba(255,176,46,0.12)"
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
              disabled={pasteLoading || !pasteText.trim()}
              style={{ marginTop: 10 }}
            />
          </View>
        )}

        {/* ── What Wingman reads ───────────────────────────────────────────── */}
        <Text style={g.sectionT}>WHAT WINGMAN READS</Text>
        <View style={[g.group, { paddingVertical: 12 }]}>
          <Feat ic="✈️" t="Booking & flight confirmations from Gmail" />
          <Feat ic="📆" t="Trip dates and flight times from Calendar" />
          <Feat ic="🏨" t="Hotel check-in and check-out confirmations" />
          <Feat ic="🚗" t="Opens Uber on landing — no account linking required" />
          <Feat ic="🔒" t="Read-only access — Wingman never sends emails or edits events" />
          <Feat ic="⦸" color={C.coral} t="Nothing personal or off-topic — ever." />
        </View>

        <Text style={s.note}>Revoke any connection in one tap. Your data is never sold or shared.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  ambientNote: { color: C.mut, fontSize: 13, lineHeight: 20, marginBottom: 14 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowT: { color: C.ink, fontSize: 14, fontWeight: "600" },
  rowS: { color: C.mut, fontSize: 12, marginTop: 2, lineHeight: 17 },
  connectBtn: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  connectBtnT: { color: "#fff", fontSize: 13, fontWeight: "700" },
  connectedBadge: {
    backgroundColor: "rgba(20,201,153,0.12)", borderWidth: 1,
    borderColor: "rgba(20,201,153,0.25)", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  connectedT: { color: C.teal, fontSize: 12, fontWeight: "700" },
  rescanBtn: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  rescanT: { color: C.ink, fontSize: 12, fontWeight: "600" },
  soonBadge: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  soonT: { color: C.mut, fontSize: 12 },
  pasteWrap: {
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1,
    borderColor: C.line, padding: 16, marginBottom: 14,
  },
  pasteInput: {
    color: C.ink, fontSize: 14, lineHeight: 22,
    minHeight: 140, backgroundColor: C.card2,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.line,
  },
  note: { color: C.mut, fontSize: 12, textAlign: "center", marginTop: 10 },
});
