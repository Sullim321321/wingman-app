// TripDetailScreen.js — Editorial v3
// EB Garamond serif headline · prose briefing · clean data rows · three action buttons
// Preserves all backend hooks: live flight status, risk, refresh, companion invite,
// destination intel, outcome rating, wallet pass, upgrade bid, compensation, share

import React, { useState, useCallback, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Share, Linking, TextInput, Modal,
} from "react-native";
import { C, T, SHADOW, litEdge } from "../theme";
import { tap, FadeRise } from "../components";
import { ShareCardModal } from "../components/ShareCard";
import { DestinationImage } from "../components/DestinationImage";
import { Ionicons } from "@expo/vector-icons";
// SDK 56 silently swapped expo-calendar's default export to a NEW object-oriented
// API and moved the original to /legacy. Expo filed this under "Deprecations", not
// "Breaking changes" — so it compiles clean and then misbehaves at runtime, which
// is the worst possible failure mode. This code uses the original API.
import * as Calendar from "expo-calendar/legacy";
import {
  getFlightStatus, getPrediction, refreshTrip, getTripRisk,
  recordTripOutcome, shareTripLink, getDestinationIntel,
  inviteCompanion, getCompanions, getTrips,
  getChecklist, generateChecklist, updateChecklistItem, addChecklistItem,
  getShowNights, updateCompanionsMeta, getDisruptionAlternatives,
  editLeg, deleteLeg, exportCalendarIcs, getToken,
  getStandingOrder, setStandingOrder, getMe,
} from "../api";
import { UpgradeSheet } from "../components/UpgradeSheet";
import { API_BASE } from "../config";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch { return null; }
}

function fmtTime(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return null; }
}

function minutesToHM(mins) {
  if (!mins) return null;
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? "−" : "+";
  return h > 0 ? `${sign}${h}h ${m}m` : `${sign}${m}m`;
}

