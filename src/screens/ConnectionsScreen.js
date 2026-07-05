// ConnectionsScreen.js — multi-account Gmail/Calendar support + TripIt/TravelPerk/PDF import
// Warm espresso palette + champagne gold + DM Sans

import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  Alert, ActivityIndicator, TextInput, Linking, AppState, Share,
} from "react-native";
import * as Calendar from "expo-calendar";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { C, T } from "../theme";
import { BackBar, Btn, g } from "../components";
import {
  getMe, getGmailConnectUrl, triggerGmailScan, rescanInbox,
  disconnectGmail, disconnectGmailAccount, scanEmailBody, syncCalendar,
  syncTripItIcal, getTripItStatus, disconnectTripIt,
  getTravelPerkConnectUrl, syncTravelPerk, getTravelPerkStatus, disconnectTravelPerk,
  importPdfOcr,
} from "../api";

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

// ── Connected account row (for each Google account) ──────────────────────────
function AccountRow({ account, onDisconnect, onRescan, scanning, last, rescanResult }) {
  const label = account.label || account.account_email || "Google Account";
  const hasResult = rescanResult && (rescanResult.legs_added > 0 || rescanResult.trips_created > 0);
  return (
    <View style={[s.accountRow, last && { borderBottomWidth: 0 }]}>
      <View style={[s.iconBox, { backgroundColor: C.gold + "12" }]}>
        <Text style={{ fontSize: 14, color: C.gold, fontFamily: T.sansB }}>@</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowT} numberOfLines={1}>{label}</Text>
        {scanning
          ? <Text style={[s.rowS, { color: C.gold }]}>Scanning inbox…</Text>
          : hasResult
            ? <Text style={[s.rowS, { color: C.teal }]}>
                {rescanResult.trips_created > 0
                  ? `+${rescanResult.trips_created} trip${rescanResult.trips_created !== 1 ? 's' : ''}, `
                  : ''}
                {rescanResult.legs_added > 0
                  ? `+${rescanResult.legs_added} booking${rescanResult.legs_added !== 1 ? 's' : ''} found`
                  : 'Up to date'}
              </Text>
            : rescanResult
              ? <Text style={[s.rowS, { color: C.mut }]}>Up to date</Text>
              : <Text style={s.rowS}>Connected — tap Re-scan to import bookings</Text>}
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Pressable style={s.rescanBtn} onPress={onRescan} disabled={scanning}>
          {scanning
            ? <ActivityIndicator color={C.gold} size="small" />
            : <Text style={s.rescanT}>Re-scan</Text>}
        </Pressable>
        <Pressable style={s.disconnectBtn} onPress={onDisconnect}>
          <Text style={s.disconnectT}>✕</Text>
        </Pressable>
        <View style={s.connectedBadge}><Text style={s.connectedT}>ON</Text></View>
      </View>
    </View>
  );
}

