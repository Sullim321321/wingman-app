import React, { useState, useRef, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, TextInput, Pressable,
  StyleSheet, Alert, ActivityIndicator, TouchableOpacity, Animated,
  KeyboardAvoidingView, Platform, Share, Clipboard, Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { C, T } from "../theme";
import { BackBar, Btn, g, tap } from "../components";
import { createTrip, getFlightStatus, draftTripFromText } from "../api";

// ── Trip mode ────────────────────────────────────────────────────────────────
const MODES = [
  { id: "solo",    label: "Solo",    icon: "◆", desc: "Efficiency mode" },
  { id: "client",  label: "Client",  icon: "◈", desc: "Prestige & optics" },
  { id: "partner", label: "Partner", icon: "◇", desc: "Leisure & romance" },
];

// ── Leg types ────────────────────────────────────────────────────────────────
const LEG_TYPES = [
  { id: "flight",   label: "Flight",   icon: "✈" },
  { id: "hotel",    label: "Hotel",    icon: "⌂" },
  { id: "airbnb",   label: "Airbnb",   icon: "◎" },
  { id: "train",    label: "Train",    icon: "⊟" },
  { id: "car",      label: "Car",      icon: "◉" },
  { id: "ferry",    label: "Ferry",    icon: "⊕" },
  { id: "activity", label: "Activity", icon: "◈" },
  { id: "event",    label: "Show / Event", icon: "◆" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseFlightInput(raw) {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m = s.match(/^([A-Z]{2,3})(\d{1,4})$/);
  if (m) return { carrier: m[1], number: m[2] };
  return null;
}

function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, editable = true, right, multiline }) {
  return (
    <View style={s.field}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Text style={s.label}>{label}</Text>
        {right}
      </View>
      <TextInput
        style={[s.input, !editable && { color: C.mut }, multiline && { minHeight: 60, lineHeight: 22 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ""}
        placeholderTextColor={C.mut}
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize || "words"}
        autoCorrect={autoCapitalize !== "characters" && autoCapitalize !== "none"}
        spellCheck={autoCapitalize !== "characters" && autoCapitalize !== "none"}
        keyboardAppearance="dark"
        editable={editable}
        multiline={multiline}
      />
    </View>
  );
}

// ── DateField — tap to open native date+time picker ─────────────────────────
function DateField({ label, value, onChange, mode = "datetime" }) {
  const [show, setShow] = useState(false);
  const parsed = value ? new Date(value) : new Date();
  const display = value
    ? (mode === "date"
        ? parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
          " " + parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }))
    : null;

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === "android") setShow(false);
    if (event.type === "dismissed") return;
    if (selectedDate) {
      onChange(
        mode === "date"
          ? selectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : selectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
            " " + selectedDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      );
    }
    if (Platform.OS === "ios") setShow(false);
  };

  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        style={[s.input, s.dateBtn]}
        onPress={() => { tap(); setShow(true); }}
      >
        <Text style={[s.dateBtnT, !display && { color: C.mut }]}>
          {display || (mode === "date" ? "Select date" : "Select date & time")}
        </Text>
        <Text style={s.dateBtnIcon}>▼</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={parsed}
          mode={mode === "date" ? "date" : "datetime"}
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={handleChange}
          minimumDate={new Date()}
          themeVariant="dark"
        />
      )}
    </View>
  );
}

// ── Type-specific form sections ───────────────────────────────────────────────

