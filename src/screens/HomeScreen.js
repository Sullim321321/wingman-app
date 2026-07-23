// HomeScreen.js — Editorial Intelligence Briefing + Persistent Chat
// Approved v3 design: masthead → edition line → EB Garamond serif headline →
// prose briefing → CONVERSATION rule → chat FlatList → input bar
// No chips, no widgets, no cards. Monocle/private-club editorial feel.

import React, {
  useState, useCallback, useEffect, useRef, useMemo,
} from "react";
import {
  SafeAreaView, View, Text, Pressable, RefreshControl,
  StyleSheet, Platform, ActivityIndicator,
  Alert, Animated, Easing, AppState, ScrollView, Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { C, T, SHADOW, litEdge } from "../theme";
import { Leg, RideCount } from "../tripdoc";
import { tap, DecisionCard, FadeRise } from "../components";
import { PlanCard } from "../components/PlanCard";
import { InferredTravel } from "../components/InferredTravel";
import {
  getTrips, getHomeState, getWeather, getMe, getToday, getTravel,
  sendConciergeMessage, getConciergeThread, saveConciergeThread, clearConciergeThread,
  getTripBriefing, getPrediction, triggerGmailScan, getTravelProfile,
  getLocalNews, getLocalTraffic, getTodayEvents, getTravelStats,
  createTrip, addLeg,
  getDecisions, confirmDecision, dismissDecision, undoDecision,
  getBrief,
} from "../api";
import { scheduleDisruption, schedulePreDepartureBriefing, schedulePostTripDebrief } from "../notify";
import * as Speech from "expo-speech";
import { LOCATION_OPT_IN_KEY } from "./SettingsScreen";
import { syncFlightActivity } from "../liveActivity";
import * as fid from "../flightid";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Build the horizontal intelligence signals strip pills from existing state
// Returns array of { label, color } — no new API calls needed
function buildSignalPills({ homeState, weather, trafficData, todayEvents, riskScore }) {
  const hs  = homeState;
  const leg = hs?.active_leg;
  const pills = [];

  if (hs?.state === "at_airport" && leg) {
    // Flight status
    const delay = leg.delay_minutes || 0;
    if (delay > 15) {
      pills.push({ label: `${leg.ident || "Flight"} delayed ${delay}m`, color: "coral" });
    } else {
      pills.push({ label: `${leg.ident || "Flight"} on time`, color: "teal" });
    }
    // Gate
    if (leg.gate) pills.push({ label: `Gate ${leg.gate} confirmed`, color: "teal" });
    // Risk
    if (riskScore != null && riskScore >= 30) {
      pills.push({ label: `${riskScore}% disruption risk`, color: riskScore >= 60 ? "coral" : "amber" });
    }
    // Traffic to airport
    if (trafficData?.delay_mins > 5) {
      pills.push({ label: trafficData.summary || `${trafficData.delay_mins}m traffic delay`, color: "amber" });
    }
    // Weather at destination
    if (hs?.weather?.temp != null) {
      const dest = leg.destination || hs?.active_trip?.destination_city;
      pills.push({ label: `${dest ? dest + " " : ""}${hs.weather.temp}° on arrival`, color: "gold" });
    }
  } else if (hs?.state === "in_transit" && leg) {
    const dest = leg.destination || hs?.active_trip?.destination_city || "destination";
    pills.push({ label: `En route to ${dest}`, color: "gold" });
    if (hs?.weather?.temp != null) pills.push({ label: `${dest} ${hs.weather.temp}° on landing`, color: "gold" });
    if (leg.delay_minutes > 5) pills.push({ label: `${leg.delay_minutes}m delay`, color: "amber" });
  } else if (hs?.state === "at_destination") {
    // Local weather
    const w = hs?.weather || weather;
    if (w?.temp != null) pills.push({ label: `${w.temp}°${w.description ? " · " + w.description : ""}`, color: "gold" });
    // Return flight status
    if (leg?.ident) pills.push({ label: `Return: ${leg.ident}`, color: "teal" });
    // Traffic
    if (trafficData?.delay_mins > 5) {
      pills.push({ label: trafficData.summary || `${trafficData.delay_mins}m delays`, color: "amber" });
    } else if (trafficData?.city) {
      pills.push({ label: `Traffic normal in ${trafficData.city}`, color: "teal" });
    }
    // Today's events
    if (todayEvents?.length > 0) {
      const e = todayEvents[0];
      const timeStr = e.time ? new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
      pills.push({ label: timeStr ? `${timeStr} — ${e.title}` : e.title, color: "indigo" });
    }
  } else if (hs?.state === "pre_departure" && leg) {
    // Disruption risk
    if (riskScore != null && riskScore >= 30) {
      pills.push({ label: `${riskScore}% disruption risk`, color: riskScore >= 60 ? "coral" : "amber" });
    } else {
      pills.push({ label: "No disruption forecast", color: "teal" });
    }
    // Destination weather
    const w = hs?.weather || weather;
    if (w?.temp != null) {
      const dest = leg.destination || hs?.active_trip?.destination_city;
      pills.push({ label: `${dest ? dest + " " : ""}${w.temp}° at landing`, color: "gold" });
    }
    // Today's events
    if (todayEvents?.length > 0) {
      const e = todayEvents[0];
      const timeStr = e.time ? new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
      pills.push({ label: timeStr ? `${timeStr} — ${e.title}` : e.title, color: "indigo" });
    }
  } else {
    // No trip / standing by — city intelligence
    const w = weather;
    if (w?.temp != null) {
      const desc = w.description ? ` · ${w.description}` : "";
      pills.push({ label: `${w.temp}°${desc}`, color: "gold" });
    }
    // Airport status (use trafficData as a proxy for general city intel)
    if (trafficData?.delay_mins > 5) {
      pills.push({ label: trafficData.summary || `${trafficData.delay_mins}m delays`, color: "amber" });
    } else if (trafficData?.city) {
      pills.push({ label: `No major delays in ${trafficData.city}`, color: "teal" });
    }
    // Today's events
    if (todayEvents?.length > 0) {
      const e = todayEvents[0];
      const timeStr = e.time ? new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
      pills.push({ label: timeStr ? `${timeStr} — ${e.title}` : e.title, color: "indigo" });
    }
  }

  return pills.slice(0, 6); // max 6 pills
}

// Map pill colour NAME to the palette. These used to be hardcoded hexes — a fifth
// copy of the colour system, hiding inside a lookup table. Every one of them is now
// resolved from theme.js, so the palette cannot drift out from under this screen again.
const PILL_COLORS = {
  teal:   C.teal,
  coral:  C.coral,
  amber:  C.amber,
  gold:   C.gold,
  indigo: C.premium,
  mut:    C.mut,
};

function findNextFlight(trips) {
  const now = Date.now();
  let best = null, bestTime = Infinity;
  for (const trip of (trips || [])) {
    for (const leg of (trip.legs || [])) {
      // A SUGGESTION IS NOT A FLIGHT. This function fed the "TODAY - YOUR FLIGHT"
      // card, which cheerfully announced a Smoky Mountains leg Wingman had proposed
      // itself — origin unknown, rendered as "?", nine hours out, never booked.
      if (leg.type !== "flight" || !leg.departs_at) continue;
      if (leg.state === "proposed") continue;
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
          fid.displayName(leg),
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

// Cabin label helper
const CABIN_LABELS = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first: "First Class",
};

// Seat preference label helper
function seatLabel(seatPref) {
  if (!seatPref) return null;
  if (seatPref === "window") return "window seat";
  if (seatPref === "aisle") return "aisle seat";
  return null;
}

// Build the chief-of-staff briefing (greeting + upright opening + prose) from home state + trip data
function buildBriefing({ homeState, trips, weather, firstName, riskScore, userPrefs, newsData, trafficData, todayEvents, restaurantSuggestion, errored }) {
  const hs    = homeState;
  const leg   = hs?.active_leg;
  const trip  = hs?.active_trip;
  const hotel = hs?.hotel;
  const w     = hs?.weather || weather;
  const next  = findNextFlight(trips);

  const weatherCity = w?.city || trip?.destination_city || null;

  const hour = new Date().getHours();
  const timeGreet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = firstName || null;
  const greeting = name ? `${timeGreet}, ${name}.` : `${timeGreet}.`;

  let statusDotColor = C.mut;
  let statusLabel    = "No trips";
  let headline = null;   // upright opening line (no line breaks)
  let prose    = null;   // chief-of-staff body
  let editionSuffix = "";

  const suffix = (d) => (d ? ` · ${String(d).toUpperCase()} BRIEFING` : "");

  if (hs?.state === "in_transit" && leg) {
    statusDotColor = C.gold;
    statusLabel    = `Airborne · ${(fid.displayName(leg) || "")}`;
    const landMins = leg.arrives_at ? Math.round((new Date(leg.arrives_at).getTime() - Date.now()) / 60000) : null;
    const timeToLand = landMins && landMins > 0
      ? (landMins >= 60 ? `${Math.floor(landMins / 60)} hour${Math.floor(landMins / 60) !== 1 ? "s" : ""}` : `${landMins} minutes`)
      : null;
    const dest = leg.destination || trip?.destination_city || "your destination";
    editionSuffix = suffix(dest);
    headline = timeToLand ? `${timeToLand} to ${dest}.` : `En route to ${dest}.`;
    const parts = ["You're on schedule."];
    if (w) parts.push(`${dest} is ${w.temp}° when you land`);
    if (hotel) parts.push(`your room at ${hotel.name} is ready`);
    const arrivalsDelay = hs?.arrivals_delay_mins;
    if (arrivalsDelay && arrivalsDelay > 5) parts.push(`arrivals at ${dest} are running ${arrivalsDelay} minutes slow`);
    prose = `${parts.join(". ")}. Anything you need before you land?`;

  } else if (hs?.state === "at_airport" && leg) {
    statusDotColor = C.teal;
    statusLabel    = "On time";
    const ident = (fid.displayName(leg) || "");
    const minsAway = hs.hours_to_depart != null ? Math.round(hs.hours_to_depart * 60) : null;
    const timeStr  = minsAway != null ? (minsAway >= 120 ? `in ${Math.round(minsAway / 60)} hours` : `in ${minsAway} minutes`) : null;
    editionSuffix = suffix(weatherCity || leg.destination);
    headline = ident && timeStr ? `${ident} departs ${timeStr}.` : `Departure approaching.`;
    const parts = ["You're set to board."];
    const gate = [leg.gate ? `Gate ${leg.gate}` : null, leg.terminal ? `Terminal ${leg.terminal}` : null].filter(Boolean).join(", ");
    if (gate) parts.push(gate);
    if (w && weatherCity) parts.push(`${weatherCity} is ${w.temp}° when you land`);
    if (riskScore != null && riskScore >= 30) {
      statusDotColor = riskScore >= 60 ? C.coral : C.amber;
      statusLabel    = riskScore >= 60 ? "Disruption risk" : "Moderate risk";
      parts.push(riskScore >= 60
        ? `there's real disruption risk here — I'm on it and you'll have options the moment it moves`
        : `I'm keeping an eye on a ${riskScore}% chance of disruption`);
    }
    const cabin = userPrefs?.cabin_preference;
    const seat  = seatLabel(userPrefs?.seat_preference);
    const loungeCards = userPrefs?.lounge_cards || [];
    if ((cabin === "business" || cabin === "first") && loungeCards.length > 0) parts.push(`your ${loungeCards[0].replace(/_/g, " ")} card covers the lounge`);
    if (seat) parts.push(`I'll flag your ${seat} at check-in`);
    prose = `${parts.join(". ")}. What do you need before you board?`;

  } else if (hs?.state === "at_destination" && trip) {
    statusDotColor = C.gold;
    statusLabel    = "At destination";
    const city = trip.destination_city || leg?.destination || "your destination";
    editionSuffix = suffix(city);
    headline = `You're in ${city}.`;
    const parts = [];
    if (hotel) {
      const checkinTime = hotel.checkin_at ? new Date(hotel.checkin_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
      parts.push(`${hotel.name} checks in at ${checkinTime || "3:00 PM"}`);
    }
    if (w) parts.push(`it's ${w.temp}°${w.description ? `, ${w.description.toLowerCase()}` : ""}`);
    const destPace = userPrefs?.travel_pace;
    if (destPace === "tight") parts.push("I'll remind you when it's time to leave for the airport");
    else if (destPace === "generous") parts.push("I'll build extra buffer into your return");
    if (restaurantSuggestion?.name) {
      const stars = restaurantSuggestion.rating ? ` (${restaurantSuggestion.rating}★)` : "";
      parts.push(`${restaurantSuggestion.name}${stars} is worth booking`);
    }
    prose = parts.length ? `${parts.join(". ")}. What can I arrange for you?` : `You've arrived. What can I arrange for you?`;

  } else if ((hs?.state === "pre_departure" || !hs?.state) && next) {
    const daysAway  = Math.ceil((new Date(next.departs_at).getTime() - Date.now()) / 86400000);
    const ident     = (fid.displayName(next) || "");
    const dest      = next.destination || "your destination";
    editionSuffix = suffix(dest);
    if (daysAway <= 0) { statusDotColor = C.teal; statusLabel = "Today"; headline = `${dest} today.`; }
    else if (daysAway === 1) { statusDotColor = C.amber; statusLabel = "Tomorrow"; headline = `${dest} tomorrow.`; }
    else if (daysAway <= 7) { statusDotColor = C.amber; statusLabel = `${daysAway} days out`; headline = `${dest} in ${daysAway} days.`; }
    else { statusDotColor = C.mut; statusLabel = `${daysAway} days away`; headline = `${dest} in ${daysAway} days.`; }

    // Lead with a read
    let read;
    if (riskScore != null && riskScore >= 60) {
      statusDotColor = C.coral; statusLabel = "Disruption risk";
      read = `There's real disruption risk on this one — I'm on it, and you'll have rescue options the moment it moves.`;
    } else if (riskScore != null && riskScore >= 30) {
      statusDotColor = C.amber; statusLabel = `${riskScore}% risk`;
      read = `You're in good shape, though I'm keeping an eye on a ${riskScore}% chance of disruption.`;
    } else {
      read = `You're in good shape.`;
    }
    const parts = [read];
    if (ident) parts.push(`${ident} departs ${new Date(next.departs_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`);
    if (w && weatherCity) parts.push(`${weatherCity} will be ${w.temp}° when you land`);
    const preCabin = userPrefs?.cabin_preference;
    const preSeat  = seatLabel(userPrefs?.seat_preference);
    if (preCabin && next.cabin_class && next.cabin_class.toLowerCase() !== preCabin) parts.push(`you're in ${next.cabin_class} — an upgrade is worth a look`);
    if (preSeat) parts.push(`I'll watch for your ${preSeat} at check-in`);
    prose = `${parts.join(". ")}. Anything you'd like handled before you go?`;

  } else if (errored && (!trips || trips.length === 0)) {
    // The load FAILED and there's nothing cached to fall back on. Say that — do not
    // render it as an empty life. "Nothing on your calendar" when the truth is "I
    // couldn't reach the server" is the dark-monitor bug wearing a calm face.
    statusDotColor = C.amber;
    statusLabel    = "Can't reach Wingman";
    headline = "I can't reach the server right now.";
    prose = "This isn't an empty calendar — it's a connection I couldn't make. Pull to refresh, or try again in a moment. Nothing's lost.";
    return { greeting: "", headline, prose, statusDotColor, statusLabel, editionSuffix: "" };
  } else {
    statusDotColor = C.mut;
    statusLabel    = "Standing by";
    const city = w?.city || null;
    headline = city ? `All quiet in ${city}.` : `Nothing on your calendar yet.`;
    const parts = [];
    if (w && w.temp != null) parts.push(`It's ${w.temp}°${w.description ? ` and ${w.description.toLowerCase()}` : ""}.`);
    if (trafficData?.summary && trafficData?.delay_mins > 5) parts.push(trafficData.summary);
    const now = new Date();
    const upcomingEvents = (todayEvents || []).filter(e => !e.time || new Date(e.time) > now).slice(0, 2);
    if (upcomingEvents.length) {
      const eventsLine = upcomingEvents.map(e => {
        const timeStr = e.time ? new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
        return timeStr ? `${timeStr} — ${e.title}` : e.title;
      }).join(" · ");
      parts.push(`You have ${eventsLine}.`);
    }
    parts.push("Forward a booking or tell me where you're headed, and I'll take it from there.");
    prose = parts.join(" ");
  }

  return { greeting, headline, prose, statusDotColor, statusLabel, editionSuffix };
}

// Build the welcome message for the chat thread
function buildWelcomeMessage(trips, firstName, city) {
  const next = findNextFlight(trips);
  if (!next) {
    const hour = new Date().getHours();
    const timeGreet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const namePart = firstName ? `, ${firstName}` : "";
    const cityPart = city ? ` I see you're in ${city}.` : "";
    return `${timeGreet}${namePart}.${cityPart} What can I help you with?`;
  }
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
  const ident = fid.displayName(next);
  const parts = [route, ident].filter(Boolean).join(" · ");
  return `Good day. Your next flight${parts ? ` (${parts})` : ""} departs ${timeStr}. I'm monitoring it now — what can I do for you?`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const [trips, setTrips]               = useState([]);
  const [decisions, setDecisions]       = useState([]);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const decisionTimers                  = useRef({});
  const [tripsLoaded, setTripsLoaded]   = useState(false);
  const [homeState, setHomeState]       = useState(null);
  // Today's page of the trip document — the same legs the Dossier shows, filtered to
  // what's happening now and what's close enough to need you.
  const [today, setToday]               = useState(null);
  const [travel, setTravel]             = useState(null);
  const [todayErr, setTodayErr]         = useState(null);
  const [weather, setWeather]           = useState(null);
  const [firstName, setFirstName]       = useState("");
  const [riskScore, setRiskScore]       = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userPrefs, setUserPrefs]       = useState(null); // cabin, seat, lounge_cards, home_airports
  const [newsData, setNewsData]         = useState(null); // { articles: [] }
  const [trafficData, setTrafficData]   = useState(null); // { summary, delay_mins }
  const [todayEvents, setTodayEvents]   = useState([]);   // [{ title, time, location }]
  const [restaurantSuggestion, setRestaurantSuggestion] = useState(null); // { name, rating, maps_url }
  const [travelStats, setTravelStats]     = useState(null); // { trips_this_year, miles_this_year, nights_away_this_year }
  const [isSpeaking, setIsSpeaking]     = useState(false);
  const [isRefreshing, setIsRefreshing]  = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(true); // skeleton state
  const [briefError, setBriefError] = useState(false);          // load FAILED ≠ empty day
  const [homeSignals, setHomeSignals] = useState([]);           // Signals, folded into Home
  // The Brief. "Nothing needs you" as a graph query rather than a greeting.
  const [brief, setBrief] = useState(null);

  // Chat state
  const [messages, setMessages]         = useState([{ role: "assistant", content: "" }]);
  const [input, setInput]               = useState("");
  const [chatLoading, setChatLoading]   = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loadedAt, setLoadedAt]         = useState(null); // timestamp when briefing last loaded

  // Dev mode (5-tap unlock)
  const [devMode, setDevMode]           = useState(__DEV__);
  const devTapCount                     = useRef(0);

  const listRef    = useRef(null);
  const tripsRef   = useRef([]);
  const saveTimer  = useRef(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  // ── Manual refresh ─────────────────────────────────────────────────────────
  // Pull the Brief. Best-effort: if it fails, Home simply doesn't show the line —
  // it must never be the reason the screen won't load.
  const loadBrief = useCallback(async () => {
    try { setBrief(await getBrief()); } catch { /* silent */ }
    // Signals, folded into Home — only the ones that mattered. Imports/status/hotel_email
    // are plumbing (the machine narrating its own filing); they belong nowhere on Home.
    try {
      const { getActivity } = require("../api");
      const data = await getActivity(30);
      const routine = new Set(["import", "status", "hotel_email", "trip"]);
      setHomeSignals((data?.events || []).filter((e) => e && !routine.has(e.type)));
    } catch { /* leave empty rather than invent one */ }
  }, []);
  useEffect(() => { loadBrief(); }, [loadBrief]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    loadBrief();
    try {
      const [tripsData, meData] = await Promise.allSettled([getTrips(), getMe()]);
      if (tripsData.status === "fulfilled") {
        const loaded = tripsData.value.trips || [];
        tripsRef.current = loaded;
        setTrips(loaded);
      }
      if (meData.status === "fulfilled" && meData.value?.first_name) {
        setFirstName(meData.value.first_name);
      }
      // Today's page refreshes on pull, ALWAYS — it doesn't depend on having a
      // location fix. A leg you're inside is true whether or not the GPS answered,
      // and gating the document on location is how Home goes blank in a basement.
      try {
        const td = await getToday();
        if (td?.ok) { setToday(td); setTodayErr(null); }
        else setTodayErr(td?.error || "couldn't load today");
      } catch (e) { setTodayErr(e?.message || "couldn't load today"); }

      // Re-fetch home state with current location
      const lat = userLocation?.lat;
      const lng = userLocation?.lng;
      if (lat && lng) {
        const hs = await getHomeState({ lat, lng });
        if (hs?.ok) {
          setHomeState(hs);
          setLoadedAt(new Date());
        }
        const ws = await getWeather({ lat, lng });
        if (ws?.ok) setWeather(ws);
      }
    } catch {}
    setIsRefreshing(false);
  }, [userLocation]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setBriefingLoading(true);

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
            return [{ role: "assistant", content: buildWelcomeMessage(loaded, firstName, null) }];
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
      .catch(() => { if (!cancelled) { setTripsLoaded(true); setBriefingLoading(false); } });

    // Load pending decisions (chief-of-staff cards) — surface above the briefing
    getDecisions()
      .then(d => { if (!cancelled) setDecisions(d.decisions || []); })
      .catch(() => {});

    // Location + weather + home state
    (async () => {
      try {
        let optIn = await AsyncStorage.getItem(LOCATION_OPT_IN_KEY);
        let lat = null, lng = null;
        // If never asked, proactively request location so masthead always has weather
        if (optIn === null) {
          const { status: existing } = await Location.getForegroundPermissionsAsync();
          if (existing === "granted") {
            // Already granted (e.g. from a previous install) — use it silently
            await AsyncStorage.setItem(LOCATION_OPT_IN_KEY, "true");
            optIn = "true";
          } else {
            const { status: asked } = await Location.requestForegroundPermissionsAsync();
            if (asked === "granted") {
              await AsyncStorage.setItem(LOCATION_OPT_IN_KEY, "true");
              optIn = "true";
            } else {
              await AsyncStorage.setItem(LOCATION_OPT_IN_KEY, "false");
            }
          }
        }
        if (optIn === "true") {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === "granted") {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            if (!cancelled) setUserLocation({ lat, lng });
          }
        }
        const [hs, w, td, tv] = await Promise.allSettled([
          getHomeState(lat, lng),
          lat && lng ? getWeather(lat, lng) : Promise.resolve(null),
          getToday(),
          getTravel({ lat, lng }),
        ]);
        if (!cancelled) {
          if (hs.status === "fulfilled" && hs.value?.ok) {
            setHomeState(hs.value);
            if (hs.value?.restaurant_suggestion) setRestaurantSuggestion(hs.value.restaurant_suggestion);
          }
          // Today's page. Deliberately independent of homeState: the document is the
          // truth about what's happening, and it must render even if the state machine
          // above has nothing to say.
          //
          // AND IT SAYS WHEN IT FAILED. The first version of this line set `today`
          // only on success, so a 500 left the section simply absent — no error, no
          // gap, just a Home screen quietly missing the thing it was built to show.
          // That is the dark monitor again, and I wrote it the same day I fixed it
          // somewhere else. An empty day and an unanswered question are not the same.
          if (td.status === "fulfilled" && td.value?.ok) { setToday(td.value); setTodayErr(null); }
          else setTodayErr(td.reason?.message || td.value?.error || "couldn't load today");
          if (w.status === "fulfilled" && w.value?.ok) setWeather(w.value);
          // What the calendar implies you need to travel for. Proposals + honest
          // questions; never booked, never certain. Absent silently if it fails —
          // an empty travel section is fine, a crash is not.
          if (tv.status === "fulfilled" && tv.value?.ok) setTravel(tv.value);
          if (!cancelled) {
          setBriefingLoading(false);
          // Stamp timestamp whenever homeState loaded successfully (briefing is derived client-side)
          if (hs.value?.ok) setLoadedAt(new Date());
        }
        }
        // If the state call itself failed (rejected, or ok:false), remember THAT —
        // distinct from a genuinely empty day. Otherwise the briefing below falls to
        // "Nothing on your calendar yet," and a dropped connection reads as an empty
        // life. Same bug the Trips screen had; same class as the dark monitor.
        if (!cancelled) setBriefError(hs.status !== "fulfilled" || !hs.value?.ok);
      } catch {
        if (!cancelled) {
          setBriefingLoading(false);
          setBriefError(true);
        }
      }
    })();

    // User name + travel preferences
    getMe().then(u => { if (!cancelled && u?.first_name) setFirstName(u.first_name); }).catch(() => {});
    getTravelProfile().then(d => { if (!cancelled && d?.profile) setUserPrefs(d.profile); }).catch(() => {});
    // Travel stats for home screen strip
    getTravelStats().then(s => { if (!cancelled && s?.ok) setTravelStats(s); }).catch(() => {});

    // Briefing data: news, traffic, today events — fetched in parallel, silently
    // Only fetch when we have location
    const fetchBriefingData = async (lat, lng, city) => {
      try {
        const [news, traffic, events] = await Promise.allSettled([
          getLocalNews({ city, lat, lng }),
          lat && lng ? getLocalTraffic({ lat, lng, city }) : Promise.resolve(null),
          getTodayEvents(),
        ]);
        if (!cancelled) {
          if (news.status === "fulfilled" && news.value?.ok) setNewsData(news.value);
          if (traffic.status === "fulfilled" && traffic.value?.ok) setTrafficData(traffic.value);
          if (events.status === "fulfilled" && events.value?.ok) setTodayEvents(events.value.events || []);
        }
      } catch {}
    };
    // Delay slightly to let weather/location resolve first
    setTimeout(() => {
      if (!cancelled) {
        const city = null; // will be populated from weather state after it resolves
        fetchBriefingData(null, null, null);
      }
    }, 2000);

    return () => { cancelled = true; };
  }, []));

  // Home no longer loads a conversation thread.
  //
  // It used to load its OWN — getConciergeThread(null) — while the Concierge screen
  // loaded a different one keyed to the active trip. Two threads, two composers, and
  // a promise of persistent memory that silently depended on which of them you'd used.
  // The conversation now lives in exactly one place, so there is exactly one thing to
  // remember. Home is the briefing.

  // ── Context-aware opener based on thread recency ─────────────────────────────
  function buildContextOpener(updatedAt, trips, firstName, city) {
    // If thread was active within last 24h, use a "welcome back" opener
    if (updatedAt) {
      const hoursSince = (Date.now() - new Date(updatedAt).getTime()) / 3600000;
      if (hoursSince < 24) {
        const next = findNextFlight(trips);
        if (next) {
          const diff = new Date(next.departs_at).getTime() - Date.now();
          const hours = Math.floor(diff / 3600000);
          const days  = Math.floor(diff / 86400000);
          const timeStr = hours < 1 ? `in ${Math.round(diff / 60000)}m`
            : hours < 24 ? `in ${hours}h`
            : days === 1 ? "tomorrow"
            : `in ${days} days`;
          const ident = fid.displayName(next);
          return `Welcome back${firstName ? `, ${firstName}` : ""}. ${ident ? `${ident} departs ${timeStr}` : `Your next flight departs ${timeStr}`} — anything you need?`;
        }
        return `Welcome back${firstName ? `, ${firstName}` : ""}. What can I help with?`;
      }
    }
    return buildWelcomeMessage(trips, firstName, city);
  }

  // Refetch briefing data when weather/location resolves (provides city + coords)
  useEffect(() => {
    if (!weather) return;
    const lat = userLocation?.lat;
    const lng = userLocation?.lng;
    const city = weather.city || null;
    const country = weather.country_code || null;
    Promise.allSettled([
      getLocalNews({ city, country, lat, lng }),
      lat && lng ? getLocalTraffic({ lat, lng, city }) : Promise.resolve(null),
      getTodayEvents(),
    ]).then(([news, traffic, events]) => {
      if (news.status === "fulfilled" && news.value?.ok) setNewsData(news.value);
      if (traffic.status === "fulfilled" && traffic.value?.ok) setTrafficData(traffic.value);
      if (events.status === "fulfilled" && events.value?.ok) setTodayEvents(events.value.events || []);
    }).catch(() => {});
  }, [weather?.city]);

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
      const opener = buildContextOpener(data.updated_at, tripsRef.current, firstName, weather?.city || null);
      if (saved.length > 0) {
        setMessages([{ role: "assistant", content: opener }, ...saved]);
      } else {
        setMessages([{ role: "assistant", content: opener }]);
      }
    } catch {
      setMessages([{ role: "assistant", content: buildWelcomeMessage(tripsRef.current, firstName, weather?.city || null) }]);
    } finally {
      setThreadLoading(false);
    }
  }

  // ── Save a plan from the concierge as a real trip ────────────────────────────
  const savePlanAsTrip = async (plan) => {
    // Create the trip
    const tripData = await createTrip({
      title: plan.title || (plan.cities || []).join(' → '),
      status: 'upcoming',
      companions_count: 0,
    });
    const tripId = tripData?.id || tripData?.trip?.id;
    if (!tripId) throw new Error('No trip ID returned');

    // Add legs in order
    const legs = plan.legs || [];
    for (const leg of legs) {
      if (leg.type === 'flight') {
        await addLeg(tripId, {
          type: 'flight',
          origin: leg.from,
          destination: leg.to,
          departs_at: leg.date ? leg.date + 'T00:00:00Z' : null,
          notes: leg.routing || null,
        }).catch(() => {});
      } else if (leg.hotel) {
        await addLeg(tripId, {
          type: 'hotel',
          carrier: leg.hotel,
          destination: leg.city || null,
          departs_at: leg.check_in ? leg.check_in + 'T14:00:00Z' : null,
          arrives_at: (leg.check_in && leg.nights)
            ? new Date(new Date(leg.check_in + 'T12:00:00Z').getTime() + leg.nights * 86400000).toISOString()
            : null,
          notes: leg.why || null,
        }).catch(() => {});
      }
    }

    // Refresh trips list
    getTrips().then(d => setTrips(d.trips || [])).catch(() => {});
  };

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
        plan:    data.plan    || null,
        write:   data.write   || null,
      };
      // If the concierge made a write-back change, silently refresh the trips list
      if (data.write) {
        getTrips().then(d => setTrips(d.trips || [])).catch(() => {});
      }
      const updated = [...newMessages, aiMsg];
      setMessages(updated);
      scheduleSave(updated);
    } catch (err) {
      console.log("[CONCIERGE ERROR]", "status:", err?.status, "message:", err?.message, "detail:", err?.detail);
      const msg = (err?.message || "") + " " + (err?.detail || "");
      const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError" || /timeout/i.test(msg);
      const isOffline = /No connection|Network request failed|internet/i.test(msg);
      const isAuthError = err?.status === 401 || /401|unauthorized|session expired/i.test(msg);
      const isServiceDown = /service_unavailable|credit balance|insufficient_quota/i.test(msg);
      const isServerError = err?.status >= 500 || /50[0-9]|concierge_error/i.test(msg);
      const errMsg = isOffline
        ? "No internet connection — check your signal and try again."
        : isAuthError
        ? "Your session's expired. Sign out and back in (Settings › Sign out) and I'll be right here."
        : isServiceDown
        ? "I'm temporarily offline (my AI service hit a limit). This is on our side, not you — try again in a minute."
        : isTimeout
        ? "That took longer than usual — the server may have been waking up. Try once more, I'm ready."
        : isServerError
        ? "Something hiccuped on my end. Give it a few seconds and try again."
        : "That didn't go through. Try again — if it keeps happening, sign out and back in."
      setMessages(prev => [...prev, { role: "assistant", content: errMsg }]);
    } finally {
      setChatLoading(false);
    }
  };

  function scrollToBottom(animated = true) {
    setTimeout(() => { listRef.current?.scrollToEnd({ animated }); }, 80);
  }

  // ── Open on the BRIEF, not on the tail of yesterday's conversation ──────────
  // This used to fire on every mount: `if (messages.length > 0) scrollToBottom()`.
  // Since a restored thread always has messages, opening the app scrolled you
  // straight past the briefing to the bottom of a chat from last night. The first
  // thing you saw each morning was the end of a conversation you'd already had.
  //
  // (The old auto-scroll effect lived here. With no message list on Home, there is
  //  nothing to scroll to — and the bug it was written to fix, "the app opens at the
  //  bottom of last night's chat", cannot happen on a screen that has no chat.)

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
            setMessages([{ role: "assistant", content: buildWelcomeMessage(tripsRef.current, firstName, weather?.city || null) }]);
          },
        },
      ]
    );
  }

  // ── Derived briefing ─────────────────────────────────────────────────────────

  const { greeting, headline, prose, statusDotColor, statusLabel, editionSuffix } = useMemo(
    () => buildBriefing({ homeState, trips, weather, firstName, riskScore, userPrefs, newsData, trafficData, todayEvents, restaurantSuggestion, errored: briefError }),
    [homeState, trips, weather, firstName, riskScore, userPrefs, newsData, trafficData, todayEvents, restaurantSuggestion, briefError]
  );

  const nextFlight = useMemo(() => findNextFlight(trips), [trips]);

  // ── Intelligence signals strip ───────────────────────────────────────────────
  const signalPills = useMemo(
    () => buildSignalPills({ homeState, weather, trafficData, todayEvents, riskScore }),
    [homeState, weather, trafficData, todayEvents, riskScore]
  );

  // ── Render helpers ───────────────────────────────────────────────────────────

  function renderMessage({ item, index }) {
    const isUser = item.role === "user";
    if (!item.content && !item.transit && !item.places && !item.action && !item.plan) return null;
    return (
      <View style={[s.msgRow, isUser ? s.msgRowUser : s.msgRowWing]}>
        {!isUser && (
          <View style={s.wingMark}>
            <Text style={s.wingMarkT}>W</Text>
          </View>
        )}
        <View style={{ flex: 1, maxWidth: '85%' }}>
          <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleWing]}>
            {item.content ? (
              <Text style={[s.bubbleT, isUser && s.bubbleTUser]}>{item.content}</Text>
            ) : null}
          </View>
          {item.plan && !isUser ? (
            <PlanCard plan={item.plan} onSave={savePlanAsTrip} />
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
    // Always prefer local weather (user's current location) for the masthead
    const localCity = weather?.city || null;
    const localTemp = weather?.temp != null ? `${weather.temp}°` : null;
    if (localCity && localTemp) return `${localCity} · ${localTemp}`;
    if (localCity) return localCity;
    if (localTemp) return localTemp;
    // Fall back to destination city if no local weather
    const destCity = hs?.active_trip?.destination_city || null;
    if (destCity) return destCity;
    return null;
  })();

  const isNoTrip = !trips.length;

  // ── Dynamic placeholder based on home state ─────────────────────────────
  const inputPlaceholder = (() => {
    const hs = homeState;
    const next = findNextFlight(trips);
    if (hs?.state === "at_airport") return "Ask about your gate, lounge, or departure…";
    if (hs?.state === "in_transit") return "Ask about your flight, connection, or arrival…";
    if (hs?.state === "at_destination") {
      const dest = hs?.active_trip?.destination_city || hs?.active_leg?.destination || "your destination";
      return `Ask about restaurants, transport, or things to do in ${dest}…`;
    }
    if (next) {
      const dest = next.destination || "your destination";
      return `Ask about your trip to ${dest}…`;
    }
    return "Ask anything…";
  })();

  // ── Context-aware suggestion chips ───────────────────────────────────────
  const suggestionChips = (() => {
    if (messages.some(m => m.role === "user")) return []; // hide after user has typed
    const hs = homeState;
    const next = findNextFlight(trips);
    const chips = [];
    if (hs?.state === "in_transit") {
      chips.push("How much longer until landing?");
      chips.push("What's the weather at my destination?");
      chips.push("Will I make my connection?");
    } else if (hs?.state === "at_airport") {
      chips.push("Which lounge can I access?");
      chips.push("What's my gate?");
      chips.push("Any delay risk?");
    } else if (hs?.state === "at_destination") {
      const dest = hs?.active_trip?.destination_city || hs?.active_leg?.destination;
      if (dest) chips.push(`Best restaurants in ${dest}?`);
      chips.push("What's on this week?");
      chips.push("Best way to get around?");
    } else if (next) {
      const ident = fid.displayName(next);
      if (ident) chips.push(`Is ${ident} on time?`);
      if (next.origin && next.destination) chips.push(`Weather risk: ${next.origin} → ${next.destination}?`);
      chips.push("Upgrade options on my next flight?");
      chips.push("What should I pack?");
    } else {
      chips.push("Any disruption risks?");
      chips.push("Best airport lounge here?");
      chips.push("Dinner recommendations?");
    }
    return chips.slice(0, 3);
  })();

  // ── Last updated timestamp ──────────────────────────────────────────────────
  const lastUpdatedStr = loadedAt
    ? `Updated ${loadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : null;

  // ── Voice briefing ───────────────────────────────────────────────────────────
  const speakBriefing = async () => {
    const speaking = await Speech.isSpeakingAsync();
    if (speaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    const text = [greeting, headline?.replace(/\n/g, " "), prose].filter(Boolean).join(" ");
    if (!text) return;
    setIsSpeaking(true);
    Speech.speak(text, {
      language: "en-GB",
      pitch: 0.95,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const tabBarHeight = useBottomTabBarHeight();

  const handleConfirmDecision = async (decision, optionId) => {
    const opt = (decision.options || []).find(o => o.id === optionId);
    // For a real disruption's primary action, open the full rebooking flow.
    if (decision.kind === "rebook" && optionId === decision.recommended_option_id && decision.trip_id && decision.leg_id) {
      confirmDecision(decision.id, optionId).catch(() => {});
      setDecisions(prev => prev.filter(d => d.id !== decision.id));
      navigation.navigate("Situation", { legId: decision.leg_id, delay: 0 });
      return;
    }
    // Otherwise: acknowledge with a "Done" state (with a short undo window), then fade out.
    setDecisionBusy(true);
    setDecisions(prev => prev.map(d => d.id === decision.id ? { ...d, _confirmed: opt?.label || "Handled" } : d));
    try {
      await confirmDecision(decision.id, optionId);
    } catch (_) {
      setDecisions(prev => prev.map(d => d.id === decision.id ? { ...d, _confirmed: undefined } : d));
      setDecisionBusy(false);
      return;
    }
    setDecisionBusy(false);
    decisionTimers.current[decision.id] = setTimeout(
      () => setDecisions(prev => prev.filter(d => d.id !== decision.id)),
      6000
    );
  };

  const handleUndoDecision = (decision) => {
    clearTimeout(decisionTimers.current[decision.id]);
    setDecisions(prev => prev.map(d => d.id === decision.id ? { ...d, _confirmed: undefined } : d));
    undoDecision(decision.id).catch(() => {});
  };
  const handleDismissDecision = (decision) => {
    setDecisions(prev => prev.filter(d => d.id !== decision.id));
    dismissDecision(decision.id).catch(() => {});
  };

  // Day-of-travel: a focused panel when a flight departs within ~18h — gate, status,
  // countdown, and a tap into live tracking. Home becomes "today" on travel days.
  // ── Live Activity (lock screen / Dynamic Island) ──────────────────────────
  // Whenever the trip data changes, tell the lock screen. syncFlightActivity is
  // idempotent and decides for itself whether anything should be showing — it
  // starts, updates, or ends as needed. iOS-only; a no-op everywhere else, and it
  // swallows its own errors, because a courtesy must never break the app.
  useEffect(() => {
    const legs = (trips || []).flatMap((t) =>
      (t.legs || []).map((l) => ({ ...l, trip_id: t.id })),
    );
    syncFlightActivity(legs);
  }, [trips]);

  // ── Adaptive home (Roadmap 2, UI #1) ──────────────────────────────────────
  // Home reshapes by where you are in the trip: in-transit → day-of → pre-trip →
  // post-trip → planning. Exactly one hero panel shows, so the screen always leads
  // with the thing that matters right now.
  const inTransit = (() => {
    const now = Date.now();
    for (const trip of (trips || [])) {
      for (const leg of (trip.legs || [])) {
        if (leg.type !== "flight" || !leg.departs_at) continue;
        const dep = new Date(leg.departs_at).getTime();
        const arr = leg.arrives_at ? new Date(leg.arrives_at).getTime() : dep + 3 * 3600000;
        if (now >= dep && now <= arr + 30 * 60000) {
          const left = Math.max(0, arr - now);
          const h = Math.floor(left / 3600000);
          const m = Math.floor((left % 3600000) / 60000);
          const eta = h > 0 ? `Lands in ${h}h ${m}m` : m > 1 ? `Lands in ${m}m` : "Landing now";
          return { leg: { ...leg, tripTitle: trip.title }, eta };
        }
      }
    }
    return null;
  })();

  const dayOf = (() => {
    if (inTransit) return null; // you're already flying
    const flt = findNextFlight(trips);
    if (!flt?.departs_at) return null;
    const ms = new Date(flt.departs_at).getTime() - Date.now();
    if (ms < 0 || ms > 18 * 3600000) return null;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const countdown = h > 0 ? `Departs in ${h}h ${m}m` : m > 5 ? `Departs in ${m}m` : "Boarding soon";
    return { leg: flt, countdown };
  })();

  // Just landed — close the loop and capture the outcome while it's fresh.
  const postTrip = (() => {
    if (inTransit || dayOf) return null;
    const now = Date.now();
    let best = null, bestT = 0;
    for (const trip of (trips || [])) {
      for (const leg of (trip.legs || [])) {
        if (!leg.arrives_at) continue;
        const arr = new Date(leg.arrives_at).getTime();
        if (arr < now && now - arr < 48 * 3600000 && arr > bestT) { bestT = arr; best = trip; }
      }
    }
    return best ? { trip: best } : null;
  })();

  // Anticipatory pre-work (UX #1): for the next trip that isn't day-of yet,
  // show what Wingman has already handled so the value is visible before departure.
  // Every line reflects a real capability — nothing fabricated.
  const prep = (() => {
    if (dayOf || inTransit || postTrip) return null; // a nearer-term phase takes over
    const flt = findNextFlight(trips);
    if (!flt?.departs_at) return null;
    const days = Math.ceil((new Date(flt.departs_at).getTime() - Date.now()) / 86400000);
    if (days < 0 || days > 14) return null;
    const items = [
      {
        icon: "eye-outline",
        text: `Monitoring ${(fid.displayName(flt) || "").trim() || "your flight"} ${flt.origin || "?"}→${flt.destination || "?"} for delays and gate changes`,
      },
    ];
    if (riskScore != null) {
      items.push({
        icon: "pulse-outline",
        text: `Disruption risk checked — ${riskScore >= 60 ? "elevated" : riskScore >= 30 ? "moderate" : "low"} right now`,
      });
    }
    if (flt.origin) {
      items.push({
        icon: "cafe-outline",
        text: `Lounge, dining & terminal options ready for ${flt.origin}`,
        route: "LoungeCards",
        params: { airport: flt.origin },
      });
    }
    // Entry & documents. Wingman deliberately does NOT assert visa rules — getting
    // that wrong could strand you. It points to the authoritative source instead.
    if (flt.destination) {
      items.push({
        icon: "document-text-outline",
        text: `Entry rules for ${flt.destination} — confirm on the official source before you fly`,
        url: "https://www.iatatravelcentre.com/",
        verify: true,
      });
    }
    return { days, flt, items };
  })();

  // Masthead + hero briefing + section divider live INSIDE the FlatList as its
  // scrollable header. This keeps the message list the only flex element, so the
  // input bar reliably sits above the keyboard (the tall hero no longer pins it down).
  const listHeader = (
    <>
        {/* ── Masthead ──────────────────────────────────────────────────── */}
        <View style={s.masthead}>
          <Pressable onPress={() => { tap(); speakBriefing(); }} hitSlop={8}>
            <Text style={[s.mastW, isSpeaking && { opacity: 0.5 }]}>W</Text>
          </Pressable>
          <Text style={s.mastName}>WINGMAN</Text>
          <View style={s.mastRight}>
            {mastheadRight ? (
              <Text style={s.mastLoc}>{mastheadRight}</Text>
            ) : null}
            {/* The Ledger left the tab bar and lives here — the record, one tap from the
                brief, without taking a fifth of the bottom bar. */}
            <Pressable
              onPress={() => { tap(); navigation.navigate("Ledger"); }}
              hitSlop={8}
              accessibilityLabel="The Ledger — what Wingman did and what it protected"
            >
              <Text style={s.mastLink}>◆</Text>
            </Pressable>
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

        {/* ── Decisions — the one thing that needs you, above the briefing ── */}
        {decisions.length > 0 ? (
          <FadeRise style={{ marginTop: 8 }}>
            {decisions.slice(0, 2).map(d => (
              <DecisionCard
                key={d.id}
                decision={d}
                busy={decisionBusy}
                onConfirm={handleConfirmDecision}
                onDismiss={handleDismissDecision}
                onUndo={handleUndoDecision}
              />
            ))}
            {decisions.length > 2 ? (
              <Pressable
                style={s.decisionsMore}
                onPress={() => { tap(); navigation.navigate("Decisions"); }}
                accessibilityRole="button"
                accessibilityLabel={`View all ${decisions.length} decisions`}
              >
                <Text style={s.decisionsMoreT}>View all {decisions.length} decisions  ›</Text>
              </Pressable>
            ) : null}
          </FadeRise>
        ) : null}

        {/* ── What your calendar implies you need to travel for ──
            Proposals + honest questions, from your meetings and where you are.
            Renders only when there's something to say; silent otherwise. */}
        {travel && ((travel.trips || []).length || (travel.asks || []).length) ? (
          <FadeRise delay={60}>
            <InferredTravel
              trips={travel.trips || []}
              asks={travel.asks || []}
              from={travel.from}
              onPlan={(t) => { tap(); setInput(`Plan my ${t.destination} trip — ${t.reason}`); }}
              onAnswer={(a) => { tap(); setInput(`About "${a.driver?.title || "that meeting"}": I'll be attending `); }}
            />
          </FadeRise>
        ) : null}

        {/* ── In-transit — you're in the air right now ── */}
        {inTransit ? (
          <FadeRise delay={70}>
            <Pressable
              style={s.transitCard}
              onPress={() => { tap(); navigation.navigate("Situation", { legId: inTransit.leg.id, delay: 0 }); }}
            >
              <View style={s.dayOfHead}>
                <View style={[s.dayOfDot, { backgroundColor: C.gold }]} />
                <Text style={[s.dayOfKicker, { color: C.gold }]}>IN THE AIR</Text>
                <Text style={s.dayOfCountdown}>{inTransit.eta}</Text>
              </View>
              <Text style={s.dayOfRoute}>{inTransit.leg.origin || "?"} → {inTransit.leg.destination || "?"}</Text>
              <Text style={s.dayOfMeta}>
                {(fid.displayName(inTransit.leg) || "").trim()} · I'm watching your connections and onward bookings.
              </Text>
              <Text style={[s.dayOfCta, { color: C.gold }]}>Live status  ›</Text>
            </Pressable>
          </FadeRise>
        ) : null}

        {/* ── Just landed — close the loop while it's fresh ── */}
        {postTrip ? (
          <FadeRise delay={70}>
            <Pressable
              style={s.postTripCard}
              onPress={() => { tap(); navigation.navigate("Dossier", { tripId: postTrip.trip?.id }); }}
            >
              <View style={s.dayOfHead}>
                <View style={[s.dayOfDot, { backgroundColor: C.teal }]} />
                <Text style={[s.dayOfKicker, { color: C.teal }]}>WELCOME BACK</Text>
              </View>
              <Text style={s.postTripHed}>How was {postTrip.trip.title}?</Text>
              <Text style={s.dayOfMeta}>
                Rate it and I'll sharpen my predictions for your next one — and show you the value I protected.
              </Text>
              <Text style={[s.dayOfCta, { color: C.teal }]}>Rate this trip  ›</Text>
            </Pressable>
          </FadeRise>
        ) : null}

        {/* ── Day-of-travel panel — Home becomes "today" when you're flying ── */}
        {dayOf ? (
          <FadeRise delay={70}>
          <Pressable
            style={s.dayOfCard}
            onPress={() => { tap(); navigation.navigate("Situation", { legId: dayOf.leg.id, delay: 0 }); }}
          >
            <View style={s.dayOfHead}>
              <View style={s.dayOfDot} />
              <Text style={s.dayOfKicker}>TODAY · YOUR FLIGHT</Text>
              <Text style={s.dayOfCountdown}>{dayOf.countdown}</Text>
            </View>
            <Text style={s.dayOfRoute}>{dayOf.leg.origin || "?"} → {dayOf.leg.destination || "?"}</Text>
            {(() => {
              const meta = [
                (fid.displayName(dayOf.leg) || "").trim(),
                dayOf.leg.gate ? `Gate ${dayOf.leg.gate}` : null,
                dayOf.leg.terminal ? `Terminal ${dayOf.leg.terminal}` : null,
                dayOf.leg.status || null,
              ].filter(Boolean).join("  ·  ");
              return meta ? <Text style={s.dayOfMeta}>{meta}</Text> : null;
            })()}
            <Text style={s.dayOfCta}>Live status &amp; gate  ›</Text>
          </Pressable>
          </FadeRise>
        ) : null}

        {/* ── Anticipatory prep — "I've already handled this" (UX #1) ── */}
        {prep ? (
          <FadeRise delay={70} style={s.prepCard}>
            <View style={s.prepHead}>
              <Text style={s.prepKicker}>AHEAD OF YOUR TRIP</Text>
              <Text style={s.prepDays}>{prep.days === 0 ? "Departs today" : prep.days === 1 ? "In 1 day" : `In ${prep.days} days`}</Text>
            </View>
            <Text style={s.prepRoute}>{prep.flt.origin || "?"} → {prep.flt.destination || "?"}</Text>
            <View style={s.prepList}>
              {prep.items.map((it, i) => {
                const tappable = !!(it.route || it.url);
                const Row = tappable ? Pressable : View;
                const onPress = it.url
                  ? () => { tap(); Linking.openURL(it.url).catch(() => {}); }
                  : it.route
                  ? () => { tap(); navigation.navigate(it.route, it.params); }
                  : undefined;
                return (
                  <Row
                    key={i}
                    style={s.prepRow}
                    {...(tappable ? { onPress } : {})}
                  >
                    {/* A checkmark means "I've handled this." Items you must verify
                        yourself get their own icon — never a false all-clear. */}
                    <Ionicons
                      name={it.verify ? (it.icon || "open-outline") : "checkmark-circle"}
                      size={17}
                      color={it.verify ? C.amber : C.gold}
                      style={{ marginTop: 1 }}
                    />
                    <Text style={s.prepText}>{it.text}</Text>
                    {tappable ? <Text style={s.prepArrow}>›</Text> : null}
                  </Row>
                );
              })}
            </View>
          </FadeRise>
        ) : null}

        {/* ── HERO BRIEFING — fills the viewport above the fold ─────────── */}
        <View style={s.heroWrap}>
          {/* Edition line */}
          <View style={s.edition}>
            <Text style={s.editionDate}>{formatEditionDate()}{editionSuffix || ""}</Text>
            <View style={s.editionStatus}>
              <View style={[s.editionDot, { backgroundColor: briefingLoading ? C.mut : statusDotColor }]} />
              <Text style={s.editionStatusText}>{briefingLoading ? "LOADING" : statusLabel.toUpperCase()}</Text>
            </View>
          </View>

          {/* ── The one line that matters ────────────────────────────────────
              "Nothing needs you" as a COMPUTED FACT, not a greeting: no broken or
              tight dependency, no unresolved must, nothing awaiting your word, no
              pending decision. Every travel app writes this sentence. /brief checks
              it first — and when there's no upcoming travel it says "Nothing on the
              horizon" instead, because 0 of 0 is 100% and means nothing. */}
          {brief ? (
            <Pressable
              style={s.briefLine}
              onPress={() => {
                if (!brief.needs_you) return;
                tap();
                const n = brief.needs[0];
                if (n?.kind === "cascade" && n.leg_id) navigation.navigate("Situation", { legId: n.leg_id, delay: 0 });
                else if (n?.kind === "confirm") navigation.navigate("Plan", { tripId: n.trip_id });
                else navigation.navigate("Decisions");
              }}
              disabled={!brief.needs_you}
            >
              <View style={[s.briefDot, { backgroundColor: brief.needs_you ? C.amber : C.teal }]} />
              <Text style={[s.briefText, brief.needs_you && { color: C.ink }]}>{brief.headline}</Text>
              {brief.needs_you ? <Text style={s.briefArrow}>›</Text> : null}
            </Pressable>
          ) : null}

          {/* ── Disruption alert banner ── */}
          {(() => {
            const disrupted = (trips || []).flatMap(t => (t.legs || []).filter(l =>
              l.type === 'flight' && (l.status === 'Cancelled' || l.status === 'Delayed') &&
              l.departs_at && new Date(l.departs_at) > new Date()
            ).map(l => ({ ...l, tripId: t.id, tripTitle: t.title })));
            if (!disrupted.length) return null;
            const leg = disrupted[0];
            const isCancelled = leg.status === 'Cancelled';
            const ident = (leg.carrier || '') + (leg.flight_number || '');
            return (
              <Pressable
                style={[s.disruptionBanner, { borderColor: isCancelled ? C.coral + '60' : C.amber + '60', backgroundColor: isCancelled ? C.coral + '12' : C.amber + '10' }]}
                onPress={() => { tap(); navigation.navigate('Disruption', { tripId: String(leg.tripId), legId: String(leg.id), ident }); }}
              >
                <Ionicons name={isCancelled ? "alert-circle-outline" : "time-outline"} size={20} color={isCancelled ? C.coral : C.amber} style={s.disruptionBannerIcon} />

                <View style={{ flex: 1 }}>
                  <Text style={[s.disruptionBannerTitle, { color: isCancelled ? C.coral : C.amber }]}>
                    {isCancelled ? `${ident} cancelled` : `${ident} delayed`}
                  </Text>
                  <Text style={s.disruptionBannerSub}>{leg.origin} → {leg.destination} · Tap to see options</Text>
                </View>
                <Text style={[s.disruptionBannerArrow, { color: isCancelled ? C.coral : C.amber }]}>›</Text>
              </Pressable>
            );
          })()}

          {/* Skeleton loading state */}
          {briefingLoading ? (
            <View style={s.skeletonWrap}>
              <View style={[s.skeletonLine, { width: "60%", height: 44, marginBottom: 6 }]} />
              <View style={[s.skeletonLine, { width: "80%", height: 44, marginBottom: 20 }]} />
              <View style={[s.skeletonLine, { width: "95%", height: 16, marginBottom: 8 }]} />
              <View style={[s.skeletonLine, { width: "85%", height: 16, marginBottom: 8 }]} />
              <View style={[s.skeletonLine, { width: "70%", height: 16 }]} />
            </View>
          ) : (
            <>
              {/* Greeting (italic) + upright opening — editorial chief-of-staff briefing */}
              {(greeting || headline) ? (
                <View style={s.headlineWrap}>
                  <Text style={s.hedPara}>
                    {greeting ? <Text style={s.hedGreet}>{greeting} </Text> : null}
                    {headline || ""}
                  </Text>
                </View>
              ) : null}

              {/* Prose briefing */}
              {prose ? (
                <Text style={s.prose}>{prose}</Text>
              ) : null}

              {/* Intelligence signals strip — horizontal scrollable pills */}
              {signalPills.length > 0 && !briefingLoading ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.signalStrip}
                  contentContainerStyle={s.signalStripContent}
                >
                  {signalPills.map((pill, i) => (
                    <View key={i} style={s.signalPill}>
                      <View style={[s.signalDot, { backgroundColor: PILL_COLORS[pill.color] || PILL_COLORS.mut }]} />
                      <Text style={s.signalPillT}>{pill.label}</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              {/* ── The stats strip is gone ────────────────────────────────────
                  "16 TRIPS · 6,400 EST. MILES · 81 NIGHTS AWAY."

                  That's a fitness tracker. It flatters the reader and tells them
                  nothing they can act on — and a private travel office does not
                  congratulate you on your mileage. It's the same instinct as the
                  points system: performing value instead of delivering it.

                  travelStats is still fetched; the concierge uses it for context.
                  It just doesn't get a trophy cabinet on the front page. */}

              {/* ── Add-trip shortcut ──────────────────────────────────────────
                  `trips` holds UPCOMING trips only. Someone with 46 past trips and
                  nothing booked has an empty array — so this used to greet them
                  with "+ Add your FIRST trip", directly beneath a stats bar reading
                  "16 trips · 6,400 miles". The app knew two things and believed
                  both.

                  Truly new (no history at all) → "Add your first trip".
                  Has history, nothing booked → "Add your next trip". */}
              {!trips.length && !briefingLoading ? (
                <Pressable
                  style={s.addTripShortcut}
                  onPress={() => { tap(); navigation.navigate("AddTrip"); }}
                  accessibilityRole="button"
                >
                  <Text style={s.addTripShortcutT}>
                    {Number(travelStats?.total_trips) > 0
                      ? "+ Add your next trip"
                      : "+ Add your first trip"}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}

          {/* Last updated timestamp — only when there is headline content */}
          {lastUpdatedStr && headline && !briefingLoading ? (
            <Text style={s.lastUpdated}>{lastUpdatedStr}</Text>
          ) : null}

          {/* Briefing controls row: speak + refresh */}
          {headline && !briefingLoading ? (
            <View style={s.briefingControls}>
              <Pressable onPress={() => { tap(); speakBriefing(); }} style={s.speakHint}>
                <Text style={[s.speakHintT, isSpeaking && { color: C.gold }]}>
                  {isSpeaking ? "◼︎ Stop" : "▶︎ Hear briefing"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { tap(); handleRefresh(); }}
                style={s.speakHint}
                disabled={isRefreshing}
              >
                <Text style={[s.speakHintT, isRefreshing && { opacity: 0.4 }]}>
                  {isRefreshing ? "Refreshing…" : "↺ Refresh"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* ── TODAY'S PAGE OF THE DOCUMENT ───────────────────────────────────────
            Not a summary of the trip — the trip itself, narrowed to now. Same cards as
            the Dossier, same dependency lines, from ../tripdoc so the two can't drift.

            This is what was missing when Home said "Nothing on your calendar yet" to a
            woman sitting in the Kimpton: the old brief asked for the next FLIGHT and,
            finding none, concluded she had no life. A hotel you are inside is the most
            concrete fact available about where you are. */}
        {todayErr ? (
          <View style={s.docWrap}>
            <Text style={s.docLabel}>TODAY</Text>
            <Text style={s.docErr}>
              I couldn't load today's page. This isn't an empty day — it's a question I
              couldn't get answered. Pull to refresh.
            </Text>
          </View>
        ) : null}

        {(today?.chapters?.in_motion?.length || today?.chapters?.prepare?.length) ? (
          <View style={s.docWrap}>
            {(today.chapters.in_motion || []).length ? (
              <>
                <Text style={s.docLabel}>NOW</Text>
                {today.chapters.in_motion.map((l) => (
                  <Pressable key={l.id} onPress={() => { tap(); navigation.navigate("Dossier", { tripId: l.trip_id }); }}>
                    <Leg leg={l} compact />
                  </Pressable>
                ))}
                <RideCount n={today.rides?.in_motion || 0} />
              </>
            ) : null}

            {(today.chapters.prepare || []).length ? (
              <>
                <Text style={[s.docLabel, { marginTop: 22 }]}>NEXT</Text>
                {today.chapters.prepare.map((l) => (
                  <Pressable key={l.id} onPress={() => { tap(); navigation.navigate("Dossier", { tripId: l.trip_id }); }}>
                    <Leg leg={l} compact />
                  </Pressable>
                ))}
                <RideCount n={today.rides?.prepare || 0} />
              </>
            ) : null}
          </View>
        ) : null}

        {/* ── SIGNALS, folded in ─────────────────────────────────────────────────
            When the tabs collapsed from five to three I said Signals "folds into Home"
            and then only deleted the tab — the feed itself never landed here. This is
            that feed, at last: ONLY things that needed you, and what was handled. The
            import plumbing that used to fill the old Signals tab is deliberately not
            here — the brief above already says whether anything needs you; this is the
            evidence behind it, not a changelog of your own inbox. Nothing to show →
            nothing rendered. */}
        {homeSignals.length > 0 ? (
          <View style={s.sigWrap}>
            <View style={s.sigHead}>
              <Text style={s.sigLabel}>RECENT SIGNALS</Text>
              <Pressable onPress={() => { tap(); navigation.navigate("Intelligence"); }} hitSlop={8}>
                <Text style={s.sigAll}>All ›</Text>
              </Pressable>
            </View>
            {homeSignals.slice(0, 4).map((e) => (
              <Pressable
                key={e.id}
                style={s.sigRow}
                onPress={() => {
                  tap();
                  if (e.leg_id) navigation.navigate("Situation", { legId: e.leg_id, delay: 0 });
                  else if (e.trip_id) navigation.navigate("Dossier", { tripId: e.trip_id });
                }}
              >
                <View style={[s.sigDot, {
                  backgroundColor: ["disruption", "delay", "weather"].includes(e.type) ? C.coral
                    : e.type === "recovery" ? C.teal : C.mutD,
                }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.sigTitle} numberOfLines={1}>{e.title}</Text>
                  {e.body ? <Text style={s.sigBody} numberOfLines={1}>{e.body}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

    </>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // HOME IS THE BRIEFING. There is no chat here any more.
  //
  // Home used to be a briefing with a chat bolted underneath it, and that had two
  // costs, one obvious and one not.
  //
  // The obvious one: a composer at the bottom of a screen is an instruction to type.
  // So the first thing Wingman did every morning was ask you a question — which is
  // exactly backwards for something that claims to have been working while you slept.
  // A chief of staff opens with what happened, not with "how can I help?"
  //
  // The one that actually mattered: Home kept its own conversation thread (trip_id
  // null) while Concierge kept another (trip_id = the active trip). Two composers,
  // two threads. So "Wingman remembers" was quietly conditional on WHICH BOX you
  // happened to type into — and there was no way to tell them apart from the outside.
  // Deleting this composer doesn't just tidy the screen; it makes the memory claim
  // true, because now there is only one conversation to remember.
  //
  // The chat is one tap away, floating, and it keeps everything you said.
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={C.mut} />
        }
        showsVerticalScrollIndicator={false}
      >
        {listHeader}

        {devMode && (
          <View style={s.devSection}>
            <Text style={s.devLabel}>TEST NOTIFICATIONS</Text>
            <Pressable style={s.devBtn} onPress={async () => {
              await scheduleDisruption(nextFlight);
              setTimeout(() => navigation.navigate("Situation", { legId: nextFlight?.id, delay: 120 }), 3500);
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

        {/* 5-tap to unlock dev mode — now lives at the foot of the briefing. */}
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

        {/* Room for the floating "Ask Wingman" pill, which now shows on Home. */}
        <View style={{ height: 96 }} />
      </ScrollView>
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
  mastLink: { fontFamily: T.sans, fontSize: 15, color: C.mutD, marginRight: 4 },
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

  // ── Day-of-travel panel ──
  dayOfCard: {
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 4,
    padding: 18,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "rgba(45,184,150,0.30)",
    ...SHADOW.soft,
  },
  dayOfHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dayOfDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.teal },
  dayOfKicker: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2, color: C.teal, flex: 1 },
  dayOfCountdown: { fontFamily: T.sansM, fontSize: 11, color: C.mut },
  dayOfRoute: { fontFamily: T.garamondSI, fontSize: 30, color: C.ink, lineHeight: 34, marginBottom: 4 },
  dayOfMeta: { fontFamily: T.sans, fontSize: 12, color: C.mut, marginBottom: 10 },
  dayOfCta: { fontFamily: T.sansB, fontSize: 12, color: C.teal },

  // ── Adaptive phases: in-transit + post-trip ──
  transitCard: {
    marginHorizontal: 24, marginTop: 12, marginBottom: 4, padding: 18, borderRadius: 16,
    backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(201,169,110,0.30)",
    ...litEdge, ...SHADOW.soft,
  },
  postTripCard: {
    marginHorizontal: 24, marginTop: 12, marginBottom: 4, padding: 18, borderRadius: 16,
    backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(45,184,150,0.30)",
    ...litEdge, ...SHADOW.soft,
  },
  postTripHed: { fontFamily: T.garamondSI, fontSize: 26, color: C.ink, lineHeight: 31, marginBottom: 6 },

  // ── Anticipatory prep card (UX #1) ──
  prepCard: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 18,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    ...litEdge,
    ...SHADOW.soft,
  },
  prepHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  prepKicker: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2, color: C.mutD },
  prepDays: { fontFamily: T.sansM, fontSize: 11, color: C.mut },
  prepRoute: { fontFamily: T.garamondSI, fontSize: 26, color: C.ink, lineHeight: 30, marginBottom: 12 },
  prepList: { gap: 10 },
  prepRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  prepText: { flex: 1, fontFamily: T.sans, fontSize: 13.5, lineHeight: 19, color: C.ink },
  prepArrow: { fontFamily: T.sans, fontSize: 16, color: C.mut, opacity: 0.6, marginLeft: 4 },
  decisionsMore: { marginHorizontal: 20, marginTop: 2, marginBottom: 4, paddingVertical: 10, alignItems: "center" },
  decisionsMoreT: { fontFamily: T.sansM, fontSize: 13, color: C.gold, letterSpacing: 0.2 },

  // ── Hero briefing wrapper ──
  // Sits between masthead and CONVERSATION divider.
  // Does NOT scroll — it is always visible above the fold.
  // The Brief line. Teal dot = nothing needs you, and that is a checked fact.
  // Amber + arrow = something does, and tapping takes you straight to it.
  docWrap:  { marginTop: 26 },
  docErr:   { fontFamily: T.sans, fontSize: 14, color: C.amber, lineHeight: 21 },
  docLabel: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.6, color: C.gold, marginBottom: 12 },
  sigWrap:  { marginHorizontal: 20, marginTop: 26 },
  sigHead:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sigLabel: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2.4, color: C.mutD },
  sigAll:   { fontFamily: T.sansM, fontSize: 12, color: C.gold },
  sigRow:   { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 11,
              borderTopWidth: 1, borderTopColor: C.line },
  sigDot:   { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  sigTitle: { fontFamily: T.sansM, fontSize: 14, color: C.ink },
  sigBody:  { fontFamily: T.sans, fontSize: 12.5, color: C.mut, marginTop: 2 },

  briefLine: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginTop: 14, marginBottom: 4,
  },
  briefDot: { width: 7, height: 7, borderRadius: 4 },
  briefText: { flex: 1, fontFamily: T.garamondI, fontSize: 17, lineHeight: 24, color: C.mut },
  briefArrow: { fontFamily: T.sansM, fontSize: 18, color: C.amber },

  heroWrap: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    borderBottomOpacity: 0.4,
  },

  // Briefing controls row (speak + refresh)
  briefingControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingTop: 4,
  },
  // Tap-to-speak hint line below prose
  speakHint: {
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  speakHintT: {
    fontFamily: T.sansM,
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.mut,
    textTransform: "uppercase",
  },

  // ── Scroll content ──
  scrollContent: {
    paddingBottom: 16,
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
  hedPara: {
    fontFamily: T.garamond,
    fontSize: 25,
    color: C.ink,
    lineHeight: 33,
    letterSpacing: -0.2,
  },
  hedGreet: {
    fontFamily: T.garamondMI,
    fontSize: 25,
    color: C.ink,
    letterSpacing: -0.2,
  },

  // ── Skeleton loading ──
  skeletonWrap: {
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  skeletonLine: {
    backgroundColor: "rgba(200,168,106,0.07)",
    borderRadius: 6,
  },

  // ── Add Trip shortcut ──
  addTripShortcut: {
    marginHorizontal: 24,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(200,168,106,0.25)",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  addTripShortcutT: {
    fontFamily: T.sansM,
    fontSize: 13,
    color: C.gold,
    letterSpacing: 0.5,
  },

  // ── Intelligence signals strip ──
  signalStrip: {
    marginTop: 14,
  },
  signalStripContent: {
    paddingHorizontal: 24,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  signalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 20,
  },
  signalDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  signalPillT: {
    fontFamily: T.sansM,
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.2,
  },

  // ── Travel stats strip ──

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
    fontFamily: T.sans,
    fontSize: 15,
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

  // ── Suggestion chips row ──
  chipsRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    flexDirection: "row",
  },
  chip: {
    backgroundColor: "rgba(200,168,106,0.08)",
    borderWidth: 1,
    borderColor: "rgba(200,168,106,0.28)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipT: {
    fontFamily: T.sansM,
    fontSize: 12,
    color: C.gold,
    letterSpacing: 0.1,
  },

  // ── Last updated timestamp ──
  lastUpdated: {
    paddingHorizontal: 24,
    paddingTop: 6,
    fontFamily: T.sans,
    fontSize: 10,
    color: C.mut,
    opacity: 0.5,
    letterSpacing: 0.5,
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

  // ── Disruption alert banner ──
  disruptionBanner: {
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  disruptionBannerIcon: {
    fontSize: 20,
    flexShrink: 0,
  },
  disruptionBannerTitle: {
    fontFamily: T.sansM,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  disruptionBannerSub: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
    marginTop: 2,
  },
  disruptionBannerArrow: {
    fontFamily: T.sansB,
    fontSize: 22,
    flexShrink: 0,
  },
});
