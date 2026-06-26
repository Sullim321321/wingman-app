import React, { useState } from "react";
import {
  View, Text, TextInput, ScrollView, Pressable, ActivityIndicator,
  StyleSheet, Platform, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackBar, Btn, Segmented, g, tap } from "../components";
import { C } from "../theme";
import * as api from "../api";

const CABINS = ["economy", "premium_economy", "business", "first"];
const CABIN_LABELS = { economy: "Economy", premium_economy: "Prem. Economy", business: "Business", first: "First" };

function formatDuration(iso) {
  if (!iso) return "";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  const h = m[1] ? `${m[1]}h ` : "";
  const min = m[2] ? `${m[2]}m` : "";
  return h + min;
}

function formatTime(dt) {
  if (!dt) return "--";
  const d = new Date(dt);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function OfferCard({ offer, onSelect }) {
  const slice = offer.slices?.[0];
  const segs = slice?.segments || [];
  const stops = segs.length - 1;
  const firstSeg = segs[0];
  const lastSeg = segs[segs.length - 1];
  const carrier = firstSeg?.carrier || "";
  const price = parseFloat(offer.total_amount);
  const currency = offer.total_currency || "USD";

  return (
    <Pressable style={s.card} onPress={() => { tap(); onSelect(offer); }}>
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.carrier}>{carrier}</Text>
          <View style={s.route}>
            <View style={s.routeEnd}>
              <Text style={s.time}>{formatTime(firstSeg?.departing_at)}</Text>
              <Text style={s.airport}>{firstSeg?.origin}</Text>
            </View>
            <View style={s.routeMid}>
              <Text style={s.dur}>{formatDuration(slice?.duration)}</Text>
              <View style={s.routeLine} />
              <Text style={s.stops}>{stops === 0 ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`}</Text>
            </View>
            <View style={s.routeEnd}>
              <Text style={s.time}>{formatTime(lastSeg?.arriving_at)}</Text>
              <Text style={s.airport}>{lastSeg?.destination}</Text>
            </View>
          </View>
          <Text style={s.date}>{formatDate(firstSeg?.departing_at)}</Text>
        </View>
        <View style={s.priceBox}>
          <Text style={s.price}>${Math.round(price)}</Text>
          <Text style={s.priceSub}>{currency}</Text>
        </View>
      </View>
      <View style={s.cardFoot}>
        {offer.conditions?.refundable && (
          <View style={s.badge}><Text style={s.badgeT}>Refundable</Text></View>
        )}
        {offer.conditions?.changeable && (
          <View style={[s.badge, { backgroundColor: "rgba(91,140,255,0.12)", borderColor: "rgba(91,140,255,0.3)" }]}>
            <Text style={[s.badgeT, { color: C.accent }]}>Changeable</Text>
          </View>
        )}
        {offer.baggages?.some(b => b.type === "checked" && b.quantity > 0) && (
          <View style={[s.badge, { backgroundColor: "rgba(255,176,46,0.1)", borderColor: "rgba(255,176,46,0.25)" }]}>
            <Text style={[s.badgeT, { color: C.amber }]}>Bag included</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function FlightSearchScreen({ navigation }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [cabin, setCabin] = useState("economy");
  const [passengers, setPassengers] = useState("1");
  const [tripType, setTripType] = useState("One-way");
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState(null);
  const [error, setError] = useState(null);

  async function search() {
    if (!origin.trim() || !destination.trim() || !departDate.trim()) {
      setError("Please fill in origin, destination, and departure date.");
      return;
    }
    // Basic date format check YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departDate.trim())) {
      setError("Departure date must be in YYYY-MM-DD format (e.g. 2025-09-15).");
      return;
    }
    if (tripType === "Return" && returnDate && !/^\d{4}-\d{2}-\d{2}$/.test(returnDate.trim())) {
      setError("Return date must be in YYYY-MM-DD format.");
      return;
    }
    setError(null);
    setLoading(true);
    setOffers(null);
    try {
      const body = {
        origin: origin.trim().toUpperCase(),
        destination: destination.trim().toUpperCase(),
        departure_date: departDate.trim(),
        cabin_class: cabin,
        passengers: parseInt(passengers, 10) || 1,
      };
      if (tripType === "Return" && returnDate.trim()) {
        body.return_date = returnDate.trim();
      }
      const result = await api.searchFlights(body);
      setOffers(result.offers || []);
      if ((result.offers || []).length === 0) {
        setError("No flights found for this route and date. Try different dates or airports.");
      }
    } catch (e) {
      setError(e.message || "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={g.scroll} keyboardShouldPersistTaps="handled">
          <BackBar nav={navigation} label="Flight Search" />

          <Text style={g.sectionT}>TRIP TYPE</Text>
          <Segmented options={["One-way", "Return"]} value={tripType} onChange={setTripType} />

          <Text style={g.sectionT}>ROUTE</Text>
          <View style={s.row}>
            <View style={[s.inputWrap, { flex: 1 }]}>
              <Text style={s.inputLabel}>From</Text>
              <TextInput
                style={s.input}
                placeholder="JFK"
                placeholderTextColor={C.mut}
                value={origin}
                onChangeText={setOrigin}
                autoCapitalize="characters"
                maxLength={3}
              />
            </View>
            <Pressable style={s.swap} onPress={() => { tap(); const t = origin; setOrigin(destination); setDestination(t); }}>
              <Text style={{ color: C.accent, fontSize: 18 }}>⇄</Text>
            </Pressable>
            <View style={[s.inputWrap, { flex: 1 }]}>
              <Text style={s.inputLabel}>To</Text>
              <TextInput
                style={s.input}
                placeholder="LAX"
                placeholderTextColor={C.mut}
                value={destination}
                onChangeText={setDestination}
                autoCapitalize="characters"
                maxLength={3}
              />
            </View>
          </View>

          <Text style={g.sectionT}>DATES</Text>
          <View style={s.row}>
            <View style={[s.inputWrap, { flex: 1 }]}>
              <Text style={s.inputLabel}>Depart</Text>
              <TextInput
                style={s.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.mut}
                value={departDate}
                onChangeText={setDepartDate}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            {tripType === "Return" && (
              <View style={[s.inputWrap, { flex: 1 }]}>
                <Text style={s.inputLabel}>Return</Text>
                <TextInput
                  style={s.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.mut}
                  value={returnDate}
                  onChangeText={setReturnDate}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            )}
          </View>

          <Text style={g.sectionT}>CABIN CLASS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {CABINS.map(c => (
                <Pressable key={c} style={[s.cabinBtn, cabin === c && s.cabinBtnSel]} onPress={() => { tap(); setCabin(c); }}>
                  <Text style={[s.cabinT, cabin === c && s.cabinTSel]}>{CABIN_LABELS[c]}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={g.sectionT}>PASSENGERS</Text>
          <View style={s.row}>
            {["1", "2", "3", "4"].map(n => (
              <Pressable key={n} style={[s.paxBtn, passengers === n && s.paxBtnSel]} onPress={() => { tap(); setPassengers(n); }}>
                <Text style={[s.paxT, passengers === n && s.paxTSel]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <View style={{ marginTop: 20, marginBottom: 24 }}>
            <Btn title={loading ? "Searching…" : "Search Flights"} onPress={search} kind="accent" />
          </View>

          {loading && (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <ActivityIndicator color={C.teal} size="large" />
              <Text style={{ color: C.mut, marginTop: 12, fontSize: 13 }}>Checking airlines…</Text>
            </View>
          )}

          {offers && offers.length > 0 && (
            <>
              <Text style={g.sectionT}>{offers.length} FLIGHTS FOUND</Text>
              {offers.map(offer => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  onSelect={o => navigation.navigate("FlightBook", { offer: o })}
                />
              ))}
              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 4 },
  inputWrap: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12 },
  inputLabel: { color: C.mut, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  input: { color: C.ink, fontSize: 16, fontWeight: "600" },
  swap: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", marginTop: 16 },
  cabinBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  cabinBtnSel: { backgroundColor: "rgba(34,211,166,0.12)", borderColor: C.teal },
  cabinT: { color: C.mut, fontSize: 13, fontWeight: "600" },
  cabinTSel: { color: C.teal },
  paxBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  paxBtnSel: { backgroundColor: "rgba(34,211,166,0.12)", borderColor: C.teal },
  paxT: { color: C.mut, fontSize: 15, fontWeight: "700" },
  paxTSel: { color: C.teal },
  error: { color: C.coral, fontSize: 13, marginTop: 8, marginBottom: 4 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  carrier: { color: C.mut, fontSize: 12, marginBottom: 8 },
  route: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeEnd: { alignItems: "center" },
  routeMid: { flex: 1, alignItems: "center", gap: 3 },
  routeLine: { width: "100%", height: 1, backgroundColor: C.line },
  time: { color: C.ink, fontSize: 17, fontWeight: "700" },
  airport: { color: C.mut, fontSize: 12, marginTop: 2 },
  dur: { color: C.mut, fontSize: 11 },
  stops: { color: C.mut, fontSize: 11 },
  date: { color: C.mut, fontSize: 12, marginTop: 6 },
  priceBox: { alignItems: "flex-end", minWidth: 60 },
  price: { color: C.teal, fontSize: 22, fontWeight: "800" },
  priceSub: { color: C.mut, fontSize: 11 },
  cardFoot: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  badge: { backgroundColor: "rgba(34,211,166,0.1)", borderWidth: 1, borderColor: "rgba(34,211,166,0.25)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeT: { color: C.teal, fontSize: 11, fontWeight: "700" },
});