function FlightFields({ state, set, lookingUp, looked, onFlightQueryChange }) {
  return (
    <View style={g.group}>
      <View style={s.field}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text style={s.label}>Flight Number</Text>
          {lookingUp && <ActivityIndicator size="small" color={C.gold} />}
          {looked && !lookingUp && (
            <View style={s.lookedBadge}><Text style={s.lookedT}>✓ Found</Text></View>
          )}
        </View>
        <TextInput
          style={s.input}
          value={state.flightQuery}
          onChangeText={onFlightQueryChange}
          placeholder="UA 412 — we'll look it up"
          placeholderTextColor={C.mut}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>
      <Field label="From (airport code)" value={state.origin} onChangeText={v => set("origin", v)} placeholder="JFK" autoCapitalize="characters" editable={!looked} />
      <Field label="To (airport code)" value={state.destination} onChangeText={v => set("destination", v)} placeholder="LHR" autoCapitalize="characters" editable={!looked} />
      <Field label="Airline" value={state.carrier} onChangeText={v => set("carrier", v)} placeholder="BA" autoCapitalize="characters" editable={!looked} />
      <Field label="Cabin Class" value={state.cabinClass} onChangeText={v => set("cabinClass", v)} placeholder="Economy / Business / First" autoCapitalize="words" />
      <Field label="Seat" value={state.seat} onChangeText={v => set("seat", v)} placeholder="12A" autoCapitalize="characters" />
      <DateField label="Departure Date & Time" value={state.depDate} onChange={v => set("depDate", v)} />
      <View style={[s.field, { borderBottomWidth: 0 }]}>
        <Text style={s.label}>Confirmation #</Text>
        <TextInput style={s.input} value={state.confirmation} onChangeText={v => set("confirmation", v)}
          placeholder="ABC123" placeholderTextColor={C.mut} autoCapitalize="characters" />
      </View>
    </View>
  );
}

function HotelFields({ state, set }) {
  return (
    <View style={g.group}>
      <Field label="Property Name" value={state.propertyName} onChangeText={v => set("propertyName", v)} placeholder="The Hoxton, Edinburgh" />
      <Field label="Address" value={state.address} onChangeText={v => set("address", v)} placeholder="19–21 Market St, Edinburgh" multiline />
      <DateField label="Check-in Date" value={state.checkIn} onChange={v => set("checkIn", v)} mode="date" />
      <DateField label="Check-out Date" value={state.checkOut} onChange={v => set("checkOut", v)} mode="date" />
      <Field label="Nights" value={state.nights} onChangeText={v => set("nights", v)} placeholder="5" keyboardType="number-pad" autoCapitalize="none" />
      <Field label="Guests" value={state.guests} onChangeText={v => set("guests", v)} placeholder="2" keyboardType="number-pad" autoCapitalize="none" />
      <View style={[s.field, { borderBottomWidth: 0 }]}>
        <Text style={s.label}>Confirmation #</Text>
        <TextInput style={s.input} value={state.confirmation} onChangeText={v => set("confirmation", v)}
          placeholder="HTL-123456" placeholderTextColor={C.mut} autoCapitalize="characters" />
      </View>
    </View>
  );
}

function AirbnbFields({ state, set }) {
  return (
    <View style={g.group}>
      <Field label="Property Name" value={state.propertyName} onChangeText={v => set("propertyName", v)} placeholder="Cosy flat in Leith" />
      <Field label="Address" value={state.address} onChangeText={v => set("address", v)} placeholder="12 Shore, Leith, Edinburgh" multiline />
      <DateField label="Check-in Date" value={state.checkIn} onChange={v => set("checkIn", v)} mode="date" />
      <DateField label="Check-out Date" value={state.checkOut} onChange={v => set("checkOut", v)} mode="date" />
      <Field label="Nights" value={state.nights} onChangeText={v => set("nights", v)} placeholder="5" keyboardType="number-pad" autoCapitalize="none" />
      <Field label="Guests" value={state.guests} onChangeText={v => set("guests", v)} placeholder="2" keyboardType="number-pad" autoCapitalize="none" />
      <View style={[s.field, { borderBottomWidth: 0 }]}>
        <Text style={s.label}>Confirmation #</Text>
        <TextInput style={s.input} value={state.confirmation} onChangeText={v => set("confirmation", v)}
          placeholder="HMXXXXXXXX" placeholderTextColor={C.mut} autoCapitalize="characters" />
      </View>
    </View>
  );
}

function TrainFields({ state, set }) {
  return (
    <View style={g.group}>
      <Field label="Operator" value={state.carrier} onChangeText={v => set("carrier", v)} placeholder="LNER / ScotRail / Eurostar" />
      <Field label="From Station" value={state.stationFrom} onChangeText={v => set("stationFrom", v)} placeholder="London King's Cross" />
      <Field label="To Station" value={state.stationTo} onChangeText={v => set("stationTo", v)} placeholder="Edinburgh Waverley" />
      <DateField label="Departure Date & Time" value={state.depDate} onChange={v => set("depDate", v)} />
      <DateField label="Arrival Date & Time" value={state.arrDate} onChange={v => set("arrDate", v)} />
      <Field label="Seat / Coach" value={state.seat} onChangeText={v => set("seat", v)} placeholder="Coach B, Seat 42" />
      <View style={[s.field, { borderBottomWidth: 0 }]}>
        <Text style={s.label}>Booking Reference</Text>
        <TextInput style={s.input} value={state.confirmation} onChangeText={v => set("confirmation", v)}
          placeholder="A1B2C3" placeholderTextColor={C.mut} autoCapitalize="characters" />
      </View>
    </View>
  );
}

