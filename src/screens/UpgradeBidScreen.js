import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  ActivityIndicator, Pressable, Alert,
} from "react-native";
import { C } from "../theme";
import { Btn, BackBar, g } from "../components";
import { API_BASE, getToken } from "../api";

const BID_PRESETS = [500, 1000, 2500, 5000, 10000];

export default function UpgradeBidScreen({ navigation, route }) {
  const { tripId, legId, flightIdent, origin, destination, carrier } = route?.params || {};

  const [loading, setLoading] = useState(true);
  const [bidData, setBidData] = useState(null);
  const [selectedPoints, setSelectedPoints] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bidRef, setBidRef] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        const resp = await fetch(`${API_BASE}/trips/${tripId}/upgrade-bid/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ leg_id: legId }),
        });
        const data = await resp.json();
        setBidData(data);
        if (data.suggested_bid) setSelectedPoints(data.suggested_bid);
      } catch (e) {
        // Demo mode
        const demo = {
          available: true,
          flight: flightIdent || `${carrier || "AA"} 412`,
          origin: origin || "JFK",
          destination: destination || "LHR",
          current_cabin: "Economy",
          target_cabin: "Business",
          suggested_bid: 5000,
          min_bid: 2500,
          upgrade_probability: 68,
          loyalty_program: "AAdvantage",
          points_balance: 47200,
          cash_equivalent: "$350–$800",
          bid_deadline: new Date(Date.now() + 6 * 3600000).toISOString(),
        };
        setBidData(demo);
        setSelectedPoints(demo.suggested_bid);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tripId, legId]);

  const handleSubmitBid = async () => {
    if (!selectedPoints) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/trips/${tripId || "demo"}/upgrade-bid/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leg_id: legId, points_bid: selectedPoints }),
      });
      const data = await resp.json();
      setBidRef(data.bid_ref || "BID-" + Math.random().toString(36).slice(2, 8).toUpperCase());
      setSubmitted(true);
    } catch (e) {
      Alert.alert("Error", "Could not submit bid. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const hoursUntilDeadline = bidData?.bid_deadline
    ? Math.max(0, Math.round((new Date(bidData.bid_deadline).getTime() - Date.now()) / 3600000))
    : null;

  const probColor = bidData?.upgrade_probability >= 60 ? C.teal : bidData?.upgrade_probability >= 35 ? C.amber : C.coral;

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Upgrade bid" />

        {loading && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator color={C.gold} size="small" />
            <Text style={{ color: C.mut, fontSize: 13, marginTop: 10 }}>
              Checking upgrade availability…
            </Text>
          </View>
        )}

        {!loading && submitted && (
          <View style={s.successCard}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>✦</Text>
            <Text style={s.successTitle}>Bid placed</Text>
            <Text style={s.successRef}>Reference: {bidRef}</Text>
            <Text style={s.successSub}>
              Wingman will monitor the upgrade queue and notify you if your bid is accepted. You'll receive a push notification as soon as the airline confirms.
            </Text>
            <Btn
              title="Back to trip"
              kind="accent"
              onPress={() => navigation.popToTop()}
              style={{ marginTop: 16 }}
            />
          </View>
        )}

        {!loading && !submitted && bidData && (
          <>
            {/* Flight header */}
            <View style={s.flightHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.flightRoute}>
                  {bidData.origin} → {bidData.destination}
                </Text>
                <Text style={s.flightNum}>{bidData.flight}</Text>
              </View>
              <View style={s.cabinPill}>
                <Text style={s.cabinFrom}>{bidData.current_cabin}</Text>
                <Text style={{ color: C.mut, fontSize: 12, marginHorizontal: 6 }}>→</Text>
                <Text style={s.cabinTo}>{bidData.target_cabin}</Text>
              </View>
            </View>

            {/* Upgrade probability */}
            <View style={s.probCard}>
              <View style={s.probRow}>
                <Text style={s.probLabel}>Upgrade probability</Text>
                <Text style={[s.probPct, { color: probColor }]}>{bidData.upgrade_probability}%</Text>
              </View>
              <View style={s.probTrack}>
                <View style={[s.probFill, { width: bidData.upgrade_probability + "%", backgroundColor: probColor }]} />
              </View>
              {hoursUntilDeadline !== null && (
                <Text style={s.probDeadline}>
                  Bid window closes in {hoursUntilDeadline}h
                </Text>
              )}
            </View>

            {/* Points balance */}
            <View style={s.balanceCard}>
              <Text style={s.balanceLabel}>{bidData.loyalty_program} balance</Text>
              <Text style={s.balancePoints}>
                {bidData.points_balance?.toLocaleString()} pts
              </Text>
              <Text style={s.balanceCash}>Cash equivalent: {bidData.cash_equivalent}</Text>
            </View>

            {/* Bid selector */}
            <Text style={g.sectionT}>SELECT YOUR BID</Text>
            <View style={s.bidGrid}>
              {BID_PRESETS.filter(p => p >= (bidData.min_bid || 0)).map(pts => (
                <Pressable
                  key={pts}
                  style={[s.bidOption, selectedPoints === pts && s.bidOptionSelected]}
                  onPress={() => setSelectedPoints(pts)}
                >
                  {pts === bidData.suggested_bid && (
                    <Text style={s.bidRecommended}>WINGMAN PICK</Text>
                  )}
                  <Text style={[s.bidPoints, selectedPoints === pts && { color: C.gold }]}>
                    {pts.toLocaleString()}
                  </Text>
                  <Text style={s.bidPtsLabel}>pts</Text>
                </Pressable>
              ))}
            </View>

            {selectedPoints && (
              <Text style={s.bidNote}>
                Bidding {selectedPoints.toLocaleString()} pts — {selectedPoints >= bidData.suggested_bid ? "competitive bid" : "below suggested minimum"}
              </Text>
            )}

            {/* Submit */}
            <View style={s.actionCard}>
              <Text style={s.actionTitle}>Wingman monitors the queue automatically</Text>
              <Text style={s.actionSub}>
                If your bid is accepted, Wingman will notify you immediately and update your boarding pass. Points are only deducted if the upgrade is confirmed.
              </Text>
              <Btn
                title={submitting ? "Placing bid…" : `✦  Place bid — ${selectedPoints?.toLocaleString() || "0"} pts`}
                kind="accent"
                onPress={handleSubmitBid}
                disabled={!selectedPoints || submitting}
                style={{ marginTop: 14 }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  flightHeader: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 12 },
  flightRoute: { color: C.ink, fontSize: 18, fontWeight: "700" },
  flightNum: { color: C.mut, fontSize: 13, marginTop: 2 },
  cabinPill: { flexDirection: "row", alignItems: "center", backgroundColor: C.card2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  cabinFrom: { color: C.mut, fontSize: 12, fontWeight: "600" },
  cabinTo: { color: C.gold, fontSize: 12, fontWeight: "700" },
  probCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 12 },
  probRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  probLabel: { color: C.mut, fontSize: 13 },
  probPct: { fontSize: 18, fontWeight: "800" },
  probTrack: { height: 6, backgroundColor: C.card2, borderRadius: 99, overflow: "hidden", marginBottom: 8 },
  probFill: { height: "100%", borderRadius: 99 },
  probDeadline: { color: C.mut, fontSize: 12 },
  balanceCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 12 },
  balanceLabel: { color: C.mut, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  balancePoints: { color: C.ink, fontSize: 24, fontWeight: "800" },
  balanceCash: { color: C.mut, fontSize: 12, marginTop: 2 },
  bidGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  bidOption: { flex: 1, minWidth: "28%", backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, alignItems: "center" },
  bidOptionSelected: { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.08)" },
  bidRecommended: { color: C.gold, fontSize: 8, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4 },
  bidPoints: { color: C.ink, fontSize: 16, fontWeight: "800" },
  bidPtsLabel: { color: C.mut, fontSize: 10, marginTop: 1 },
  bidNote: { color: C.mut, fontSize: 12, textAlign: "center", marginBottom: 12 },
  actionCard: { backgroundColor: "rgba(201,169,110,0.06)", borderWidth: 1, borderColor: "rgba(201,169,110,0.25)", borderRadius: 18, padding: 18, marginBottom: 24 },
  actionTitle: { color: C.ink, fontSize: 15, fontWeight: "700", marginBottom: 6 },
  actionSub: { color: C.mut, fontSize: 13, lineHeight: 19 },
  successCard: { backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(201,169,110,0.3)", borderRadius: 18, padding: 24, alignItems: "center", marginTop: 20 },
  successTitle: { color: C.gold, fontSize: 22, fontWeight: "800", marginBottom: 4 },
  successRef: { color: C.mut, fontSize: 13, marginBottom: 12 },
  successSub: { color: C.ink, fontSize: 13, lineHeight: 20, textAlign: "center" },
});