// Merge multiple reservations at the SAME hotel (e.g. nights booked under separate
// confirmation numbers) into one stay spanning check-in → check-out. Non-stay legs
// pass through untouched.
function consolidateStays(legs) {
  const stays = [];
  const rest = [];
  const groups = {};
  for (const l of legs) {
    if (l.type === "hotel" || l.type === "airbnb") {
      const key = String(l.carrier || l.destination || l.property_name || l.type).trim().toLowerCase();
      (groups[key] = groups[key] || []).push(l);
    } else {
      rest.push(l);
    }
  }
  for (const key of Object.keys(groups)) {
    const g = groups[key];
    if (g.length === 1) { stays.push(g[0]); continue; }
    let start = null, end = null;
    for (const l of g) {
      if (l.departs_at && (!start || l.departs_at < start)) start = l.departs_at;
      const e = l.arrives_at || l.departs_at;
      if (e && (!end || e > end)) end = e;
    }
    let nights = null;
    if (start && end) nights = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
    const base = g.slice().sort((a, b) => (a.departs_at || "") < (b.departs_at || "") ? -1 : 1)[0];
    stays.push({
      ...base,
      departs_at: start,
      arrives_at: end,
      _nights: nights,
      _mergedCount: g.length,
      confirmation: g.map(x => x.confirmation).filter(Boolean).join(", ") || base.confirmation,
    });
  }
  // Dedupe non-stay legs too (identical Ubers/transfers): same type + name + time.
  const seen = new Set();
  const dedupedRest = rest.filter((l) => {
    const key = `${l.type}|${String(l.carrier || l.destination || "").toLowerCase()}|${l.departs_at || ""}|${l.confirmation || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...dedupedRest, ...stays];
}

// Stays show check-in/out DATES only — parsers often emit a bogus "11:00 AM – 8:00 AM"
// clock time, which is meaningless for a hotel. Returns a clean date-range label.
function stayDatesLabel(leg) {
  const ci = fmt(leg.departs_at);
  const co = fmt(leg.arrives_at);
  const nights = leg._nights;
  if (ci && co && co !== ci) return `${ci} → ${co}${nights ? ` · ${nights} night${nights > 1 ? "s" : ""}` : ""}`;
  if (ci) return `Check-in ${ci}`;
  return null;
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  if (!status) return null;
  const map = {
    "On Time":   { bg: "rgba(45,184,150,0.08)",  border: "rgba(45,184,150,0.2)",  text: C.teal },
    "Delayed":   { bg: "rgba(212,144,42,0.08)",  border: "rgba(212,144,42,0.2)",  text: C.amber },
    "Cancelled": { bg: "rgba(217,95,95,0.08)",   border: "rgba(217,95,95,0.2)",   text: C.coral },
    "Landed":    { bg: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.2)", text: "#818CF8" },
    "In Air":    { bg: "rgba(201,169,110,0.08)", border: "rgba(201,169,110,0.2)", text: C.gold },
    "Scheduled": { bg: "rgba(138,127,112,0.07)", border: "rgba(138,127,112,0.15)", text: C.mut },
    "Booked":    { bg: "rgba(138,127,112,0.07)", border: "rgba(138,127,112,0.15)", text: C.mut },
  };
  const st = map[status] || map["Scheduled"];
  return (
    <View style={[s.pill, { backgroundColor: st.bg, borderColor: st.border }]}>
      <Text style={[s.pillT, { color: st.text }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

// ─── Live Flight Card ─────────────────────────────────────────────────────────

function FlightLegRow({ leg, isCompleted, tripId, navigation, onEdit, onDelete }) {
  const [liveStatus, setLiveStatus] = useState(null);
  const [risk, setRisk]             = useState(null);

  useEffect(() => {
    if (!leg.carrier || !leg.flight_number) return;
    getFlightStatus(leg.carrier, leg.flight_number, leg.departs_at)
      .then(d => { if (d?.status) setLiveStatus(d); })
      .catch(() => {});
    if (leg.origin && leg.destination) {
      getPrediction({ dep: leg.origin, arr: leg.destination })
        .then(p => { if (p?.risk != null) setRisk(p.risk); })
        .catch(() => {});
    }
  }, [leg.carrier, leg.flight_number]);

  const ident      = [leg.carrier, leg.flight_number].filter(Boolean).join("");
  const depTime    = fmtTime(leg.departs_at);
  const arrTime    = fmtTime(leg.arrives_at);
  const depDate    = fmt(leg.departs_at);
  const status     = liveStatus?.status || leg.status || null;
  const delayMins  = liveStatus?.delay_minutes || null;
  const gate       = liveStatus?.gate || leg.gate || null;
  const terminal   = liveStatus?.terminal || leg.terminal || null;

  return (
    <View style={s.legBlock}>
      {/* Route row */}
      <View style={s.legRouteRow}>
        <View style={s.legAirport}>
          <Text style={s.legCode}>{leg.origin || "—"}</Text>
          {depTime && <Text style={s.legTime}>{depTime}</Text>}
        </View>
        <View style={s.legArrowWrap}>
          <Text style={s.legArrow}>→</Text>
          {ident ? <Text style={s.legIdent}>{ident}</Text> : null}
        </View>
        <View style={[s.legAirport, { alignItems: "flex-end" }]}>
          <Text style={s.legCode}>{leg.destination || "—"}</Text>
          {arrTime && <Text style={s.legTime}>{arrTime}</Text>}
        </View>
      </View>

      {/* Meta row */}
      <View style={s.legMetaRow}>
        {depDate && <Text style={s.legMeta}>{depDate}</Text>}
        {gate && <Text style={s.legMeta}>Gate {gate}{terminal ? ` · T${terminal}` : ""}</Text>}
        {delayMins && <Text style={[s.legMeta, { color: C.amber }]}>{minutesToHM(delayMins)}</Text>}
        {status && <StatusPill status={status} />}
        {risk != null && risk >= 30 && (
          <View style={[s.pill, {
            backgroundColor: risk >= 60 ? "rgba(217,95,95,0.08)" : "rgba(212,144,42,0.08)",
            borderColor:     risk >= 60 ? "rgba(217,95,95,0.2)"  : "rgba(212,144,42,0.2)",
          }]}>
            <Text style={[s.pillT, { color: risk >= 60 ? C.coral : C.amber }]}>{risk}% RISK</Text>
          </View>
        )}
      </View>

      {/* Action row */}
      <View style={s.legActions}>
        {leg.id && (
          <Pressable
            style={s.legAction}
            onPress={() => { tap(); Linking.openURL(`${API_BASE}/wallet/pass/${leg.id}`); }}
          >
            <Text style={s.legActionT}>Wallet</Text>
          </Pressable>
        )}
        {!isCompleted && leg.id && (
          <Pressable
            style={s.legAction}
            onPress={() => { tap(); navigation.navigate("UpgradeBid", {
              tripId, legId: leg.id,
              flightIdent: leg.flight_number,
              origin: leg.origin, destination: leg.destination, carrier: leg.carrier,
            }); }}
          >
            <Text style={s.legActionT}>Upgrade bid</Text>
          </Pressable>
        )}
        {isCompleted && leg.id && (
          <Pressable
            style={s.legAction}
            onPress={() => { tap(); navigation.navigate("Compensation", {
              tripId, legId: leg.id, flightIdent: leg.flight_number,
            }); }}
          >
            <Text style={s.legActionT}>Claim compensation</Text>
          </Pressable>
        )}
        {leg.destination && (
          <Pressable
            style={s.legAction}
            onPress={() => { tap(); navigation.navigate("GroundTransport", {
              iata: leg.destination, city: leg.destination, tripId,
            }); }}
          >
            <Text style={s.legActionT}>Transport</Text>
          </Pressable>
        )}
        {leg.destination && (
          <Pressable
            style={s.legAction}
            onPress={() => { tap(); navigation.navigate("LoungeCards", { airport: leg.destination }); }}
          >
            <Text style={s.legActionT}>Lounge</Text>
          </Pressable>
        )}
        {onEdit && (
          <Pressable style={s.legAction} onPress={() => { tap(); onEdit(leg); }}>
            <Text style={s.legActionT}>Edit</Text>
          </Pressable>
        )}
        {onDelete && (
          <Pressable style={[s.legAction, s.legActionDanger]} onPress={() => { tap(); onDelete(leg); }}>
            <Text style={[s.legActionT, { color: C.coral }]}>Remove</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Non-flight Leg Row ───────────────────────────────────────────────────────

function OtherLegRow({ leg, onEdit, onDelete }) {
  const typeLabel = {
    hotel:    "Stay",
    airbnb:   "Stay",
    train:    "Train",
    car:      "Car",
    ferry:    "Ferry",
    activity: "Activity",
    transfer: "Transfer",
    cruise:   "Cruise",
    other:    "Booking",
  }[leg.type] || "Booking";

  const name     = leg.carrier || leg.destination || typeLabel;
  const isStay   = leg.type === "hotel" || leg.type === "airbnb";
  const depDate  = fmt(leg.departs_at);
  const arrDate  = fmt(leg.arrives_at);
  const depTime  = fmtTime(leg.departs_at);
  const arrTime  = fmtTime(leg.arrives_at);
  const stayLabel = isStay ? stayDatesLabel(leg) : null;

  return (
    <View style={s.otherRow}>
      <View style={s.otherTypeTag}>
        <Text style={s.otherTypeT}>{typeLabel.toUpperCase()}</Text>
      </View>
      <View style={s.otherBody}>
        <Text style={s.otherName}>{name}</Text>
        {isStay ? (
          stayLabel ? <Text style={s.otherMeta}>{stayLabel}</Text> : null
        ) : (depDate || arrDate) ? (
          <Text style={s.otherMeta}>
            {depDate}{depTime ? ` · ${depTime}` : ""}
            {arrDate && arrDate !== depDate ? `  –  ${arrDate}${arrTime ? ` · ${arrTime}` : ""}` : ""}
          </Text>
        ) : null}
        {leg._mergedCount > 1 ? (
          <Text style={s.otherMeta}>{leg._mergedCount} reservations</Text>
        ) : leg.confirmation ? (
          <Text style={s.otherMeta}>Ref: {leg.confirmation}</Text>
        ) : null}
      </View>
      <View style={s.otherActions}>
        {onEdit && (
          <Pressable style={s.legAction} onPress={() => { tap(); onEdit(leg); }}>
            <Text style={s.legActionT}>Edit</Text>
          </Pressable>
        )}
        {onDelete && (
          <Pressable style={[s.legAction, s.legActionDanger]} onPress={() => { tap(); onDelete(leg); }}>
            <Text style={[s.legActionT, { color: C.coral }]}>Remove</Text>
          </Pressable>
        )}
      </View>
      <StatusPill status="Booked" />
    </View>
  );
}

// ─── Outcome Card ─────────────────────────────────────────────────────────────

function OutcomeCard({ tripId, onSubmitted }) {
  const [rating,     setRating]     = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  const labels = ["", "Rough trip", "Needed more help", "A few hiccups", "Mostly smooth", "Flawless"];

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      await recordTripOutcome(tripId, { rating, disruptions_predicted: null, disruptions_actual: null, value_saved: null, notes: null });
      setSubmitted(true);
      if (onSubmitted) onSubmitted();
    } catch {
      Alert.alert("Error", "Could not save rating. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={s.outcomeCard}>
        <Text style={s.outcomeTitle}>Noted — your predictions just got sharper.</Text>
        <Text style={s.outcomeSub}>I'll weight this trip's outcome when I forecast delays, connections, and rescue timing for your next one.</Text>
      </View>
    );
  }

  return (
    <View style={s.outcomeCard}>
      <Text style={s.outcomeTitle}>How did this trip go?</Text>
      <Text style={s.outcomeSub}>Your rating improves future predictions and rescue decisions.</Text>
      <View style={s.starRow}>
        {[1, 2, 3, 4, 5].map(n => (
          <Pressable key={n} onPress={() => setRating(n)} style={s.starBtn}>
            <Text style={[s.star, rating >= n && { color: C.gold }]}>★</Text>
          </Pressable>
        ))}
      </View>
      {rating && <Text style={s.ratingLabel}>{labels[rating]}</Text>}
      <Pressable
        style={[s.outcomeSubmit, (!rating || submitting) && { opacity: 0.4 }]}
        onPress={handleSubmit}
        disabled={!rating || submitting}
      >
        <Text style={s.outcomeSubmitT}>{submitting ? "Saving…" : "Submit"}</Text>
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TripDetailScreen({ route, navigation }) {
  const initialTrip = route.params?.trip || null;
  const paramTripId = route.params?.tripId || null;

  const [trip,          setTrip]          = useState(initialTrip);
  const [loadingTrip,   setLoadingTrip]   = useState(!initialTrip && !!paramTripId);
  const [refreshing,    setRefreshing]    = useState(false);
  const [riskData,      setRiskData]      = useState(null);
  const [riskLoading,   setRiskLoading]   = useState(false);
  const [outcomeSubmitted, setOutcomeSubmitted] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [destIntel,     setDestIntel]     = useState(null);
  const [companions,    setCompanions]    = useState([]);
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviting,      setInviting]      = useState(false);
  // New feature state
  const [checklist,        setChecklist]        = useState(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [newCheckItem,     setNewCheckItem]     = useState("");
  const [showNights,       setShowNights]       = useState([]);
  const [disruption,       setDisruption]       = useState(null);
  const [disruptionLeg,    setDisruptionLeg]    = useState(null);
  const [disruptionLoading,setDisruptionLoading]= useState(false);
  const [companionsCount,  setCompanionsCount]  = useState(initialTrip?.companions_count || 1);
  const [companionNames,   setCompanionNames]   = useState(initialTrip?.companion_names || []);
  const [showMore,         setShowMore]         = useState(false);
  const [showShareCard,    setShowShareCard]    = useState(false);
  const [showStanding,     setShowStanding]     = useState(false);
  const [isPro,            setIsPro]            = useState(true); // assume yes until known, so we never wrongly gate
  const [upgradeMoment,    setUpgradeMoment]    = useState(null); // key into UPGRADE_MOMENTS
  const [standing,         setStanding]         = useState({ enabled: false, max_price: "", min_cabin: "economy" });
  const [standingSaving,   setStandingSaving]   = useState(false);
  const [quickEdit,        setQuickEdit]        = useState(null); // leg being edited inline
  const [qName,            setQName]            = useState("");
  const [qConf,            setQConf]            = useState("");
  const [qSaving,          setQSaving]          = useState(false);

  // Fetch trip by ID if only ID was passed (deep-link / Concierge path)
  useEffect(() => {
    if (initialTrip || !paramTripId) return;
    setLoadingTrip(true);
    getTrips()
      .then(data => {
        const found = (data?.trips || []).find(t => t.id === Number(paramTripId) || t.id === paramTripId);
        if (found) setTrip(found);
        else navigation.goBack();
      })
      .catch(() => navigation.goBack())
      .finally(() => setLoadingTrip(false));
  }, [paramTripId]);

  // Load risk + intel + companions once trip is available
  useEffect(() => {
    if (!trip?.id) return;
    const flightLegsLocal = (trip.legs || []).filter(l => l.type === "flight");
    if (flightLegsLocal.length >= 2) {
      setRiskLoading(true);
      getTripRisk(trip.id)
        .then(d => setRiskData(d))
        .catch(() => {})
        .finally(() => setRiskLoading(false));
    }
    getDestinationIntel(trip.id)
      .then(d => { if (d?.intel) setDestIntel(d); })
      .catch(e => { if (e.code === "pro_required") setDestIntel({ pro_required: true }); });
    getCompanions(trip.id)
      .then(d => { if (d?.companions) setCompanions(d.companions); })
      .catch(() => {});
    // Load checklist (silent — don't block UI)
    getChecklist(trip.id)
      .then(d => { if (d?.checklist) setChecklist(d.checklist); })
      .catch(() => {});
    // Load show nights
    getShowNights(trip.id)
      .then(d => { if (d?.show_nights?.length) setShowNights(d.show_nights); })
      .catch(() => {});
    // Sync companions count from trip object
    if (trip.companions_count) setCompanionsCount(trip.companions_count);
    if (trip.companion_names)  setCompanionNames(trip.companion_names);
  }, [trip?.id]);

  if (loadingTrip || !trip) {
    return (
      <SafeAreaView style={s.root}>
        <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
          <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: C.card2, marginBottom: 28 }} />
          <View style={{ width: "42%", height: 12, borderRadius: 4, backgroundColor: C.card2, marginBottom: 14 }} />
          <View style={{ width: "72%", height: 30, borderRadius: 6, backgroundColor: C.card2, marginBottom: 10 }} />
          <View style={{ width: "34%", height: 12, borderRadius: 4, backgroundColor: C.card2, marginBottom: 30 }} />
          {[0, 1, 2].map(i => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.card2, marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <View style={{ width: "58%", height: 12, borderRadius: 4, backgroundColor: C.card2, marginBottom: 8 }} />
                <View style={{ width: "38%", height: 10, borderRadius: 4, backgroundColor: C.card }} />
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const legs        = trip.legs || [];
  const displayLegs = consolidateStays(legs);
  const flightLegs  = legs.filter(l => l.type === "flight");
  const otherLegs   = displayLegs.filter(l => l.type !== "flight");
  const firstFlight = flightLegs[0];

  const tripStartDate = trip.trip_start || firstFlight?.departs_at || legs[0]?.departs_at;
  const tripEndDate   = trip.trip_end   || null;
  const depDate       = fmt(tripStartDate);
  const endDate       = fmt(tripEndDate);

  const lastLegEnd = tripEndDate || legs.reduce((latest, l) => {
    const t = l.arrives_at || l.departs_at;
    return t && (!latest || new Date(t) > new Date(latest)) ? t : latest;
  }, null);
  const isCompleted = lastLegEnd
    ? new Date(lastLegEnd).getTime() < Date.now() - 86400000
    : false;

  // Highest connection risk
  const riskLevels = { critical: 4, high: 3, moderate: 2, low: 1 };
  const topRisk = riskData?.risks?.reduce((best, r) =>
    (riskLevels[r.risk_level] || 0) > (riskLevels[best?.risk_level] || 0) ? r : best
  , null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTrip(trip.id);
      if (flightLegs.length >= 2) {
        const d = await getTripRisk(trip.id);
        setRiskData(d);
      }
    } catch (e) {
      Alert.alert("Refresh failed", e.message);
    } finally {
      setRefreshing(false);
    }
  }, [trip.id]);

  const openConcierge = () => {
    const context = `I'm asking about my trip: "${trip.title}"` +
      (depDate ? ` departing ${depDate}` : "") +
      (firstFlight ? `. My first flight is ${firstFlight.carrier || ""}${firstFlight.flight_number || ""} from ${firstFlight.origin || "?"} to ${firstFlight.destination || "?"}` : "") +
      ". What should I know?";
    navigation.navigate("Concierge", { prefill: context });
  };

  const handleShareTrip = async () => {
    try {
      const data = await shareTripLink(trip.id);
      // Build a richer share card message
      const legs = (trip.legs || []).filter(l => l.type === "flight");
      const legStr = legs.length > 0
        ? legs.map(l => l.origin && l.destination ? `${l.origin}→${l.destination}` : null).filter(Boolean).join(" · ")
        : null;
      const valueLine = trip.value_saved > 0
        ? ` Wingman saved me $${trip.value_saved.toLocaleString()} on this trip.`
        : "";
      const shareMsg = [
        `${trip.title}${legStr ? ` (${legStr})` : ""}${valueLine}`,
        `Tracked by Wingman — wingmantravel.app`,
        data.share_url,
      ].filter(Boolean).join("\n");
      await Share.share({ message: shareMsg, url: data.share_url });
    } catch {
      Alert.alert("Share", "Could not generate share link. Try again.");
    }
  };

  const handleInviteCompanion = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteCompanion(trip.id, inviteEmail.trim());
      Alert.alert("Invite sent!", `An invite was sent to ${inviteEmail.trim()}.`);
      setInviteEmail("");
      const d = await getCompanions(trip.id);
      if (d?.companions) setCompanions(d.companions);
    } catch (e) {
      if (e.code === "pro_required") navigation.navigate("Subscription");
      else Alert.alert("Error", e.message);
    } finally {
      setInviting(false);
    }
  };

  // ── New feature handlers ──────────────────────────────────────────────────

  const handleGenerateChecklist = async () => {
    setChecklistLoading(true);
    try {
      const d = await generateChecklist(trip.id);
      if (d?.checklist) setChecklist(d.checklist);
    } catch (e) {
      Alert.alert("Checklist", e.message || "Could not generate checklist.");
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleToggleCheckItem = async (itemId, current) => {
    // Optimistic update
    setChecklist(prev => prev?.map(it => it.id === itemId ? { ...it, completed: !current } : it));
    try {
      await updateChecklistItem(trip.id, itemId, !current);
    } catch {
      // Revert on failure
      setChecklist(prev => prev?.map(it => it.id === itemId ? { ...it, completed: current } : it));
    }
  };

  const handleAddCheckItem = async () => {
    if (!newCheckItem.trim()) return;
    const text = newCheckItem.trim();
    setNewCheckItem("");
    try {
      const d = await addChecklistItem(trip.id, text, "general");
      if (d?.item) setChecklist(prev => [...(prev || []), d.item]);
    } catch {}
  };

  const handleOpenDisruption = async (leg) => {
    setDisruptionLeg(leg);
    setDisruptionLoading(true);
    setDisruption(null);
    try {
      const d = await getDisruptionAlternatives(trip.id, leg.id);
      setDisruption(d);
    } catch (e) {
      Alert.alert("Disruption", e.message || "Could not load disruption data.");
      setDisruptionLeg(null);
    } finally {
      setDisruptionLoading(false);
    }
  };

  const handleSaveCompanions = async (count, names) => {
    setCompanionsCount(count);
    setCompanionNames(names);
    try {
      await updateCompanionsMeta(trip.id, count, names);
    } catch {}
  };

  // Inline quick-edit (UI #4): fix the two things people most often correct —
  // the booking name and the confirmation number — without leaving the screen.
  const handleEditLeg = (leg) => {
    setQuickEdit(leg);
    setQName(leg.carrier || leg.destination || "");
    setQConf(leg.confirmation || "");
  };

  const handleFullEdit = (leg) => {
    setQuickEdit(null);
    navigation.navigate("AddTrip", { editLeg: leg, tripId: trip.id });
  };

  const saveQuickEdit = async () => {
    if (!quickEdit) return;
    setQSaving(true);
    const patch = { carrier: qName.trim(), confirmation: qConf.trim() };
    try {
      await editLeg(trip.id, quickEdit.id, patch);
      setTrip(prev => ({
        ...prev,
        legs: (prev.legs || []).map(l => l.id === quickEdit.id ? { ...l, ...patch } : l),
      }));
      setQuickEdit(null);
    } catch (e) {
      Alert.alert("Couldn't save", e.message || "Please try again.");
    } finally {
      setQSaving(false);
    }
  };

  const handleDeleteLeg = (leg) => {
    Alert.alert(
      "Remove booking",
      `Remove "${leg.carrier || leg.destination || "this booking"}" from your trip?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            try {
              await deleteLeg(trip.id, leg.id);
              setTrip(prev => ({
                ...prev,
                legs: (prev.legs || []).filter(l => l.id !== leg.id),
              }));
            } catch (e) {
              Alert.alert("Error", e.message || "Could not remove booking.");
            }
          },
        },
      ]
    );
  };

  // Subscription tier — drives the well-timed upgrade moments.
  useEffect(() => {
    let on = true;
    getMe()
      .then(me => {
        if (!on) return;
        const tier = (me?.subscription_tier || "free").toLowerCase();
        const status = (me?.subscription_status || "").toLowerCase();
        setIsPro(tier !== "free" && status !== "inactive");
      })
      .catch(() => {}); // on failure, leave isPro=true — never gate a paying user by accident
    return () => { on = false; };
  }, []);

  // ── Action handlers (used by the action bar + "More" sheet) ──
  const handleUpgradeBid = () => {
    if (!firstFlight?.id) return;
    navigation.navigate("UpgradeBid", {
      tripId: trip.id, legId: firstFlight.id,
      flightIdent: firstFlight.flight_number,
      origin: firstFlight.origin, destination: firstFlight.destination,
      carrier: firstFlight.carrier,
    });
  };

  const handleAddToWallet = async () => {
    if (!firstFlight?.id) return;
    const t = await getToken();
    Linking.openURL(`${API_BASE}/wallet/pass/${firstFlight.id}?token=${encodeURIComponent(t || "")}`);
  };

  const handleAddBooking = () => {
    navigation.navigate("AddTrip", { tripId: trip.id, addLegMode: true });
  };

  const openStanding = async () => {
    // Autonomous rebooking is the flagship Pro capability — surface the upgrade
    // exactly here, at the moment the value is concrete.
    if (!isPro) { setUpgradeMoment("standing_orders"); return; }
    setShowStanding(true);
    try {
      const so = await getStandingOrder(trip.id);
      setStanding({
        enabled: !!so.enabled,
        max_price: so.max_price != null ? String(so.max_price) : "",
        min_cabin: so.min_cabin || "economy",
      });
    } catch (_) {}
  };

  const saveStanding = async () => {
    setStandingSaving(true);
    try {
      await setStandingOrder(trip.id, {
        enabled: standing.enabled,
        max_price: standing.max_price ? parseInt(standing.max_price, 10) : null,
        min_cabin: standing.min_cabin,
      });
      setShowStanding(false);
    } catch (e) {
      Alert.alert("Couldn't save", e.message || "Please try again.");
    } finally {
      setStandingSaving(false);
    }
  };

  const handleExportCalendar = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Wingman needs calendar access to add events.");
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      let calId = calendars.find(c => c.title === "Wingman")?.id;
      if (!calId) {
        const defaultCal = await Calendar.getDefaultCalendarAsync();
        calId = await Calendar.createCalendarAsync({
          title: "Wingman",
          color: "#C9A84C",
          entityType: Calendar.EntityTypes.EVENT,
          sourceId: defaultCal?.source?.id,
          source: defaultCal?.source,
          name: "Wingman",
          ownerAccount: "personal",
          accessLevel: Calendar.CalendarAccessLevel.OWNER,
        });
      }
      const legs = trip.legs || [];
      let added = 0;
      for (const leg of legs) {
        const start = leg.dep_time || leg.start_time || leg.date;
        const end = leg.arr_time || leg.end_time || start;
        if (!start) continue;
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime())) continue;
        if (isNaN(endDate.getTime()) || endDate <= startDate) {
          endDate.setTime(startDate.getTime() + 2 * 60 * 60 * 1000);
        }
        const title = leg.type === "flight"
          ? `✈ ${leg.flight_number || "Flight"} ${leg.origin || ""} → ${leg.destination || ""}`
          : leg.type === "hotel"
          ? `🏨 ${leg.hotel_name || leg.title || "Hotel"}`
          : leg.type === "event" || leg.type === "show"
          ? `🎭 ${leg.event_name || leg.title || "Event"}`
          : leg.title || leg.type || "Booking";
        const location = leg.type === "flight"
          ? `${leg.origin || ""} → ${leg.destination || ""}`
          : leg.venue || leg.hotel_name || "";
        await Calendar.createEventAsync(calId, {
          title, startDate, endDate, location,
          notes: `Wingman trip: ${trip.title}`,
          timeZone: leg.timezone || "UTC",
        });
        added++;
      }
      Alert.alert(
        "Added to Calendar",
        added > 0
          ? `${added} event${added !== 1 ? "s" : ""} added to your Wingman calendar.`
          : "No events with dates found to add."
      );
    } catch (e) {
      Alert.alert("Export failed", e.message);
    }
  };

  const handleExportItinerary = async () => {
    try {
      const sorted = [...(trip.legs || [])].sort((a, b) => {
        const ta = a.departs_at || a.arrives_at || '';
        const tb = b.departs_at || b.arrives_at || '';
        return ta < tb ? -1 : ta > tb ? 1 : 0;
      });
      const TYPE_LABEL = { flight: '✈ Flight', hotel: '🏨 Hotel', airbnb: '🏠 Stay', train: '🚄 Train', car: '🚗 Car', ferry: '⛴ Ferry', activity: '🎭 Activity', transfer: '🚖 Transfer', cruise: '🚢 Cruise' };
      const lines = [`${trip.title}`, ``, `ITINERARY`, `${'─'.repeat(40)}`];
      let lastDate = null;
      for (const leg of sorted) {
        const d = fmt(leg.departs_at || leg.arrives_at);
        if (d && d !== lastDate) { lines.push(``); lines.push(d.toUpperCase()); lastDate = d; }
        const typeLabel = TYPE_LABEL[leg.type] || leg.type?.toUpperCase() || 'BOOKING';
        const name = leg.type === 'flight'
          ? `${leg.carrier || ''}${leg.flight_number || ''} · ${leg.origin || '?'} → ${leg.destination || '?'}`
          : leg.carrier || leg.destination || '';
        const time = fmtTime(leg.departs_at);
        const endTime = fmtTime(leg.arrives_at);
        const timeStr = time ? ` · ${time}${endTime && endTime !== time ? ` – ${endTime}` : ''}` : '';
        const conf = leg.confirmation ? ` (Ref: ${leg.confirmation})` : '';
        lines.push(`  ${typeLabel}: ${name}${timeStr}${conf}`);
      }
      lines.push(``);
      lines.push(`Tracked by Wingman — wingmantravel.app`);
      await Share.share({ message: lines.join('\n') });
    } catch (e) {
      Alert.alert('Export failed', e.message);
    }
  };

  // ── Build prose briefing for the header
  const dest = firstFlight?.destination || trip.destination_city || null;
  const daysAway = tripStartDate
    ? Math.ceil((new Date(tripStartDate).getTime() - Date.now()) / 86400000)
    : null;
  let briefingProse = null;
  if (isCompleted) {
    briefingProse = `This trip is complete. Rate it below to help Wingman improve future predictions.`;
  } else if (daysAway != null && daysAway <= 0) {
    briefingProse = `This trip is underway. I'm monitoring every leg in real time.`;
  } else if (daysAway != null && daysAway === 1) {
    briefingProse = `You depart tomorrow. I'm watching the forecast and will alert you to any changes overnight.`;
  } else if (daysAway != null && daysAway <= 7) {
    briefingProse = `You depart in ${daysAway} days. I'm tracking disruption risk and will brief you the morning of departure.`;
  } else if (daysAway != null) {
    briefingProse = `You depart in ${daysAway} days. I'll send you a full briefing 24 hours before departure.`;
  }

  if (topRisk && (topRisk.risk_level === "critical" || topRisk.risk_level === "high")) {
    briefingProse = `${briefingProse || ""} There's a ${topRisk.risk_level} connection risk on this itinerary — I'm watching it.`.trim();
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Back bar ── */}
        <Pressable style={s.backBar} onPress={() => navigation.goBack()}>
          <Text style={s.backArrow}>‹</Text>
          <Text style={s.backLabel}>Trips</Text>
        </Pressable>

        {/* ── Destination photo wash (Design #9) — city from destination_city, else a
             trip title that looks like a place (skip routes / import junk) ── */}
        {(() => {
          const titleCity = trip.title && !/[→>]|imported|reservation|confirmation|\bunknown\b/i.test(trip.title) && trip.title.length <= 28 ? trip.title : null;
          const imageCity = trip.destination_city || titleCity;
          return imageCity ? (
            <DestinationImage city={imageCity} height={150} style={{ borderRadius: 14, marginHorizontal: 24, marginBottom: 6 }} />
          ) : null;
        })()}

        {/* ── Editorial header ── */}
        <FadeRise style={s.header}>
          {/* Edition line */}
          <View style={s.editionLine}>
            {depDate && <Text style={s.editionDate}>{depDate}{endDate && endDate !== depDate ? `  –  ${endDate}` : ""}</Text>}
            <View style={s.editionPills}>
              {isCompleted ? (
                <View style={[s.pill, s.pillMut]}><Text style={[s.pillT, { color: C.mut }]}>COMPLETED</Text></View>
              ) : (
                <View style={[s.pill, s.pillTeal]}>
                  <View style={s.pillDot} />
                  <Text style={[s.pillT, { color: C.teal }]}>LIVE</Text>
                </View>
              )}
              {topRisk && topRisk.risk_level !== "low" && (
                <View style={[s.pill, {
                  backgroundColor: topRisk.risk_level === "critical" ? "rgba(217,95,95,0.08)" : "rgba(212,144,42,0.08)",
                  borderColor:     topRisk.risk_level === "critical" ? "rgba(217,95,95,0.2)"  : "rgba(212,144,42,0.2)",
                }]}>
                  <Text style={[s.pillT, { color: topRisk.risk_level === "critical" ? C.coral : C.amber }]}>
                    {topRisk.risk_level.toUpperCase()} CONNECTION
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Headline */}
          <Text style={s.hed}>{trip.title}</Text>

          {/* Prose briefing */}
          {briefingProse && <Text style={s.prose}>{briefingProse}</Text>}
        </FadeRise>

        <View style={s.rule} />

        {/* ── Day-by-day itinerary timeline ── */}
        {legs.length > 0 && (() => {
          // Sort all legs chronologically (stays consolidated into one block)
          const sorted = [...displayLegs].sort((a, b) => {
            const ta = a.departs_at || a.arrives_at || '';
            const tb = b.departs_at || b.arrives_at || '';
            return ta < tb ? -1 : ta > tb ? 1 : 0;
          });
          // Group by date
          const groups = {};
          for (const leg of sorted) {
            const d = fmt(leg.departs_at || leg.arrives_at) || 'TBD';
            if (!groups[d]) groups[d] = [];
            groups[d].push(leg);
          }
          const TYPE_ICON = { flight: 'airplane-outline', hotel: 'bed-outline', airbnb: 'home-outline', train: 'train-outline', car: 'car-outline', ferry: 'boat-outline', activity: 'ticket-outline', transfer: 'car-outline', cruise: 'boat-outline', dining: 'restaurant-outline', restaurant: 'restaurant-outline', other: 'bookmark-outline' };
          return (
            <>
              <Text style={s.sectionLabel}>ITINERARY</Text>
              {Object.entries(groups).map(([date, dayLegs], gi) => (
                <View key={gi} style={s.dayGroup}>
                  <Text style={s.dayLabel}>{date}</Text>
                  {dayLegs.map((leg, li) => {
                    const icon = TYPE_ICON[leg.type] || 'bookmark-outline';
                    const isStay = leg.type === 'hotel' || leg.type === 'airbnb';
                    const name = leg.type === 'flight'
                      ? `${leg.carrier || ''}${leg.flight_number || ''} · ${leg.origin || '?'} → ${leg.destination || '?'}`
                      : leg.carrier || leg.destination || leg.type;
                    const time = fmtTime(leg.departs_at);
                    const endTime = fmtTime(leg.arrives_at);
                    const conf = leg.confirmation;
                    return (
                      <View key={li} style={[s.timelineRow, li < dayLegs.length - 1 && s.timelineRowBorder]}>
                        <Ionicons name={icon} size={16} color={C.gold} style={{ width: 22, textAlign: 'center', marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.timelineName}>{name}</Text>
                          {isStay ? (
                            stayDatesLabel(leg) ? <Text style={s.timelineMeta}>{stayDatesLabel(leg)}</Text> : null
                          ) : (time || endTime) ? (
                            <Text style={s.timelineMeta}>
                              {time}{endTime && endTime !== time ? ` – ${endTime}` : ''}
                            </Text>
                          ) : null}
                          {leg._mergedCount > 1
                            ? <Text style={s.timelineMeta}>{leg._mergedCount} reservations</Text>
                            : conf ? <Text style={s.timelineMeta}>Ref: {conf}</Text> : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </>
          );
        })()}

        {/* ── Flights ── */}
        {flightLegs.length > 0 && (
          <>
            <Text style={s.sectionLabel}>FLIGHTS</Text>
            {riskLoading && (
              <View style={s.riskLoading}>
                <ActivityIndicator size="small" color={C.gold} />
                <Text style={s.riskLoadingT}>Scoring connection risks…</Text>
              </View>
            )}
            {!riskLoading && riskData?.risks?.length > 0 && riskData.risks.map((r, i) => (
              <View key={i} style={[s.connRiskRow, {
                borderColor: r.risk_level === "critical" ? "rgba(217,95,95,0.2)" : "rgba(212,144,42,0.2)",
              }]}>
                <Text style={[s.connRiskLabel, { color: r.risk_level === "critical" ? C.coral : C.amber }]}>
                  {r.risk_level.toUpperCase()} CONNECTION · {r.connection_minutes}min · {r.risk_score}%
                </Text>
                <Text style={s.connRiskRec}>{r.recommendation}</Text>
              </View>
            ))}
            {flightLegs.map((leg, i) => (
              <FlightLegRow
                key={i}
                leg={leg}
                isCompleted={isCompleted}
                tripId={trip.id}
                navigation={navigation}
                onEdit={handleEditLeg}
                onDelete={handleDeleteLeg}
              />
            ))}
          </>
        )}

        {/* ── Other legs — collapsed by default so the itinerary above stays the hero ── */}
        {otherLegs.length > 0 && (
          <>
            <Pressable style={s.manageToggle} onPress={() => { tap(); setShowBookings(v => !v); }}>
              <Text style={s.sectionLabel}>MANAGE BOOKINGS ({otherLegs.length})</Text>
              <Text style={s.manageArrow}>{showBookings ? "▲" : "▼"}</Text>
            </Pressable>
            {showBookings && otherLegs.map((leg, i) => (
              <OtherLegRow
                key={i}
                leg={leg}
                onEdit={handleEditLeg}
                onDelete={handleDeleteLeg}
              />
            ))}
          </>
        )}

        {legs.length === 0 && (
          <View style={s.emptyLegs}>
            <Text style={s.emptyLegsT}>No bookings yet.</Text>
          </View>
        )}

        {/* ── Show nights ── */}
        {showNights.length > 0 && (
          <>
            <Text style={s.sectionLabel}>SHOW NIGHTS</Text>
            <View style={s.intelBlock}>
              {showNights.map((sn, i) => {
                const snDate = fmt(sn.departs_at || sn.date);
                const snTime = fmtTime(sn.departs_at || sn.date);
                const isToday = snDate === fmt(new Date().toISOString());
                return (
                  <View key={i} style={[s.intelRow, i < showNights.length - 1 && s.intelRowBorder]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={s.intelLabel}>{snDate}{snTime ? ` · ${snTime}` : ""}</Text>
                      {isToday && (
                        <View style={[s.pill, s.pillTeal]}>
                          <View style={s.pillDot} />
                          <Text style={[s.pillT, { color: C.teal }]}>TONIGHT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.intelText}>{sn.carrier || sn.title || "Show"}</Text>
                    {sn.venue && <Text style={[s.intelText, { color: C.mut, fontSize: 12, marginTop: 2 }]}>{sn.venue}</Text>}
                    {sn.travel_time_mins && (
                      <Text style={[s.intelText, { color: C.gold, fontSize: 12, marginTop: 4 }]}>
                        Allow {sn.travel_time_mins} min from hotel · depart by {sn.recommended_depart_time || "TBC"}
                      </Text>
                    )}
                    {sn.tip && <Text style={[s.intelText, { color: C.mut, fontSize: 12, marginTop: 4, fontStyle: "italic" }]}>{sn.tip}</Text>}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Disruption impact panel ── */}
        {disruptionLoading && (
          <View style={s.riskLoading}>
            <ActivityIndicator size="small" color={C.gold} />
            <Text style={s.riskLoadingT}>Calculating cascade impact…</Text>
          </View>
        )}
        {disruption && disruptionLeg && (
          <>
            <Text style={s.sectionLabel}>DISRUPTION IMPACT</Text>
            <View style={[s.connRiskRow, { borderColor: "rgba(217,95,95,0.2)", marginBottom: 4 }]}>
              <Text style={[s.connRiskLabel, { color: C.coral }]}>
                {disruptionLeg.carrier}{disruptionLeg.flight_number} AFFECTED
              </Text>
              <Text style={s.connRiskRec}>
                {disruption.cascade_actions?.length || 0} downstream booking{disruption.cascade_actions?.length !== 1 ? "s" : ""} may need attention.
              </Text>
            </View>
            {(disruption.cascade_actions || []).map((action, i) => {
              const isEvent = action.type === "event_at_risk";
              const isConn  = action.type === "connection_at_risk";
              const color   = isEvent || isConn ? C.coral : C.amber;
              return (
                <View key={i} style={[s.connRiskRow, { borderColor: isEvent || isConn ? "rgba(217,95,95,0.2)" : "rgba(212,144,42,0.2)", marginBottom: 4 }]}>
                  <Text style={[s.connRiskLabel, { color }]}>{(action.type || "").replace(/_/g, " ").toUpperCase()}</Text>
                  <Text style={s.connRiskRec}>{action.message || action.description}</Text>
                  {action.cta && (
                    <Pressable
                      style={[s.intelCta, { paddingHorizontal: 0, paddingVertical: 8, borderTopWidth: 0, marginTop: 6 }]}
                      onPress={() => { tap(); navigation.navigate("Disruption", { tripId: trip.id, legId: disruptionLeg.id, leg: disruptionLeg }); }}
                    >
                      <Text style={s.intelCtaT}>{action.cta}  ›</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
            <Pressable
              style={[s.intelCta, { paddingHorizontal: 24, paddingVertical: 12, borderTopWidth: 0 }]}
              onPress={() => { tap(); navigation.navigate("Disruption", { tripId: trip.id, legId: disruptionLeg.id, leg: disruptionLeg }); }}
            >
              <Text style={s.intelCtaT}>See all alternatives  ›</Text>
            </Pressable>
          </>
        )}

        {/* ── Pre-trip checklist — pointless once the trip is over, so hide it
             (unless items already exist, which are worth keeping visible). ── */}
        {(!isCompleted || (checklist && checklist.length > 0)) && (
        <>
          <Text style={s.sectionLabel}>PRE-TRIP CHECKLIST</Text>
          <View style={s.intelBlock}>
            {!checklist && !checklistLoading && (
              <Pressable
                style={s.intelCta}
                onPress={() => { tap(); handleGenerateChecklist(); }}
              >
                <Text style={s.intelCtaT}>Generate personalised checklist  ›</Text>
              </Pressable>
            )}
            {checklistLoading && (
              <View style={[s.riskLoading, { paddingHorizontal: 18, paddingVertical: 14 }]}>
                <ActivityIndicator size="small" color={C.gold} />
                <Text style={s.riskLoadingT}>Building your checklist…</Text>
              </View>
            )}
            {checklist && checklist.length > 0 && (
              <>
                {checklist.map((item, i) => (
                  <Pressable
                    key={item.id || i}
                    style={[s.intelRow, i < checklist.length - 1 && s.intelRowBorder, { flexDirection: "row", alignItems: "flex-start", gap: 12 }]}
                    onPress={() => { tap(); handleToggleCheckItem(item.id, item.completed); }}
                  >
                    <View style={[s.checkBox, item.completed && s.checkBoxDone]}>
                      {item.completed && <Text style={s.checkMark}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      {item.category && <Text style={s.intelLabel}>{item.category.toUpperCase()}</Text>}
                      <Text style={[s.intelText, item.completed && { opacity: 0.4, textDecorationLine: "line-through" }]}>{item.item}</Text>
                      {item.due_date && <Text style={[s.intelText, { color: C.gold, fontSize: 11, marginTop: 2 }]}>Due {fmt(item.due_date)}</Text>}
                    </View>
                  </Pressable>
                ))}
                <View style={[s.companionInputRow, { borderTopWidth: 1, borderTopColor: C.line }]}>
                  <TextInput
                    style={s.companionInput}
                    value={newCheckItem}
                    onChangeText={setNewCheckItem}
                    placeholder="Add item…"
                    placeholderTextColor={C.mut}
                    returnKeyType="done"
                    onSubmitEditing={handleAddCheckItem}
                  />
                  <Pressable
                    style={[s.inviteBtn, !newCheckItem.trim() && { opacity: 0.4 }]}
                    onPress={handleAddCheckItem}
                    disabled={!newCheckItem.trim()}
                  >
                    <Text style={s.inviteBtnT}>Add</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </>
        )}

        {/* ── Confident action bar + "More" sheet ── */}
        {(() => {
          const hasFlight = !!firstFlight?.id;
          const canDisrupt = hasFlight && !isCompleted;
          // Primary bar: the chief-of-staff CTA + the single most relevant next action.
          const primary = [
            { key: "ask", label: "Ask Wingman", icon: "chatbubbles-outline", onPress: openConcierge, hero: true },
            canDisrupt
              ? { key: "disrupt", label: "Disruptions", icon: "alert-circle-outline", onPress: () => handleOpenDisruption(firstFlight) }
              : { key: "add", label: "Add booking", icon: "add-circle-outline", onPress: handleAddBooking },
            { key: "share", label: "Share", icon: "share-outline", onPress: () => setShowShareCard(true) },
          ];
          // Everything else lives in the More sheet.
          const more = [
            canDisrupt && { key: "upgrade", label: "Upgrade bid", sub: "Bid for a cabin upgrade", icon: "trending-up-outline", onPress: handleUpgradeBid },
            hasFlight && { key: "wallet", label: "Add boarding pass to Wallet", sub: "Apple Wallet", icon: "wallet-outline", onPress: handleAddToWallet },
            canDisrupt && { key: "standing", label: "Standing orders", sub: "Pre-authorize auto-rebooking for this trip", icon: "shield-checkmark-outline", onPress: openStanding },
            canDisrupt && { key: "add2", label: "Add booking", sub: "Hotel, car, activity…", icon: "add-circle-outline", onPress: handleAddBooking },
            { key: "expenses", label: "Trip expenses", sub: "Categorized report — export as a receipt", icon: "receipt-outline", onPress: () => navigation.navigate("Expenses", { trip }) },
            { key: "cal", label: "Export to Calendar", sub: "Add every leg to your calendar", icon: "calendar-outline", onPress: handleExportCalendar },
            { key: "itin", label: "Export itinerary", sub: "Share a plain-text summary", icon: "document-text-outline", onPress: handleExportItinerary },
          ].filter(Boolean);
          return (
            <>
              <View style={s.actionBar}>
                {primary.map(a => (
                  <Pressable
                    key={a.key}
                    style={[s.actionTile, a.hero && s.actionTileHero]}
                    onPress={() => { tap(); a.onPress(); }}
                    accessibilityRole="button"
                    accessibilityLabel={a.label}
                  >
                    <Ionicons name={a.icon} size={19} color={a.hero ? C.inkD : C.gold} />
                    {/* "Ask Wingman" is the longest label and was truncating to
                        "Ask Wingm…" — which reads like a bug in a product whose
                        whole promise is composure. Shrink to fit rather than clip;
                        minimumFontScale keeps it legible. */}
                    <Text
                      style={[s.actionTileT, a.hero && s.actionTileTHero]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
                {more.length > 0 && (
                  <Pressable style={s.actionTile} onPress={() => { tap(); setShowMore(true); }}>
                    <Ionicons name="ellipsis-horizontal" size={19} color={C.gold} />
                    <Text style={s.actionTileT}>More</Text>
                  </Pressable>
                )}
              </View>

              <Modal
                visible={showMore}
                transparent
                animationType="slide"
                onRequestClose={() => setShowMore(false)}
              >
                <Pressable style={s.sheetScrim} onPress={() => setShowMore(false)}>
                  <Pressable style={s.sheet} onPress={() => {}}>
                    <View style={s.sheetGrip} />
                    <Text style={s.sheetTitle}>More actions</Text>
                    {more.map((a, i) => (
                      <Pressable
                        key={a.key}
                        style={[s.sheetRow, i < more.length - 1 && s.sheetRowBorder]}
                        onPress={() => { tap(); setShowMore(false); a.onPress(); }}
                      >
                        <Ionicons name={a.icon} size={20} color={C.gold} style={{ width: 28 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.sheetRowLabel}>{a.label}</Text>
                          {a.sub ? <Text style={s.sheetRowSub}>{a.sub}</Text> : null}
                        </View>
                        <Text style={s.actionRowArrow}>›</Text>
                      </Pressable>
                    ))}
                    <Pressable style={s.sheetCancel} onPress={() => { tap(); setShowMore(false); }}>
                      <Text style={s.sheetCancelT}>Close</Text>
                    </Pressable>
                  </Pressable>
                </Pressable>
              </Modal>
            </>
          );
        })()}

        {/* ── Inline quick-edit sheet (UI #4) ── */}
        <Modal
          visible={!!quickEdit}
          transparent
          animationType="slide"
          onRequestClose={() => setQuickEdit(null)}
        >
          <Pressable style={s.sheetScrim} onPress={() => !qSaving && setQuickEdit(null)}>
            <Pressable style={s.sheet} onPress={() => {}}>
              <View style={s.sheetGrip} />
              <Text style={s.sheetTitle}>Quick edit</Text>
              <Text style={s.qEditField}>NAME</Text>
              <TextInput
                style={s.qEditInput}
                value={qName}
                onChangeText={setQName}
                placeholder="Booking name"
                placeholderTextColor={C.mut}
                autoCapitalize="words"
              />
              <Text style={s.qEditField}>CONFIRMATION #</Text>
              <TextInput
                style={s.qEditInput}
                value={qConf}
                onChangeText={setQConf}
                placeholder="e.g. AB12CD"
                placeholderTextColor={C.mut}
                autoCapitalize="characters"
              />
              <Pressable
                style={[s.qEditSave, qSaving && { opacity: 0.6 }]}
                onPress={saveQuickEdit}
                disabled={qSaving}
              >
                {qSaving
                  ? <ActivityIndicator color={C.inkD} />
                  : <Text style={s.qEditSaveT}>Save</Text>}
              </Pressable>
              <Pressable
                style={s.sheetRow}
                onPress={() => quickEdit && handleFullEdit(quickEdit)}
              >
                <Ionicons name="create-outline" size={20} color={C.gold} style={{ width: 28 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetRowLabel}>Edit all details</Text>
                  <Text style={s.sheetRowSub}>Dates, times, route, and more</Text>
                </View>
                <Text style={s.actionRowArrow}>›</Text>
              </Pressable>
              <Pressable style={s.sheetCancel} onPress={() => setQuickEdit(null)}>
                <Text style={s.sheetCancelT}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ── Well-timed upgrade moment (Roadmap 2, UI #10) ── */}
        <UpgradeSheet
          visible={!!upgradeMoment}
          moment={upgradeMoment || "standing_orders"}
          onClose={() => setUpgradeMoment(null)}
          onUpgrade={() => { setUpgradeMoment(null); navigation.navigate("Subscription"); }}
        />

        {/* ── Standing orders sheet (Roadmap 2) ── */}
        <Modal
          visible={showStanding}
          transparent
          animationType="slide"
          onRequestClose={() => setShowStanding(false)}
        >
          <Pressable style={s.sheetScrim} onPress={() => !standingSaving && setShowStanding(false)}>
            <Pressable style={s.sheet} onPress={() => {}}>
              <View style={s.sheetGrip} />
              <Text style={s.sheetTitle}>Standing orders</Text>
              <Text style={s.qEditField}>Pre-authorize Wingman to rebook this trip automatically if a flight is cancelled or badly delayed — within the limits you set. You stay in control; I only act inside these rules.</Text>

              <Pressable
                style={[s.sheetRow, s.sheetRowBorder]}
                onPress={() => setStanding(v => ({ ...v, enabled: !v.enabled }))}
              >
                <Ionicons name={standing.enabled ? "checkmark-circle" : "ellipse-outline"} size={22} color={standing.enabled ? C.teal : C.mut} style={{ width: 28 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetRowLabel}>Auto-rebook this trip</Text>
                  <Text style={s.sheetRowSub}>{standing.enabled ? "On — I'll act within your limits" : "Off — I'll ask first"}</Text>
                </View>
              </Pressable>

              {standing.enabled ? (
                <>
                  <Text style={s.qEditField}>MAX PRICE WITHOUT ASKING</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontFamily: T.serifB, fontSize: 18, color: C.gold }}>$</Text>
                    <TextInput
                      style={[s.qEditInput, { flex: 1 }]}
                      value={standing.max_price}
                      onChangeText={t => setStanding(v => ({ ...v, max_price: t.replace(/[^0-9]/g, "") }))}
                      placeholder="650"
                      placeholderTextColor={C.mut}
                      keyboardType="number-pad"
                    />
                  </View>

                  <Text style={s.qEditField}>MINIMUM CABIN</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[["economy", "Economy"], ["premium_economy", "Premium"], ["business", "Business"], ["first", "First"]].map(([id, label]) => (
                      <Pressable
                        key={id}
                        style={[s.cabinPill, standing.min_cabin === id && s.cabinPillOn]}
                        onPress={() => setStanding(v => ({ ...v, min_cabin: id }))}
                      >
                        <Text style={[s.cabinPillT, standing.min_cabin === id && s.cabinPillTOn]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              <Pressable style={[s.qEditSave, standingSaving && { opacity: 0.6 }]} onPress={saveStanding} disabled={standingSaving}>
                {standingSaving ? <ActivityIndicator color={C.inkD} /> : <Text style={s.qEditSaveT}>Save</Text>}
              </Pressable>
              <Pressable style={s.sheetCancel} onPress={() => setShowStanding(false)}>
                <Text style={s.sheetCancelT}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ── Destination intel ── */}
        {destIntel?.pro_required && (
          <Pressable style={s.proCard} onPress={() => { tap(); navigation.navigate("Subscription"); }}>
            <Text style={s.proTitle}>Destination Intel — Pro</Text>
            <Text style={s.proSub}>AI-curated local tips, restaurant picks, and neighbourhood guides for every destination.</Text>
            <Text style={s.proCta}>Upgrade to Pro →</Text>
          </Pressable>
        )}

        {destIntel?.intel && (
          <>
            <Text style={s.sectionLabel}>DESTINATION INTEL · {destIntel.destination}</Text>
            <View style={s.intelBlock}>
              {[
                { key: "restaurant",   label: "WHERE TO EAT" },
                { key: "neighbourhood",label: "NEIGHBOURHOOD" },
                { key: "hotel_tip",    label: "HOTEL TIP" },
                { key: "local_tip",    label: "LOCAL TIP" },
              ].filter(({ key }) => destIntel.intel[key]).map(({ key, label }, i, arr) => (
                <View key={key} style={[s.intelRow, i < arr.length - 1 && s.intelRowBorder]}>
                  <Text style={s.intelLabel}>{label}</Text>
                  <Text style={s.intelText}>{destIntel.intel[key]}</Text>
                </View>
              ))}
              <Pressable
                style={s.intelCta}
                onPress={() => { tap(); navigation.navigate("Destination", {
                  city: destIntel.destination, trip_id: trip.id, tripTitle: trip.title,
                }); }}
              >
                <Text style={s.intelCtaT}>Explore {destIntel.destination}  ›</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* ── Travel companions ── */}
        <Text style={s.sectionLabel}>TRAVEL COMPANIONS</Text>
        <View style={s.companionBlock}>
          {/* Companions count quick-set */}
          <View style={[s.companionRow, { justifyContent: "space-between" }]}>
            <Text style={[s.companionEmail, { fontSize: 13, color: C.mut }]}>
              Travelling with {companionsCount === 1 ? "no one else" : `${companionsCount - 1} other${companionsCount > 2 ? "s" : ""}`} · {companionsCount} room{companionsCount > 1 ? "s" : ""}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                style={[s.inviteBtn, { paddingHorizontal: 12, paddingVertical: 6 }, companionsCount <= 1 && { opacity: 0.3 }]}
                onPress={() => { if (companionsCount > 1) { tap(); handleSaveCompanions(companionsCount - 1, companionNames); } }}
                disabled={companionsCount <= 1}
              >
                <Text style={s.inviteBtnT}>−</Text>
              </Pressable>
              <Pressable
                style={[s.inviteBtn, { paddingHorizontal: 12, paddingVertical: 6 }]}
                onPress={() => { tap(); handleSaveCompanions(companionsCount + 1, companionNames); }}
              >
                <Text style={s.inviteBtnT}>+</Text>
              </Pressable>
            </View>
          </View>
          <View style={s.actionDivider} />
          {companions.length > 0 && companions.map((c, i) => (
            <View key={i} style={[s.companionRow, i > 0 && s.companionRowBorder]}>
              <View style={s.companionAvatar}>
                <Text style={s.companionAvatarT}>{(c.invitee_email || "?")[0].toUpperCase()}</Text>
              </View>
              <Text style={s.companionEmail}>{c.invitee_email}</Text>
              <Text style={[s.companionStatus, { color: c.accepted_at ? C.teal : C.mut }]}>
                {c.accepted_at ? "Joined" : "Pending"}
              </Text>
            </View>
          ))}
          <View style={s.companionInputRow}>
            <TextInput
              style={s.companionInput}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="Invite by email…"
              placeholderTextColor={C.mut}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={handleInviteCompanion}
            />
            <Pressable
              style={[s.inviteBtn, (!inviteEmail.trim() || inviting) && { opacity: 0.4 }]}
              onPress={handleInviteCompanion}
              disabled={!inviteEmail.trim() || inviting}
            >
              <Text style={s.inviteBtnT}>{inviting ? "…" : "Invite"}</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Post-trip outcome ── */}
        {isCompleted && !outcomeSubmitted && (
          <>
            <Text style={s.sectionLabel}>TRIP OUTCOME</Text>
            <OutcomeCard tripId={trip.id} onSubmitted={() => setOutcomeSubmitted(true)} />
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <ShareCardModal
        visible={showShareCard}
        onClose={() => setShowShareCard(false)}
        variant="trip"
        data={{
          title: trip.title,
          route: firstFlight
            ? `${firstFlight.origin || ""} → ${firstFlight.destination || ""}`.trim()
            : (trip.destination_city || ""),
          dates: tripStartDate
            ? new Date(tripStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "Tracked by Wingman",
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 16 },

  // ── Back bar ──
  backBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 4,
  },
  backArrow: {
    fontFamily: T.sans,
    fontSize: 22,
    color: C.gold,
    lineHeight: 26,
  },
  backLabel: {
    fontFamily: T.sansM,
    fontSize: 13,
    color: C.gold,
    letterSpacing: 0.3,
  },

  // ── Header ──
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  editionLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  editionDate: {
    fontFamily: T.sansM,
    fontSize: 10,
    letterSpacing: 2,
    color: C.mut,
    textTransform: "uppercase",
    opacity: 0.7,
  },
  editionPills: {
    flexDirection: "row",
    gap: 6,
  },
  hed: {
    fontFamily: T.garamondSI,
    fontSize: 34,
    color: C.ink,
    letterSpacing: -0.3,
    lineHeight: 40,
    marginBottom: 10,
  },
  prose: {
    fontFamily: T.garamondI,
    fontSize: 16,
    color: C.ink,
    lineHeight: 26,
    opacity: 0.78,
  },

  // ── Rule ──
  rule: {
    height: 1,
    marginHorizontal: 24,
    backgroundColor: C.line,
    opacity: 0.5,
    marginBottom: 4,
  },

  // ── Section label ──
  sectionLabel: {
    fontFamily: T.sansM,
    fontSize: 9,
    letterSpacing: 2.5,
    color: C.mut,
    textTransform: "uppercase",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 6,
    opacity: 0.7,
  },
  manageToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 24,
  },
  manageArrow: { color: C.mut, fontSize: 11, opacity: 0.7 },

  // ── Itinerary timeline ──
  dayGroup: {
    marginHorizontal: 24,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dayLabel: {
    fontFamily: T.sansM,
    fontSize: 9,
    letterSpacing: 2,
    color: C.gold,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  timelineRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  timelineIcon: {
    fontSize: 16,
    lineHeight: 22,
    width: 22,
    textAlign: 'center',
  },
  timelineName: {
    fontFamily: T.sans,
    fontSize: 13,
    color: C.ink,
    lineHeight: 18,
  },
  timelineMeta: {
    fontFamily: T.sans,
    fontSize: 11,
    color: C.mut,
    marginTop: 2,
  },

  // ── Status pills ──
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillT: {
    fontFamily: T.sansB,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  pillMut:  { backgroundColor: "rgba(138,127,112,0.07)", borderColor: "rgba(138,127,112,0.18)" },
  pillTeal: { backgroundColor: "rgba(45,184,150,0.08)",  borderColor: "rgba(45,184,150,0.2)" },
  pillDot:  { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.teal },

  // ── Risk loading ──
  riskLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  riskLoadingT: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
  },

  // ── Connection risk row ──
  connRiskRow: {
    marginHorizontal: 24,
    marginBottom: 10,
    padding: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderRadius: 10,
  },
  connRiskLabel: {
    fontFamily: T.sansB,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  connRiskRec: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
    lineHeight: 18,
  },

  // ── Flight leg block ──
  legBlock: {
    marginHorizontal: 24,
    marginBottom: 12,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  legRouteRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  legAirport: {
    flex: 1,
    alignItems: "flex-start",
  },
  legCode: {
    fontFamily: T.garamondSI,
    fontSize: 28,
    color: C.ink,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  legTime: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
    marginTop: 2,
  },
  legArrowWrap: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  legArrow: {
    fontFamily: T.sans,
    fontSize: 16,
    color: C.mut,
  },
  legIdent: {
    fontFamily: T.sansM,
    fontSize: 10,
    color: C.gold,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  legMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  legMeta: {
    fontFamily: T.sans,
    fontSize: 11,
    color: C.mut,
  },
  legActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  legAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
  },
  legActionT: {
    fontFamily: T.sansM,
    fontSize: 11,
    color: C.mut,
  },
  legActionDanger: {
    borderColor: "rgba(217,95,95,0.25)",
    backgroundColor: "rgba(217,95,95,0.04)",
  },
  otherActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  // ── Other leg row ──
  otherRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    gap: 12,
  },
  otherTypeTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "rgba(201,169,110,0.07)",
    borderWidth: 1,
    borderColor: "rgba(201,169,110,0.18)",
    borderRadius: 6,
    marginTop: 2,
  },
  otherTypeT: {
    fontFamily: T.sansB,
    fontSize: 8,
    letterSpacing: 1.2,
    color: C.gold,
  },
  otherBody: {
    flex: 1,
    gap: 3,
  },
  otherName: {
    fontFamily: T.sansM,
    fontSize: 14,
    color: C.ink,
  },
  otherMeta: {
    fontFamily: T.sans,
    fontSize: 11,
    color: C.mut,
  },

  // ── Three action rows ──
  actionsBlock: {
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  actionRowLabel: {
    fontFamily: T.sansM,
    fontSize: 14,
    color: C.ink,
  },
  actionRowArrow: {
    fontFamily: T.sans,
    fontSize: 18,
    color: C.mut,
    opacity: 0.5,
  },
  actionDivider: {
    height: 1,
    marginHorizontal: 18,
    backgroundColor: C.line,
    opacity: 0.5,
  },

  // ── Confident action bar (UI #10) ──
  actionBar: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 24,
    marginTop: 20,
  },
  actionTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 4,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    ...litEdge,
    ...SHADOW.soft,
  },
  actionTileHero: {
    backgroundColor: C.gold,
    borderColor: C.gold,
  },
  actionTileT: {
    fontFamily: T.sansM,
    fontSize: 11,
    color: C.mut,
    letterSpacing: 0.2,
  },
  actionTileTHero: {
    color: C.inkD,
    fontFamily: T.sansB,
  },
  // ── "More" bottom sheet ──
  sheetScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    ...SHADOW.sheet,
  },
  sheetGrip: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: T.sansM,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: C.mut,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 15,
  },
  sheetRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  sheetRowLabel: {
    fontFamily: T.sansM,
    fontSize: 15,
    color: C.ink,
  },
  sheetRowSub: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
    marginTop: 2,
  },
  sheetCancel: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  sheetCancelT: {
    fontFamily: T.sansM,
    fontSize: 14,
    color: C.ink,
  },
  // ── Inline quick-edit fields ──
  qEditField: {
    fontFamily: T.sansM,
    fontSize: 10,
    letterSpacing: 1.2,
    color: C.mut,
    marginTop: 14,
    marginBottom: 6,
  },
  qEditInput: {
    fontFamily: T.sans,
    fontSize: 16,
    color: C.ink,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  qEditSave: {
    marginTop: 18,
    marginBottom: 6,
    paddingVertical: 15,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: C.gold,
  },
  qEditSaveT: {
    fontFamily: T.sansB,
    fontSize: 15,
    color: C.inkD,
  },
  cabinPill: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
  },
  cabinPillOn: { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.08)" },
  cabinPillT: { fontFamily: T.sansM, fontSize: 11, color: C.mut },
  cabinPillTOn: { color: C.gold },

  // ── Pro upsell ──
  proCard: {
    marginHorizontal: 24,
    marginTop: 16,
    padding: 18,
    backgroundColor: "rgba(201,169,110,0.05)",
    borderWidth: 1,
    borderColor: "rgba(201,169,110,0.18)",
    borderRadius: 14,
  },
  proTitle: {
    fontFamily: T.sansB,
    fontSize: 13,
    color: C.gold,
    marginBottom: 6,
  },
  proSub: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
    lineHeight: 18,
    marginBottom: 10,
  },
  proCta: {
    fontFamily: T.sansM,
    fontSize: 12,
    color: C.gold,
  },

  // ── Destination intel ──
  intelBlock: {
    marginHorizontal: 24,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    overflow: "hidden",
  },
  intelRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  intelRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  intelLabel: {
    fontFamily: T.sansM,
    fontSize: 9,
    letterSpacing: 2,
    color: C.gold,
    marginBottom: 4,
    opacity: 0.8,
  },
  intelText: {
    fontFamily: T.sans,
    fontSize: 13,
    color: C.ink,
    lineHeight: 20,
  },
  intelCta: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  intelCtaT: {
    fontFamily: T.sansM,
    fontSize: 13,
    color: C.gold,
  },

  // ── Companions ──
  companionBlock: {
    marginHorizontal: 24,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    overflow: "hidden",
  },
  companionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
  },
  companionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  companionAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.card2,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  companionAvatarT: {
    fontFamily: T.sansM,
    fontSize: 11,
    color: C.mut,
  },
  companionEmail: {
    flex: 1,
    fontFamily: T.sans,
    fontSize: 13,
    color: C.ink,
  },
  companionStatus: {
    fontFamily: T.sansM,
    fontSize: 11,
  },
  companionInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.line,
    gap: 10,
  },
  companionInput: {
    flex: 1,
    fontFamily: T.garamondI,
    fontSize: 15,
    color: C.ink,
    paddingVertical: 6,
  },
  inviteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.gold,
    borderRadius: 20,
  },
  inviteBtnT: {
    fontFamily: T.sansB,
    fontSize: 12,
    color: C.bg,
  },

  // ── Checklist ──
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  checkBoxDone: {
    backgroundColor: C.teal,
    borderColor: C.teal,
  },
  checkMark: {
    fontFamily: T.sansB,
    fontSize: 11,
    color: C.bg,
    lineHeight: 14,
  },

  // ── Outcome card ──
  outcomeCard: {
    marginHorizontal: 24,
    padding: 18,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
  },
  outcomeTitle: {
    fontFamily: T.garamondI,
    fontSize: 18,
    color: C.ink,
    marginBottom: 6,
  },
  outcomeSub: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
    lineHeight: 18,
    marginBottom: 14,
  },
  starRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  starBtn: {
    padding: 4,
  },
  star: {
    fontSize: 26,
    color: C.card2,
  },
  ratingLabel: {
    fontFamily: T.sansM,
    fontSize: 12,
    color: C.gold,
    marginBottom: 12,
  },
  outcomeSubmit: {
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: C.gold,
    borderRadius: 20,
  },
  outcomeSubmitT: {
    fontFamily: T.sansB,
    fontSize: 13,
    color: C.bg,
  },

  // ── Empty legs ──
  emptyLegs: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  emptyLegsT: {
    fontFamily: T.garamondI,
    fontSize: 16,
    color: C.mut,
  },
});