function CarFields({ state, set }) {
  return (
    <View style={g.group}>
      <Field label="Rental Company" value={state.carrier} onChangeText={v => set("carrier", v)} placeholder="Hertz / Avis / Enterprise" />
      <Field label="Vehicle Class" value={state.vehicleClass} onChangeText={v => set("vehicleClass", v)} placeholder="Economy / SUV / Luxury" />
      <Field label="Pickup Location" value={state.pickupLocation} onChangeText={v => set("pickupLocation", v)} placeholder="Edinburgh Airport" />
      <Field label="Dropoff Location" value={state.dropoffLocation} onChangeText={v => set("dropoffLocation", v)} placeholder="Edinburgh City Centre" />
      <DateField label="Pickup Date & Time" value={state.depDate} onChange={v => set("depDate", v)} />
      <DateField label="Return Date & Time" value={state.arrDate} onChange={v => set("arrDate", v)} />
      <View style={[s.field, { borderBottomWidth: 0 }]}>
        <Text style={s.label}>Confirmation #</Text>
        <TextInput style={s.input} value={state.confirmation} onChangeText={v => set("confirmation", v)}
          placeholder="K1234567" placeholderTextColor={C.mut} autoCapitalize="characters" />
      </View>
    </View>
  );
}

function FerryFields({ state, set }) {
  return (
    <View style={g.group}>
      <Field label="Operator" value={state.carrier} onChangeText={v => set("carrier", v)} placeholder="CalMac / Stena / P&O" />
      <Field label="From Port" value={state.origin} onChangeText={v => set("origin", v)} placeholder="Ardrossan" />
      <Field label="To Port" value={state.destination} onChangeText={v => set("destination", v)} placeholder="Brodick (Arran)" />
      <DateField label="Departure Date & Time" value={state.depDate} onChange={v => set("depDate", v)} />
      <DateField label="Return Date & Time" value={state.arrDate} onChange={v => set("arrDate", v)} />
      <View style={[s.field, { borderBottomWidth: 0 }]}>
        <Text style={s.label}>Booking Reference</Text>
        <TextInput style={s.input} value={state.confirmation} onChangeText={v => set("confirmation", v)}
          placeholder="FRY-12345" placeholderTextColor={C.mut} autoCapitalize="characters" />
      </View>
    </View>
  );
}

function ActivityFields({ state, set }) {
  return (
    <View style={g.group}>
      <Field label="Activity / Experience" value={state.propertyName} onChangeText={v => set("propertyName", v)} placeholder="Whisky distillery tour" />
      <Field label="Provider" value={state.carrier} onChangeText={v => set("carrier", v)} placeholder="Glenfarclas / Viator / GetYourGuide" />
      <Field label="Location" value={state.address} onChangeText={v => set("address", v)} placeholder="Ballindalloch, Speyside" />
      <DateField label="Date & Time" value={state.depDate} onChange={v => set("depDate", v)} />
      <Field label="Guests / Tickets" value={state.guests} onChangeText={v => set("guests", v)} placeholder="2" keyboardType="number-pad" autoCapitalize="none" />
      <View style={[s.field, { borderBottomWidth: 0 }]}>
        <Text style={s.label}>Booking Reference</Text>
        <TextInput style={s.input} value={state.confirmation} onChangeText={v => set("confirmation", v)}
          placeholder="ACT-98765" placeholderTextColor={C.mut} autoCapitalize="characters" />
      </View>
    </View>
  );
}

