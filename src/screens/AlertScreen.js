import { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  Pressable, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, T } from "../theme";
import { Btn, BackBar, SerifText, useCountUp, success, g } from "../components";
import {
  getPrediction, getTrips,
  getRescueOptions, acceptRescue, rejectRescue,
  notifyHotel, notifyRestaurant,
} from "../api";
import { getCachedAlerts } from "../offlineCache";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRescueSteps(dep, arr, flightLabel, optionLabel) {
  const dest = arr || "your destination";
  const flight = flightLabel || `${dep || "your flight"} → ${arr || ""}`;
  const chosen = optionLabel || "best available option";
  return [
    ["Confirming rescue option", `Locking in: ${chosen}`],
    [`Cancelling ${flight}`, "Releasing your seat and initiating refund"],
    ["Processing refund", "Credit back to your original payment method"],
    [`Updating your ${dest} reservation`, "Noting revised arrival time"],
    ["Syncing calendar & wallet", "New itinerary saved to your phone"],
  ];
}

function findNextFlight(trips) {
  const now = Date.now();
  let best = null, bestTime = Infinity;
  for (const trip of trips) {
    for (const leg of (trip.legs || [])) {
      if (leg.type !== "flight" || !leg.departs_at) continue;
      const t = new Date(leg.departs_at).getTime();
      if (t > now && t < bestTime) { bestTime = t; best = { ...leg, tripId: trip.id, tripTitle: trip.title }; }
    }
  }
  return best;
}

