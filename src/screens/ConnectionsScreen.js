// ConnectionsScreen — Wingman
// Warm espresso palette + champagne gold + DM Sans

import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  Alert, ActivityIndicator, TextInput, Linking, AppState, Share,
} from "react-native";
import * as Calendar from "expo-calendar";
import { C, T } from "../theme";
import { BackBar, Btn, SerifText, g } from "../components";
import { getMe, getGmailConnectUrl, triggerGmailScan, scanEmailBody, syncCalendar } from "../api";

// ─── Hairline icon labels for each channel ────────────────────────────────────
const CHANNEL_ICONS = {
  gmail:     { char: "@",  bg: C.gold + "12" },
  calendar:  { char: "#",  bg: C.gold + "12" },
  gcal:      { char: "G",  bg: C.gold + "12" },
  uber:      { char: "U",  bg: C.card2 },
  whatsapp:  { char: "W",  bg: C.card2 },
  imessage:  { char: "M",  bg: C.card2 },
  paste:     { char: "P",  bg: C.gold + "12" },
  forward:   { char: "→",  bg: C.gold + "12" },
};

const FORWARD_EMAIL = "import@wingmantravel.app";

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
  const [gmailConnected,    setGmailConnected]    = useState(false);
  const [appleCalGranted,   setAppleCalGranted]   = useState(false);
  const [loading,           setLoading]           = useState(true);
  const [connecting,        setConnecting]        = useState(false);
  const [scanning,          setScanning]          = useState(false);
  const [calGranting,       setCalGranting]       = useState(false);
  const [showPaste,         setShowPaste]         = useState(false);
  const [pasteText,         setPasteText]         = useState("");
  const [pasteLoading,      setPasteLoading]      = useState(false);

  // Track whether we're waiting for the user to return from Gmail OAuth in Safari
  const awaitingGmailReturn = useRef(false);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await getMe();
        setGmailConnected(data.gmail_connected || false);
      } catch {}
      try {
        const { status } = await Calendar.getCalendarPermissionsAsync();
        setAppleCalGranted(status === "granted");
      } catch {}
      setLoading(false);
    };
    init();
  }, []);

  // When the app returns to foreground, re-check Gmail status if we sent the
  // user to Safari to complete OAuth. This replaces the unreliable 3-second timeout.
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (nextState === "active" && awaitingGmailReturn.current) {
        awaitingGmailReturn.current = false;
        try {
          const me = await getMe();
          const connected = me.gmail_connected || false;
          setGmailConnected(connected);
          if (connected) {
            Alert.alert(
              "Gmail connected",
              "Wingman is scanning your inbox for travel bookings. Pull to refresh on the Trips tab in a moment."
            );
          } else {
            Alert.alert(
              "Not connected yet",
              "It looks like Gmail wasn't connected. Please try again — make sure to complete the sign-in and grant Wingman read-only access."
            );
          }
        } catch {}
      }
    });
    return () => sub.remove();
  }, []);

  const connectGmail = async () => {
    setConnecting(true);
    try {
      const data = await getGmailConnectUrl();
      if (data.url) {
        awaitingGmailReturn.current = true;
        await Linking.openURL(data.url);
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
        setPasteText("");
        setShowPaste(false);
        Alert.alert(
          result.trips_created === 1 ? "Trip imported" : `${result.trips_created} trips imported`,
          result.trips_created === 1
            ? "Wingman has extracted your itinerary and is now monitoring it for disruptions."
            : `Wingman found ${result.trips_created} trips in that email and is monitoring all of them.`,
          [
            { text: "View Trips", onPress: () => navigation.navigate("Trips") },
            { text: "Done", style: "cancel" },
          ]
        );
      } else {
        Alert.alert(
          "No trips found",
          "Wingman couldn't find a flight or hotel confirmation in that text.\n\nTip: paste the full booking confirmation email — including the subject line and all booking details."
        );
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setPasteLoading(false);
    }
  };

  // ── Helper: read calendar events and sync travel signals to backend ──────
  const readAndSyncCalendar = async () => {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const now = new Date();
      const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days ahead
      const past   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days back
      const calIds = calendars.map(c => c.id);
      const events = await Calendar.getEventsAsync(calIds, past, future);
      // Filter to travel-relevant events before sending
      const travelRe = /flight|hotel|check.?in|check.?out|airport|depart|arrive|booking|reservation|itinerary|transit|train|cruise|trip|travel/i;
      const travelEvents = events
        .filter(ev => travelRe.test(`${ev.title || ""} ${ev.notes || ""} ${ev.location || ""}`))
        .map(ev => ({
          title:     ev.title,
          notes:     ev.notes,
          location:  ev.location,
          startDate: ev.startDate,
          endDate:   ev.endDate,
        }));
      if (travelEvents.length > 0) {
        const result = await syncCalendar(travelEvents);
        return result.signals_created || 0;
      }
      return 0;
    } catch (e) {
      console.warn("[calendar sync]", e.message);
      return 0;
    }
  };

  const connectAppleCalendar = async () => {
    setCalGranting(true);
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === "granted") {
        setAppleCalGranted(true);
        // Immediately read and sync travel events
        const count = await readAndSyncCalendar();
        Alert.alert(
          "Apple Calendar connected",
          count > 0
            ? `Wingman found ${count} travel event${count !== 1 ? "s" : ""} in your calendar and is now monitoring them.`
            : "Wingman is now watching your calendar. Travel events will appear automatically as you add them."
        );
      } else {
        Alert.alert("Permission denied", "Enable Calendar access in Settings → Privacy & Security → Calendars → Wingman.");
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setCalGranting(false);
    }
  };

  const connectGoogleCalendar = async () => {
    // Google Calendar is accessed via the same Gmail OAuth scope (calendar.readonly).
    // For now, direct users to connect Gmail which covers both inbox + calendar.
    Alert.alert(
      "Google Calendar",
      "Connect Gmail above to give Wingman access to both your Gmail and Google Calendar — it uses the same sign-in.",
      [
        { text: "Connect Gmail", onPress: connectGmail },
        { text: "Cancel", style: "cancel" },
      ]
    );
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

          {/* Apple Calendar */}
          <ConnRow
            iconKey="calendar"
            title="Apple Calendar"
            sub={
              appleCalGranted
                ? "Connected — reading travel events and flight dates"
                : "Detect trip dates and pre-fill itinerary from your Apple Calendar"
            }
            right={
              appleCalGranted ? (
                <ConnBadge on />
              ) : (
                <Pressable style={s.connectBtn} onPress={connectAppleCalendar} disabled={calGranting}>
                  {calGranting
                    ? <ActivityIndicator color={C.inkD} size="small" />
                    : <Text style={s.connectBtnT}>Connect</Text>}
                </Pressable>
              )
            }
          />

          {/* Google Calendar */}
          <ConnRow
            iconKey="gcal"
            title="Google Calendar"
            sub={
              gmailConnected
                ? "Connected via Gmail — reading travel events"
                : "Connect via Gmail to read your Google Calendar"
            }
            right={
              gmailConnected ? (
                <ConnBadge on />
              ) : (
                <Pressable style={s.connectBtn} onPress={connectGoogleCalendar}>
                  <Text style={s.connectBtnT}>Connect</Text>
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
            sub="Share a booking confirmation from WhatsApp directly to Wingman"
            onPress={() => {
              Alert.alert(
                "Import from WhatsApp",
                "To import a trip from WhatsApp:\n\n1. Open the booking confirmation message\n2. Tap and hold the message \u2192 Share\n3. Choose Wingman from the share sheet\n\nOr forward the text to:\nimport@wingmantravel.app",
                [
                  {
                    text: "Open WhatsApp",
                    onPress: () => Linking.openURL("whatsapp://").catch(() =>
                      Alert.alert("WhatsApp not installed", "Install WhatsApp to use this feature.")
                    )
                  },
                  { text: "Got it", style: "cancel" },
                ]
              );
            }}
            right={<View style={s.connectBtn}><Text style={s.connectBtnT}>How to</Text></View>}
          />

          {/* iMessage */}
          <ConnRow
            iconKey="imessage"
            title="iMessage"
            sub="Forward a booking confirmation or flight text from iMessage to Wingman"
            onPress={() => {
              Alert.alert(
                "Import from iMessage",
                "To import a trip from iMessage:\n\n1. Open the booking confirmation message\n2. Tap and hold the message \u2192 More\n3. Forward to import@wingmantravel.app\n\nWingman will extract your trip automatically.",
                [
                  {
                    text: "Open Messages",
                    onPress: () => Linking.openURL("sms:").catch(() => {})
                  },
                  { text: "Got it", style: "cancel" },
                ]
              );
            }}
            right={<View style={s.connectBtn}><Text style={s.connectBtnT}>How to</Text></View>}
            last
          />
        </View>

        {/* ── Manual import ─────────────────────────────────────────────────── */}
        <Text style={g.sectionT}>MANUAL IMPORT</Text>
        <View style={g.group}>
          {/* Forward-to-import */}
          <ConnRow
            iconKey="forward"
            title="Forward a booking email"
            sub={`Forward any booking confirmation to ${FORWARD_EMAIL} — Wingman imports it automatically`}
            right={
              <Pressable
                style={s.connectBtn}
                onPress={() => {
                  Share.share({ message: FORWARD_EMAIL, title: "Wingman import address" })
                    .catch(() => Alert.alert("Forward to", FORWARD_EMAIL));
                }}
              >
                <Text style={s.connectBtnT}>Share</Text>
              </Pressable>
            }
          />
          {/* Paste — always visible, prominent */}
          <ConnRow
            iconKey="paste"
            title="Paste a confirmation email"
            sub="Copy a booking confirmation and paste it here — Wingman extracts the trip instantly"
            last
          />
        </View>
        <View style={s.pasteWrap}>
          <TextInput
            style={s.pasteInput}
            placeholder={`Paste your booking confirmation here…\n\ne.g. \"Your booking is confirmed: AA 412, JFK → LAX, Jan 15, 10:35 AM\"`}
            placeholderTextColor={C.mut}
            value={pasteText}
            onChangeText={setPasteText}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            autoCorrect={false}
            spellCheck={false}
          />
          <Btn
            title={pasteLoading ? "Scanning…" : "Import trip"}
            onPress={submitPaste}
            disabled={!pasteText.trim() || pasteLoading}
            style={{ marginTop: 12 }}
          />
          {pasteText.trim().length === 0 && (
            <Text style={s.pasteHint}>Works with any airline, hotel, or OTA confirmation email (Expedia, Booking.com, etc.)</Text>
          )}
        </View>

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
    borderColor: "rgba(201,169,110,0.25)", padding: 16, marginBottom: 14,
  },
  pasteInput: {
    color: C.ink, fontSize: 14, fontFamily: T.sans, lineHeight: 22,
    minHeight: 160, backgroundColor: C.card2,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)",
  },
  pasteHint: { color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 17, marginTop: 10, textAlign: "center" },
  featIcon: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: C.gold + "10", borderWidth: 1, borderColor: C.gold + "25",
    alignItems: "center", justifyContent: "center",
  },
  note: { color: C.mut, fontSize: 12, fontFamily: T.sans, textAlign: "center", marginTop: 10 },
});
