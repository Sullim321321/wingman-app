// DisruptionScreen — Wingman
// Full disruption response: alternatives, EC261 entitlement, cascade actions
// Triggered when a flight is cancelled or severely delayed
import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, Alert, Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, T } from "../theme";
import { SerifText, tap } from "../components";
import { getDisruptionAlternatives, acceptRescue, executeCascadeAction } from "../api";

function SectionHeader({ title, color }) {
  return (
    <Text style={[s.sectionTitle, color ? { color } : {}]}>{title}</Text>
  );
}

function AlternativeCard({ option, onSelect, selected }) {
  const price = option.price?.total ? `${option.price.currency || "$"}${option.price.total}` : "Price TBC";
  const dep = option.itineraries?.[0]?.segments?.[0]?.departure?.at;
  const arr = option.itineraries?.[0]?.segments?.[option.itineraries[0].segments.length - 1]?.arrival?.at;
  const stops = (option.itineraries?.[0]?.segments?.length || 1) - 1;
  const carrier = option.itineraries?.[0]?.segments?.[0]?.carrierCode || "";
  const flightNum = option.itineraries?.[0]?.segments?.[0]?.number || "";
  const depTime = dep ? new Date(dep).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";
  const arrTime = arr ? new Date(arr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";
  const depDate = dep ? new Date(dep).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  return (
    <Pressable
      style={[s.altCard, selected && s.altCardSelected]}
      onPress={() => { tap(); onSelect(option); }}
    >
      <LinearGradient
        colors={selected ? [C.gold + "18", "transparent"] : ["transparent", "transparent"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <View>
          <Text style={s.altCarrier}>{carrier}{flightNum}</Text>
          <Text style={s.altDate}>{depDate}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.altPrice}>{price}</Text>
          <Text style={s.altStops}>{stops === 0 ? "Direct" : `${stops} stop${stops > 1 ? "s" : ""}`}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={s.altTime}>{depTime}</Text>
        <View style={s.altLine} />
        <Text style={s.altTime}>{arrTime}</Text>
      </View>
      {selected && (
        <View style={s.altSelectedBadge}>
          <Text style={s.altSelectedBadgeT}>Selected</Text>
        </View>
      )}
    </Pressable>
  );
}

function EC261Card({ ec261 }) {
  if (!ec261?.eligible) return null;
  return (
    <View style={s.ec261Card}>
      <LinearGradient colors={[C.gold + "10", "transparent"]} style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={s.ec261Title}>EC 261/2004 Compensation</Text>
        <Text style={s.ec261Amount}>€{ec261.amount_eur}</Text>
      </View>
      <Text style={s.ec261Basis}>{ec261.basis}</Text>
      <Text style={s.ec261How}>{ec261.how_to_claim}</Text>
      <Pressable
        style={s.ec261Btn}
        onPress={() => Linking.openURL("https://www.aviationclaims.co.uk/")}
      >
        <Text style={s.ec261BtnT}>Start claim  →</Text>
      </Pressable>
    </View>
  );
}

function CascadeActionCard({ action, onPress, executing, done }) {
  const icons = {
    hotel_delay:      "🏨",
    restaurant_delay: "🍽",
    lounge_access:    "🛋",
  };
  return (
    <Pressable
      style={[s.cascadeCard, done && s.cascadeCardDone]}
      onPress={onPress}
      disabled={executing || done}
    >
      <Text style={s.cascadeIcon}>{icons[action.type] || "›"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.cascadeLabel}>{action.label}</Text>
        <Text style={s.cascadeSub}>{action.description}</Text>
      </View>
      {executing
        ? <ActivityIndicator size="small" color={C.gold} />
        : done
          ? <Text style={{ color: C.teal, fontSize: 14, fontFamily: T.sansB }}>Sent ✓</Text>
          : <Text style={{ color: C.gold, fontSize: 18 }}>›</Text>
      }
    </Pressable>
  );
}

export default function DisruptionScreen({ route, navigation }) {
  const { tripId, legId, ident } = route.params || {};
  const [loading, setLoading]       = useState(true);
  const [data, setData]             = useState(null);
  const [selectedAlt, setSelectedAlt] = useState(null);
  const [booking, setBooking]       = useState(false);
  const [cascadeExecuting, setCascadeExecuting] = useState({});
  const [cascadeDone, setCascadeDone]           = useState({});

  useEffect(() => {
    if (!tripId || !legId) { setLoading(false); return; }
    getDisruptionAlternatives(tripId, legId)
      .then(d => { if (d?.ok) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tripId, legId]);

  const handleBook = async () => {
    if (!selectedAlt) return;
    setBooking(true);
    try {
      const result = await acceptRescue(tripId, { offerId: selectedAlt.id });
      if (result?.ok || result?.booking) {
        Alert.alert("Booked ✓", "Your new flight has been booked. Check your email for confirmation.", [
          { text: "OK", onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert("Booking failed", "Could not complete the booking. Please try again or contact the airline directly.");
      }
    } catch (e) {
      Alert.alert("Error", e.message || "Booking failed.");
    } finally {
      setBooking(false);
    }
  };

  const handleConcierge = (prefill) => {
    navigation.navigate("Concierge", { prefill });
  };

  const handleCascadeAction = async (action, index) => {
    // hotel_delay and restaurant_delay hit real backend endpoints via Twilio SMS.
    // lounge_access and unknown types fall back gracefully to the concierge chat.
    const REAL_ENDPOINTS = {
      hotel_delay:      "hotel-notify",
      restaurant_delay: "restaurant-reschedule",
    };
    const endpoint = REAL_ENDPOINTS[action.type];

    if (endpoint && tripId) {
      setCascadeExecuting(prev => ({ ...prev, [index]: true }));
      try {
        const result = await executeCascadeAction(tripId, endpoint, {
          delay_minutes: data?.flight?.delay_minutes,
          ident: ident || data?.flight?.ident,
        });
        if (result?.ok || result?.sent) {
          setCascadeDone(prev => ({ ...prev, [index]: true }));
          const successTitle = action.type === "hotel_delay"
            ? "Hotel notified ✓"
            : "Reservation updated ✓";
          Alert.alert(successTitle, result.message || "Done — we've sent the notification on your behalf.");
        } else {
          // Endpoint responded but didn't confirm send — fall back to concierge
          handleConcierge(`My flight was ${isCancelled ? "cancelled" : "delayed"}. ${action.label} — can you help?`);
        }
      } catch {
        // If Twilio isn't configured yet, fall back gracefully to concierge chat
        handleConcierge(`My flight was ${isCancelled ? "cancelled" : "delayed"}. ${action.label} — can you help?`);
      } finally {
        setCascadeExecuting(prev => ({ ...prev, [index]: false }));
      }
    } else {
      handleConcierge(`My flight was ${isCancelled ? "cancelled" : "delayed"}. ${action.label} — can you help?`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={C.gold} style={{ marginTop: 80 }} />
        <Text style={s.loadingT}>Finding your options…</Text>
      </SafeAreaView>
    );
  }

  const flight = data?.flight;
  const isCancelled = data?.is_cancelled;
  const alternatives = data?.alternatives || [];
  const ec261 = data?.ec261;
  const cascadeActions = data?.cascade_actions || [];
  const rightsInfo = data?.rights_info;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View style={[s.statusBanner, { backgroundColor: isCancelled ? C.coral + "15" : C.amber + "15", borderColor: isCancelled ? C.coral + "40" : C.amber + "40" }]}>
            <Text style={[s.statusBannerT, { color: isCancelled ? C.coral : C.amber }]}>
              {isCancelled ? "⚠  Flight Cancelled" : `⏱  Delayed ${flight?.delay_minutes || 0} minutes`}
            </Text>
          </View>
          {flight && (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <SerifText bold style={{ color: C.ink, fontSize: 26 }}>{flight.origin}</SerifText>
                <Text style={{ color: C.mut, fontSize: 16 }}>→</Text>
                <SerifText bold style={{ color: C.ink, fontSize: 26 }}>{flight.destination}</SerifText>
              </View>
              <Text style={s.flightIdent}>{flight.ident}</Text>
            </View>
          )}
        </View>

        {/* Rights info */}
        {rightsInfo && (
          <View style={s.rightsCard}>
            <Text style={s.rightsTitle}>{rightsInfo.title}</Text>
            <Text style={s.rightsBody}>{rightsInfo.body}</Text>
          </View>
        )}

        {/* Alternative flights */}
        {alternatives.length > 0 && (
          <>
            <SectionHeader title="ALTERNATIVE FLIGHTS" />
            {alternatives.map((alt, i) => (
              <AlternativeCard
                key={alt.id || i}
                option={alt}
                selected={selectedAlt?.id === alt.id}
                onSelect={setSelectedAlt}
              />
            ))}
            {selectedAlt && (
              <Pressable style={s.bookBtn} onPress={handleBook} disabled={booking}>
                {booking
                  ? <ActivityIndicator color={C.bg} />
                  : <Text style={s.bookBtnT}>Book this flight  →</Text>
                }
              </Pressable>
            )}
          </>
        )}

        {/* No alternatives — ask Wingman */}
        {alternatives.length === 0 && (
          <Pressable
            style={s.conciergeCard}
            onPress={() => handleConcierge(`My ${ident || "flight"} was ${isCancelled ? "cancelled" : "delayed"}. What are my options?`)}
          >
            <LinearGradient colors={[C.gold + "0A", "transparent"]} style={StyleSheet.absoluteFill} />
            <Text style={s.conciergeTitle}>Ask Wingman for options</Text>
            <Text style={s.conciergeSub}>Wingman can search alternatives, check your rights, and help you rebook.</Text>
            <Text style={s.conciergeArrow}>Open Concierge  →</Text>
          </Pressable>
        )}

        {/* EC261 compensation */}
        {ec261 && (
          <>
            <SectionHeader title="COMPENSATION ENTITLEMENT" color={C.gold} />
            <EC261Card ec261={ec261} />
          </>
        )}

        {/* Cascade actions — now wired to real endpoints */}
        {cascadeActions.length > 0 && (
          <>
            <SectionHeader title="ALSO AFFECTED" />
            {cascadeActions.map((action, i) => (
              <CascadeActionCard
                key={i}
                action={action}
                executing={!!cascadeExecuting[i]}
                done={!!cascadeDone[i]}
                onPress={() => handleCascadeAction(action, i)}
              />
            ))}
          </>
        )}

        {/* Ask Wingman anything */}
        <Pressable
          style={s.askCard}
          onPress={() => handleConcierge(`My ${ident || "flight"} was ${isCancelled ? "cancelled" : "delayed"}. What should I do?`)}
        >
          <Text style={s.askT}>Ask Wingman anything about this disruption  →</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  scroll:       { paddingHorizontal: 20, paddingTop: 16 },
  loadingT:     { color: C.mut, textAlign: "center", marginTop: 12, fontFamily: T.sans, fontSize: 13 },
  header:       { marginBottom: 20 },
  statusBanner: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 4 },
  statusBannerT:{ fontSize: 14, fontFamily: T.sansB },
  flightIdent:  { color: C.mut, fontSize: 13, fontFamily: T.sans, marginTop: 4 },
  rightsCard:   { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, marginBottom: 16 },
  rightsTitle:  { color: C.ink, fontSize: 13, fontFamily: T.sansB, marginBottom: 4 },
  rightsBody:   { color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 18 },
  sectionTitle: { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.4, marginBottom: 8, marginTop: 16 },
  altCard:      { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line, marginBottom: 8, overflow: "hidden" },
  altCardSelected: { borderColor: C.gold + "80" },
  altCarrier:   { color: C.ink, fontSize: 14, fontFamily: T.sansB },
  altDate:      { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2 },
  altPrice:     { color: C.gold, fontSize: 16, fontFamily: T.sansB },
  altStops:     { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 2, textAlign: "right" },
  altTime:      { color: C.ink, fontSize: 18, fontFamily: T.serifB },
  altLine:      { flex: 1, height: 1, backgroundColor: C.line },
  altSelectedBadge: { position: "absolute", top: 12, right: 12, backgroundColor: C.gold + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.gold + "40" },
  altSelectedBadgeT: { color: C.gold, fontSize: 10, fontFamily: T.sansB },
  bookBtn:      { backgroundColor: C.gold, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8, marginBottom: 4 },
  bookBtnT:     { color: C.bg, fontSize: 15, fontFamily: T.sansB },
  conciergeCard:{ backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.gold + "30", marginBottom: 8, overflow: "hidden" },
  conciergeTitle:{ color: C.ink, fontSize: 15, fontFamily: T.sansB, marginBottom: 4 },
  conciergeSub: { color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 18, marginBottom: 10 },
  conciergeArrow:{ color: C.gold, fontSize: 13, fontFamily: T.sansM },
  ec261Card:    { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.gold + "40", marginBottom: 8, overflow: "hidden" },
  ec261Title:   { color: C.ink, fontSize: 14, fontFamily: T.sansB },
  ec261Amount:  { color: C.gold, fontSize: 22, fontFamily: T.serifB },
  ec261Basis:   { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 4, marginBottom: 6 },
  ec261How:     { color: C.ink, fontSize: 12, fontFamily: T.sans, lineHeight: 18, marginBottom: 10 },
  ec261Btn:     { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.gold + "60" },
  ec261BtnT:    { color: C.gold, fontSize: 13, fontFamily: T.sansM },
  cascadeCard:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, marginBottom: 8 },
  cascadeCardDone: { borderColor: C.teal + "40", backgroundColor: C.teal + "08" },
  cascadeIcon:  { fontSize: 22 },
  cascadeLabel: { color: C.ink, fontSize: 13, fontFamily: T.sansM, marginBottom: 2 },
  cascadeSub:   { color: C.mut, fontSize: 11, fontFamily: T.sans, lineHeight: 16 },
  askCard:      { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, marginTop: 12, alignItems: "center" },
  askT:         { color: C.gold, fontSize: 13, fontFamily: T.sansM },
});
