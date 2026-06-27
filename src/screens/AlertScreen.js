import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  Pressable, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { Btn, Opt, BackBar, useCountUp, success, g } from "../components";
import { getPrediction, getTrips, searchAwards } from "../api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRescueSteps(dep, arr, flightLabel) {
  const dest = arr || "your destination";
  const flight = flightLabel || `${dep || "your flight"} → ${arr || ""}`;
  return [
    ["Finding best alternative", `Checking rebooking options for ${flight}`],
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
      if (t > now && t < bestTime) { bestTime = t; best = { ...leg, tripTitle: trip.title }; }
    }
  }
  return best;
}

function formatMoney(n) {
  if (!n) return null;
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatPoints(n) {
  if (!n) return null;
  return Number(n).toLocaleString("en-US") + " pts";
}

// ─── Award Option Row ─────────────────────────────────────────────────────────

function AwardRow({ award, selected, onSelect }) {
  const isPoints = award.type === "points";
  const accentColor = isPoints ? C.amber : C.accent;
  const accentBg = isPoints ? "rgba(255,176,46,0.08)" : "rgba(74,114,255,0.08)";
  const accentBorder = isPoints ? "rgba(255,176,46,0.2)" : "rgba(74,114,255,0.2)";

  return (
    <Pressable
      onPress={onSelect}
      style={[s.awardRow, selected && { borderColor: accentColor, backgroundColor: accentBg }]}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Text style={{ color: accentColor, fontSize: 13, fontWeight: "700" }}>
            {isPoints ? "✦ " : "✈ "}{award.carrier || award.program || "Alternative"}
          </Text>
          {award.cabin && (
            <View style={[s.cabinBadge, { borderColor: accentBorder, backgroundColor: accentBg }]}>
              <Text style={{ color: accentColor, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>
                {award.cabin.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={s.awardRoute}>
          {award.origin} → {award.destination}
          {award.departs_at ? "  ·  " + new Date(award.departs_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
        </Text>
        {award.duration_minutes ? (
          <Text style={s.awardMeta}>{Math.floor(award.duration_minutes / 60)}h {award.duration_minutes % 60}m</Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {isPoints ? (
          <>
            <Text style={[s.awardPrice, { color: C.amber }]}>{formatPoints(award.points)}</Text>
            {award.cash_copay ? <Text style={s.awardMeta}>+ {formatMoney(award.cash_copay)} copay</Text> : null}
          </>
        ) : (
          <Text style={[s.awardPrice, { color: C.ink }]}>{formatMoney(award.cash_price)}</Text>
        )}
        {selected && (
          <View style={[s.selectedBadge, { borderColor: accentColor, backgroundColor: accentBg }]}>
            <Text style={{ color: accentColor, fontSize: 10, fontWeight: "800" }}>SELECTED</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AlertScreen({ navigation, route }) {
  const paramFlight = route?.params?.flight || null;

  const [pred, setPred] = useState(null);
  const [status, setStatus] = useState("loading");
  const [flight, setFlight] = useState(paramFlight);

  // Award search state
  const [awards, setAwards] = useState([]);
  const [awardsLoading, setAwardsLoading] = useState(false);
  const [awardsError, setAwardsError] = useState(null);
  const [selectedAward, setSelectedAward] = useState(null);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      let fl = paramFlight;
      if (!fl) {
        try {
          const data = await getTrips();
          fl = findNextFlight(data.trips || []);
          if (alive) setFlight(fl);
        } catch (_) {}
      }

      const dep = fl?.origin || "DEN";
      const arr = fl?.destination || "ASE";

      try {
        const p = await getPrediction({ dep, arr });
        if (!alive) return;
        setPred(p);
        setStatus(p.live ? "live" : "modeled");
      } catch {
        if (alive) setStatus("offline");
      }

      // Fetch award options if we have a real flight
      if (fl?.origin && fl?.destination && fl?.departs_at) {
        setAwardsLoading(true);
        try {
          const date = new Date(fl.departs_at).toISOString().split("T")[0];
          const result = await searchAwards({
            origin: fl.origin,
            destination: fl.destination,
            date,
            cabin: fl.cabin || "economy",
          });
          if (alive) {
            setAwards(result.options || []);
            if (result.options?.length > 0) setSelectedAward(result.options[0]);
          }
        } catch (e) {
          if (alive) setAwardsError(e.message);
        } finally {
          if (alive) setAwardsLoading(false);
        }
      }
    };

    run();
    return () => { alive = false; };
  }, []);

  const dep = flight?.origin || "DEN";
  const arr = flight?.destination || "ASE";
  const flightLabel = flight
    ? [(flight.carrier || ""), (flight.flight_number || "")].filter(Boolean).join(" ") || `${dep} → ${arr}`
    : "UA 5821";
  const tripTitle = flight?.tripTitle || "your trip";
  const rescueSteps = buildRescueSteps(dep, arr, flightLabel);

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

  // Separate cash vs points awards
  const cashAwards = awards.filter(a => a.type === "cash");
  const pointsAwards = awards.filter(a => a.type === "points");

  // Build confirm summary based on selected award
  const confirmSummary = selectedAward
    ? selectedAward.type === "points"
      ? `Approve: transfer ${formatPoints(selectedAward.points)} to ${selectedAward.program || selectedAward.carrier} · book ${selectedAward.carrier || ""} ${dep}→${arr} · cancel ${flightLabel}`
      : `Approve: rebook on ${selectedAward.carrier || ""} ${dep}→${arr} · ${formatMoney(selectedAward.cash_price)} · cancel ${flightLabel}`
    : `Confirm: book alternative · cancel ${flightLabel} · update hotel`;

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Disruption · live" />

        {/* ── Hero card ───────────────────────────────────────────────────── */}
        <LinearGradient colors={["#3A1B2A", "#1E0E28"]} style={s.heroCard}>
          <Text style={{ fontSize: 30 }}>{heroEmoji}</Text>
          <Text style={s.heroH}>{heroTitle}</Text>
          <Text style={s.heroRoute}>{dep} → {arr} · {flightLabel}</Text>
          <Text style={s.heroP}>{detail}</Text>
          <View style={s.riskBar}>
            <View style={[s.riskFill, { width: `${risk}%` }]} />
          </View>
          <View style={g.rowBetween}>
            <Text style={[s.riskLbl, status === "live" && { color: C.teal }]}>{statusText}</Text>
            <Text style={[s.riskLbl, { color: C.coral, fontWeight: "800", fontSize: 14 }]}>{risk}%</Text>
          </View>
        </LinearGradient>

        <Text
          style={s.whyLink}
          onPress={() => navigation.navigate("Reason", { prediction: pred })}
        >
          🧠  Why I think this →
        </Text>

        {/* ── Standard rescue options ─────────────────────────────────────── */}
        <Text style={g.sectionT}>PICK A BACKUP — I'LL HANDLE THE REST</Text>

        <Opt
          sel={!selectedAward}
          title="🚙 Private car to destination"
          badge="Recommended"
          sub={`Skip the airport gamble. Arrives before check-in with zero disruption risk.`}
          meta={["0% risk", "$420 · covered", "Confirmed"]}
          onPress={() => setSelectedAward(null)}
        />
        <Opt
          title="✈️ Rebook next available flight"
          sub={`Next flight on ${dep} → ${arr} with available seats.`}
          meta={["Same day", "No extra cost"]}
        />
        <Opt
          title="📅 Rebook tomorrow AM"
          sub={`Overnight near the airport, fly out first thing tomorrow.`}
          meta={["+1 night", "Hotel covered"]}
        />

        {/* ── Award rescue options ────────────────────────────────────────── */}
        {(awardsLoading || awards.length > 0 || awardsError) && (
          <>
            <Text style={g.sectionT}>RESCUE WITH POINTS OR CASH</Text>
            <Text style={s.awardNote}>
              Wingman found these alternatives. Tap to select, then approve below — we'll handle the transfer and booking.
            </Text>

            {awardsLoading && (
              <View style={s.awardsLoading}>
                <ActivityIndicator color={C.teal} size="small" />
                <Text style={{ color: C.mut, fontSize: 13, marginLeft: 10 }}>Searching award availability…</Text>
              </View>
            )}

            {awardsError && !awardsLoading && (
              <Text style={s.awardsError}>Could not load award options — check your connection.</Text>
            )}

            {/* Cash options */}
            {cashAwards.length > 0 && (
              <>
                <Text style={s.awardGroupLabel}>CASH REBOOKING</Text>
                {cashAwards.map((award, i) => (
                  <AwardRow
                    key={i}
                    award={award}
                    selected={selectedAward === award}
                    onSelect={() => setSelectedAward(award)}
                  />
                ))}
              </>
            )}

            {/* Points options */}
            {pointsAwards.length > 0 && (
              <>
                <Text style={s.awardGroupLabel}>REDEEM POINTS</Text>
                <Text style={s.awardPointsNote}>
                  Wingman will transfer your points and book the seat — one tap, no hold music.
                </Text>
                {pointsAwards.map((award, i) => (
                  <AwardRow
                    key={i}
                    award={award}
                    selected={selectedAward === award}
                    onSelect={() => setSelectedAward(award)}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* ── Confirm strip ───────────────────────────────────────────────── */}
        <View style={s.sticky}>
          <Text style={s.sum}>{confirmSummary}</Text>
          <Btn
            title="✓  Yes — handle it all"
            kind="accent"
            onPress={() => {
              success();
              navigation.navigate("Exec", {
                title: "Fixing your trip",
                steps: rescueSteps,
                doneRoute: "Done",
              });
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  heroCard: { borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "rgba(255,77,109,0.2)" },
  heroH: { color: C.ink, fontSize: 20, fontWeight: "700", marginTop: 10, marginBottom: 4, letterSpacing: -0.3 },
  heroRoute: { color: C.coral, fontSize: 13, fontWeight: "700", marginBottom: 8, letterSpacing: 0.3 },
  heroP: { color: "rgba(243,245,247,0.7)", fontSize: 14, lineHeight: 21 },
  riskBar: { height: 8, borderRadius: 99, backgroundColor: "rgba(255,77,109,0.15)", marginTop: 16, overflow: "hidden" },
  riskFill: { height: "100%", borderRadius: 99, backgroundColor: C.coral },
  riskLbl: { color: C.mut, fontSize: 12, marginTop: 8 },
  whyLink: { color: C.accent, fontSize: 14, fontWeight: "600", textAlign: "center", marginVertical: 16 },

  // Award options
  awardNote: { color: C.mut, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  awardGroupLabel: { color: C.mut, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },
  awardPointsNote: { color: C.mut, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  awardsLoading: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, marginBottom: 10 },
  awardsError: { color: C.mut, fontSize: 13, textAlign: "center", marginBottom: 10 },
  awardRow: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line,
    padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center",
  },
  awardRoute: { color: C.ink, fontSize: 13, fontWeight: "600", marginBottom: 2 },
  awardMeta: { color: C.mut, fontSize: 12 },
  awardPrice: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  cabinBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  selectedBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },

  // Confirm strip
  sticky: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 16 },
  sum: { color: C.mut, fontSize: 13, textAlign: "center", marginBottom: 12, lineHeight: 19 },
});
