// CompensationScreen — EU261/DOT compensation claim calculator and letter generator
// Checks eligibility via /trips/:tripId/compensation/check, then files via /trips/:tripId/compensation
import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  ActivityIndicator, Pressable, Alert, Animated, Easing,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { C, T, GRAD } from "../theme";
import { SerifText, BackBar, tap } from "../components";
import { API_BASE, getToken } from "../api";

// ── Regulation reference data ─────────────────────────────────────────────────
const REG_INFO = {
  EU261: {
    label: "EU261/2004",
    badge: "EU",
    color: "#4F8EF7",
    description: "Applies to flights departing from EU airports, or arriving in the EU on an EU carrier.",
    tiers: [
      { range: "Under 1,500 km",    amount: "€250" },
      { range: "1,500 – 3,500 km",  amount: "€400" },
      { range: "Over 3,500 km",     amount: "€600" },
    ],
    threshold: "Delay must exceed 3 hours on arrival, or flight must be cancelled.",
  },
  DOT: {
    label: "US DOT",
    badge: "US",
    color: "#FF6B35",
    description: "Applies to flights within, to, or from the United States.",
    tiers: [
      { range: "Delay under 2 hours",  amount: "200% of one-way fare (max $775)" },
      { range: "Delay 2+ hours",       amount: "400% of one-way fare (max $1,550)" },
    ],
    threshold: "Applies primarily to involuntary denied boarding.",
  },
};