function EventFields({ state, set }) {
  return (
    <View style={g.group}>
      <Field label="Event / Show Name" value={state.propertyName} onChangeText={v => set("propertyName", v)} placeholder="Coldplay — Music of the Spheres" />
      <Field label="Venue" value={state.address} onChangeText={v => set("address", v)} placeholder="Wembley Stadium, London" multiline />
      <DateField label="Event Date & Time" value={state.depDate} onChange={v => set("depDate", v)} />
      <Field label="Tickets / Guests" value={state.guests} onChangeText={v => set("guests", v)} placeholder="2" keyboardType="number-pad" autoCapitalize="none" />
      <View style={[s.field, { borderBottomWidth: 0 }]}>
        <Text style={s.label}>Booking Reference</Text>
        <TextInput style={s.input} value={state.confirmation} onChangeText={v => set("confirmation", v)}
          placeholder="EVT-12345" placeholderTextColor={C.mut} autoCapitalize="characters" />
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function AddTripScreen({ navigation, route }) {
  const [title, setTitle]   = useState("");
  const [mode, setMode]     = useState("solo");
    const [tab, setTab] = useState("ai"); // AI is always the default entry point
  const [legType, setLegType] = useState("flight");

  // AI / NL drafting
  const [nlText, setNlText]   = useState("");
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted]   = useState(false);

  // ── prefillPlan: populate from concierge plan card ──────────────────────────
  useEffect(() => {
    const plan = route?.params?.prefillPlan;
    if (!plan) return;
    // Set trip title from plan
    if (plan.title) setTitle(plan.title);
    // Pre-fill the NL text with a description so the user can see what was planned
    const cityList = Array.isArray(plan.cities) ? plan.cities.join(" → ") : "";
    const nights = plan.nights ? `${plan.nights} nights` : "";
    const desc = [plan.title, cityList, nights].filter(Boolean).join(" · ");
    if (desc) setNlText(desc);
    // Switch to manual tab so the user can review and save
    setTab("manual");
    setDrafted(true);
  }, [route?.params?.prefillPlan]);

  // Flight lookup
  const [lookingUp, setLookingUp] = useState(false);
  const [looked, setLooked]       = useState(false);

  // Shared leg state (all types share the same flat object; unused fields are ignored on save)
  const [leg, setLeg] = useState({
    flightQuery: "", origin: "", destination: "", carrier: "",
    flightNum: "", cabinClass: "", seat: "", depDate: "", arrDate: "",
    confirmation: "", propertyName: "", address: "", checkIn: "", checkOut: "",
    nights: "", guests: "", stationFrom: "", stationTo: "", vehicleClass: "",
    pickupLocation: "", dropoffLocation: "",
  });
  const setF = (key, val) => setLeg(prev => ({ ...prev, [key]: val }));

  const [loading, setLoading] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const doShake = () => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // ── AI draft ────────────────────────────────────────────────────────────────
  const draftFromNL = async () => {
    if (!nlText.trim()) return;
    setDrafting(true);
    try {
      const data = await draftTripFromText(nlText.trim());
      if (data.title) setTitle(data.title);
      const updates = {};
      const draftType = data.type && LEG_TYPES.find(t => t.id === data.type) ? data.type : "flight";
      // Route fields by booking type — never put hotel/city names into flight airport fields
      if (draftType === "flight" || draftType === "ferry") {
        if (data.origin)        updates.origin      = data.origin.toUpperCase();
        if (data.destination)   updates.destination = data.destination.toUpperCase();
        if (data.carrier)       updates.carrier     = data.carrier.toUpperCase();
        if (data.flight_number) updates.flightNum   = String(data.flight_number);
      } else if (draftType === "train") {
        if (data.station_from)  updates.stationFrom = data.station_from;
        if (data.station_to)    updates.stationTo   = data.station_to;
        if (data.carrier)       updates.carrier     = data.carrier;
      } else if (draftType === "car") {
        if (data.pickup_location)  updates.pickupLocation  = data.pickup_location;
        if (data.dropoff_location) updates.dropoffLocation = data.dropoff_location;
        if (data.carrier)          updates.carrier         = data.carrier;
        if (data.vehicle_class)    updates.vehicleClass    = data.vehicle_class;
      } else {
        // hotel / airbnb / activity / cruise / other — carrier is the property/operator name
        if (data.carrier)       updates.carrier     = data.carrier;
      }
      // Fields common to all types
      if (data.departs_at) {
        const d = new Date(data.departs_at);
        if (!isNaN(d)) updates.depDate = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      }
      if (data.confirmation)      updates.confirmation = data.confirmation.toUpperCase();
      if (data.property_name)     updates.propertyName = data.property_name;
      if (data.property_address)  updates.address      = data.property_address;
      else if (data.address)      updates.address      = data.address;
      if (data.check_in)          updates.checkIn      = data.check_in;
      if (data.check_out)         updates.checkOut     = data.check_out;
      if (data.nights)            updates.nights       = String(data.nights);
      if (data.guests)            updates.guests       = String(data.guests);
      if (data.cabin_class)       updates.cabinClass   = data.cabin_class;
      if (data.seat)              updates.seat         = data.seat;
      // Set leg type AFTER building updates so the correct form renders
      if (draftType) setLegType(draftType);
      setLeg(prev => ({ ...prev, ...updates }));
      setDrafted(true);
      setTab("manual");
      tap("medium");
      // No Alert — the form fills in and the user can see the result immediately
    } catch (e) {
      Alert.alert("Couldn't draft trip", e.message || "Try being more specific.");
    } finally {
      setDrafting(false);
    }
  };

  // ── Flight auto-lookup ───────────────────────────────────────────────────────
  const onFlightQueryChange = async (text) => {
    setF("flightQuery", text);
    setLooked(false);
    const parsed = parseFlightInput(text);
    if (!parsed) return;
    setLookingUp(true);
    try {
      const data = await getFlightStatus(parsed.carrier + parsed.number);
      if (data) {
        const updates = {};
        if (data.origin)        updates.origin      = data.origin;
        if (data.destination)   updates.destination = data.destination;
        if (data.carrier || parsed.carrier) updates.carrier = data.carrier || parsed.carrier;
        if (data.flight_number || parsed.number) updates.flightNum = data.flight_number || parsed.number;
        if (data.departs_at) {
          const d = new Date(data.departs_at);
          updates.depDate = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + " " +
            d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        }
        if (!title && data.origin && data.destination) setTitle(`${data.origin} → ${data.destination}`);
        setLeg(prev => ({ ...prev, ...updates }));
        setLooked(true);
      }
    } catch (_) {
      setLeg(prev => ({ ...prev, carrier: parsed.carrier, flightNum: parsed.number }));
    } finally {
      setLookingUp(false);
    }
  };

  // ── Build leg payload from current state ─────────────────────────────────────
  const buildLegPayload = () => {
    const base = {
      type: legType,
      confirmation: leg.confirmation.trim() || null,
    };
    switch (legType) {
      case "flight":
        return {
          ...base,
          carrier: leg.carrier.trim().toUpperCase() || null,
          flight_number: leg.flightNum.trim() || null,
          origin: leg.origin.trim().toUpperCase() || null,
          destination: leg.destination.trim().toUpperCase() || null,
          departs_at: leg.depDate.trim() ? new Date(leg.depDate.trim()).toISOString() : null,
          cabin_class: leg.cabinClass.trim() || null,
          seat: leg.seat.trim() || null,
        };
      case "hotel":
      case "airbnb":
        return {
          ...base,
          property_name: leg.propertyName.trim() || null,
          property_address: leg.address.trim() || null,
          departs_at: leg.checkIn.trim() ? new Date(leg.checkIn.trim()).toISOString() : null,
          arrives_at: leg.checkOut.trim() ? new Date(leg.checkOut.trim()).toISOString() : null,
          nights: leg.nights ? parseInt(leg.nights, 10) : null,
          guests: leg.guests ? parseInt(leg.guests, 10) : null,
          destination_city: title.trim() || null,
        };
      case "train":
        return {
          ...base,
          carrier: leg.carrier.trim() || null,
          station_from: leg.stationFrom.trim() || null,
          station_to: leg.stationTo.trim() || null,
          departs_at: leg.depDate.trim() ? new Date(leg.depDate.trim()).toISOString() : null,
          arrives_at: leg.arrDate.trim() ? new Date(leg.arrDate.trim()).toISOString() : null,
          seat: leg.seat.trim() || null,
        };
      case "car":
        return {
          ...base,
          carrier: leg.carrier.trim() || null,
          vehicle_class: leg.vehicleClass.trim() || null,
          pickup_location: leg.pickupLocation.trim() || null,
          dropoff_location: leg.dropoffLocation.trim() || null,
          departs_at: leg.depDate.trim() ? new Date(leg.depDate.trim()).toISOString() : null,
          arrives_at: leg.arrDate.trim() ? new Date(leg.arrDate.trim()).toISOString() : null,
        };
      case "ferry":
        return {
          ...base,
          carrier: leg.carrier.trim() || null,
          origin: leg.origin.trim() || null,
          destination: leg.destination.trim() || null,
          departs_at: leg.depDate.trim() ? new Date(leg.depDate.trim()).toISOString() : null,
          arrives_at: leg.arrDate.trim() ? new Date(leg.arrDate.trim()).toISOString() : null,
        };
      case "activity":
        return {
          ...base,
          property_name: leg.propertyName.trim() || null,
          carrier: leg.carrier.trim() || null,
          property_address: leg.address.trim() || null,
          departs_at: leg.depDate.trim() ? new Date(leg.depDate.trim()).toISOString() : null,
          guests: leg.guests ? parseInt(leg.guests, 10) : null,
        };
      case "event":
        return {
          ...base,
          property_name: leg.propertyName.trim() || null,
          property_address: leg.address.trim() || null,
          departs_at: leg.depDate.trim() ? new Date(leg.depDate.trim()).toISOString() : null,
          guests: leg.guests ? parseInt(leg.guests, 10) : null,
        };
      default:
        return base;
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!title.trim()) {
      doShake();
      Alert.alert("Trip name required", "Give your trip a name like 'Scotland' or 'Tokyo Client Trip'.");
      return;
    }
    setLoading(true);
    try {
      const legPayload = buildLegPayload();
      // Only include the leg if at least one meaningful field is filled
      const hasContent = legPayload.carrier || legPayload.property_name || legPayload.station_from ||
        legPayload.pickup_location || legPayload.origin || legPayload.departs_at;
      const legs = hasContent ? [legPayload] : [];
      const result = await createTrip({ title: title.trim(), legs, mode });
      tap("medium");
      const tripId = result?.trip?.id;
      if (tripId) {
        navigation.replace("TripDetail", { tripId });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.app}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={g.scroll} keyboardShouldPersistTaps="handled">
        <BackBar nav={navigation} label="Add Trip" />

        {/* Tab switcher */}
        <View style={s.tabRow}>
          <Pressable style={[s.tabBtn, tab === "ai" && s.tabBtnOn]} onPress={() => { tap(); setTab("ai"); }}>
            <Text style={[s.tabT, tab === "ai" && s.tabTOn]}>Ask Wingman</Text>
          </Pressable>
          <Pressable style={[s.tabBtn, tab === "manual" && s.tabBtnOn]} onPress={() => { tap(); setTab("manual"); }}>
            <Text style={[s.tabT, tab === "manual" && s.tabTOn]}>Enter manually</Text>
          </Pressable>
        </View>

        {/* ── AI / NL drafting tab ─────────────────────────────────────────── */}
        {tab === "ai" && (
          <View>
            <LinearGradient colors={[C.card2, C.card]} style={s.aiCard}>
              <Text style={s.aiHeadline}>One sentence.{"\n"}A complete trip drafted.</Text>
              <Text style={s.aiSub}>Describe any booking — flight, hotel, train, car, Airbnb — and Wingman will fill in the details.</Text>
              <TextInput
                style={s.aiInput}
                value={nlText}
                onChangeText={setNlText}
                placeholder={"e.g. Staying at The Hoxton Edinburgh for 5 nights from July 3rd"}
                placeholderTextColor={C.mut}
                multiline
                autoCapitalize="sentences"
                autoCorrect
                returnKeyType="done"
              />
              <Pressable
                style={[s.aiBtn, (!nlText.trim() || drafting) && { opacity: 0.5 }]}
                onPress={draftFromNL}
                disabled={!nlText.trim() || drafting}
              >
                {drafting
                  ? <ActivityIndicator color={C.bg} size="small" />
                  : <Text style={s.aiBtnT}>Draft trip →</Text>
                }
              </Pressable>
            </LinearGradient>

            <Text style={[s.label, { paddingHorizontal: 0, marginTop: 20, marginBottom: 10 }]}>EXAMPLES</Text>
            {[
              "Flying BA 112 from JFK to LHR on July 15th, business class",
              "5 nights at The Hoxton Edinburgh from July 3rd",
              "ScotRail from Edinburgh to Inverness on July 5th at 10am",
              "Hertz SUV pickup at Edinburgh Airport on July 3rd for 5 days",
              "Whisky distillery tour in Speyside on July 6th for 2 people",
            ].map((ex, i) => (
              <Pressable key={i} style={s.exRow} onPress={() => { tap(); setNlText(ex); }}>
                <Text style={s.exT}>{ex}</Text>
                <Text style={s.exArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Manual tab ───────────────────────────────────────────────────── */}
        {tab === "manual" && (
          <View>
            {drafted && (
              <View style={s.draftedBanner}>
                <Text style={s.draftedT}>✓ Drafted by Wingman — review and save</Text>
              </View>
            )}

            {/* Trip Name */}
            <Text style={g.sectionT}>TRIP NAME</Text>
            <Animated.View style={[g.group, { transform: [{ translateX: shake }] }]}>
              <View style={[s.field, { borderBottomWidth: 0 }]}>
                <TextInput
                  style={s.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Scotland, Tokyo Client Trip, Paris Weekend"
                  placeholderTextColor={C.mut}
                  autoCapitalize="words"
                />
              </View>
            </Animated.View>

            {/* Trip Mode */}
            <Text style={g.sectionT}>TRIP MODE</Text>
            <View style={s.modeRow}>
              {MODES.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[s.modeBtn, mode === m.id && s.modeBtnOn]}
                  onPress={() => { tap(); setMode(m.id); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.modeIcon, mode === m.id && { color: C.gold }]}>{m.icon}</Text>
                  <Text style={[s.modeLabel, mode === m.id && s.modeLabelOn]}>{m.label}</Text>
                  <Text style={s.modeDesc}>{m.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Booking Type */}
            <Text style={g.sectionT}>BOOKING TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
                {LEG_TYPES.map(lt => (
                  <Pressable
                    key={lt.id}
                    style={[s.typeChip, legType === lt.id && s.typeChipOn]}
                    onPress={() => { tap(); setLegType(lt.id); setLooked(false); }}
                  >
                    <Text style={[s.typeChipIcon, legType === lt.id && { color: C.gold }]}>{lt.icon}</Text>
                    <Text style={[s.typeChipT, legType === lt.id && s.typeChipTOn]}>{lt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Type-specific fields */}
            {legType === "flight"   && <FlightFields state={leg} set={setF} lookingUp={lookingUp} looked={looked} onFlightQueryChange={onFlightQueryChange} />}
            {legType === "hotel"    && <HotelFields   state={leg} set={setF} />}
            {legType === "airbnb"   && <AirbnbFields  state={leg} set={setF} />}
            {legType === "train"    && <TrainFields    state={leg} set={setF} />}
            {legType === "car"      && <CarFields      state={leg} set={setF} />}
            {legType === "ferry"    && <FerryFields    state={leg} set={setF} />}
            {legType === "activity" && <ActivityFields state={leg} set={setF} />}
            {legType === "event"    && <EventFields    state={leg} set={setF} />}

            <Btn
              title={loading ? "Saving…" : "Save Trip"}
              onPress={save}
              style={{ marginTop: 20 }}
            />
          </View>
        )}

        {/* ── Email forward card ───────────────────────────────────────────── */}
        <View style={s.importCard}>
          <LinearGradient colors={[C.card2, C.card]} style={s.importInner}>
            <View style={s.importIconWrap}>
              <Text style={s.importIc}>✉</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.importT}>Forward any confirmation</Text>
              <Text style={s.importS}>
                Forward booking emails to{" "}
                <Text style={{ color: C.gold, fontFamily: T.sansB }}>import@wingmantravel.app</Text>
                {" "}— Wingman parses them automatically.
              </Text>
            </View>
          </LinearGradient>
          <View style={s.importActions}>
            <Pressable
              style={s.importActionBtn}
              onPress={() => {
                tap();
                Clipboard.setString("import@wingmantravel.app");
                Alert.alert("Copied", "import@wingmantravel.app copied to clipboard.");
              }}
            >
              <Text style={s.importActionT}>Copy address</Text>
            </Pressable>
            <View style={s.importDivider} />
            <Pressable
              style={s.importActionBtn}
              onPress={() => {
                tap();
                Share.share({ message: "import@wingmantravel.app" });
              }}
            >
              <Text style={s.importActionT}>Share</Text>
            </Pressable>
            <View style={s.importDivider} />
            <Pressable
              style={s.importActionBtn}
              onPress={() => { tap(); navigation.navigate("Connections"); }}
            >
              <Text style={s.importActionT}>Connect Gmail →</Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  // Tab switcher
  tabRow:   { flexDirection: "row", gap: 8, marginBottom: 20 },
  tabBtn:   { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  tabBtnOn: { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.08)" },
  tabT:     { color: C.mut, fontSize: 12, fontFamily: T.sansM, letterSpacing: 0.3 },
  tabTOn:   { color: C.gold },

  // AI card
  aiCard:     { borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.line, marginBottom: 4 },
  aiHeadline: { color: C.ink, fontSize: 26, fontFamily: T.serifB, lineHeight: 34, marginBottom: 10 },
  aiSub:      { color: C.mut, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  aiInput: {
    color: C.ink, fontSize: 16, lineHeight: 24, minHeight: 80,
    backgroundColor: C.bg, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.line, marginBottom: 16,
  },
  aiBtn:  { backgroundColor: C.gold, borderRadius: 14, padding: 16, alignItems: "center" },
  aiBtnT: { color: C.bg, fontSize: 15, fontFamily: T.sansB, letterSpacing: 0.5 },

  // Examples
  exRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  exT:    { color: C.mut, fontSize: 13, flex: 1, lineHeight: 19 },
  exArrow:{ color: C.gold, fontSize: 18, marginLeft: 8 },

  // Drafted banner
  draftedBanner: { backgroundColor: "rgba(201,169,110,0.12)", borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "rgba(201,169,110,0.25)" },
  draftedT:      { color: C.gold, fontSize: 13, fontFamily: T.sansM },

  // Mode selector
  modeRow:    { flexDirection: "row", gap: 10, marginBottom: 10 },
  modeBtn:    { flex: 1, alignItems: "center", backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, borderWidth: 1.5, borderColor: "transparent" },
  modeBtnOn:  { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.06)" },
  modeIcon:   { fontSize: 18, marginBottom: 4, color: C.mut },
  modeLabel:  { color: C.mut, fontSize: 13, fontFamily: T.sansB },
  modeLabelOn:{ color: C.gold },
  modeDesc:   { color: C.mut, fontSize: 10, marginTop: 2, textAlign: "center" },

  // Booking type chips
  typeChip:     { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  typeChipOn:   { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.08)" },
  typeChipIcon: { fontSize: 14, color: C.mut },
  typeChipT:    { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  typeChipTOn:  { color: C.gold, fontFamily: T.sansB },

  // Fields
  field: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  label: { color: C.mut, fontSize: 11, fontFamily: T.sansB, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { color: C.ink, fontSize: 16, fontFamily: T.sansM },

  // Lookup badge
  lookedBadge: { backgroundColor: "rgba(201,169,110,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(201,169,110,0.25)" },
  lookedT:     { color: C.gold, fontSize: 11, fontFamily: T.sansB },
  dateBtn:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateBtnT:    { color: C.fg, fontSize: 15, fontFamily: T.sans, flex: 1 },
  dateBtnIcon: { color: C.gold, fontSize: 10, marginLeft: 8 },

  // Email forward card
  importCard:      { marginTop: 28, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  importInner:     { flexDirection: "row", alignItems: "center", gap: 14, padding: 18 },
  importIconWrap:  { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(201,169,110,0.12)", alignItems: "center", justifyContent: "center" },
  importIc:        { fontSize: 20, color: C.gold },
  importT:         { color: C.ink, fontSize: 14, fontFamily: T.sansB, marginBottom: 3 },
  importS:         { color: C.mut, fontSize: 12, lineHeight: 18 },
  importActions:   { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line },
  importActionBtn: { flex: 1, paddingVertical: 13, alignItems: "center" },
  importActionT:   { color: C.gold, fontSize: 13, fontFamily: T.sansM },
  importDivider:   { width: 1, backgroundColor: C.line },
});
