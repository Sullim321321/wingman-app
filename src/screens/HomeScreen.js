// HomeScreen.js — Editorial Intelligence Briefing + Persistent Chat
// Approved v3 design: masthead → edition line → EB Garamond serif headline →
// prose briefing → CONVERSATION rule → chat FlatList → input bar
// No chips, no widgets, no cards. Monocle/private-club editorial feel.

import React, {
  useState, useCallback, useEffect, useRef, useMemo,
} from "react";
import {
  SafeAreaView, View, Text, TextInput, Pressable, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Animated, Easing, AppState,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { C, T } from "../theme";
import { tap } from "../components";
import {
  getTrips, getHomeState, getWeather, getMe,
  sendConciergeMessage, getConciergeThread, saveConciergeThread, clearConciergeThread,
  getTripBriefing, getPrediction, triggerGmailScan,
} from "../api";
import { scheduleDisruption, schedulePreDepartureBriefing, schedulePostTripDebrief } from "../notify";
import { LOCATION_OPT_IN_KEY } from "./SettingsScreen";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findNextFlight(trips) {
  const now = Date.now();
  let best = null, bestTime = Infinity;
  for (const trip of (trips || [])) {
    for (const leg of (trip.legs || [])) {
      if (leg.type !== "flight" || !leg.departs_at) continue;
      const t = new Date(leg.departs_at).getTime();
      if (t > now && t < bestTime) { bestTime = t; best = { ...leg, tripTitle: trip.title }; }
    }
  }
  return best;
}

function buildTripContext(trips) {
  if (!trips || trips.length === 0) return null;
  const lines = trips.slice(0, 5).map(trip => {
    const legs = (trip.legs || []).map(leg => {
      if (leg.type === "flight") {
        const parts = [
          leg.carrier && leg.flight_number ? `${leg.carrier}${leg.flight_number}` : null,
          leg.origin && leg.destination ? `${leg.origin}→${leg.destination}` : null,
          leg.departs_at ? new Date(leg.departs_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          }) : null,
        ].filter(Boolean);
        return `flight: ${parts.join(" ")}`;
      }
      if (leg.type === "hotel") return `hotel: ${leg.carrier || leg.destination || "unknown"}`;
      return null;
    }).filter(Boolean);
    return `Trip "${trip.title}": ${legs.join("; ") || "no legs"}`;
  });
  return lines.join("\n");
}

function formatEditionDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// Build the editorial headline and prose briefing from home state + trip data
function buildBriefing({ homeState, trips, weather, firstName, riskScore }) {
  const hs    = homeState;
  const leg   = hs?.active_leg;
  const trip  = hs?.active_trip;
  const hotel = hs?.hotel;
  const w     = hs?.weather || weather;
  const next  = findNextFlight(trips);

  const weatherCity = w?.city || trip?.destination_city || null;
  const weatherStr  = w ? `${w.temp}°${weatherCity ? ` in ${weatherCity}` : ""}` : null;

  // ── Status dot colour ──────────────────────────────────────────────────────
  let statusDotColor = C.mut;   // grey = no trip
  let statusLabel    = "No trips";

  // ── Headline ──────────────────────────────────────────────────────────────
  let headline = null;
  // ── Prose briefing ────────────────────────────────────────────────────────
  let prose    = null;

  if (hs?.state === "in_transit" && leg) {
    statusDotColor = C.gold;
    statusLabel    = `Airborne · ${[leg.carrier, leg.flight_number].filter(Boolean).join("")}`;
    const landMins = leg.arrives_at
      ? Math.round((new Date(leg.arrives_at).getTime() - Date.now()) / 60000)
      : null;
    const timeToLand = landMins && landMins > 0
      ? (landMins >= 60 ? `${Math.floor(landMins / 60)} hour${Math.floor(landMins / 60) !== 1 ? "s" : ""}` : `${landMins} minutes`)
      : null;
    const dest = leg.destination || trip?.destination_city || "your destination";
    headline = timeToLand
      ? `${timeToLand}\nto ${dest}.`
      : `En route\nto ${dest}.`;
    const parts = [];
    if (w) parts.push(`${dest} is ${w.temp}° at landing time`);
    if (hotel) parts.push(`${hotel.name} has confirmed your room`);
    if (leg.arrives_at) {
      const arrivalsDelay = hs?.arrivals_delay_mins;
      if (arrivalsDelay && arrivalsDelay > 5) {
        parts.push(`arrivals at ${leg.destination} are running ${arrivalsDelay} minutes slow`);
      }
    }
    prose = parts.length
      ? `You're on schedule. ${parts.join(". ")}. Anything you need before you land?`
      : `You're on schedule. I'll send you the latest on the ground 30 minutes before landing.`;

  } else if (hs?.state === "at_airport" && leg) {
    statusDotColor = C.teal;
    statusLabel    = "On time";
    const ident = [leg.carrier, leg.flight_number].filter(Boolean).join("");
    const minsAway = hs.hours_to_depart != null ? Math.round(hs.hours_to_depart * 60) : null;
    const timeStr  = minsAway != null
      ? (minsAway >= 120 ? `in ${Math.round(minsAway / 60)} hours` : `in ${minsAway} minutes`)
      : null;
    headline = ident && timeStr
      ? `${ident} departs\n${timeStr}.`
      : `Departure\napproaching.`;
    const parts = [];
    if (leg.gate) parts.push(`Gate ${leg.gate}`);
    if (leg.terminal) parts.push(`Terminal ${leg.terminal}`);
    if (w && weatherCity) parts.push(`${weatherCity} is ${w.temp}° when you land`);
    if (riskScore != null && riskScore >= 30) {
      statusDotColor = riskScore >= 60 ? C.coral : C.amber;
      statusLabel    = riskScore >= 60 ? "Disruption risk" : "Moderate risk";
      parts.push(`${riskScore}% disruption risk — I'm watching it`);
    }
    prose = parts.length
      ? `${parts.join(". ")}. What do you need before you board?`
      : `I'm watching your flight. What do you need before you board?`;

  } else if (hs?.state === "at_destination" && trip) {
    statusDotColor = C.gold;
    statusLabel    = "At destination";
    const city = trip.destination_city || leg?.destination || "your destination";
    headline = `Welcome to\n${city}.`;
    const parts = [];
    if (hotel) {
      const checkinTime = hotel.checkin_at
        ? new Date(hotel.checkin_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : null;
      parts.push(`${hotel.name} checks in at ${checkinTime || "3:00 PM"}`);
    }
    if (w) parts.push(`${city} is ${w.temp}°${w.description ? `, ${w.description.toLowerCase()}` : ""}`);
    prose = parts.length
      ? `${parts.join(". ")}. What can I arrange for you?`
      : `You've arrived. What can I arrange for you?`;

  } else if ((hs?.state === "pre_departure" || !hs?.state) && next) {
    const daysAway  = Math.ceil((new Date(next.departs_at).getTime() - Date.now()) / 86400000);
    const hoursAway = Math.round((new Date(next.departs_at).getTime() - Date.now()) / 3600000);
    const ident     = [next.carrier, next.flight_number].filter(Boolean).join("");
    const dest      = next.destination || "your destination";

    if (daysAway <= 0) {
      statusDotColor = C.teal;
      statusLabel    = "Today";
      headline       = `${ident || "Your flight"}\nis today.`;
    } else if (daysAway === 1) {
      statusDotColor = C.amber;
      statusLabel    = "Tomorrow";
      headline       = `${dest}\ntomorrow.`;
    } else if (daysAway <= 7) {
      statusDotColor = C.amber;
      statusLabel    = `${daysAway} days to departure`;
      const destName = dest.length <= 4 ? dest : dest; // IATA or city
      headline       = `${destName} in\n${daysAway === 1 ? "one day" : `${daysAway} days`}.`;
    } else {
      statusDotColor = C.mut;
      statusLabel    = `${daysAway} days away`;
      headline       = `${dest} in\n${daysAway} days.`;
    }

    const parts = [];
    if (ident) parts.push(`${ident} on ${new Date(next.departs_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`);
    if (riskScore != null && riskScore >= 30) {
      statusDotColor = riskScore >= 60 ? C.coral : C.amber;
      statusLabel    = riskScore >= 60 ? "Disruption risk" : `${riskScore}% risk`;
      parts.push(`${riskScore}% disruption risk this week — I'll alert you the moment anything changes, with a rescue plan ready`);
    }
    if (w && weatherCity) parts.push(`${weatherCity} will be ${w.temp}° when you land`);
    prose = parts.length
      ? `${parts.join(". ")}. What would you like to know?`
      : `I'm watching it. What would you like to know?`;

  } else {
    // No trips at all — new user state
    statusDotColor = C.mut;
    statusLabel    = "No trips yet";
    const name     = firstName ? `, ${firstName}` : "";
    headline       = `Your concierge\nis standing by.`;
    prose          = `No flights on the board yet${name}. Once you add a trip — or connect your email and let me find them — I'll brief you every morning on what matters: gate changes, weather at your destination, lounge access, upgrade windows. Where are you headed next?`;
  }

  return { headline, prose, statusDotColor, statusLabel };
}

// Build the welcome message for the chat thread
function buildWelcomeMessage(trips) {
  const next = findNextFlight(trips);
  if (!next) return "Good day. I'm your private travel concierge. I watch your flights, brief you on what matters, and handle the details so you don't have to. Where are you headed next?";
  const diff  = new Date(next.departs_at).getTime() - Date.now();
  if (diff <= 0) return "Good day. I'm monitoring your active trip. What can I do for you?";
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  const timeStr = hours < 1
    ? `in ${Math.round(diff / 60000)} minutes`
    : hours < 24 ? `in ${hours} hours`
    : days === 1 ? "tomorrow"
    : `in ${days} days`;
  const route = next.origin && next.destination ? `${next.origin} → ${next.destination}` : null;
  const ident = next.carrier && next.flight_number ? `${next.carrier}${next.flight_number}` : null;
  const parts = [route, ident].filter(Boolean).join(" · ");
  return `Good day. Your next flight${parts ? ` (${parts})` : ""} departs ${timeStr}. I'm monitoring it now — what can I do for you?`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const [trips, setTrips]               = useState([]);
  const [tripsLoaded, setTripsLoaded]   = useState(false);
  const [homeState, setHomeState]       = useState(null);
  const [weather, setWeather]           = useState(null);
  const [firstName, setFirstName]       = useState("");
  const [riskScore, setRiskScore]       = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // Chat state
  const [messages, setMessages]         = useState([{ role: "assistant", content: "" }]);
  const [input, setInput]               = useState("");
  const [chatLoading, setChatLoading]   = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);

  // Dev mode (5-tap unlock)
  const [devMode, setDevMode]           = useState(__DEV__);
  const devTapCount                     = useRef(0);

  const listRef    = useRef(null);
  const tripsRef   = useRef([]);
  const saveTimer  = useRef(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  useFocusEffect(useCallback(() => {
    let cancelled = false;

    // Load trips
    getTrips()
      .then(data => {
        if (cancelled) return;
        const loaded = data.trips || [];
        tripsRef.current = loaded;
        setTrips(loaded);
        setTripsLoaded(true);
        // Update welcome message if thread is still at initial state
        setMessages(prev => {
          if (prev.length === 1 && prev[0].role === "assistant") {
            return [{ role: "assistant", content: buildWelcomeMessage(loaded) }];
          }
          return prev;
        });
        // Fetch risk for next flight
        const next = findNextFlight(loaded);
        if (next?.origin && next?.destination) {
          getPrediction({ dep: next.origin, arr: next.destination })
            .then(p => { if (!cancelled && p?.risk != null) setRiskScore(p.risk); })
            .catch(() => {});
        }
      })
      .catch(() => { if (!cancelled) setTripsLoaded(true); });

    // Location + weather + home state
    (async () => {
      try {
        const optIn = await AsyncStorage.getItem(LOCATION_OPT_IN_KEY);
        let lat = null, lng = null;
        if (optIn === "true") {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === "granted") {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            if (!cancelled) setUserLocation({ lat, lng });
          }
        }
        const [hs, w] = await Promise.allSettled([
          getHomeState(lat, lng),
          lat && lng ? getWeather(lat, lng) : Promise.resolve(null),
        ]);
        if (!cancelled) {
          if (hs.status === "fulfilled" && hs.value?.ok) setHomeState(hs.value);
          if (w.status === "fulfilled" && w.value?.ok) setWeather(w.value);
        }
      } catch {}
    })();

    // User name
    getMe().then(u => { if (!cancelled && u?.first_name) setFirstName(u.first_name); }).catch(() => {});

    return () => { cancelled = true; };
  }, []));

  // Load persisted thread once trips are ready
  useEffect(() => {
    if (!tripsLoaded) return;
    loadThread();
  }, [tripsLoaded]);

  // ── Background scan — trigger Gmail scan when app comes to foreground ────────
  // Runs silently: no spinner, no alert. Trips refresh automatically if new ones found.
  // Throttled to once per 15 minutes to avoid hammering the API.
  const SCAN_THROTTLE_MS = 15 * 60 * 1000; // 15 minutes
  const LAST_SCAN_KEY = "@wingman_last_bg_scan";
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const runScanIfDue = async () => {
      try {
        const lastStr = await AsyncStorage.getItem(LAST_SCAN_KEY);
        const last = lastStr ? parseInt(lastStr, 10) : 0;
        if (Date.now() - last < SCAN_THROTTLE_MS) return; // too soon
        await AsyncStorage.setItem(LAST_SCAN_KEY, String(Date.now()));
        await triggerGmailScan();
        // Silently refresh trips after scan
        const data = await getTrips();
        const loaded = data.trips || [];
        tripsRef.current = loaded;
        setTrips(loaded);
      } catch {
        // Silent — never surface background scan errors to the user
      }
    };

    // Run once on mount
    runScanIfDue();

    // Run again whenever the app returns to the foreground
    const sub = AppState.addEventListener("change", nextState => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        runScanIfDue();
      }
      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, []);

  // ── Thread persistence ───────────────────────────────────────────────────────

  async function loadThread() {
    setThreadLoading(true);
    try {
      const data = await getConciergeThread(null);
      const saved = (data.messages || []).filter(m => m && (m.content || m.transit || m.places || m.action));
      if (saved.length > 0) {
        setMessages([{ role: "assistant", content: buildWelcomeMessage(tripsRef.current) }, ...saved]);
      } else {
        setMessages([{ role: "assistant", content: buildWelcomeMessage(tripsRef.current) }]);
      }
    } catch {
      setMessages([{ role: "assistant", content: buildWelcomeMessage(tripsRef.current) }]);
    } finally {
      setThreadLoading(false);
    }
  }

  function scheduleSave(msgs) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const toSave = msgs.filter((_, i) => i > 0);
      saveConciergeThread(toSave, null).catch(() => {});
    }, 1500);
  }

  // ── Chat send ────────────────────────────────────────────────────────────────

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || chatLoading) return;
    setInput("");
    const userMsg    = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatLoading(true);
    scrollToBottom();
    try {
      const history     = newMessages.slice(1).map(m => ({ role: m.role, content: m.content }));
      const tripContext = buildTripContext(tripsRef.current);
      const isFirst     = newMessages.filter(m => m.role === "user").length === 1;
      const enriched    = isFirst && tripContext
        ? `[User's trips:\n${tripContext}]\n\n${msg}`
        : msg;
      const loc = userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null;
      const data = await sendConciergeMessage(enriched, history.slice(0, -1), loc);
      const aiMsg = {
        role:    "assistant",
        content: data.reply,
        places:  data.places  || null,
        transit: data.transit || null,
        action:  data.action  || null,
      };
      const updated = [...newMessages, aiMsg];
      setMessages(updated);
      scheduleSave(updated);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I couldn't connect right now. Try again in a moment.",
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  function scrollToBottom(animated = true) {
    setTimeout(() => { listRef.current?.scrollToEnd({ animated }); }, 80);
  }
  useEffect(() => { if (messages.length > 0) scrollToBottom(); }, [messages.length]);

  function confirmClear() {
    Alert.alert(
      "Clear Conversation",
      "This will permanently delete this conversation. Wingman will start fresh.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear", style: "destructive",
          onPress: async () => {
            try { await clearConciergeThread(null); } catch {}
            setMessages([{ role: "assistant", content: buildWelcomeMessage(tripsRef.current) }]);
          },
        },
      ]
    );
  }

  // ── Derived briefing ─────────────────────────────────────────────────────────

  const { headline, prose, statusDotColor, statusLabel } = useMemo(
    () => buildBriefing({ homeState, trips, weather, firstName, riskScore }),
    [homeState, trips, weather, firstName, riskScore]
  );

  const nextFlight = useMemo(() => findNextFlight(trips), [trips]);

  // ── Render helpers ───────────────────────────────────────────────────────────

  function renderMessage({ item, index }) {
    const isUser = item.role === "user";
    if (!item.content && !item.transit && !item.places && !item.action) return null;
    return (
      <View style={[s.msgRow, isUser ? s.msgRowUser : s.msgRowWing]}>
        {!isUser && (
          <View style={s.wingMark}>
            <Text style={s.wingMarkT}>W</Text>
          </View>
        )}
        <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleWing]}>
          {item.content ? (
            <Text style={[s.bubbleT, isUser && s.bubbleTUser]}>{item.content}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  // ── Location/temp for masthead ───────────────────────────────────────────────
  const mastheadRight = (() => {
    const hs = homeState;
    if (hs?.state === "in_transit") {
      return "38,000 ft";
    }
    const city = weather?.city || hs?.active_trip?.destination_city || null;
    const temp = weather?.temp != null ? `${weather.temp}°` : null;
    if (city && temp) return `${city} · ${temp}`;
    if (city) return city;
    if (temp) return temp;
    return null;
  })();

  const isNoTrip = !trips.length;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* ── Masthead ──────────────────────────────────────────────────── */}
        <View style={s.masthead}>
          <Text style={s.mastW}>W</Text>
          <Text style={s.mastName}>WINGMAN</Text>
          <View style={s.mastRight}>
            {mastheadRight ? (
              <Text style={s.mastLoc}>{mastheadRight}</Text>
            ) : null}
            <Pressable
              style={s.avatar}
              onPress={() => { tap(); navigation.navigate("Settings"); }}
            >
              <Text style={s.avatarT}>{firstName ? firstName[0].toUpperCase() : "W"}</Text>
              {homeState?.state && homeState.state !== "no_trip" && (
                <View style={[s.avatarDot, { backgroundColor: statusDotColor }]} />
              )}
            </Pressable>
          </View>
        </View>

        <View style={s.rule} />

        {/* ── Scrollable content: briefing + conversation ───────────────── */}
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          contentContainerStyle={s.scrollContent}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderMessage}
          ListHeaderComponent={() => (
            <>
              {/* Edition line */}
              <View style={s.edition}>
                <Text style={s.editionDate}>{formatEditionDate()}</Text>
                <View style={s.editionStatus}>
                  <View style={[s.editionDot, { backgroundColor: statusDotColor }]} />
                  <Text style={s.editionStatusText}>{statusLabel.toUpperCase()}</Text>
                </View>
              </View>

              {/* Headline */}
              {headline ? (
                <View style={s.headlineWrap}>
                  <HeadlineText text={headline} />
                </View>
              ) : null}

              {/* Prose briefing */}
              {prose ? (
                <Text style={s.prose}>{prose}</Text>
              ) : null}

              {/* No-trip CTAs */}
              {isNoTrip && (
                <>
                  <Pressable
                    style={s.ctaRow}
                    onPress={() => { tap(); navigation.navigate("AddTrip"); }}
                  >
                    <View style={s.ctaIcon}><Text style={s.ctaIconT}>✈</Text></View>
                    <View style={s.ctaBody}>
                      <Text style={s.ctaTitle}>Add a trip</Text>
                      <Text style={s.ctaSub}>Enter a flight number or itinerary</Text>
                    </View>
                    <Text style={s.ctaArrow}>›</Text>
                  </Pressable>
                  <Pressable
                    style={[s.ctaRow, s.ctaRowTeal]}
                    onPress={() => { tap(); navigation.navigate("Connections"); }}
                  >
                    <View style={[s.ctaIcon, s.ctaIconTeal]}><Text style={s.ctaIconT}>✉</Text></View>
                    <View style={s.ctaBody}>
                      <Text style={[s.ctaTitle, { color: C.teal }]}>Connect Gmail</Text>
                      <Text style={s.ctaSub}>I'll find your bookings automatically</Text>
                    </View>
                    <Text style={s.ctaArrow}>›</Text>
                  </Pressable>
                </>
              )}

              {/* CONVERSATION rule */}
              <View style={s.sectionRule}>
                <View style={s.sectionRuleLine} />
                <Text style={s.sectionRuleLabel}>CONVERSATION</Text>
                <View style={s.sectionRuleLine} />
              </View>
            </>
          )}
          ListFooterComponent={() => (
            <>
              {chatLoading && (
                <View style={[s.msgRow, s.msgRowWing]}>
                  <View style={s.wingMark}>
                    <Text style={s.wingMarkT}>W</Text>
                  </View>
                  <View style={[s.bubble, s.bubbleWing, s.bubbleLoading]}>
                    <TypingDots />
                  </View>
                </View>
              )}
              {/* Dev mode: TEST NOTIFICATIONS */}
              {devMode && (
                <View style={s.devSection}>
                  <Text style={s.devLabel}>TEST NOTIFICATIONS</Text>
                  <Pressable style={s.devBtn} onPress={async () => {
                    await scheduleDisruption(nextFlight);
                    setTimeout(() => navigation.navigate("Alert", { flight: nextFlight }), 3500);
                  }}>
                    <Text style={s.devBtnT}>Simulate disruption</Text>
                  </Pressable>
                  <Pressable style={s.devBtn} onPress={async () => {
                    await schedulePreDepartureBriefing(nextFlight, null);
                  }}>
                    <Text style={s.devBtnT}>Simulate pre-departure briefing</Text>
                  </Pressable>
                  <Pressable style={s.devBtn} onPress={async () => {
                    const t = trips[trips.length - 1];
                    await schedulePostTripDebrief(t?.title || "your trip", t?.id || null);
                  }}>
                    <Text style={s.devBtnT}>Simulate post-trip debrief</Text>
                  </Pressable>
                </View>
              )}
              <View style={{ height: 16 }} />
            </>
          )}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* ── Input bar ─────────────────────────────────────────────────── */}
        <View style={s.inputWrap}>
          <View style={s.inputInner}>
            <TextInput
              style={s.inputField}
              value={input}
              onChangeText={setInput}
              placeholder="Ask anything…"
              placeholderTextColor={C.mut}
              onSubmitEditing={() => send()}
              returnKeyType="send"
              multiline={false}
              editable={!chatLoading}
            />
            <Pressable
              style={[s.sendBtn, (!input.trim() || chatLoading) && s.sendBtnDim]}
              onPress={() => send()}
              disabled={!input.trim() || chatLoading}
            >
              <Text style={s.sendBtnT}>›</Text>
            </Pressable>
          </View>
          {/* 5-tap gesture on the input area bottom label to unlock dev mode */}
          <Pressable
            onPress={() => {
              devTapCount.current += 1;
              if (devTapCount.current >= 5) {
                devTapCount.current = 0;
                setDevMode(v => !v);
              }
            }}
            style={s.devTapTarget}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Headline component — parses "first line\nsecond line." ──────────────────