function formatMoney(n) {
  if (n == null) return null;
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatPoints(n) {
  if (!n) return null;
  return Number(n).toLocaleString("en-US") + " pts";
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ─── Risk badge ──────────────────────────────────────────────────────────────

function RiskBadge({ level }) {
  const cfg = {
    critical: { bg: "rgba(255,77,109,0.15)", border: "rgba(255,77,109,0.4)", text: C.coral, label: "CRITICAL" },
    high:     { bg: "rgba(255,140,0,0.12)",  border: "rgba(255,140,0,0.35)",  text: "#FF8C00", label: "HIGH RISK" },
    moderate: { bg: "rgba(201,169,110,0.12)", border: "rgba(201,169,110,0.3)", text: C.gold,   label: "MODERATE" },
    low:      { bg: "rgba(100,200,140,0.1)",  border: "rgba(100,200,140,0.25)", text: "#64C88C", label: "LOW" },
  }[level] || { bg: "rgba(201,169,110,0.12)", border: "rgba(201,169,110,0.3)", text: C.gold, label: level?.toUpperCase() || "RISK" };

  return (
    <View style={[s.riskBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[s.riskBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Rescue Option Row ────────────────────────────────────────────────────────

function RescueRow({ opt, selected, onSelect, rank }) {
  const isPoints = opt.type === "points";
  const accentColor = isPoints ? "#D4902A" : C.gold;
  const accentBg = isPoints ? "rgba(212,144,42,0.08)" : "rgba(201,169,110,0.08)";
  const accentBorder = isPoints ? "rgba(212,144,42,0.25)" : "rgba(201,169,110,0.25)";

  return (
    <Pressable
      onPress={onSelect}
      style={[s.rescueRow, selected && { borderColor: accentColor, backgroundColor: accentBg }]}
    >
      {/* Rank badge */}
      {rank === 1 && (
        <View style={[s.wingmanPick, { borderColor: accentBorder, backgroundColor: accentBg }]}>
          <Text style={{ color: accentColor, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 }}>WINGMAN PICK</Text>
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          {/* Carrier + cabin */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Text style={{ color: accentColor, fontSize: 14, fontFamily: T.sansB }}>
              {isPoints ? "✦ " : "✈ "}{opt.carrier || "Alternative"}
            </Text>
            <Text style={{ color: C.mut, fontSize: 13, fontFamily: T.sansM }}>{opt.flight}</Text>
            {opt.cabin && (
              <View style={[s.cabinBadge, { borderColor: accentBorder, backgroundColor: accentBg }]}>
                <Text style={{ color: accentColor, fontSize: 9, fontFamily: T.sansB, letterSpacing: 0.5 }}>
                  {opt.cabin.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Label */}
          <Text style={s.rescueLabel}>{opt.label}</Text>

          {/* Departs */}
          {opt.departs_at && (
            <Text style={s.rescueMeta}>Departs {formatTime(opt.departs_at)}</Text>
          )}

          {/* Cost note */}
          {opt.cost_note && (
            <Text style={[s.rescueMeta, { color: C.gold, marginTop: 2 }]}>{opt.cost_note}</Text>
          )}

          {/* Downstream protection */}
          {opt.downstream_protection && opt.downstream_value_protected > 0 && (
            <Text style={[s.rescueMeta, { color: "#64C88C", marginTop: 4 }]}>
              ✓ Protects {formatMoney(opt.downstream_value_protected)} in downstream legs
            </Text>
          )}
        </View>

        {/* Price column */}
        <View style={{ alignItems: "flex-end", gap: 4, marginLeft: 12 }}>
          {isPoints ? (
            <>
              <Text style={[s.rescuePrice, { color: "#D4902A" }]}>{formatPoints(opt.cost_points)}</Text>
              {opt.cost_usd_equivalent && (
                <Text style={s.rescueMeta}>≈ {formatMoney(opt.cost_usd_equivalent)}</Text>
              )}
            </>
          ) : (
            <Text style={[s.rescuePrice, { color: opt.cost_usd === 0 ? "#64C88C" : C.ink }]}>
              {opt.cost_usd === 0 ? "Free" : formatMoney(opt.cost_usd)}
            </Text>
          )}
          {selected && (
            <View style={[s.selectedBadge, { borderColor: accentColor, backgroundColor: accentBg }]}>
              <Text style={{ color: accentColor, fontSize: 9, fontWeight: "800" }}>SELECTED</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AlertScreen({ navigation, route }) {
  const paramFlight = route?.params?.flight || null;
  const paramTripId = route?.params?.tripId || null;
  const paramLegId  = route?.params?.legId  || null;
  const paramDisruption = route?.params?.disruption_type || "delay";
  const paramDelay  = route?.params?.delay_minutes || 90;

  const [pred, setPred] = useState(null);
  const [status, setStatus] = useState("loading");
  const [flight, setFlight] = useState(paramFlight);
  const [tripId, setTripId] = useState(paramTripId);
  const [noTrips, setNoTrips] = useState(false);

  // Rescue engine state
  const [rescueData, setRescueData] = useState(null);
  const [rescueLoading, setRescueLoading] = useState(false);
  const [rescueError, setRescueError] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);

  // Accept/reject state
  const [accepting, setAccepting] = useState(false);

  // Downstream notification state — tracks per-leg sending/done
  const [notifySending, setNotifySending] = useState({});
  const [notifyDone, setNotifyDone] = useState({});

  useEffect(() => {
    let alive = true;

    const run = async () => {
      let fl = paramFlight;
      let tid = paramTripId;

      if (!fl) {
        try {
          const result = await getCachedAlerts(() => getTrips());
          const data = result.data;
          fl = findNextFlight(data.trips || []);
          if (alive) {
            setFlight(fl);
            if (fl?.tripId) { tid = fl.tripId; setTripId(fl.tripId); }
            // If no upcoming flights exist, show the empty state instead of demo data
            if (!fl) { setNoTrips(true); setStatus("no_trips"); return; }
          }
        } catch (_) { if (alive) { setNoTrips(true); setStatus("no_trips"); return; } }
      }

      const dep = fl?.origin || "";
      const arr = fl?.destination || "";
      if (!dep || !arr) { if (alive) { setNoTrips(true); setStatus("no_trips"); } return; }

      // Get disruption prediction
      try {
        const p = await getPrediction({ dep, arr });
        if (!alive) return;
        setPred(p);
        setStatus(p.live ? "live" : "modeled");
      } catch {
        if (alive) setStatus("offline");
      }

      // Fetch rescue options from the decision engine
      const legId = paramLegId || fl?.id;
      if (tid && legId) {
        setRescueLoading(true);
        try {
          const result = await getRescueOptions(tid, {
            disrupted_leg_id: legId,
            disruption_type: paramDisruption,
            delay_minutes: paramDelay,
          });
          if (alive) {
            setRescueData(result);
            // Auto-select the Wingman-recommended option (rank 1)
            const recommended = (result.options || []).find(o => o.recommended) || result.options?.[0];
            if (recommended) setSelectedOption(recommended);
          }
        } catch (e) {
          if (alive) setRescueError(e.message);
        } finally {
          if (alive) setRescueLoading(false);
        }
      }
    };

    run();
    return () => { alive = false; };
  }, []);

  const dep = flight?.origin || "";
  const arr = flight?.destination || "";
  const flightLabel = flight
    ? [(flight.carrier || ""), (flight.flight_number || "")].filter(Boolean).join(" ") || `${dep} → ${arr}`
    : "";
  const tripTitle = flight?.tripTitle || "your trip";

  const target = pred ? pred.risk : status === "offline" ? 78 : 0;
  const risk = useCountUp(target, pred != null || status === "offline");

  const statusText = {
    loading: "Analyzing live conditions…",
    live: "● Live conditions",
    modeled: "● Modeled — no live feed right now",
    offline: "Offline — showing a sample",
  }[status];

  const detail = pred
    ? `${pred.summary} ` + pred.factors.filter((f) => f.detail && f.impact !== "Low").map((f) => f.detail).join("; ")
    : `Conditions at ${dep} are deteriorating. Based on radar, ATC flow, and current cancellations, your ${dep} → ${arr} flight is at risk.`;

  const heroEmoji = risk >= 70 ? "⛈️" : risk >= 45 ? "🌨️" : "⚠️";
  const heroTitle = risk >= 70
    ? `${tripTitle} connection is at high risk`
    : risk >= 45
      ? `${tripTitle} may be disrupted`
      : `Heads up on ${tripTitle}`;

  // Downstream value at risk from rescue engine
  const downstreamValue = rescueData?.downstream_value_at_risk || 0;
  const downstreamLegs  = rescueData?.downstream_legs || 0;

  // Confirm summary
  const confirmSummary = selectedOption
    ? selectedOption.type === "points"
      ? `Approve: redeem ${formatPoints(selectedOption.cost_points)} · book ${selectedOption.flight} ${dep}→${arr} · cancel ${flightLabel}`
      : `Approve: rebook ${selectedOption.flight} ${dep}→${arr} · ${selectedOption.cost_usd === 0 ? "no charge" : formatMoney(selectedOption.cost_usd)} · cancel ${flightLabel}`
    : `Confirm: book alternative · cancel ${flightLabel} · update hotel`;

  // ── Downstream notification handler ──────────────────────────────────────
  const handleNotify = async (leg, delayMins) => {
    if (!tripId) return;
    setNotifySending(prev => ({ ...prev, [leg.id]: true }));
    try {
      const isHotel = leg.type === "hotel" || leg.type === "accommodation";
      const fn = isHotel ? notifyHotel : notifyRestaurant;
      const result = await fn(tripId, leg.id, delayMins || paramDelay, null);
      setNotifyDone(prev => ({ ...prev, [leg.id]: result?.message_drafted || "Notification sent." }));
    } catch (e) {
      setNotifyDone(prev => ({ ...prev, [leg.id]: "Could not send — copy the message from Concierge." }));
    } finally {
      setNotifySending(prev => ({ ...prev, [leg.id]: false }));
    }
  };

  const handleAccept = async () => {
    if (!selectedOption) return;
    setAccepting(true);
    try {
      const tid = tripId;
      if (tid) {
        await acceptRescue(tid, {
          option_id: selectedOption.id,
          disrupted_leg_id: paramLegId || flight?.id,
          value_saved: selectedOption.downstream_value_protected || 0,
        });
      }
      success();
      navigation.navigate("Exec", {
        title: "Fixing your trip",
        steps: buildRescueSteps(dep, arr, flightLabel, selectedOption.label),
        doneRoute: "Done",
        doneParams: {
          option: selectedOption,
          dep,
          arr,
          flightLabel,
          valueSaved: selectedOption.downstream_value_protected || 0,
          currency: selectedOption.currency || "USD",
        },
      });
    } catch (e) {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    try {
      const tid = tripId;
      if (tid) {
        await rejectRescue(tid, {
          disrupted_leg_id: paramLegId || flight?.id,
          reason: "user_declined",
        });
      }
    } catch (_) {}
    navigation.goBack();
  };

  // ── Empty state: no upcoming flights ──────────────────────────────────────
  if (noTrips) {
    return (
      <SafeAreaView style={s.app}>
        <ScrollView contentContainerStyle={g.scroll}>
          <BackBar nav={navigation} label="Alerts" />
          <View style={s.emptyWrap}>
            <View style={s.emptyIcon}>
              <Text style={{ color: C.gold, fontSize: 22 }}>✈</Text>
            </View>
            <Text style={s.emptyH}>No upcoming flights</Text>
            <Text style={s.emptyBody}>
              Add a trip with at least one flight leg and Wingman will monitor it for delays, cancellations, and gate changes — and surface rescue options here if anything goes wrong.
            </Text>
            <Btn
              title="+ Add a trip"
              kind="primary"
              onPress={() => navigation.navigate("AddTrip")}
              style={{ marginTop: 24, alignSelf: "stretch" }}
            />
            <Btn
              title="Import from email"
              kind="ghost"
              onPress={() => navigation.navigate("Connections")}
              style={{ marginTop: 10, alignSelf: "stretch" }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Disruption · live" />

        {/* ── Hero — deck style: plain bg, serif headline ───────────────────────────────────── */}
        <View style={s.heroCard}>
          <View style={s.heroDisruptBadge}>
            <Text style={s.heroDisruptIc}>⚠️</Text>
            <Text style={s.heroDisruptLabel}>DISRUPTION DETECTED</Text>
          </View>
          <SerifText style={s.heroH}>{heroTitle}</SerifText>
          <Text style={s.heroRoute}>{dep} → {arr}</Text>
          <Text style={s.heroRouteSub}>{flightLabel}</Text>
          <Text style={s.heroP}>{detail}</Text>
          <View style={[g.rowBetween, { marginTop: 14 }]}>
            <Text style={[s.riskLbl, status === "live" && { color: C.teal }]}>{statusText}</Text>
          </View>
          {downstreamValue > 0 && (
            <View style={s.downstreamBanner}>
              <Text style={s.downstreamText}>
                ⚡ {formatMoney(downstreamValue)} in downstream {downstreamLegs === 1 ? "leg" : "legs"} at risk
              </Text>
            </View>
          )}
        </View>

        <Text
          style={s.whyLink}
          onPress={() => navigation.navigate("Reason", { prediction: pred })}
        >
          🧠  Why I think this →
        </Text>

        {/* ── Rescue decision engine ──────────────────────────────────────── */}
        <Text style={g.sectionT}>WINGMAN RESCUE OPTIONS</Text>

        {rescueLoading && (
          <View style={s.loadingRow}>
            <ActivityIndicator color={C.gold} size="small" />
            <Text style={{ color: C.mut, fontSize: 13, marginLeft: 10 }}>
              Ranking rescue options — cash vs points…
            </Text>
          </View>
        )}

        {rescueError && !rescueLoading && (
          <Text style={s.errorText}>
            Could not load rescue options — check your connection.
          </Text>
        )}

        {!rescueLoading && rescueData?.options?.length > 0 && (
          <>
            <Text style={s.rescueNote}>
              Wingman ranked these by your preferences. Tap to select — one approval handles everything.
            </Text>

            {/* Separate cash vs points */}
            {rescueData.options.filter(o => o.type === "cash").length > 0 && (
              <>
                <Text style={s.groupLabel}>CASH REBOOKING</Text>
                {rescueData.options.filter(o => o.type === "cash").map((opt, i) => (
                  <RescueRow
                    key={opt.id || i}
                    opt={opt}
                    rank={opt.wingman_rank}
                    selected={selectedOption?.id === opt.id}
                    onSelect={() => setSelectedOption(opt)}
                  />
                ))}
              </>
            )}

            {rescueData.options.filter(o => o.type === "points").length > 0 && (
              <>
                <Text style={s.groupLabel}>REDEEM POINTS</Text>
                <Text style={s.pointsNote}>
                  Wingman will transfer your points and book the seat — one tap, no hold music.
                </Text>
                {rescueData.options.filter(o => o.type === "points").map((opt, i) => (
                  <RescueRow
                    key={opt.id || i}
                    opt={opt}
                    rank={opt.wingman_rank}
                    selected={selectedOption?.id === opt.id}
                    onSelect={() => setSelectedOption(opt)}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* Fallback when no rescue data yet (no tripId/legId) */}
        {!rescueLoading && !rescueData && !rescueError && (
          <>
            <Text style={s.rescueNote}>
              Open this screen from an active trip alert to see ranked rescue options.
            </Text>
            {[
              { id: "car", type: "cash", label: "Private car to destination", carrier: "Ground", flight: "Direct", cabin: "private", cost_usd: 420, cost_note: "Covered by your travel policy", downstream_protection: true, downstream_value_protected: 0, wingman_rank: 1, recommended: true },
              { id: "rebook", type: "cash", label: "Next available flight", carrier: "AA", flight: "AA1234", cabin: "economy", cost_usd: 0, cost_note: "Free rebooking — carrier owes you", downstream_protection: false, downstream_value_protected: 0, wingman_rank: 2, recommended: false },
              { id: "tomorrow", type: "cash", label: "Next day — direct flight", carrier: "UA", flight: "UA5821", cabin: "economy", cost_usd: 0, cost_note: "Free rebooking on next day flight", downstream_protection: false, downstream_value_protected: 0, wingman_rank: 3, recommended: false },
            ].map((opt, i) => (
              <RescueRow
                key={opt.id}
                opt={opt}
                rank={opt.wingman_rank}
                selected={selectedOption?.id === opt.id}
                onSelect={() => setSelectedOption(opt)}
              />
            ))}
          </>
        )}

        {/* ── Also Affected — downstream notification buttons ───────────────────────── */}
        {rescueData?.downstream_legs_detail?.length > 0 && (
          <>
            <Text style={g.sectionT}>ALSO AFFECTED</Text>
            <Text style={s.rescueNote}>
              Wingman will draft and send a notification to each affected reservation on your behalf.
            </Text>
            {rescueData.downstream_legs_detail.map((leg) => {
              const isDone = !!notifyDone[leg.id];
              const isSending = !!notifySending[leg.id];
              const legLabel = leg.type === "hotel" || leg.type === "accommodation"
                ? "Hotel"
                : leg.type === "restaurant" || leg.type === "dining"
                  ? "Restaurant"
                  : "Reservation";
              const legName = leg.name || leg.destination || legLabel;
              const legTime = leg.departs_at
                ? new Date(leg.departs_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                : null;
              return (
                <View key={leg.id} style={s.notifyCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.notifyCardLabel}>{legLabel.toUpperCase()}</Text>
                    <Text style={s.notifyCardName}>{legName}</Text>
                    {legTime && <Text style={s.notifyCardMeta}>Check-in / arrival: {legTime}</Text>}
                    {isDone && (
                      <Text style={s.notifyCardDraft} numberOfLines={3}>
                        {notifyDone[leg.id]}
                      </Text>
                    )}
                  </View>
                  <Pressable
                    style={[s.notifyBtn, isDone && s.notifyBtnDone]}
                    onPress={() => !isDone && handleNotify(leg, paramDelay)}
                    disabled={isSending || isDone}
                  >
                    <Text style={[s.notifyBtnText, isDone && { color: C.gold }]}>
                      {isSending ? "Sending…" : isDone ? "Notified ✓" : "Notify"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        {/* ── Confirm strip ───────────────────────────────────────────────── */}
        <View style={s.sticky}>
          {selectedOption && (
            <View style={s.selectedSummary}>
              <Text style={s.selectedSummaryLabel}>SELECTED</Text>
              <Text style={s.selectedSummaryText}>{selectedOption.label}</Text>
              {selectedOption.downstream_protection && selectedOption.downstream_value_protected > 0 && (
                <Text style={s.selectedSummaryProtect}>
                  ✓ Protects {formatMoney(selectedOption.downstream_value_protected)} downstream
                </Text>
              )}
            </View>
          )}
          {/* Cash rebooking button — DECK: dark card bg, white text, gold $ icon */}
          <Pressable
            style={[s.approveBtn, s.approveBtnCash]}
            onPress={handleAccept}
            disabled={accepting}
          >
            <View style={s.approveBtnInner}>
              <View style={[s.approveBtnIcon, s.approveBtnIconCash]}>
                <Text style={{ fontSize: 15, color: C.gold, fontFamily: T.sansB }}>$</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.approveBtnT, { color: C.ink }]}>
                  {accepting ? "Handling it…" : "Approve Rebooking"}
                </Text>
                {selectedOption?.cost_usd != null && (
                  <Text style={[s.approveBtnS, { color: C.mut }]}>
                    {selectedOption.cost_usd === 0 ? "No charge" : `(+${formatMoney(selectedOption.cost_usd)})`}
                  </Text>
                )}
              </View>
              <Text style={[s.approveBtnChev, { color: C.mut }]}>›</Text>
            </View>
          </Pressable>

          {/* Points rebooking button — DECK: parchment bg, dark ink text, P icon */}
          <Pressable
            style={[s.approveBtn, s.approveBtnPoints]}
            onPress={handleAccept}
            disabled={accepting}
          >
            <View style={s.approveBtnInner}>
              <View style={[s.approveBtnIcon, s.approveBtnIconPoints]}>
                <Text style={{ fontSize: 13, color: C.inkD, fontFamily: T.sansB }}>P</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.approveBtnT, { color: C.inkD }]}>Approve Rebooking</Text>
                <Text style={[s.approveBtnS, { color: C.mutD }]}>
                  {selectedOption?.points_cost
                    ? `(${formatPoints(selectedOption.points_cost)})`
                    : "(Redeem points)"}
                </Text>
              </View>
              <Text style={[s.approveBtnChev, { color: C.mutD }]}>›</Text>
            </View>
          </Pressable>

          {/* Footer — DECK: shield + "You're in control. We'll act when you say go." */}
          <View style={s.controlFooter}>
            <Text style={s.controlFooterIc}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.controlFooterT}>You're in control.</Text>
              <Text style={s.controlFooterS}>We'll act when you say go.</Text>
            </View>
          </View>

          <Pressable onPress={handleDecline} style={s.declineBtn}>
            <Text style={s.declineText}>Decline — I'll handle it myself</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  // Hero — exact deck disruption card
  // Hero — deck style: plain bg, no red card
  heroCard: { borderRadius: 0, paddingVertical: 20, paddingHorizontal: 0, borderWidth: 0, backgroundColor: "transparent", marginBottom: 8 },
  heroDisruptBadge: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  heroDisruptIc: { fontSize: 14 },
  heroDisruptLabel: { color: C.coral, fontSize: 11, fontFamily: T.sansB, letterSpacing: 3.5 },
  heroH: { color: C.ink, fontSize: 30, fontFamily: T.serif, marginBottom: 10, letterSpacing: -0.5, lineHeight: 38 },
  heroRoute: { color: C.mut, fontSize: 15, fontFamily: T.sansM, marginBottom: 4, letterSpacing: 0.5 },
  heroRouteSub: { color: C.mut, fontSize: 13, fontFamily: T.sans, marginBottom: 12, opacity: 0.7 },
  heroP: { color: C.ink, fontSize: 14, lineHeight: 22, opacity: 0.75 },
  riskBar: { height: 6, borderRadius: 99, backgroundColor: "rgba(255,77,109,0.15)", marginTop: 16, overflow: "hidden" },
  riskFill: { height: "100%", borderRadius: 99, backgroundColor: C.coral },
  riskLbl: { color: C.mut, fontSize: 12, marginTop: 8, fontFamily: T.sans },
  // Approve buttons — exact deck spec
  approveBtn:      { borderRadius: 14, marginBottom: 10, overflow: "hidden" },
  approveBtnCash:  { backgroundColor: C.card2, borderWidth: 1, borderColor: "rgba(201,169,110,0.25)" },
  approveBtnPoints:{ backgroundColor: C.parch, borderWidth: 0 },
  approveBtnInner: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18 },
  approveBtnIcon:  { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  approveBtnIconCash:   { backgroundColor: "rgba(201,169,110,0.12)", borderWidth: 1, borderColor: "rgba(201,169,110,0.3)" },
  approveBtnIconPoints: { backgroundColor: "rgba(0,0,0,0.10)", borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  approveBtnT:     { fontSize: 15, fontFamily: T.sansB },
  approveBtnS:     { fontSize: 13, fontFamily: T.sans, marginTop: 2 },
  approveBtnChev:  { fontSize: 20, fontFamily: T.sans },
  // Control footer — deck: shield icon + "You're in control. We'll act when you say go."
  controlFooter:   { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, paddingHorizontal: 4, marginTop: 4, borderTopWidth: 0.5, borderTopColor: C.line },
  controlFooterIc: { fontSize: 18, opacity: 0.6 },
  controlFooterT:  { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  controlFooterS:  { color: C.mut, fontSize: 13, fontFamily: T.sans, marginTop: 1 },
  whyLink: { color: C.gold, fontSize: 14, fontFamily: T.sansM, textAlign: "center", marginVertical: 16 },
  downstreamBanner: {
    marginTop: 14, backgroundColor: "rgba(255,140,0,0.1)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(255,140,0,0.25)", paddingHorizontal: 12, paddingVertical: 8,
  },
  downstreamText: { color: "#FF8C00", fontSize: 13, fontFamily: T.sansB },

  // Risk badge
  riskBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  riskBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },

  // Rescue rows — exact deck option card spec
  rescueNote: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 12, fontFamily: T.sans },
  groupLabel: { color: C.gold, fontSize: 10, fontFamily: T.sansB, letterSpacing: 3, marginBottom: 8, marginTop: 4 },
  pointsNote: { color: C.mut, fontSize: 12, lineHeight: 18, marginBottom: 10, fontFamily: T.sans },
  loadingRow: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, marginBottom: 10 },
  errorText: { color: C.mut, fontSize: 13, textAlign: "center", marginBottom: 10 },

  rescueRow: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line,
    padding: 16, marginBottom: 10,
  },
  wingmanPick: {
    alignSelf: "flex-start", borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 3, marginBottom: 8,
  },
  rescueLabel: { color: C.ink, fontSize: 13, fontFamily: T.sansM, marginBottom: 2 },
  rescueMeta: { color: C.mut, fontSize: 12, marginTop: 1 },
  rescuePrice: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  cabinBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  selectedBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },

  // Confirm strip
  sticky: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 16 },
  selectedSummary: {
    backgroundColor: "rgba(201,169,110,0.08)", borderRadius: 12, borderWidth: 1,
    borderColor: "rgba(201,169,110,0.2)", padding: 12, marginBottom: 12,
  },
  selectedSummaryLabel: { color: C.gold, fontSize: 9, fontWeight: "800", letterSpacing: 1.2, marginBottom: 2 },
  selectedSummaryText: { color: C.ink, fontSize: 14, fontFamily: T.sansB },
  selectedSummaryProtect: { color: "#64C88C", fontSize: 12, marginTop: 4 },
  sum: { color: C.mut, fontSize: 13, textAlign: "center", marginBottom: 12, lineHeight: 19 },
  declineBtn: { marginTop: 10, paddingVertical: 12, alignItems: "center" },
  declineText: { color: C.mut, fontSize: 13, fontFamily: T.sansM },

  // Downstream notify cards
  notifyCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line,
    padding: 14, marginBottom: 10,
  },
  notifyCardLabel: { color: C.gold, fontSize: 9, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 2 },
  notifyCardName: { color: C.ink, fontSize: 14, fontFamily: T.sansB },
  notifyCardMeta: { color: C.mut, fontSize: 12, marginTop: 2 },
  notifyCardDraft: { color: C.mut, fontSize: 11, lineHeight: 16, marginTop: 6, fontStyle: "italic" },
  notifyBtn: {
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(201,169,110,0.4)",
    backgroundColor: "rgba(201,169,110,0.08)",
    paddingHorizontal: 14, paddingVertical: 8,
  },
  notifyBtnDone: { borderColor: "rgba(100,200,140,0.4)", backgroundColor: "rgba(100,200,140,0.08)" },
  notifyBtnText: { color: C.gold, fontSize: 13, fontFamily: T.sansB },

  // Empty state
  emptyWrap: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: C.gold + "12", borderWidth: 1, borderColor: C.gold + "30",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  emptyH: { color: C.ink, fontSize: 20, fontFamily: T.sansB, textAlign: "center", marginBottom: 10 },
  emptyBody: { color: C.mut, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