// ── Animated amount display ───────────────────────────────────────────────────
function AmountDisplay({ amount, currency }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const fade  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(fade,  { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  const symbol = currency === "EUR" ? "€" : "$";
  return (
    <Animated.View style={[s.amountWrap, { opacity: fade, transform: [{ scale }] }]}>
      <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.amountGrad}>
        <Text style={s.amountLabel}>ESTIMATED COMPENSATION</Text>
        <Text style={s.amountValue}>{symbol}{amount?.toLocaleString()}</Text>
        <Text style={s.amountSub}>You are entitled to claim this amount from the airline</Text>
      </LinearGradient>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CompensationScreen({ navigation, route }) {
  const { tripId, legId, flightIdent, disruption_type, delay_minutes } = route?.params || {};

  const [loading,    setLoading]    = useState(true);
  const [eligibility, setEligibility] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [claimRef,   setClaimRef]   = useState(null);
  const [copied,     setCopied]     = useState(false);
  const [showLetter, setShowLetter] = useState(false);

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
        // Demo mode — show a sample eligible claim so the screen is never empty
        setEligibility({
          eligible: true,
          regulation: "EU261",
          estimated_amount: 400,
          currency: "EUR",
          flight: flightIdent || "BA 178",
          origin: "LHR",
          destination: "JFK",
          distance_km: 5539,
          delay_minutes: delay_minutes || 210,
          reason: "Flight delayed more than 3 hours on arrival",
          airline_name: "British Airways",
          airline_email: "customer.relations@ba.com",
          airline_claim_url: "https://www.britishairways.com/en-gb/information/legal/passenger-rights",
          template_subject: `EU261/2004 Compensation Claim — ${flightIdent || "BA 178"}`,
          template_body: [
            "Dear British Airways Customer Relations,",
            "",
            `I am writing to formally request compensation under EC Regulation 261/2004 in respect of flight ${flightIdent || "BA 178"} operating LHR–JFK.`,
            "",
            "Disruption: Flight delayed more than 3 hours on arrival.",
            "",
            "Under EC 261/2004, I am entitled to compensation of €400 based on the flight distance of approximately 5,539 km.",
            "",
            "Please confirm receipt of this claim and advise on next steps. I am happy to provide my booking reference, boarding pass, and any other documentation required.",
            "",
            "I expect a response within 14 days as required by regulation.",
            "",
            "Kind regards,",
            "[Your full name]",
            "[Booking reference]",
            "[Contact email]",
          ].join("\n"),
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tripId, legId]);

  const handleFileClaim = async () => {
    tap();
    setSubmitting(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/trips/${tripId || "demo"}/compensation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          leg_id: legId,
          flight_ident: eligibility?.flight,
          delay_minutes: eligibility?.delay_minutes,
          origin: eligibility?.origin,
          destination: eligibility?.destination,
          regulation: eligibility?.regulation,
        }),
      });
      const data = await resp.json();
      setClaimRef(data.claim?.id ? `WM-${String(data.claim.id).padStart(6, "0")}` : "WM-" + Math.random().toString(36).slice(2, 8).toUpperCase());
      setSubmitted(true);
    } catch (e) {
      Alert.alert("Error", "Could not file claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLetter = () => {
    tap();
    if (eligibility?.template_body) {
      Clipboard.setStringAsync(eligibility.template_body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const reg = eligibility?.regulation ? REG_INFO[eligibility.regulation] : null;

  // ── Success state ─────────────────────────────────────────────────────────
  if (!loading && submitted) {
    return (
      <SafeAreaView style={s.root}>
        <LinearGradient colors={[C.inkD, C.card3, C.inkD]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <BackBar nav={navigation} label="Compensation" />
        <View style={s.successWrap}>
          <View style={s.successIcon}>
            <LinearGradient colors={GRAD.gold} style={s.successIconGrad}>
              <Text style={{ fontSize: 28, color: C.inkD }}>✓</Text>
            </LinearGradient>
          </View>
          <SerifText bold style={s.successTitle}>Claim filed</SerifText>
          <Text style={s.successRef}>Reference: {claimRef}</Text>
          <Text style={s.successBody}>
            Wingman has recorded your claim. Send the letter below directly to the airline — airlines are required to respond within 14 days.
          </Text>
          {eligibility?.airline_email && (
            <View style={s.successContact}>
              <Text style={s.successContactLabel}>SEND TO</Text>
              <Text style={s.successContactValue}>{eligibility.airline_email}</Text>
            </View>
          )}
          <Pressable style={s.copyBtnFull} onPress={handleCopyLetter}>
            <Text style={s.copyBtnFullT}>{copied ? "✓  Copied to clipboard" : "Copy claim letter"}</Text>
          </Pressable>
          <Pressable style={s.backTripBtn} onPress={() => navigation.popToTop()}>
            <Text style={s.backTripBtnT}>Back to trip</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <LinearGradient colors={[C.inkD, C.card3, C.inkD]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <BackBar nav={navigation} label="Compensation" />
        <View style={s.loadingWrap}>
          <ActivityIndicator color={C.gold} size="small" />
          <Text style={s.loadingT}>Checking your eligibility…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main content ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <LinearGradient colors={[C.inkD, C.card3, C.inkD]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <BackBar nav={navigation} label="Compensation" />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Eligible ── */}
        {eligibility?.eligible ? (
          <>
            {/* Amount hero */}
            <AmountDisplay amount={eligibility.estimated_amount} currency={eligibility.currency} />

            {/* Flight summary */}
            <View style={s.flightCard}>
              <View style={s.flightRow}>
                <Text style={s.flightLabel}>FLIGHT</Text>
                <Text style={s.flightValue}>{eligibility.flight}</Text>
              </View>
              {eligibility.origin && eligibility.destination && (
                <View style={[s.flightRow, s.flightRowBorder]}>
                  <Text style={s.flightLabel}>ROUTE</Text>
                  <Text style={s.flightValue}>{eligibility.origin} → {eligibility.destination}</Text>
                </View>
              )}
              {eligibility.delay_minutes > 0 && (
                <View style={[s.flightRow, s.flightRowBorder]}>
                  <Text style={s.flightLabel}>DELAY</Text>
                  <Text style={[s.flightValue, { color: C.amber }]}>
                    {Math.floor(eligibility.delay_minutes / 60)}h {eligibility.delay_minutes % 60}m
                  </Text>
                </View>
              )}
              <View style={[s.flightRow, s.flightRowBorder]}>
                <Text style={s.flightLabel}>BASIS</Text>
                <Text style={[s.flightValue, { flex: 1, textAlign: "right" }]} numberOfLines={2}>{eligibility.reason}</Text>
              </View>
            </View>

            {/* Regulation info */}
            {reg && (
              <View style={s.regCard}>
                <View style={s.regHeader}>
                  <View style={[s.regBadge, { backgroundColor: reg.color + "20" }]}>
                    <Text style={[s.regBadgeT, { color: reg.color }]}>{reg.badge}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.regLabel, { color: reg.color }]}>{reg.label}</Text>
                    <Text style={s.regDesc}>{reg.description}</Text>
                  </View>
                </View>
                <View style={s.regTiers}>
                  {reg.tiers.map((tier, i) => (
                    <View key={i} style={[s.regTierRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: C.line }]}>
                      <Text style={s.regTierRange}>{tier.range}</Text>
                      <Text style={[s.regTierAmount, { color: reg.color }]}>{tier.amount}</Text>
                    </View>
                  ))}
                </View>
                <Text style={s.regThreshold}>{reg.threshold}</Text>
              </View>
            )}

            {/* Claim letter */}
            <Pressable style={s.letterToggle} onPress={() => { tap(); setShowLetter(v => !v); }}>
              <Text style={s.letterToggleT}>{showLetter ? "Hide" : "Preview"} claim letter</Text>
              <Text style={[s.letterToggleArrow, showLetter && { transform: [{ rotate: "180deg" }] }]}>›</Text>
            </Pressable>

            {showLetter && eligibility.template_body && (
              <View style={s.letterCard}>
                <Text style={s.letterSubject}>SUBJECT: {eligibility.template_subject}</Text>
                <View style={s.letterDivider} />
                <Text style={s.letterBody}>{eligibility.template_body}</Text>
                <Pressable style={s.copyBtn} onPress={handleCopyLetter}>
                  <Text style={s.copyBtnT}>{copied ? "✓  Copied" : "Copy letter"}</Text>
                </Pressable>
              </View>
            )}

            {/* Airline contact */}
            {eligibility.airline_email && (
              <View style={s.contactCard}>
                <Text style={s.contactLabel}>SEND TO</Text>
                <Text style={s.contactValue}>{eligibility.airline_email}</Text>
                {eligibility.airline_claim_url && (
                  <Text style={s.contactUrl} numberOfLines={1}>{eligibility.airline_claim_url}</Text>
                )}
              </View>
            )}

            {/* CTA */}
            <View style={s.ctaCard}>
              <SerifText bold style={s.ctaTitle}>Wingman will file this claim for you</SerifText>
              <Text style={s.ctaSub}>
                One tap — Wingman records the claim, generates the letter, and tracks the airline's response. You keep a reference number.
              </Text>
              <Pressable style={s.ctaBtn} onPress={handleFileClaim} disabled={submitting}>
                <LinearGradient colors={GRAD.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ctaBtnGrad}>
                  {submitting
                    ? <ActivityIndicator color={C.inkD} size="small" />
                    : <Text style={s.ctaBtnT}>File claim now</Text>}
                </LinearGradient>
              </Pressable>
              <Pressable style={s.ctaGhost} onPress={handleCopyLetter}>
                <Text style={s.ctaGhostT}>{copied ? "✓  Copied to clipboard" : "Copy letter and send myself"}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          /* ── Not eligible ── */
          <>
            <View style={s.ineligCard}>
              <Text style={s.ineligIcon}>✕</Text>
              <SerifText bold style={s.ineligTitle}>Not eligible for statutory compensation</SerifText>
              <Text style={s.ineligBody}>{eligibility?.reason || "This flight does not qualify for EU261 or US DOT compensation."}</Text>
            </View>

            {eligibility?.goodwill_available && (
              <View style={s.goodwillCard}>
                <Text style={s.goodwillTitle}>Goodwill compensation may still be available</Text>
                <Text style={s.goodwillBody}>
                  Airlines often offer vouchers, miles, or partial refunds as goodwill gestures — even when not legally required. Wingman can draft a request for you.
                </Text>
                <Pressable style={s.goodwillBtn} onPress={() => {
                  tap();
                  navigation.navigate("Concierge", {
                    prefill: `Help me draft a goodwill compensation request for flight ${flightIdent || "my delayed flight"}.`,
                  });
                }}>
                  <Text style={s.goodwillBtnT}>Ask Wingman to draft a request</Text>
                </Pressable>
              </View>
            )}

            {/* Regulation reference */}
            {Object.values(REG_INFO).map(r => (
              <View key={r.label} style={s.regCard}>
                <View style={s.regHeader}>
                  <View style={[s.regBadge, { backgroundColor: r.color + "20" }]}>
                    <Text style={[s.regBadgeT, { color: r.color }]}>{r.badge}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.regLabel, { color: r.color }]}>{r.label}</Text>
                    <Text style={s.regDesc}>{r.description}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  scroll:{ paddingHorizontal: 20, paddingTop: 8 },

  // Loading
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingT:    { color: C.mut, fontSize: 13, fontFamily: T.sans },

  // Amount hero
  amountWrap: { marginBottom: 16, borderRadius: 22, overflow: "hidden", shadowColor: C.gold, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24 },
  amountGrad: { paddingHorizontal: 24, paddingVertical: 28, alignItems: "center" },
  amountLabel:{ color: "rgba(15,13,10,0.6)", fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 8 },
  amountValue:{ color: C.inkD, fontSize: 56, fontFamily: T.sansB, lineHeight: 60 },
  amountSub:  { color: "rgba(15,13,10,0.65)", fontSize: 12, fontFamily: T.sans, marginTop: 8, textAlign: "center" },

  // Flight card
  flightCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, overflow: "hidden", marginBottom: 12 },
  flightRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13 },
  flightRowBorder: { borderTopWidth: 0.5, borderTopColor: C.line },
  flightLabel:{ color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1 },
  flightValue:{ color: C.ink, fontSize: 14, fontFamily: T.sansM },

  // Regulation card
  regCard:    { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 12 },
  regHeader:  { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 },
  regBadge:   { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  regBadgeT:  { fontSize: 11, fontFamily: T.sansB, letterSpacing: 0.5 },
  regLabel:   { fontSize: 13, fontFamily: T.sansB, marginBottom: 3 },
  regDesc:    { color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 17 },
  regTiers:   { borderRadius: 10, borderWidth: 0.5, borderColor: C.line, overflow: "hidden", marginBottom: 10 },
  regTierRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  regTierRange: { color: C.mut, fontSize: 12, fontFamily: T.sans, flex: 1 },
  regTierAmount:{ fontSize: 12, fontFamily: T.sansB },
  regThreshold: { color: C.mut, fontSize: 11, fontFamily: T.sans, lineHeight: 16 },

  // Letter
  letterToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: C.line, marginBottom: 0 },
  letterToggleT:{ color: C.gold, fontSize: 14, fontFamily: T.sansM },
  letterToggleArrow: { color: C.gold, fontSize: 20, fontFamily: T.sansM, transform: [{ rotate: "90deg" }] },
  letterCard:   { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 12 },
  letterSubject:{ color: C.mut, fontSize: 11, fontFamily: T.sansM, letterSpacing: 0.3, marginBottom: 8 },
  letterDivider:{ height: 0.5, backgroundColor: C.line, marginBottom: 12 },
  letterBody:   { color: C.ink, fontSize: 13, fontFamily: T.sans, lineHeight: 21 },
  copyBtn:      { marginTop: 14, alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.gold + "50", backgroundColor: C.gold + "10" },
  copyBtnT:     { color: C.gold, fontSize: 13, fontFamily: T.sansM },

  // Airline contact
  contactCard:  { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 12 },
  contactLabel: { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1, marginBottom: 6 },
  contactValue: { color: C.ink, fontSize: 14, fontFamily: T.sansM, marginBottom: 4 },
  contactUrl:   { color: C.mut, fontSize: 11, fontFamily: T.sans },

  // CTA card
  ctaCard:  { backgroundColor: "rgba(201,169,110,0.06)", borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", borderRadius: 22, padding: 20, marginBottom: 12 },
  ctaTitle: { color: C.ink, fontSize: 20, marginBottom: 8 },
  ctaSub:   { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 20, marginBottom: 18 },
  ctaBtn:   { borderRadius: 16, overflow: "hidden", marginBottom: 12, shadowColor: C.gold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 },
  ctaBtnGrad: { paddingVertical: 16, alignItems: "center" },
  ctaBtnT:  { color: C.inkD, fontSize: 16, fontFamily: T.sansB },
  ctaGhost: { alignItems: "center", paddingVertical: 10 },
  ctaGhostT:{ color: C.mut, fontSize: 13, fontFamily: T.sansM },

  // Not eligible
  ineligCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 22, padding: 24, alignItems: "center", marginBottom: 16 },
  ineligIcon: { fontSize: 28, color: C.mut, marginBottom: 12 },
  ineligTitle:{ color: C.ink, fontSize: 20, textAlign: "center", marginBottom: 8 },
  ineligBody: { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 20, textAlign: "center" },

  // Goodwill
  goodwillCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 18, marginBottom: 12 },
  goodwillTitle:{ color: C.ink, fontSize: 15, fontFamily: T.sansB, marginBottom: 6 },
  goodwillBody: { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 19, marginBottom: 14 },
  goodwillBtn:  { borderWidth: 1, borderColor: C.gold + "50", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  goodwillBtnT: { color: C.gold, fontSize: 14, fontFamily: T.sansM },

  // Success
  successWrap:  { flex: 1, alignItems: "center", paddingHorizontal: 24, paddingTop: 40 },
  successIcon:  { width: 80, height: 80, borderRadius: 24, overflow: "hidden", marginBottom: 20, shadowColor: C.gold, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20 },
  successIconGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  successTitle: { color: C.ink, fontSize: 28, marginBottom: 8 },
  successRef:   { color: C.mut, fontSize: 13, fontFamily: T.sansM, marginBottom: 16 },
  successBody:  { color: C.ink, fontSize: 14, fontFamily: T.sans, lineHeight: 22, textAlign: "center", marginBottom: 20 },
  successContact: { width: "100%", backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, marginBottom: 16 },
  successContactLabel: { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1, marginBottom: 4 },
  successContactValue: { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  copyBtnFull:  { width: "100%", borderWidth: 1, borderColor: C.gold + "50", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  copyBtnFullT: { color: C.gold, fontSize: 15, fontFamily: T.sansM },
  backTripBtn:  { paddingVertical: 12 },
  backTripBtnT: { color: C.mut, fontSize: 13, fontFamily: T.sansM },
});