// First line: EB Garamond italic, ink colour
// Second line (if bold-marked): EB Garamond semi-bold italic, gold

function HeadlineText({ text }) {
  const lines = text.split("\n");
  return (
    <View>
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1;
        // Last line gets the gold emphasis treatment
        return (
          <Text
            key={i}
            style={[
              s.hed,
              isLast && lines.length > 1 ? s.hedGold : null,
            ]}
          >
            {line}
          </Text>
        );
      })}
    </View>
  );
}

// ─── Typing dots animation ────────────────────────────────────────────────────

function TypingDots() {
  const dots = [useRef(new Animated.Value(0.3)).current,
                useRef(new Animated.Value(0.3)).current,
                useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    dots.forEach((d, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(d, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);
  return (
    <View style={{ flexDirection: "row", gap: 4, paddingVertical: 2 }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.mut, opacity: d }} />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Masthead ──
  masthead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 14,
  },
  mastW: {
    fontFamily: T.serifI,
    fontSize: 26,
    color: C.gold,
    marginRight: 10,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  mastName: {
    fontFamily: T.sansB,
    fontSize: 10,
    letterSpacing: 5,
    color: C.ink,
    opacity: 0.8,
    flex: 1,
    textTransform: "uppercase",
  },
  mastRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mastLoc: {
    fontFamily: T.sans,
    fontSize: 11,
    color: C.mut,
    fontWeight: "400",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarT: {
    fontFamily: T.sansM,
    fontSize: 11,
    color: C.mut,
  },
  avatarDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.5,
    borderColor: C.bg,
  },

  // ── Rule ──
  rule: {
    height: 1,
    marginHorizontal: 24,
    backgroundColor: C.line,
    opacity: 0.5,
  },

  // ── Scroll content ──
  scrollContent: {
    paddingBottom: 8,
  },

  // ── Edition line ──
  edition: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  editionDate: {
    fontFamily: T.sansM,
    fontSize: 10,
    letterSpacing: 2.5,
    color: C.mut,
    textTransform: "uppercase",
    opacity: 0.7,
  },
  editionStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  editionDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  editionStatusText: {
    fontFamily: T.sansM,
    fontSize: 10,
    letterSpacing: 1.5,
    color: C.mut,
    textTransform: "uppercase",
  },

  // ── Headline ──
  headlineWrap: {
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  hed: {
    fontFamily: T.garamondSI,
    fontSize: 32,
    color: C.ink,
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  hedGold: {
    color: C.goldL,
    fontFamily: T.garamondSI,
  },

  // ── Prose briefing ──
  prose: {
    paddingHorizontal: 24,
    paddingTop: 10,
    fontFamily: T.garamondI,
    fontSize: 17,
    color: C.ink,
    lineHeight: 27,
    opacity: 0.82,
  },

  // ── No-trip CTAs ──
  ctaRow: {
    marginHorizontal: 24,
    marginTop: 14,
    padding: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  ctaRowTeal: {
    marginTop: 10,
    backgroundColor: "rgba(43,184,150,0.04)",
    borderColor: "rgba(43,184,150,0.15)",
  },
  ctaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(200,168,106,0.07)",
    borderWidth: 1,
    borderColor: "rgba(200,168,106,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaIconTeal: {
    backgroundColor: "rgba(43,184,150,0.08)",
    borderColor: "rgba(43,184,150,0.2)",
  },
  ctaIconT: {
    fontSize: 16,
  },
  ctaBody: {
    flex: 1,
  },
  ctaTitle: {
    fontFamily: T.sansM,
    fontSize: 13,
    color: C.ink,
  },
  ctaSub: {
    fontFamily: T.sans,
    fontSize: 11,
    color: C.mut,
    marginTop: 2,
  },
  ctaArrow: {
    fontFamily: T.sans,
    fontSize: 18,
    color: C.mut,
  },

  // ── Section rule ──
  sectionRule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 4,
  },
  sectionRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.line,
    opacity: 0.5,
  },
  sectionRuleLabel: {
    fontFamily: T.sansM,
    fontSize: 9,
    letterSpacing: 2.5,
    color: C.mut,
    opacity: 0.6,
  },

  // ── Chat messages ──
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    marginTop: 12,
    gap: 9,
  },
  msgRowUser: {
    justifyContent: "flex-end",
  },
  msgRowWing: {
    justifyContent: "flex-start",
  },
  wingMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(200,168,106,0.07)",
    borderWidth: 1,
    borderColor: "rgba(200,168,106,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  wingMarkT: {
    fontFamily: T.serifI,
    fontSize: 12,
    color: C.gold,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  bubbleUser: {
    backgroundColor: "rgba(200,168,106,0.09)",
    borderWidth: 1,
    borderColor: "rgba(200,168,106,0.18)",
    borderRadius: 18,
    borderTopRightRadius: 3,
  },
  bubbleWing: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    borderTopLeftRadius: 3,
  },
  bubbleLoading: {
    paddingVertical: 14,
  },
  bubbleT: {
    fontFamily: T.sans,
    fontSize: 14,
    color: C.ink,
    lineHeight: 22,
    fontWeight: "300",
  },
  bubbleTUser: {
    fontWeight: "400",
  },

  // ── Input bar ──
  inputWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.bg,
  },
  inputInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 28,
    paddingLeft: 20,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  inputField: {
    flex: 1,
    fontFamily: T.garamondI,
    fontSize: 16,
    color: C.ink,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDim: {
    opacity: 0.35,
  },
  sendBtnT: {
    fontFamily: T.sansB,
    fontSize: 18,
    color: C.bg,
    lineHeight: 22,
    marginLeft: 2,
  },
  devTapTarget: {
    height: 8,
    width: "100%",
  },

  // ── Dev section ──
  devSection: {
    marginHorizontal: 24,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  devLabel: {
    fontFamily: T.sansM,
    fontSize: 9,
    letterSpacing: 2.5,
    color: C.mut,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  devBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    marginBottom: 8,
  },
  devBtnT: {
    fontFamily: T.sans,
    fontSize: 13,
    color: C.mut,
  },
});