export default function ConnectionsScreen({ navigation, route }) {
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [appleCalGranted,   setAppleCalGranted]   = useState(false);
  const [loading,           setLoading]           = useState(true);
  const [connecting,        setConnecting]        = useState(false);
  const [scanning,          setScanning]          = useState(false);
  const [calGranting,       setCalGranting]       = useState(false);
  // Auto-open paste section if navigated here with tab="paste" (e.g. from WelcomeScreen)
  const [showPaste,         setShowPaste]         = useState(route?.params?.tab === "paste");
  const [pasteText,         setPasteText]         = useState("");
  const [pasteLoading,      setPasteLoading]      = useState(false);

  // TripIt iCal
  const [tripitConnected,   setTripitConnected]   = useState(false);
  const [tripitUrl,         setTripitUrl]         = useState("");
  const [showTripitInput,   setShowTripitInput]   = useState(false);
  const [tripitLoading,     setTripitLoading]     = useState(false);

  // TravelPerk OAuth
  const [tpConnected,       setTpConnected]       = useState(false);
  const [tpConnecting,      setTpConnecting]      = useState(false);
  const [tpSyncing,         setTpSyncing]         = useState(false);
  const awaitingTpReturn = useRef(false);

  // PDF OCR
  const [pdfLoading,        setPdfLoading]        = useState(false);

  const awaitingGmailReturn = useRef(false);

  const gmailConnected = connectedAccounts.length > 0;

  useEffect(() => {
    const init = async () => {
      try {
        const data = await getMe();
        setConnectedAccounts(data.connected_accounts || (data.gmail_connected ? [{ id: 0, account_email: data.email, label: null }] : []));
      } catch {}
      try {
        const { status } = await Calendar.getCalendarPermissionsAsync();
        setAppleCalGranted(status === "granted");
      } catch {}
      try {
        const tripit = await getTripItStatus();
        setTripitConnected(tripit.connected);
      } catch {}
      try {
        const tp = await getTravelPerkStatus();
        setTpConnected(tp.connected);
      } catch {}
      setLoading(false);
    };
    init();
  }, []);

  // Re-check when returning from Gmail or TravelPerk OAuth
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (nextState === "active" && awaitingGmailReturn.current) {
        awaitingGmailReturn.current = false;
        try {
          const me = await getMe();
          const accounts = me.connected_accounts || (me.gmail_connected ? [{ id: 0, account_email: me.email, label: null }] : []);
          setConnectedAccounts(accounts);
          if (accounts.length > 0) {
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
      if (nextState === "active" && awaitingTpReturn.current) {
        awaitingTpReturn.current = false;
        try {
          const tp = await getTravelPerkStatus();
          setTpConnected(tp.connected);
          if (tp.connected) {
            Alert.alert("TravelPerk connected", "Wingman is syncing your corporate trips. They'll appear in the Trips tab shortly.");
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
      } else if (data.error) {
        Alert.alert(
          "Gmail not available",
          data.error === "Google OAuth not configured"
            ? "Gmail connection requires Google OAuth credentials to be configured on the server. Please contact support."
            : data.error
        );
      }
    } catch (e) {
      const msg = e?.status === 503
        ? "Gmail connection is not available right now. The server may be starting up — try again in a moment."
        : e?.message?.includes("No connection")
        ? "No internet connection — check your signal and try again."
        : e?.message || "Could not connect Gmail. Try again.";
      Alert.alert("Gmail connection failed", msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectAccount = (account) => {
    const label = account.label || account.account_email || "this account";
    Alert.alert(
      "Disconnect account",
      `Remove ${label} from Wingman? Your imported trips will remain.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              if (account.id && account.id !== 0) {
                await disconnectGmailAccount(account.id);
              } else {
                await disconnectGmail();
              }
              setConnectedAccounts(prev => prev.filter(a => a.id !== account.id));
            } catch (e) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  };

  const [rescanResult, setRescanResult] = useState(null);

  const rescan = async () => {
    setScanning(true);
    setRescanResult(null);
    try {
      const result = await rescanInbox();
      setRescanResult(result);
      // Build a human-readable breakdown
      const breakdown = result.breakdown_by_type || {};
      const parts = Object.entries(breakdown)
        .map(([type, count]) => `${count} ${type}${count !== 1 ? 's' : ''}`)
        .join(", ");
      Alert.alert(
        result.trips_created > 0 || result.legs_added > 0 ? "Inbox scanned" : "Up to date",
        result.message + (parts ? `\n\nNew bookings: ${parts}` : ""),
        [
          result.trips_created > 0 || result.legs_added > 0
            ? { text: "View Trips", onPress: () => navigation.navigate("Trips") }
            : null,
          { text: "Done", style: "cancel" },
        ].filter(Boolean)
      );
    } catch (e) {
      // Fall back to the fire-and-forget scan if the new endpoint isn't live yet
      if (e.message?.includes("404") || e.message?.includes("not found")) {
        try {
          await triggerGmailScan();
          Alert.alert("Scan started", "Wingman is re-scanning your inbox. Check the Trips tab in about 30 seconds.");
        } catch (e2) {
          Alert.alert("Error", e2.message);
        }
      } else if (e.message?.includes("429")) {
        Alert.alert("Please wait", e.message);
      } else {
        Alert.alert("Error", e.message);
      }
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

  const readAndSyncCalendar = async () => {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const now = new Date();
      const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      const past   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const calIds = calendars.map(c => c.id);
      const events = await Calendar.getEventsAsync(calIds, past, future);
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
      // Check current status first — if already denied, go straight to Settings
      const { status: currentStatus } = await Calendar.getCalendarPermissionsAsync();
      if (currentStatus === "denied") {
        Alert.alert(
          "Calendar access blocked",
          "Wingman needs Calendar access to detect trip dates. Please enable it in Settings.",
          [
            { text: "Open Settings", onPress: () => Linking.openURL("app-settings:") },
            { text: "Cancel", style: "cancel" },
          ]
        );
        setCalGranting(false);
        return;
      }
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === "granted") {
        setAppleCalGranted(true);
        const count = await readAndSyncCalendar();
        Alert.alert(
          "Apple Calendar connected",
          count > 0
            ? `Wingman found ${count} travel event${count !== 1 ? "s" : ""} in your calendar and is now monitoring them.`
            : "Wingman is now watching your calendar. Travel events will appear automatically as you add them."
        );
      } else if (status === "denied") {
        Alert.alert(
          "Calendar access denied",
          "To connect Apple Calendar, enable access in Settings → Privacy & Security → Calendars → Wingman.",
          [
            { text: "Open Settings", onPress: () => Linking.openURL("app-settings:") },
            { text: "Cancel", style: "cancel" },
          ]
        );
      } else {
        Alert.alert("Permission required", "Wingman needs Calendar access to detect trip dates automatically.");
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setCalGranting(false);
    }
  };

  const connectGoogleCalendar = async () => {
    Alert.alert(
      "Google Calendar",
      "Connect a Google account above to give Wingman access to both Gmail and Google Calendar — it uses the same sign-in.",
      [
        { text: "Connect Google account", onPress: connectGmail },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // ── TripIt iCal handlers ──────────────────────────────────────────────────
  const connectTripIt = async () => {
    const url = tripitUrl.trim();
    if (!url) return Alert.alert("Paste your TripIt iCal URL", "Go to TripIt → Settings → Publishing Options → Calendar Feed, then copy the URL and paste it here.");
    setTripitLoading(true);
    try {
      const result = await syncTripItIcal(url);
      setTripitConnected(true);
      setShowTripitInput(false);
      setTripitUrl("");
      Alert.alert(
        result.trips_created > 0 ? `${result.trips_created} trip${result.trips_created !== 1 ? 's' : ''} imported` : "TripIt connected",
        result.trips_created > 0
          ? `Wingman imported ${result.trips_created} trip${result.trips_created !== 1 ? 's' : ''} from your TripIt account.`
          : "TripIt is connected. Wingman will sync your trips automatically.",
        [{ text: "View Trips", onPress: () => navigation.navigate("Trips") }, { text: "Done", style: "cancel" }]
      );
    } catch (e) {
      Alert.alert("TripIt sync failed", e.message || "Could not import from TripIt. Check the URL and try again.");
    } finally {
      setTripitLoading(false);
    }
  };

  const handleDisconnectTripIt = () => {
    Alert.alert("Disconnect TripIt", "Remove TripIt sync? Imported trips will remain.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: async () => {
        try { await disconnectTripIt(); setTripitConnected(false); } catch {}
      }},
    ]);
  };

  // ── TravelPerk OAuth handlers ─────────────────────────────────────────────
  const connectTravelPerk = async () => {
    setTpConnecting(true);
    try {
      const data = await getTravelPerkConnectUrl();
      if (data.url) {
        awaitingTpReturn.current = true;
        await Linking.openURL(data.url);
      } else if (data.error) {
        Alert.alert("TravelPerk not available",
          data.error === "TravelPerk OAuth not configured"
            ? "TravelPerk connection requires server configuration. Please contact support."
            : data.error);
      }
    } catch (e) {
      Alert.alert("TravelPerk connection failed", e.message || "Could not connect TravelPerk.");
    } finally {
      setTpConnecting(false);
    }
  };

  const handleResyncTravelPerk = async () => {
    setTpSyncing(true);
    try {
      const result = await syncTravelPerk();
      Alert.alert("Sync complete", result.trips_created > 0 ? `${result.trips_created} new trip${result.trips_created !== 1 ? 's' : ''} imported.` : "Already up to date.");
    } catch (e) {
      Alert.alert("Sync failed", e.message);
    } finally {
      setTpSyncing(false);
    }
  };

  const handleDisconnectTravelPerk = () => {
    Alert.alert("Disconnect TravelPerk", "Remove TravelPerk sync? Imported trips will remain.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: async () => {
        try { await disconnectTravelPerk(); setTpConnected(false); } catch {}
      }},
    ]);
  };

  // ── PDF OCR import ────────────────────────────────────────────────────────
  const importFromPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file) return;
      setPdfLoading(true);
      const data = await importPdfOcr(file.uri, file.mimeType || "application/pdf");
      Alert.alert(
        `Trip imported from PDF`,
        `Wingman extracted "${data.trip_title}" with ${data.legs_created} booking${data.legs_created !== 1 ? 's' : ''}.`,
        [{ text: "View Trip", onPress: () => navigation.navigate("Trips") }, { text: "Done", style: "cancel" }]
      );
    } catch (e) {
      if (e.message?.includes("No booking data")) {
        Alert.alert("No bookings found", "Wingman couldn't find booking details in that PDF. Try forwarding the confirmation email to import@wingmantravel.app instead.");
      } else {
        Alert.alert("PDF import failed", e.message || "Could not read that PDF.");
      }
    } finally {
      setPdfLoading(false);
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
        <Text style={g.sectionT}>CONNECTED SOURCES</Text>
        <Text style={s.ambientNote}>
          Wingman reads only travel-relevant details from these sources, with your explicit permission. Your trips appear automatically — no manual entry needed.
        </Text>

        <View style={g.group}>
          {/* Connected Google accounts */}
          {loading ? (
            <View style={[s.row, { justifyContent: "center" }]}>
              <ActivityIndicator color={C.gold} size="small" />
            </View>
          ) : connectedAccounts.length > 0 ? (
            <>
              {connectedAccounts.map((account, idx) => (
                <AccountRow
                  key={account.id || idx}
                  account={account}
                  onDisconnect={() => handleDisconnectAccount(account)}
                  onRescan={rescan}
                  scanning={scanning}
                  rescanResult={rescanResult}
                  last={idx === connectedAccounts.length - 1 && !true /* never last — add button follows */}
                />
              ))}
              {/* Add another Google account */}
              <Pressable style={s.addAccountRow} onPress={connectGmail} disabled={connecting}>
                <View style={[s.iconBox, { backgroundColor: C.gold + "08" }]}>
                  <Text style={{ fontSize: 16, color: C.gold, fontFamily: T.sansB }}>+</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowT, { color: C.gold }]}>Add another Google account</Text>
                  <Text style={s.rowS}>Connect your work or personal Gmail separately</Text>
                </View>
                {connecting
                  ? <ActivityIndicator color={C.gold} size="small" />
                  : <Text style={{ color: C.gold, fontSize: 18, fontFamily: T.sansM }}>›</Text>}
              </Pressable>
            </>
          ) : (
            /* No accounts connected yet */
            <ConnRow
              iconKey="gmail"
              title="Gmail / Google Calendar"
              sub="Import flight and hotel confirmations automatically"
              right={
                <Pressable style={s.connectBtn} onPress={connectGmail} disabled={connecting}>
                  {connecting
                    ? <ActivityIndicator color={C.inkD} size="small" />
                    : <Text style={s.connectBtnT}>Connect</Text>}
                </Pressable>
              }
            />
          )}

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

          {/* Google Calendar — shown only when no Google account connected */}
          {!gmailConnected && (
            <ConnRow
              iconKey="gcal"
              title="Google Calendar"
              sub="Connect via Gmail to read your Google Calendar"
              right={
                <Pressable style={s.connectBtn} onPress={connectGoogleCalendar}>
                  <Text style={s.connectBtnT}>Connect</Text>
                </Pressable>
              }
            />
          )}

          {/* Uber */}
          <ConnRow
            iconKey="uber"
            title="Uber"
            sub="Opens Uber with your pickup pre-filled when you land — uses your own Uber account"
            onPress={() => {
              // Try to open the Uber app; fall back to App Store
              Linking.canOpenURL("uber://")
                .then(supported => {
                  if (supported) {
                    Linking.openURL("uber://");
                  } else {
                    Alert.alert(
                      "Get Uber",
                      "Wingman uses your Uber account to pre-fill airport pickups when you land. Install Uber to use this feature.",
                      [
                        { text: "Get Uber", onPress: () => Linking.openURL("https://apps.apple.com/app/uber/id368677368") },
                        { text: "Cancel", style: "cancel" },
                      ]
                    );
                  }
                })
                .catch(() => Linking.openURL("https://apps.apple.com/app/uber/id368677368"));
            }}
            right={
              <View style={s.connectBtn}>
                <Text style={s.connectBtnT}>Open</Text>
              </View>
            }
          />

          {/* WhatsApp */}
          <ConnRow
            iconKey="whatsapp"
            title="WhatsApp"
            sub="Share a booking confirmation from WhatsApp directly to Wingman"
            onPress={() => {
              Alert.alert(
                "Import from WhatsApp",
                "To import a trip from WhatsApp:\n\n1. Open the booking confirmation message\n2. Tap and hold the message → Share\n3. Choose Wingman from the share sheet\n\nOr forward the text to:\nimport@wingmantravel.app",
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
                "To import a trip from iMessage:\n\n1. Open the booking confirmation message\n2. Tap and hold the message → More\n3. Forward to import@wingmantravel.app\n\nWingman will extract your trip automatically.",
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

        {/* ── Forward address hero card ─────────────────────────────────── */}
        <View style={s.forwardCard}>
          <View style={s.forwardTop}>
            <View style={s.forwardIconWrap}>
              <Text style={s.forwardIcon}>✉</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.forwardTitle}>Forward any booking email</Text>
              <Text style={s.forwardSub}>
                Hotels, flights, trains, cars, Airbnb — forward the confirmation and Wingman imports it automatically.
              </Text>
            </View>
          </View>
          <View style={s.forwardAddressRow}>
            <Text style={s.forwardAddress} selectable>{FORWARD_EMAIL}</Text>
          </View>
          <View style={s.forwardActions}>
            <Pressable
              style={s.forwardActionBtn}
              onPress={() => {
                Clipboard.setStringAsync(FORWARD_EMAIL);
                Alert.alert("Copied", `${FORWARD_EMAIL} copied to clipboard.`);
              }}
            >
              <Text style={s.forwardActionT}>Copy address</Text>
            </Pressable>
            <View style={s.forwardActionDivider} />
            <Pressable
              style={s.forwardActionBtn}
              onPress={() => {
                Share.share({ message: FORWARD_EMAIL, title: "Wingman import address" })
                  .catch(() => Alert.alert("Forward to", FORWARD_EMAIL));
              }}
            >
              <Text style={s.forwardActionT}>Share</Text>
            </Pressable>
          </View>
          <Text style={s.forwardHint}>
            Works with Gmail, Apple Mail, Outlook, and any email app. Supports all booking types.
          </Text>
        </View>

        <View style={[g.group, { marginTop: 8 }]}>
          <ConnRow
            iconKey="paste"
            title="Paste a confirmation"
            sub="Copy a booking confirmation and paste it here — Wingman extracts the trip instantly"
            last
          />
        </View>
        <View style={s.pasteWrap}>
          <TextInput
            style={s.pasteInput}
            placeholder={`Paste your booking confirmation here…\n\ne.g. "Your booking is confirmed: AA 412, JFK → LAX, Jan 15, 10:35 AM"`}
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

        {/* ── Corporate travel ─────────────────────────────────────────────── */}
        <Text style={g.sectionT}>CORPORATE &amp; THIRD-PARTY TRAVEL</Text>
        <View style={g.group}>
          {/* TripIt */}
          <ConnRow
            iconKey="paste"
            title="TripIt"
            sub={tripitConnected ? "Connected — syncing your TripIt itineraries" : "Sync trips from your TripIt account via iCal feed"}
            right={
              tripitConnected ? (
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <ConnBadge on />
                  <Pressable style={s.disconnectBtn} onPress={handleDisconnectTripIt}>
                    <Text style={s.disconnectT}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={s.connectBtn} onPress={() => setShowTripitInput(v => !v)}>
                  <Text style={s.connectBtnT}>{showTripitInput ? "Cancel" : "Connect"}</Text>
                </Pressable>
              )
            }
          />
          {showTripitInput && !tripitConnected && (
            <View style={s.tripitInputWrap}>
              <Text style={s.tripitHint}>
                Go to TripIt → Settings → Publishing Options → Calendar Feed, then copy and paste the URL below.
              </Text>
              <TextInput
                style={s.tripitInput}
                placeholder="https://www.tripit.com/feed/ical/p/..."
                placeholderTextColor={C.mut}
                value={tripitUrl}
                onChangeText={setTripitUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Btn
                title={tripitLoading ? "Syncing…" : "Sync TripIt trips"}
                onPress={connectTripIt}
                disabled={!tripitUrl.trim() || tripitLoading}
                style={{ marginTop: 10 }}
              />
            </View>
          )}

          {/* TravelPerk */}
          <ConnRow
            iconKey="forward"
            title="TravelPerk"
            sub={tpConnected ? "Connected — corporate trips synced automatically" : "Sync corporate bookings from TravelPerk"}
            last
            right={
              tpConnected ? (
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <Pressable style={s.rescanBtn} onPress={handleResyncTravelPerk} disabled={tpSyncing}>
                    {tpSyncing
                      ? <ActivityIndicator color={C.gold} size="small" />
                      : <Text style={s.rescanT}>Re-sync</Text>}
                  </Pressable>
                  <Pressable style={s.disconnectBtn} onPress={handleDisconnectTravelPerk}>
                    <Text style={s.disconnectT}>✕</Text>
                  </Pressable>
                  <ConnBadge on />
                </View>
              ) : (
                <Pressable style={s.connectBtn} onPress={connectTravelPerk} disabled={tpConnecting}>
                  {tpConnecting
                    ? <ActivityIndicator color={C.inkD} size="small" />
                    : <Text style={s.connectBtnT}>Connect</Text>}
                </Pressable>
              )
            }
          />
        </View>

        {/* ── PDF / Image import ───────────────────────────────────────────── */}
        <Text style={g.sectionT}>IMPORT FROM PDF</Text>
        <View style={[g.group, { paddingVertical: 4 }]}>
          <View style={s.pdfRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowT}>Upload a booking PDF</Text>
              <Text style={s.rowS}>Scanned or image PDFs, e-tickets, hotel vouchers — Wingman reads them all</Text>
            </View>
            <Pressable style={[s.connectBtn, pdfLoading && { opacity: 0.6 }]} onPress={importFromPdf} disabled={pdfLoading}>
              {pdfLoading
                ? <ActivityIndicator color={C.inkD} size="small" />
                : <Text style={s.connectBtnT}>Choose file</Text>}
            </Pressable>
          </View>
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

const s = StyleSheet.create({
  app:         { flex: 1, backgroundColor: C.bg },
  ambientNote: { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 20, marginBottom: 14 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 0.5, borderBottomColor: C.line,
  },
  accountRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 0.5, borderBottomColor: C.line,
  },
  addAccountRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 13, paddingHorizontal: 16,
    borderTopWidth: 0.5, borderTopColor: C.line,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, borderColor: C.line,
    alignItems: "center", justifyContent: "center",
  },
  rowT: { color: C.ink, fontSize: 14, fontFamily: T.sansM, marginBottom: 2 },
  rowS: { color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 17 },
  connectBtn: {
    backgroundColor: C.gold, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  connectBtnT: { color: C.inkD, fontSize: 12, fontFamily: T.sansB },
  rescanBtn: {
    borderWidth: 1, borderColor: C.gold + "60", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  rescanT: { color: C.gold, fontSize: 11, fontFamily: T.sansM },
  disconnectBtn: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: C.line,
    alignItems: "center", justifyContent: "center",
  },
  disconnectT: { color: C.mut, fontSize: 13 },
  connectedBadge: {
    backgroundColor: C.gold + "20", borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  connectedT: { color: C.gold, fontSize: 10, fontFamily: T.sansB },
  pasteWrap: { marginHorizontal: 0, marginBottom: 12 },
  pasteInput: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 0.5, borderColor: C.line,
    color: C.ink, fontFamily: T.sans, fontSize: 13,
    padding: 14, minHeight: 120, lineHeight: 20,
  },
  pasteHint: { color: C.mut, fontSize: 11, fontFamily: T.sans, textAlign: "center", marginTop: 8, lineHeight: 16 },
  note: { color: C.mut, fontSize: 11, fontFamily: T.sans, textAlign: "center", marginBottom: 24, lineHeight: 17 },
  featIcon: {
    width: 24, height: 24, borderRadius: 6,
    backgroundColor: C.card2,
    alignItems: "center", justifyContent: "center",
  },

  // Forward address hero card
  forwardCard:         { borderRadius: 20, borderWidth: 1, borderColor: C.gold + "40", backgroundColor: C.card, overflow: "hidden", marginBottom: 4 },
  forwardTop:          { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 18, paddingBottom: 12 },
  forwardIconWrap:     { width: 44, height: 44, borderRadius: 22, backgroundColor: C.gold + "18", alignItems: "center", justifyContent: "center" },
  forwardIcon:         { fontSize: 20, color: C.gold },
  forwardTitle:        { color: C.ink, fontSize: 15, fontFamily: T.sansB, marginBottom: 4 },
  forwardSub:          { color: C.mut, fontSize: 12, lineHeight: 18 },
  forwardAddressRow:   { marginHorizontal: 18, marginBottom: 12, backgroundColor: C.bg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line },
  forwardAddress:      { color: C.gold, fontSize: 15, fontFamily: T.sansB, letterSpacing: 0.3, textAlign: "center" },
  forwardActions:      { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line },
  forwardActionBtn:    { flex: 1, paddingVertical: 13, alignItems: "center" },
  forwardActionT:      { color: C.gold, fontSize: 13, fontFamily: T.sansM },
  forwardActionDivider:{ width: 1, backgroundColor: C.line },
  forwardHint:         { color: C.mut, fontSize: 11, fontFamily: T.sans, textAlign: "center", paddingHorizontal: 18, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line },

  // TripIt iCal input
  tripitInputWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14, borderTopWidth: 0.5, borderTopColor: C.line },
  tripitHint:      { color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 18, marginBottom: 10 },
  tripitInput:     { backgroundColor: C.bg, borderRadius: 10, borderWidth: 0.5, borderColor: C.line, color: C.ink, fontFamily: T.sans, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },

  // PDF import row
  pdfRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
});
