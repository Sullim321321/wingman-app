// DisruptionScreen.js
// Full disruption response: alternatives, EC261 entitlement, cascade actions with draft modals,
// rebooking confirmation, missed flight flow, cancellation vs delay differentiation.
import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet,
  ActivityIndicator, Alert, Linking, Modal, TextInput, Share, Clipboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, T } from "../theme";
import { SerifText, tap } from "../components";
import { getDisruptionAlternatives, acceptRescue, executeCascadeAction, getRescueOptions, getAirportNavigation } from "../api";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ title, color }) {
  return <Text style={[s.sectionTitle, color ? { color } : {}]}>{title}</Text>;
}

function AlternativeCard({ option, onSelect, selected }) {
  const price = option.price?.total
    ? `${option.price.currency || "$"}${option.price.total}`
    : option.total_amount
      ? `${option.total_currency || ""}${option.total_amount}`
      : "Price TBC";
  const segs = option.itineraries?.[0]?.segments || option.slices?.[0]?.segments || [];
  const dep = segs[0]?.departure?.at || segs[0]?.departing_at;
  const arr = segs[segs.length - 1]?.arrival?.at || segs[segs.length - 1]?.arriving_at;
  const stops = Math.max(0, segs.length - 1);
  const carrier = segs[0]?.carrierCode || segs[0]?.marketing_carrier?.iata_code || "";
  const flightNum = segs[0]?.number || segs[0]?.marketing_carrier_flight_number || "";
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

function EC261Card({ ec261, isCancelled }) {
  if (!ec261?.eligible) return null;
  const title = isCancelled ? "Refund Entitlement" : "EC 261/2004 Compensation";
  const subtitle = isCancelled
    ? "You are entitled to a full refund of your ticket price under EU Regulation 261/2004."
    : ec261.basis;
  return (
    <View style={s.ec261Card}>
      <LinearGradient colors={[C.gold + "10", "transparent"]} style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={s.ec261Title}>{title}</Text>
        {!isCancelled && <Text style={s.ec261Amount}>€{ec261.amount_eur}</Text>}
      </View>
      <Text style={s.ec261Basis}>{subtitle}</Text>
      {!isCancelled && <Text style={s.ec261How}>{ec261.how_to_claim}</Text>}
      {isCancelled && (
        <Text style={s.ec261How}>
          Contact your airline to request a full refund. If they refuse, you can escalate to the National Enforcement Body or use a claims service.
        </Text>
      )}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        {isCancelled && (
          <Pressable
            style={s.ec261Btn}
            onPress={() => Linking.openURL("https://www.caa.co.uk/passengers-and-public/resolving-travel-problems/disrupted-travel/your-rights/")}
          >
            <Text style={s.ec261BtnT}>Know your rights  →</Text>
          </Pressable>
        )}
        <Pressable
          style={s.ec261Btn}
          onPress={() => Linking.openURL("https://www.aviationclaims.co.uk/")}
        >
          <Text style={s.ec261BtnT}>{isCancelled ? "Start refund claim  →" : "Start claim  →"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Draft message modal — shown when cascade action returns a drafted message
function DraftModal({ visible, title, message, onClose }) {
  const handleCopy = () => {
    Clipboard.setString(message || "");
    Alert.alert("Copied", "Message copied to clipboard.");
  };
  const handleShare = () => {
    Share.share({ message: message || "" });
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalSheet}>
          <Text style={s.modalTitle}>{title || "Drafted message"}</Text>
          <Text style={s.modalSub}>Review and send this yourself — Wingman never contacts third parties directly.</Text>
          <View style={s.draftBox}>
            <Text style={s.draftText}>{message}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <Pressable style={[s.modalBtn, { flex: 1 }]} onPress={handleCopy}>
              <Text style={s.modalBtnT}>Copy</Text>
            </Pressable>
            <Pressable style={[s.modalBtn, s.modalBtnGold, { flex: 1 }]} onPress={handleShare}>
              <Text style={[s.modalBtnT, { color: C.bg }]}>Share</Text>
            </Pressable>
          </View>
          <Pressable style={s.modalClose} onPress={onClose}>
            <Text style={s.modalCloseT}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Booking confirmation modal
function ConfirmBookModal({ visible, option, onConfirm, onCancel, booking }) {
  if (!option) return null;
  const segs = option.itineraries?.[0]?.segments || option.slices?.[0]?.segments || [];
  const dep = segs[0]?.departure?.at || segs[0]?.departing_at;
  const arr = segs[segs.length - 1]?.arrival?.at || segs[segs.length - 1]?.arriving_at;
  const carrier = segs[0]?.carrierCode || segs[0]?.marketing_carrier?.iata_code || "";
  const flightNum = segs[0]?.number || segs[0]?.marketing_carrier_flight_number || "";
  const price = option.price?.total
    ? `${option.price.currency || "$"}${option.price.total}`
    : option.total_amount
      ? `${option.total_currency || ""}${option.total_amount}`
      : "Price TBC";
  const depTime = dep ? new Date(dep).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";
  const depDate = dep ? new Date(dep).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={s.modalOverlay}>
        <View style={s.modalSheet}>
          <Text style={s.modalTitle}>Confirm rebooking</Text>
          <Text style={s.modalSub}>Review your new flight before confirming.</Text>
          <View style={s.confirmCard}>
            <Text style={s.confirmFlight}>{carrier}{flightNum}</Text>
            <Text style={s.confirmTime}>{depTime}</Text>
            <Text style={s.confirmDate}>{depDate}</Text>
            <Text style={s.confirmPrice}>{price}</Text>
          </View>
          <Text style={s.confirmNote}>
            Payment will be charged to your saved payment method. You'll receive a confirmation email.
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <Pressable style={[s.modalBtn, { flex: 1 }]} onPress={onCancel} disabled={booking}>
              <Text style={s.modalBtnT}>Cancel</Text>
            </Pressable>
            <Pressable style={[s.modalBtn, s.modalBtnGold, { flex: 1 }]} onPress={onConfirm} disabled={booking}>
              {booking
                ? <ActivityIndicator color={C.bg} size="small" />
                : <Text style={[s.modalBtnT, { color: C.bg }]}>Confirm booking</Text>
              }
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CascadeActionCard({ action, onPress, executing, done }) {
  const icons = {
    hotel_delay:        "🏨",
    restaurant_delay:   "🍽",
    lounge_access:      "🛋",
    event_at_risk:      "🎫",
    connection_at_risk: "⚠️",
    transfer_at_risk:   "🚕",
    visa_check:         "📋",
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
          ? <Text style={{ color: C.teal, fontSize: 14, fontFamily: T.sansB }}>Done ✓</Text>
          : <Text style={{ color: C.gold, fontSize: 18 }}>›</Text>
      }
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function DisruptionScreen({ route, navigation }) {
  const { tripId, legId, ident, missedFlight } = route.params || {};

  const [loading, setLoading]               = useState(true);
  const [data, setData]                     = useState(null);
  const [selectedAlt, setSelectedAlt]       = useState(null);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [booking, setBooking]               = useState(false);
  const [cascadeExecuting, setCascadeExecuting] = useState({});
  const [cascadeDone, setCascadeDone]           = useState({});
  const [draftModal, setDraftModal]         = useState({ visible: false, title: "", message: "" });
  const [missedMode, setMissedMode]         = useState(!!missedFlight);
  const [loungeModal, setLoungeModal]       = useState({ visible: false, iata: "", lounges: [], accessible: [] });

  const load = useCallback(() => {
    if (!tripId || !legId) { setLoading(false); return; }
    setLoading(true);
    // Try the richer rescue options endpoint first, fall back to disruption alternatives
    getRescueOptions(tripId, { leg_id: legId })
      .then(d => { if (d?.ok || d?.alternatives) setData(d); else return getDisruptionAlternatives(tripId, legId); })
      .catch(() => getDisruptionAlternatives(tripId, legId))
      .then(d => { if (d?.ok) setData(prev => prev || d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tripId, legId]);

  useEffect(() => { load(); }, [load]);

  const handleConfirmBook = async () => {
    if (!selectedAlt) return;
    setBooking(true);
    try {
      const result = await acceptRescue(tripId, {
        option_id: selectedAlt.id,
        disrupted_leg_id: legId,
        duffel_offer_id: selectedAlt.id,
        value_saved: selectedAlt.value_saved || 0,
      });
      setShowConfirm(false);
      if (result?.ok || result?.booking || result?.booked) {
        Alert.alert(
          "Booked ✓",
          result.booking_reference
            ? `Booking confirmed. Reference: ${result.booking_reference}`
            : "Your new flight has been booked. Check your email for confirmation.",
          [{ text: "View trip", onPress: () => navigation.navigate("TripDetail", { tripId }) }]
        );
      } else {
        Alert.alert("Booking failed", "Could not complete the booking. Please try again or contact the airline directly.");
      }
    } catch (e) {
      setShowConfirm(false);
      Alert.alert("Error", e.message || "Booking failed.");
    } finally {
      setBooking(false);
    }
  };

  const handleConcierge = (prefill) => {
    navigation.navigate("Concierge", { prefill });
  };

  const handleCascadeAction = async (action, index) => {
    const DRAFT_ENDPOINTS = {
      hotel_delay:      "hotel-notify",
      restaurant_delay: "restaurant-reschedule",
    };
    // lounge_access — fetch real lounge data and show inline modal
    if (action.type === "lounge_access") {
      const iata = flight?.origin || ident?.slice(0, 3) || "";
      if (iata) {
        setCascadeExecuting(prev => ({ ...prev, [index]: true }));
        getAirportNavigation(iata)
          .then(navData => {
            setLoungeModal({
              visible: true,
              iata,
              lounges: navData?.lounges || [],
              accessible: navData?.accessible_lounges || [],
            });
            setCascadeDone(prev => ({ ...prev, [index]: true }));
          })
          .catch(() => handleConcierge(`My flight is delayed at ${iata}. What lounges can I access with my status and cards?`))
          .finally(() => setCascadeExecuting(prev => ({ ...prev, [index]: false })));
      } else {
        handleConcierge(`My flight is delayed. What lounges can I access with my status and cards?`);
      }
      return;
    }

    const CONCIERGE_PREFILLS = {
      event_at_risk:      `My flight was ${isCancelled ? "cancelled" : "delayed"}. I have a show/event that may be at risk — can you help me work out if I'll make it and what my options are?`,
      connection_at_risk: `My flight was ${isCancelled ? "cancelled" : "delayed"}. I have a tight connection that's now at risk — what are my options?`,
      transfer_at_risk:   `My flight was ${isCancelled ? "cancelled" : "delayed"}. My ground transfer may need to be rescheduled — can you help?`,
      visa_check:         `My itinerary has changed. Can you check whether my visa or entry requirements are still valid for the new routing?`,
    };
    if (CONCIERGE_PREFILLS[action.type]) {
      handleConcierge(CONCIERGE_PREFILLS[action.type]);
      return;
    }
    const endpoint = DRAFT_ENDPOINTS[action.type];
    if (endpoint && tripId) {
      setCascadeExecuting(prev => ({ ...prev, [index]: true }));
      try {
        const result = await executeCascadeAction(tripId, endpoint, {
          leg_id: action.leg_id,
          delay_minutes: flight?.delay_minutes,
          ident: ident || flight?.ident,
        });
        setCascadeDone(prev => ({ ...prev, [index]: true }));
        if (result?.message_drafted) {
          const draftTitle = action.type === "hotel_delay"
            ? `Message for ${result.hotel_name || "hotel"}`
            : `Message for ${result.restaurant_name || "restaurant"}`;
          setDraftModal({ visible: true, title: draftTitle, message: result.message_drafted });
        } else {
          Alert.alert("Draft ready", result?.note || "Message drafted — check your concierge.");
        }
      } catch {
        handleConcierge(`My flight was ${isCancelled ? "cancelled" : "delayed"}. ${action.label} — can you help?`);
      } finally {
        setCascadeExecuting(prev => ({ ...prev, [index]: false }));
      }
    } else {
      handleConcierge(`My flight was ${isCancelled ? "cancelled" : "delayed"}. ${action.label} — can you help?`);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={C.gold} style={{ marginTop: 80 }} />
        <Text style={s.loadingT}>Finding your options…</Text>
      </SafeAreaView>
    );
  }

  const flight        = data?.flight;
  const isCancelled   = data?.is_cancelled;
  const alternatives  = data?.alternatives || [];
  const ec261         = data?.ec261;
  const cascadeActions = data?.cascade_actions || [];
  const rightsInfo    = data?.rights_info;

  // Connection risk — score based on delay vs buffer
  const connectionRisk = (() => {
    if (!flight?.delay_minutes || !cascadeActions.find(a => a.type === "connection_at_risk")) return null;
    const buffer = data?.connection_buffer_minutes;
    if (!buffer) return null;
    const remaining = buffer - flight.delay_minutes;
    if (remaining < 0) return { level: "MISSED", remaining: Math.abs(remaining) };
    if (remaining < 30) return { level: "CRITICAL", remaining };
    if (remaining < 60) return { level: "HIGH", remaining };
    return null;
  })();

  // ── Missed flight mode ─────────────────────────────────────────────────────
  if (missedMode) {
    return (
      <SafeAreaView style={s.root}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.header}>
            <View style={[s.statusBanner, { backgroundColor: C.coral + "15", borderColor: C.coral + "40" }]}>
              <Text style={[s.statusBannerT, { color: C.coral }]}>✈  Missed flight</Text>
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

          <View style={s.rightsCard}>
            <Text style={s.rightsTitle}>What happens now</Text>
            <Text style={s.rightsBody}>
              If you missed your flight due to a delay or cancellation on a previous leg, the airline is obligated to rebook you on the next available flight at no charge. If you missed it due to your own circumstances, you may need to purchase a new ticket.
            </Text>
          </View>

          <SectionHeader title="YOUR OPTIONS" />

          <Pressable style={s.missedOption} onPress={() => handleConcierge(`I missed my ${ident || "flight"} from ${flight?.origin || "origin"} to ${flight?.destination || "destination"}. What are the next available flights and what are my rights?`)}>
            <Text style={s.missedOptionTitle}>Find next available flights</Text>
            <Text style={s.missedOptionSub}>Wingman will search alternatives and check your rights</Text>
            <Text style={s.missedOptionArrow}>→</Text>
          </Pressable>

          <Pressable style={s.missedOption} onPress={() => handleConcierge(`I missed my ${ident || "flight"}. Can you help me draft a message to the airline requesting a free rebooking?`)}>
            <Text style={s.missedOptionTitle}>Draft message to airline</Text>
            <Text style={s.missedOptionSub}>Request free rebooking if the missed flight was due to a delay</Text>
            <Text style={s.missedOptionArrow}>→</Text>
          </Pressable>

          <Pressable style={s.missedOption} onPress={() => Linking.openURL("https://www.caa.co.uk/passengers-and-public/resolving-travel-problems/disrupted-travel/your-rights/")}>
            <Text style={s.missedOptionTitle}>Know your rights</Text>
            <Text style={s.missedOptionSub}>EC 261/2004 and airline conditions of carriage</Text>
            <Text style={s.missedOptionArrow}>→</Text>
          </Pressable>

          <Pressable style={s.switchModeBtn} onPress={() => setMissedMode(false)}>
            <Text style={s.switchModeBtnT}>View disruption options instead</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main disruption view ───────────────────────────────────────────────────
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

        {/* Connection risk alert */}
        {connectionRisk && (
          <View style={[s.connectionRisk, {
            backgroundColor: connectionRisk.level === "MISSED" ? C.coral + "15" : C.amber + "12",
            borderColor: connectionRisk.level === "MISSED" ? C.coral + "50" : C.amber + "50",
          }]}>
            <Text style={[s.connectionRiskTitle, { color: connectionRisk.level === "MISSED" ? C.coral : C.amber }]}>
              {connectionRisk.level === "MISSED"
                ? `Connection missed by ${connectionRisk.remaining}m`
                : `Connection at risk — ${connectionRisk.remaining}m buffer remaining`}
            </Text>
            <Text style={s.connectionRiskSub}>
              {connectionRisk.level === "MISSED"
                ? "Your connecting flight has departed. Wingman is finding alternatives for the full journey."
                : "This is a very tight connection. Tap below to see rebooking options for the full journey."}
            </Text>
          </View>
        )}

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
              <Pressable style={s.bookBtn} onPress={() => { tap(); setShowConfirm(true); }}>
                <Text style={s.bookBtnT}>Rebook this flight  →</Text>
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

        {/* EC261 / refund entitlement */}
        {(ec261 || isCancelled) && (
          <>
            <SectionHeader title={isCancelled ? "REFUND ENTITLEMENT" : "COMPENSATION ENTITLEMENT"} color={C.gold} />
            <EC261Card ec261={ec261 || { eligible: true }} isCancelled={isCancelled} />
          </>
        )}

        {/* Cascade actions */}
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

        {/* Missed flight entry point */}
        <Pressable style={s.missedFlightBtn} onPress={() => setMissedMode(true)}>
          <Text style={s.missedFlightBtnT}>I already missed my flight  →</Text>
        </Pressable>

        {/* Ask Wingman anything */}
        <Pressable
          style={s.askCard}
          onPress={() => handleConcierge(`My ${ident || "flight"} was ${isCancelled ? "cancelled" : "delayed"}. What should I do?`)}
        >
          <Text style={s.askT}>Ask Wingman anything about this disruption  →</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Booking confirmation modal */}
      <ConfirmBookModal
        visible={showConfirm}
        option={selectedAlt}
        booking={booking}
        onConfirm={handleConfirmBook}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Cascade draft message modal */}
      <DraftModal
        visible={draftModal.visible}
        title={draftModal.title}
        message={draftModal.message}
        onClose={() => setDraftModal({ visible: false, title: "", message: "" })}
      />

      {/* Lounge finder modal */}
      <Modal visible={loungeModal.visible} transparent animationType="slide" onRequestClose={() => setLoungeModal(prev => ({ ...prev, visible: false }))}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Lounges at {loungeModal.iata}</Text>
            <Text style={s.modalSub}>
              {loungeModal.accessible.length > 0
                ? `${loungeModal.accessible.length} lounge${loungeModal.accessible.length > 1 ? "s" : ""} accessible with your status or cards`
                : "Showing all available lounges — check access rules"}
            </Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {(loungeModal.accessible.length > 0 ? loungeModal.accessible : loungeModal.lounges).map((lounge, i) => (
                <View key={i} style={s.loungeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.loungeName}>{lounge.name}</Text>
                    <Text style={s.loungeTerminal}>Terminal {lounge.terminal}  ·  {lounge.hours}</Text>
                    <Text style={s.loungeAccess}>{lounge.access?.join(", ")}</Text>
                  </View>
                  {loungeModal.accessible.some(a => a.name === lounge.name) && (
                    <View style={s.loungeAccessBadge}>
                      <Text style={s.loungeAccessBadgeT}>Access ✓</Text>
                    </View>
                  )}
                </View>
              ))}
              {loungeModal.lounges.length === 0 && (
                <Text style={{ color: C.mut, fontSize: 13, fontFamily: T.sans, textAlign: "center", paddingVertical: 20 }}>
                  No lounge data for this airport yet.
                </Text>
              )}
            </ScrollView>
            <Pressable style={[s.modalBtn, s.modalBtnGold, { marginTop: 16 }]} onPress={() => setLoungeModal(prev => ({ ...prev, visible: false }))}>
              <Text style={[s.modalBtnT, { color: C.bg }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  scroll:       { paddingHorizontal: 20, paddingTop: 16 },
  loadingT:     { color: C.mut, textAlign: "center", marginTop: 12, fontFamily: T.sans, fontSize: 13 },
  header:       { marginBottom: 20 },
  statusBanner: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 4 },
  statusBannerT:{ fontSize: 14, fontFamily: T.sansB },
  flightIdent:  { color: C.mut, fontSize: 13, fontFamily: T.sans, marginTop: 4 },

  connectionRisk: {
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14,
  },
  connectionRiskTitle: { fontSize: 13, fontFamily: T.sansB, marginBottom: 4 },
  connectionRiskSub:   { fontSize: 12, fontFamily: T.sans, color: C.mut, lineHeight: 17 },

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
  ec261Btn:     { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.gold + "60", marginRight: 8 },
  ec261BtnT:    { color: C.gold, fontSize: 13, fontFamily: T.sansM },

  cascadeCard:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, marginBottom: 8 },
  cascadeCardDone: { borderColor: C.teal + "40", backgroundColor: C.teal + "08" },
  cascadeIcon:  { fontSize: 22 },
  cascadeLabel: { color: C.ink, fontSize: 13, fontFamily: T.sansM, marginBottom: 2 },
  cascadeSub:   { color: C.mut, fontSize: 11, fontFamily: T.sans, lineHeight: 16 },

  missedFlightBtn: { borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.coral + "40", alignItems: "center", marginTop: 12, backgroundColor: C.coral + "08" },
  missedFlightBtnT:{ color: C.coral, fontSize: 13, fontFamily: T.sansM },

  askCard:      { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, marginTop: 10, alignItems: "center" },
  askT:         { color: C.gold, fontSize: 13, fontFamily: T.sansM },

  // Missed flight mode
  missedOption: { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.line, marginBottom: 8, flexDirection: "row", alignItems: "center" },
  missedOptionTitle: { flex: 1, color: C.ink, fontSize: 14, fontFamily: T.sansM, marginBottom: 2 },
  missedOptionSub:   { flex: 1, color: C.mut, fontSize: 11, fontFamily: T.sans },
  missedOptionArrow: { color: C.gold, fontSize: 18, fontFamily: T.sansB },
  switchModeBtn: { alignItems: "center", paddingVertical: 14, marginTop: 8 },
  switchModeBtnT:{ color: C.mut, fontSize: 12, fontFamily: T.sans },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet:   { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle:   { color: C.ink, fontSize: 17, fontFamily: T.sansB, marginBottom: 4 },
  modalSub:     { color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 17, marginBottom: 16 },
  draftBox:     { backgroundColor: C.bg, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.line },
  draftText:    { color: C.ink, fontSize: 14, fontFamily: T.sans, lineHeight: 21 },
  modalBtn:     { backgroundColor: C.bg, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.line },
  modalBtnGold: { backgroundColor: C.gold, borderColor: C.gold },
  modalBtnT:    { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  modalClose:   { alignItems: "center", paddingTop: 16 },
  modalCloseT:  { color: C.mut, fontSize: 13, fontFamily: T.sans },

  // Booking confirm modal
  confirmCard:  { backgroundColor: C.bg, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.gold + "40", marginBottom: 8, alignItems: "center" },
  confirmFlight:{ color: C.ink, fontSize: 18, fontFamily: T.sansB, marginBottom: 4 },
  confirmTime:  { color: C.gold, fontSize: 28, fontFamily: T.serifB },
  confirmDate:  { color: C.mut, fontSize: 13, fontFamily: T.sans, marginTop: 2 },
  confirmPrice: { color: C.ink, fontSize: 16, fontFamily: T.sansM, marginTop: 8 },
  confirmNote:  { color: C.mut, fontSize: 11, fontFamily: T.sans, lineHeight: 16, textAlign: "center" },

  // Lounge finder
  loungeRow:        { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: "row", alignItems: "center" },
  loungeName:       { color: C.ink, fontSize: 13, fontFamily: T.sansM, marginBottom: 2 },
  loungeTerminal:   { color: C.mut, fontSize: 11, fontFamily: T.sans, marginBottom: 2 },
  loungeAccess:     { color: C.mut, fontSize: 10, fontFamily: T.sans, fontStyle: "italic" },
  loungeAccessBadge:{ backgroundColor: C.teal + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.teal + "50", marginLeft: 8 },
  loungeAccessBadgeT:{ color: C.teal, fontSize: 10, fontFamily: T.sansB },
});
