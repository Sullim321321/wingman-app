// FlightSearchScreen — Route search, flight number lookup, confirmation lookup
// Warm espresso palette + champagne gold
// Build #35: airport autocomplete, time-aware UX, better error messages

import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TextInput, ScrollView, Pressable, ActivityIndicator,
  StyleSheet, Platform, KeyboardAvoidingView, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BackBar, Btn, Segmented, g, tap } from "../components";
import { C, T } from "../theme";
import * as api from "../api";
import * as fid from "../flightid";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(iso) {
  if (!iso) return "";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  return (m[1] ? `${m[1]}h ` : "") + (m[2] ? `${m[2]}m` : "");
}
function formatTime(dt) {
  if (!dt) return "--";
  return new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}
function formatDate(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleDateString([], { month: "short", day: "numeric" });
}
function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function displayDate(d) {
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// ─── Airport Autocomplete Input ──────────────────────────────────────────────

function AirportInput({ label, value, iata, onSelect, placeholder }) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  // When iata is set externally (e.g. swap), sync the display
  React.useEffect(() => {
    if (iata && value) setQuery(`${iata} — ${value}`);
  }, [iata, value]);

  function handleChange(text) {
    setQuery(text);
    // If user clears the field, clear the selection
    if (!text) { onSelect(null); setSuggestions([]); return; }
    // Debounce 300ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (text.length < 2) { setSuggestions([]); return; }
      setLoading(true);
      try {
        const res = await api.searchAirports(text);
        setSuggestions(res.airports || []);
      } catch { setSuggestions([]); }
      finally { setLoading(false); }
    }, 300);
  }

  function handleSelect(airport) {
    tap();
    setQuery(`${airport.iata} — ${airport.city}`);
    setSuggestions([]);
    onSelect(airport);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={s.inputWrap}>
        <Text style={s.inputLabel}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder={placeholder || "City or airport"}
            placeholderTextColor={C.mut}
            value={query}
            onChangeText={handleChange}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="search"
          />
          {loading && <ActivityIndicator size="small" color={C.gold} style={{ marginLeft: 6 }} />}
        </View>
      </View>
      {suggestions.length > 0 && (
        <View style={s.dropdown}>
          {suggestions.map((a, i) => (
            <Pressable
              key={a.iata + i}
              style={[s.dropdownItem, i < suggestions.length - 1 && s.dropdownDivider]}
              onPress={() => handleSelect(a)}
            >
              <Text style={s.dropdownIata}>{a.iata}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.dropdownName} numberOfLines={1}>{a.city}</Text>
                <Text style={s.dropdownCountry} numberOfLines={1}>{a.name}{a.country ? ` · ${a.country}` : ""}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Offer Card ─────────────────────────────────────────────────────────────

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
          <View style={[s.badge, s.badgeBlue]}>
            <Text style={[s.badgeT, { color: C.gold }]}>Changeable</Text>
          </View>
        )}
        {offer.baggages?.some(b => b.type === "checked" && b.quantity > 0) && (
          <View style={[s.badge, s.badgeAmber]}>
            <Text style={[s.badgeT, { color: C.amber }]}>Bag included</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Status Card ─────────────────────────────────────────────────────────────

function StatusCard({ ident, data }) {
  const delayColor = data.delay > 30 ? C.coral : data.delay > 0 ? C.amber : C.teal;
  const statusColor = data.status?.toLowerCase().includes("cancel") ? C.coral
    : data.status?.toLowerCase().includes("delay") ? C.amber : C.teal;
  return (
    <View style={s.statusCard}>
      <View style={s.statusHeader}>
        <Text style={s.statusIdent}>{ident}</Text>
        <View style={[s.statusBadge, { borderColor: statusColor, backgroundColor: statusColor + "18" }]}>
          <Text style={[s.statusBadgeT, { color: statusColor }]}>{data.status || "Unknown"}</Text>
        </View>
      </View>
      {data.delay > 0 && (
        <Text style={[s.statusDetail, { color: delayColor }]}>Delayed {data.delay} min</Text>
      )}
      {data.gate && (
        <Text style={s.statusDetail}>Gate {data.gate}{data.terminal ? ` · Terminal ${data.terminal}` : ""}</Text>
      )}
      {data.scheduledDep && (
        <Text style={s.statusDetail}>Scheduled: {formatTime(data.scheduledDep)}</Text>
      )}
      {data.actualDep && (
        <Text style={s.statusDetail}>Actual: {formatTime(data.actualDep)}</Text>
      )}
      {!data.live && (
        <Text style={[s.statusDetail, { color: C.mut, fontStyle: "italic" }]}>Live data unavailable — showing last known status</Text>
      )}
    </View>
  );
}

// ─── Confirmation Result Card ─────────────────────────────────────────────────

function ConfirmationCard({ trip }) {
  return (
    <View style={s.statusCard}>
      <Text style={s.statusIdent}>{trip.title}</Text>
      {(trip.legs || []).map((leg, i) => (
        <View key={i} style={s.legRow}>
          <Text style={s.legType}>{leg.type?.toUpperCase()}</Text>
          <Text style={s.legDetail}>
            {leg.type === "flight"
              ? `${fid.displayName(leg) || ""} · ${leg.origin || ""}→${leg.destination || ""}`
              : leg.carrier || leg.destination || ""}
          </Text>
          {leg.departs_at && (
            <Text style={s.legDate}>{formatDate(leg.departs_at)}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Date Picker Row ─────────────────────────────────────────────────────────

function DateRow({ label, date, onChange }) {
  const [show, setShow] = React.useState(false);
  return (
    <View style={[s.inputWrap, { flex: 1 }]}>
      <Text style={s.inputLabel}>{label}</Text>
      <Pressable
        style={s.dateTapBtn}
        onPress={() => { tap(); setShow(true); }}
      >
        <Text style={s.dateTapBtnT}>{displayDate(date)}</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={date}
          mode="date"
          display="spinner"
          minimumDate={new Date(new Date().setHours(0,0,0,0))}
          themeVariant="dark"
          onChange={(_, selected) => {
            setShow(false);
            if (selected) onChange(selected);
          }}
        />
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

const CABINS = ["economy", "premium_economy", "business", "first"];
const CABIN_LABELS = { economy: "Economy", premium_economy: "Prem. Eco", business: "Business", first: "First" };
const TABS = ["Route", "Flight No.", "Confirmation"];

export default function FlightSearchScreen({ navigation }) {
  const [tab, setTab] = useState("Route");

  // Route tab — now stores full airport objects
  const [originAirport, setOriginAirport]           = useState(null);
  const [destinationAirport, setDestinationAirport] = useState(null);
  const [departDate, setDepartDate]   = useState(new Date(Date.now() + 86400000));
  const [returnDate, setReturnDate]   = useState(new Date(Date.now() + 7 * 86400000));
  const [cabin, setCabin]             = useState("economy");
  const [passengers, setPassengers]   = useState("1");
  const [tripType, setTripType]       = useState("One-way");
  const [offers, setOffers]           = useState(null);

  // Flight number tab
  const [flightIdent, setFlightIdent] = useState("");
  const [flightStatus, setFlightStatus] = useState(null);

  // Confirmation tab
  const [confirmRef, setConfirmRef]   = useState("");
  const [confirmResult, setConfirmResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // ── Route search ──────────────────────────────────────────────────────────
  async function searchRoute() {
    const originIata = originAirport?.iata;
    const destIata = destinationAirport?.iata;
    if (!originIata || !destIata) {
      setError("Please select an origin and destination airport from the suggestions.");
      return;
    }
    setError(null); setLoading(true); setOffers(null);
    try {
      const body = {
        origin: originIata,
        destination: destIata,
        departure_date: toYMD(departDate),
        cabin_class: cabin,
        passengers: parseInt(passengers, 10) || 1,
      };
      if (tripType === "Return") body.return_date = toYMD(returnDate);
      const result = await api.searchFlights(body);
      setOffers(result.offers || []);
      if ((result.offers || []).length === 0) setError("No flights found for this route and date. Try adjusting your dates or cabin class.");
    } catch (e) {
      setError(e.message || "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Swap origin/destination ───────────────────────────────────────────────
  function swapAirports() {
    tap();
    const tmp = originAirport;
    setOriginAirport(destinationAirport);
    setDestinationAirport(tmp);
  }

  // ── Flight number lookup ──────────────────────────────────────────────────
  async function lookupFlight() {
    const ident = flightIdent.trim().toUpperCase().replace(/\s/g, "");
    if (!ident) { setError("Enter a flight number, e.g. BA286 or UA412."); return; }
    setError(null); setLoading(true); setFlightStatus(null);
    try {
      const data = await api.getFlightStatus(ident);
      setFlightStatus(data);
    } catch (e) {
      setError(e.message || "Could not look up flight. Check the flight number and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Confirmation lookup ───────────────────────────────────────────────────
  async function lookupConfirmation() {
    const ref = confirmRef.trim().toUpperCase();
    if (!ref) { setError("Enter a booking reference or confirmation number."); return; }
    setError(null); setLoading(true); setConfirmResult(null);
    try {
      const data = await api.getTrips();
      const trips = data.trips || [];
      const match = trips.find(t =>
        t.booking_reference?.toUpperCase() === ref ||
        t.confirmation_number?.toUpperCase() === ref ||
        (t.legs || []).some(l => l.confirmation_number?.toUpperCase() === ref)
      );
      if (match) {
        setConfirmResult(match);
      } else {
        setError("No trip found with that reference. Make sure the trip is imported into Wingman first.");
      }
    } catch (e) {
      setError(e.message || "Lookup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function clearState() {
    setError(null); setOffers(null); setFlightStatus(null); setConfirmResult(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={g.scroll} keyboardShouldPersistTaps="handled">
          <BackBar nav={navigation} label="Flights" />

          {/* Tab selector */}
          <View style={s.tabRow}>
            {TABS.map(t => (
              <Pressable
                key={t}
                style={[s.tabBtn, tab === t && s.tabBtnSel]}
                onPress={() => { tap(); setTab(t); clearState(); }}
              >
                <Text style={[s.tabT, tab === t && s.tabTSel]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {/* ── ROUTE TAB ── */}
          {tab === "Route" && (
            <>
              <Text style={g.sectionT}>TRIP TYPE</Text>
              <Segmented options={["One-way", "Return"]} value={tripType} onChange={setTripType} />

              <Text style={g.sectionT}>ROUTE</Text>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, zIndex: 10 }}>
                <AirportInput
                  label="From"
                  value={originAirport?.city}
                  iata={originAirport?.iata}
                  placeholder="City or airport"
                  onSelect={setOriginAirport}
                />
                <Pressable style={[s.swap, { marginTop: 28 }]} onPress={swapAirports}>
                  <Text style={{ color: C.gold, fontSize: 18 }}>⇄</Text>
                </Pressable>
                <AirportInput
                  label="To"
                  value={destinationAirport?.city}
                  iata={destinationAirport?.iata}
                  placeholder="City or airport"
                  onSelect={setDestinationAirport}
                />
              </View>

              <Text style={g.sectionT}>DATES</Text>
              <View style={s.row}>
                <DateRow label="Depart" date={departDate} onChange={setDepartDate} />
                {tripType === "Return" && (
                  <DateRow label="Return" date={returnDate} onChange={d => {
                    if (d < departDate) setDepartDate(d);
                    setReturnDate(d);
                  }} />
                )}
              </View>

              <Text style={g.sectionT}>CABIN</Text>
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
                <Btn
                  title={loading ? "Searching airlines…" : "Search Flights"}
                  onPress={searchRoute}
                  kind="primary"
                  disabled={loading}
                />
              </View>

              {loading && (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <ActivityIndicator color={C.gold} size="large" />
                  <Text style={{ color: C.mut, marginTop: 12, fontSize: 13 }}>Checking all airlines — usually takes 10–20 seconds…</Text>
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
            </>
          )}

          {/* ── FLIGHT NUMBER TAB ── */}
          {tab === "Flight No." && (
            <>
              <Text style={g.sectionT}>FLIGHT NUMBER</Text>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Carrier + Number</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. BA286 or UA412"
                  placeholderTextColor={C.mut}
                  value={flightIdent}
                  onChangeText={v => setFlightIdent(v.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={lookupFlight}
                />
              </View>
              <Text style={s.hint}>Enter the airline code and flight number together, e.g. BA286, UA412, AA100.</Text>

              {error ? <Text style={s.error}>{error}</Text> : null}
              <View style={{ marginTop: 20, marginBottom: 24 }}>
                <Btn title={loading ? "Looking up…" : "Look Up Flight"} onPress={lookupFlight} kind="primary" disabled={loading} />
              </View>

              {loading && (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <ActivityIndicator color={C.gold} size="large" />
                  <Text style={{ color: C.mut, marginTop: 12, fontSize: 13 }}>Fetching live status…</Text>
                </View>
              )}
              {flightStatus && !loading && (
                <>
                  <Text style={g.sectionT}>LIVE STATUS</Text>
                  <StatusCard ident={flightIdent.trim().toUpperCase()} data={flightStatus} />
                  <View style={{ height: 40 }} />
                </>
              )}
            </>
          )}

          {/* ── CONFIRMATION TAB ── */}
          {tab === "Confirmation" && (
            <>
              <Text style={g.sectionT}>BOOKING REFERENCE</Text>
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Confirmation / PNR</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. ABC123 or XY7K9M"
                  placeholderTextColor={C.mut}
                  value={confirmRef}
                  onChangeText={v => setConfirmRef(v.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={lookupConfirmation}
                />
              </View>
              <Text style={s.hint}>Enter your airline confirmation code or booking reference. The trip must be imported into Wingman first.</Text>

              {error ? <Text style={s.error}>{error}</Text> : null}
              <View style={{ marginTop: 20, marginBottom: 24 }}>
                <Btn title={loading ? "Searching…" : "Find Trip"} onPress={lookupConfirmation} kind="primary" disabled={loading} />
              </View>

              {loading && (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <ActivityIndicator color={C.gold} size="large" />
                  <Text style={{ color: C.mut, marginTop: 12, fontSize: 13 }}>Searching your trips…</Text>
                </View>
              )}
              {confirmResult && !loading && (
                <>
                  <Text style={g.sectionT}>TRIP FOUND</Text>
                  <ConfirmationCard trip={confirmResult} />
                  <View style={{ marginTop: 16, marginBottom: 40 }}>
                    <Btn
                      title="Open Trip"
                      onPress={() => navigation.navigate("Dossier", { tripId: confirmResult.id })}
                      kind="primary"
                    />
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  tabRow: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginBottom: 16, marginTop: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  tabBtnSel: { backgroundColor: "rgba(201,169,110,0.12)", borderColor: C.gold },
  tabT: { color: C.mut, fontSize: 12, fontFamily: T.sansB, letterSpacing: 0.5 },
  tabTSel: { color: C.gold },

  row: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 4 },
  inputWrap: { backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", borderRadius: 12, padding: 12, marginBottom: 4 },
  inputLabel: { color: C.mut, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1, marginBottom: 4 },
  input: { color: C.ink, fontSize: 16, fontFamily: T.sansM },
  dateTapBtn: { backgroundColor: C.card2, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  dateTapBtnT: { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  swap: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", alignItems: "center", justifyContent: "center" },

  // Airport autocomplete dropdown
  dropdown: { backgroundColor: C.card2, borderWidth: 1, borderColor: "rgba(201,169,110,0.25)", borderRadius: 12, marginTop: 2, marginBottom: 4, overflow: "hidden", zIndex: 999 },
  dropdownItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  dropdownDivider: { borderBottomWidth: 1, borderBottomColor: C.line },
  dropdownIata: { color: C.gold, fontSize: 15, fontFamily: T.sansB, minWidth: 36 },
  dropdownName: { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  dropdownCountry: { color: C.mut, fontSize: 11, fontFamily: T.sans, marginTop: 1 },

  cabinBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  cabinBtnSel: { backgroundColor: "rgba(201,169,110,0.12)", borderColor: C.gold },
  cabinT: { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  cabinTSel: { color: C.gold },

  paxBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  paxBtnSel: { backgroundColor: "rgba(201,169,110,0.12)", borderColor: C.gold },
  paxT: { color: C.mut, fontSize: 15, fontFamily: T.sansB },
  paxTSel: { color: C.gold },

  hint: { color: C.mut, fontSize: 12, fontFamily: T.sans, marginHorizontal: 0, marginTop: 6, marginBottom: 4, lineHeight: 18 },
  error: { color: C.coral, fontSize: 13, marginTop: 8, marginBottom: 4 },

  // Status card
  statusCard: { backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)", borderRadius: 16, padding: 16, marginBottom: 10 },
  statusHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  statusIdent: { color: C.ink, fontSize: 22, fontFamily: T.serifB },
  statusBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeT: { fontSize: 12, fontFamily: T.sansB },
  statusDetail: { color: C.mut, fontSize: 13, fontFamily: T.sans, marginTop: 4 },

  // Leg rows in confirmation card
  legRow: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, marginTop: 10 },
  legType: { color: C.gold, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 3 },
  legDetail: { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  legDate: { color: C.mut, fontSize: 12, marginTop: 2 },

  // Offer card
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(201,169,110,0.18)", borderRadius: 16, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  carrier: { color: C.mut, fontSize: 12, marginBottom: 8 },
  route: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeEnd: { alignItems: "center" },
  routeMid: { flex: 1, alignItems: "center", gap: 3 },
  routeLine: { width: "100%", height: 1, backgroundColor: C.line },
  time: { color: C.ink, fontSize: 17, fontFamily: T.sansB },
  airport: { color: C.mut, fontSize: 12, marginTop: 2 },
  dur: { color: C.mut, fontSize: 11 },
  stops: { color: C.mut, fontSize: 11 },
  date: { color: C.mut, fontSize: 12, marginTop: 6 },
  priceBox: { alignItems: "flex-end", minWidth: 60 },
  price: { color: C.gold, fontSize: 22, fontFamily: T.sansB },
  priceSub: { color: C.mut, fontSize: 11 },
  cardFoot: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  badge: { backgroundColor: "rgba(201,169,110,0.1)", borderWidth: 1, borderColor: "rgba(201,169,110,0.3)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeBlue: { backgroundColor: "rgba(91,140,255,0.1)", borderColor: "rgba(91,140,255,0.3)" },
  badgeAmber: { backgroundColor: "rgba(255,176,46,0.1)", borderColor: "rgba(255,176,46,0.25)" },
  badgeT: { color: C.gold, fontSize: 11, fontFamily: T.sansB },
});
