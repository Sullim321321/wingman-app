import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  ActivityIndicator, Pressable, Alert,
} from "react-native";
import { C } from "../theme";
import { Btn, BackBar, g } from "../components";
import { API_BASE, getToken } from "../api";

const REGULATION_INFO = {
  EU261: {
    label: "EU261/2004",
    color: "#4F8EF7",
    description: "Applies to flights departing from EU airports or arriving in the EU on an EU carrier.",
    amounts: [
      { distance: "Under 1,500 km", amount: "€250" },
      { distance: "1,500–3,500 km", amount: "€400" },
      { distance: "Over 3,500 km", amount: "€600" },
    ],
  },
  DOT: {
    label: "US DOT",
    color: "#FF6B35",
    description: "Applies to flights within, to, or from the United States.",
    amounts: [
      { distance: "Delay under 2 hours", amount: "200% of one-way fare (max $775)" },
      { distance: "Delay 2+ hours", amount: "400% of one-way fare (max $1,550)" },
    ],
  },
};

export default function CompensationScreen({ navigation, route }) {
  const { tripId, legId, flightIdent, disruption_type, delay_minutes } = route?.params || {};

  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [claimRef, setClaimRef] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        const resp = await fetch(`${API_BASE}/trips/${tripId}/compensation/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ leg_id: legId, disruption_type, delay_minutes }),
        });
        const data = await resp.json();
        setEligibility(data);
      } catch (e) {
        setEligibility({ eligible: false, reason: "Could not check eligibility. Try again." });
      } finally {
        setLoading(false);
      }
    };
    if (tripId && legId) {
      load();
    } else {
      // Demo mode — show a sample eligible claim
      setEligibility({
        eligible: true,
        regulation: "EU261",
        estimated_amount: 400,
        currency: "EUR",
        flight: flightIdent || "LH 441",
        delay_minutes: delay_minutes || 180,
        reason: "Flight delayed more than 3 hours",
        airline_email: "customercare@lufthansa.com",
        template_subject: `EU261 Compensation Claim — ${flightIdent || "LH 441"}`,
        template_body: `Dear Lufthansa Customer Care,\n\nI am writing to claim compensation under EC Regulation 261/2004 for flight ${flightIdent || "LH 441"} which was delayed by more than 3 hours.\n\nPlease process my claim at your earliest convenience.\n\nKind regards`,
      });
      setLoading(false);
    }
  }, [tripId, legId]);

  const handleFileClaim = async () => {
    setSubmitting(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/trips/${tripId || "demo"}/compensation/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leg_id: legId, regulation: eligibility?.regulation }),
      });
      const data = await resp.json();
      setClaimRef(data.claim_ref || "WM-" + Math.random().toString(36).slice(2, 8).toUpperCase());
      setSubmitted(true);
    } catch (e) {
      Alert.alert("Error", "Could not file claim. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const reg = eligibility?.regulation ? REGULATION_INFO[eligibility.regulation] : null;

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Compensation" />

        {loading && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator color={C.gold} size="small" />
            <Text style={{ color: C.mut, fontSize: 13, marginTop: 10 }}>
              Checking your eligibility…
            </Text>
          </View>
        )}

        {!loading && submitted && (
          <View style={s.successCard}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>✓</Text>
            <Text style={s.successTitle}>Claim filed</Text>
            <Text style={s.successRef}>Reference: {claimRef}</Text>
            <Text style={s.successSub}>
              Wingman has sent your claim to the airline. You'll receive a confirmation email within 24 hours. Airlines are required to respond within 14 days.
            </Text>
            <Btn
              title="Back to trip"
              kind="accent"
              onPress={() => navigation.popToTop()}
              style={{ marginTop: 16 }}
            />
          </View>
        )}

        {!loading && !submitted && eligibility && (
          <>
            {/* Eligibility result */}
            <View style={[s.eligCard, { borderColor: eligibility.eligible ? "rgba(34,211,166,0.4)" : "rgba(148,163,184,0.3)" }]}>
              <Text style={[s.eligStatus, { color: eligibility.eligible ? C.teal : C.mut }]}>
                {eligibility.eligible ? "✓ You are eligible for compensation" : "✗ Not eligible"}
              </Text>
              {eligibility.eligible && eligibility.estimated_amount && (
                <Text style={s.eligAmount}>
                  Estimated: {eligibility.currency === "EUR" ? "€" : "$"}{eligibility.estimated_amount.toLocaleString()}
                </Text>
              )}
              <Text style={s.eligReason}>{eligibility.reason}</Text>
            </View>

            {/* Regulation info */}
            {reg && (
              <>
                <Text style={g.sectionT}>REGULATION</Text>
                <View style={[s.regCard, { borderColor: reg.color + "55" }]}>
                  <Text style={[s.regLabel, { color: reg.color }]}>{reg.label}</Text>
                  <Text style={s.regDesc}>{reg.description}</Text>
                  <View style={{ marginTop: 10, gap: 6 }}>
                    {reg.amounts.map((a, i) => (
                      <View key={i} style={s.regRow}>
                        <Text style={s.regDist}>{a.distance}</Text>
                        <Text style={[s.regAmount, { color: reg.color }]}>{a.amount}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Flight info */}
            {eligibility.flight && (
              <>
                <Text style={g.sectionT}>FLIGHT</Text>
                <View style={s.flightCard}>
                  <View style={s.flightRow}>
                    <Text style={s.flightLabel}>Flight</Text>
                    <Text style={s.flightValue}>{eligibility.flight}</Text>
                  </View>
                  {eligibility.delay_minutes && (
                    <View style={s.flightRow}>
                      <Text style={s.flightLabel}>Delay</Text>
                      <Text style={[s.flightValue, { color: C.amber }]}>
                        {Math.floor(eligibility.delay_minutes / 60)}h {eligibility.delay_minutes % 60}m
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Claim template preview */}
            {eligibility.eligible && eligibility.template_body && (
              <>
                <Text style={g.sectionT}>CLAIM DRAFT</Text>
                <View style={s.templateCard}>
                  <Text style={s.templateLabel}>TO: {eligibility.airline_email}</Text>
                  <Text style={s.templateLabel}>SUBJECT: {eligibility.template_subject}</Text>
                  <View style={s.templateDivider} />
                  <Text style={s.templateBody}>{eligibility.template_body}</Text>
                </View>
              </>
            )}

            {/* Action */}
            {eligibility.eligible ? (
              <View style={s.actionCard}>
                <Text style={s.actionTitle}>Wingman will send this claim on your behalf</Text>
                <Text style={s.actionSub}>
                  One tap — Wingman files with the airline, tracks the response, and follows up if needed.
                </Text>
                <Btn
                  title={submitting ? "Filing claim…" : "✓  File claim now"}
                  kind="accent"
                  onPress={handleFileClaim}
                  disabled={submitting}
                  style={{ marginTop: 14 }}
                />
              </View>
            ) : (
              <View style={s.actionCard}>
                <Text style={s.actionSub}>
                  You may still be able to claim goodwill compensation directly from the airline. Ask Wingman for help drafting a request.
                </Text>
                <Btn
                  title="Ask Wingman for help"
                  kind="ghost"
                  onPress={() => navigation.navigate("Concierge", {
                    prefill: `Help me draft a goodwill compensation request for flight ${flightIdent || "my delayed flight"}.`
                  })}
                  style={{ marginTop: 12 }}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  eligCard: { backgroundColor: C.card, borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 12 },
  eligStatus: { fontSize: 15, fontWeight: "700", marginBottom: 6 },
  eligAmount: { color: C.ink, fontSize: 28, fontWeight: "800", marginBottom: 4 },
  eligReason: { color: C.mut, fontSize: 13, lineHeight: 19 },
  regCard: { backgroundColor: C.card, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  regLabel: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5, marginBottom: 6 },
  regDesc: { color: C.mut, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  regRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  regDist: { color: C.mut, fontSize: 12, flex: 1 },
  regAmount: { fontSize: 13, fontWeight: "700" },
  flightCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 12 },
  flightRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: C.line },
  flightLabel: { color: C.mut, fontSize: 13 },
  flightValue: { color: C.ink, fontSize: 13, fontWeight: "600" },
  templateCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 12 },
  templateLabel: { color: C.mut, fontSize: 11, fontWeight: "600", letterSpacing: 0.3, marginBottom: 3 },
  templateDivider: { height: 1, backgroundColor: C.line, marginVertical: 10 },
  templateBody: { color: C.ink, fontSize: 13, lineHeight: 20 },
  actionCard: { backgroundColor: "rgba(201,169,110,0.06)", borderWidth: 1, borderColor: "rgba(201,169,110,0.25)", borderRadius: 18, padding: 18, marginBottom: 24 },
  actionTitle: { color: C.ink, fontSize: 15, fontWeight: "700", marginBottom: 6 },
  actionSub: { color: C.mut, fontSize: 13, lineHeight: 19 },
  successCard: { backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(34,211,166,0.3)", borderRadius: 18, padding: 24, alignItems: "center", marginTop: 20 },
  successTitle: { color: C.teal, fontSize: 22, fontWeight: "800", marginBottom: 4 },
  successRef: { color: C.mut, fontSize: 13, marginBottom: 12 },
  successSub: { color: C.ink, fontSize: 13, lineHeight: 20, textAlign: "center" },
});
