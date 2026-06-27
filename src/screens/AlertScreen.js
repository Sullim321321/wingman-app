import React, { useState, useEffect } from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";
import { Btn, Opt, BackBar, useCountUp, success, g } from "../components";
import { getPrediction, getTrips } from "../api";

// Build rescue steps from the actual flight context
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

// Find the user's next upcoming flight leg across all trips
function findNextFlight(trips) {
  const now = Date.now();
  let best = null;
  let bestTime = Infinity;
  for (const trip of trips) {
    for (const leg of (trip.legs || [])) {
      if (leg.type !== "flight") continue;
      if (!leg.departs_at) continue;
      const t = new Date(leg.departs_at).getTime();
      if (t > now && t < bestTime) {
        bestTime = t;
        best = { ...leg, tripTitle: trip.title };
      }
    }
  }
  return best;
}

export default function AlertScreen({ navigation, route }) {
  // Accept a pre-loaded flight from params (e.g. from Activity feed tap)
  const paramFlight = route?.params?.flight || null;

  const [pred, setPred] = useState(null);
  const [status, setStatus] = useState("loading");
  const [flight, setFlight] = useState(paramFlight);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      // If no flight passed in, find the user's next upcoming flight
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

  // Dynamic emoji based on risk level
  const heroEmoji = risk >= 70 ? "⛈️" : risk >= 45 ? "🌨️" : "⚠️";
  const heroTitle = risk >= 70
    ? `${tripTitle} connection is at high risk`
    : risk >= 45
      ? `${tripTitle} may be disrupted`
      : `Heads up on ${tripTitle}`;

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Disruption · live" />

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

        <Text style={g.sectionT}>PICK A BACKUP — I'LL HANDLE THE REST</Text>

        <Opt
          sel
          title="🚙 Private car to destination"
          badge="Recommended"
          sub={`Skip the airport gamble. Arrives before check-in with zero disruption risk.`}
          meta={["0% risk", "$420 · covered", "Confirmed"]}
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

        <View style={s.sticky}>
          <Text style={s.sum}>Confirm: book alternative · cancel {flightLabel} · update hotel</Text>
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
  sticky: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 16 },
  sum: { color: C.mut, fontSize: 13, textAlign: "center", marginBottom: 12, lineHeight: 19 },
});
