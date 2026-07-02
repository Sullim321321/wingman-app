import React, { useState, useRef, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, TouchableOpacity,
  StyleSheet, Animated, Dimensions,
} from "react-native";
import { C, T } from "../theme";
import { Btn, tap } from "../components";
import { updateProfile, getMe } from "../api";

const { width } = Dimensions.get("window");

// ─── Data ────────────────────────────────────────────────────────────────────

const SOURCES = [
  { id: "nyt36", label: "NYT 36 Hours", desc: "Dense city itineraries for short trips", icon: "📰" },
  { id: "service95", label: "Service95", desc: "Dua Lipa's cultural concierge — arts, dining, nightlife", icon: "✨" },
  { id: "hotelsabovepar", label: "Hotels Above Par", desc: "Design-forward boutique hotels only", icon: "🏨" },
  { id: "slh", label: "Small Luxury Hotels", desc: "750-criteria inspected independent luxury", icon: "🗝️" },
  { id: "afar", label: "AFAR", desc: "Experiential travel & cultural immersion", icon: "🌍" },
  { id: "travelandleisure", label: "Travel + Leisure", desc: "Established luxury, World's Best lists", icon: "🌴" },
  { id: "cntraveler", label: "Condé Nast Traveler", desc: "Gold List, Hot List, prestige picks", icon: "👑" },
  { id: "monocle", label: "Monocle", desc: "City intelligence, quality of life, local culture", icon: "🔍" },
  { id: "tablet", label: "Tablet Hotels", desc: "Curated independent hotels, no chains", icon: "🛎️" },
  { id: "eater", label: "Eater", desc: "Restaurant openings, heat maps, dining culture", icon: "🍽️" },
];

const HOTEL_PREFS = [
  { id: "high_floor", label: "High floor", icon: "🏙️" },
  { id: "quiet_room", label: "Quiet room", icon: "🔇" },
  { id: "away_elevator", label: "Away from elevator", icon: "🚶" },
  { id: "bathtub", label: "Bathtub required", icon: "🛁" },
  { id: "firm_pillow", label: "Firm pillow", icon: "💤" },
  { id: "late_checkout", label: "Late checkout", icon: "⏰" },
  { id: "room_service", label: "24h room service", icon: "🍳" },
  { id: "fast_wifi", label: "Fast Wi-Fi", icon: "📶" },
  { id: "no_resort_fee", label: "No resort fees", icon: "💳" },
  { id: "gym", label: "Gym access", icon: "🏋️" },
];

const SEAT_PREFS = [
  {
    cabin: "Economy",
    icon: "🪑",
    options: [
      { id: "econ_aisle", label: "Aisle" },
      { id: "econ_window", label: "Window" },
      { id: "econ_exit_row", label: "Exit row" },
      { id: "econ_bulkhead", label: "Bulkhead" },
    ],
  },
  {
    cabin: "Premium Economy",
    icon: "🪑✨",
    options: [
      { id: "pe_aisle", label: "Aisle" },
      { id: "pe_window", label: "Window" },
      { id: "pe_bulkhead", label: "Bulkhead" },
    ],
  },
  {
    cabin: "Business",
    icon: "💺",
    options: [
      { id: "biz_window_suite", label: "Window suite" },
      { id: "biz_aisle", label: "Aisle / direct aisle access" },
      { id: "biz_bulkhead_behind", label: "Bulkhead behind (privacy)" },
      { id: "biz_forward_facing", label: "Forward facing only" },
    ],
  },
  {
    cabin: "First",
    icon: "🛋️",
    options: [
      { id: "first_suite", label: "Enclosed suite" },
      { id: "first_forward", label: "Forward facing" },
      { id: "first_window", label: "Window / wall side" },
    ],
  },
];

const FOOD_PREFS = [
  { id: "vegetarian", label: "Vegetarian", icon: "🥗" },
  { id: "vegan", label: "Vegan", icon: "🌱" },
  { id: "gluten_free", label: "Gluten-free", icon: "🌾" },
  { id: "halal", label: "Halal", icon: "☪️" },
  { id: "kosher", label: "Kosher", icon: "✡️" },
  { id: "no_shellfish", label: "No shellfish", icon: "🦐" },
  { id: "no_nuts", label: "No nuts", icon: "🥜" },
  { id: "low_fodmap", label: "Low FODMAP", icon: "🍽️" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepHeader({ step, total, title, sub }) {
  return (
    <View style={s.stepHeader}>
      <Text style={s.stepCount}>{step} of {total}</Text>
      <Text style={s.stepTitle}>{title}</Text>
      {sub ? <Text style={s.stepSub}>{sub}</Text> : null}
    </View>
  );
}

function ToggleChip({ icon, label, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[s.chip, selected && s.chipOn]}
      onPress={() => { tap(); onPress(); }}
      activeOpacity={0.8}
    >
      <Text style={s.chipIcon}>{icon}</Text>
      <Text style={[s.chipLabel, selected && s.chipLabelOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ToggleRow({ icon, label, desc, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[s.row, selected && s.rowOn]}
      onPress={() => { tap(); onPress(); }}
      activeOpacity={0.8}
    >
      <Text style={s.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, selected && s.rowLabelOn]}>{label}</Text>
        {desc ? <Text style={s.rowDesc}>{desc}</Text> : null}
      </View>
      <View style={[s.check, selected && s.checkOn]}>
        {selected && <Text style={s.checkMark}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step1Sources({ selected, toggle }) {
  return (
    <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
      <StepHeader
        step={1} total={4}
        title="Your editorial sources"
        sub="Wingman reads these to surface recommendations that match your taste — not the algorithm's."
      />
      {SOURCES.map(src => (
        <ToggleRow
          key={src.id}
          icon={src.icon}
          label={src.label}
          desc={src.desc}
          selected={selected.includes(src.id)}
          onPress={() => toggle(src.id)}
        />
      ))}
    </ScrollView>
  );
}

function Step2Hotels({ selected, toggle }) {
  return (
    <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
      <StepHeader
        step={2} total={4}
        title="Hotel soft-specs"
        sub="Wingman injects these into your hotel reservation automatically before every stay."
      />
      <View style={s.chipGrid}>
        {HOTEL_PREFS.map(p => (
          <ToggleChip
            key={p.id}
            icon={p.icon}
            label={p.label}
            selected={selected.includes(p.id)}
            onPress={() => toggle(p.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function Step3Seats({ selected, toggle }) {
  return (
    <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
      <StepHeader
        step={3} total={4}
        title="Seat preferences"
        sub="Set your preference per cabin class. Wingman will alert you when your ideal seat opens."
      />
      {SEAT_PREFS.map(cabin => (
        <View key={cabin.cabin} style={s.cabinBlock}>
          <Text style={s.cabinLabel}>{cabin.icon}  {cabin.cabin.toUpperCase()}</Text>
          <View style={s.chipGrid}>
            {cabin.options.map(opt => (
              <ToggleChip
                key={opt.id}
                icon=""
                label={opt.label}
                selected={selected.includes(opt.id)}
                onPress={() => toggle(opt.id)}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Step4Food({ selected, toggle }) {
  return (
    <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
      <StepHeader
        step={4} total={4}
        title="Dietary preferences"
        sub="Used for airline meal requests and restaurant recommendations."
      />
      <View style={s.chipGrid}>
        {FOOD_PREFS.map(p => (
          <ToggleChip
            key={p.id}
            icon={p.icon}
            label={p.label}
            selected={selected.includes(p.id)}
            onPress={() => toggle(p.id)}
          />
        ))}
      </View>
      <View style={s.skipNote}>
        <Text style={s.skipNoteT}>No dietary restrictions? Just tap Continue.</Text>
      </View>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TasteSetupScreen({ navigation, route }) {
  const fromSettings = route?.params?.fromSettings;
  const [step, setStep] = useState(1);
  const [sources, setSources] = useState([]);
  const [hotelPrefs, setHotelPrefs] = useState([]);
  const [seatPrefs, setSeatPrefs] = useState([]);
  const [foodPrefs, setFoodPrefs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!fromSettings);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // When opened from Settings, pre-load existing saved preferences
  useEffect(() => {
    if (!fromSettings) return;
    getMe().then(data => {
      const prefs = data?.preferences || {};
      if (prefs.editorial_sources?.length) setSources(prefs.editorial_sources);
      if (prefs.hotel_prefs?.length) setHotelPrefs(prefs.hotel_prefs);
      if (prefs.seat_prefs?.length) setSeatPrefs(prefs.seat_prefs);
      if (prefs.food_prefs?.length) setFoodPrefs(prefs.food_prefs);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [fromSettings]);

  function toggleItem(list, setList, id) {
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function animateNext(nextStep) {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -20, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(nextStep);
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await updateProfile({
        preferences: {
          editorial_sources: sources,
          hotel_prefs: hotelPrefs,
          seat_prefs: seatPrefs,
          food_prefs: foodPrefs,
          taste_setup_complete: true,
        },
      });
    } catch (e) {
      console.warn("Profile save error:", e.message);
    } finally {
      setSaving(false);
      if (fromSettings) {
        navigation.goBack();
      } else {
        navigation.reset({ index: 0, routes: [{ name: "Main" }] });
      }
    }
  }

  const isLast = step === 4;

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.mut, fontFamily: T.sans, fontSize: 14 }}>Loading your preferences…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Progress bar */}
      <View style={s.progressBar}>
        {[1, 2, 3, 4].map(n => (
          <View key={n} style={[s.progressDot, step >= n && s.progressDotOn]} />
        ))}
      </View>

      <Animated.View style={[s.stepWrap, { transform: [{ translateX: slideAnim }] }]}>
        {step === 1 && (
          <Step1Sources
            selected={sources}
            toggle={(id) => toggleItem(sources, setSources, id)}
          />
        )}
        {step === 2 && (
          <Step2Hotels
            selected={hotelPrefs}
            toggle={(id) => toggleItem(hotelPrefs, setHotelPrefs, id)}
          />
        )}
        {step === 3 && (
          <Step3Seats
            selected={seatPrefs}
            toggle={(id) => toggleItem(seatPrefs, setSeatPrefs, id)}
          />
        )}
        {step === 4 && (
          <Step4Food
            selected={foodPrefs}
            toggle={(id) => toggleItem(foodPrefs, setFoodPrefs, id)}
          />
        )}
      </Animated.View>

      {/* Footer buttons */}
      <View style={s.footer}>
        {step > 1 && (
          <TouchableOpacity onPress={() => setStep(s => s - 1)} style={s.backBtn}>
            <Text style={s.backBtnT}>← Back</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Btn
            title={isLast ? (saving ? "Saving…" : "Save my taste profile") : "Continue →"}
            onPress={isLast ? handleFinish : () => animateNext(step + 1)}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  progressBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.card2,
  },
  progressDotOn: { backgroundColor: C.teal },
  stepWrap: { flex: 1 },
  stepContent: { paddingHorizontal: 20, paddingBottom: 24 },
  stepHeader: { marginBottom: 24, paddingTop: 8 },
  stepCount: { color: C.teal, fontSize: 12, fontFamily: T.sansB, letterSpacing: 1, marginBottom: 6 },
  stepTitle: { color: C.ink, fontSize: 22, fontFamily: T.sansB, marginBottom: 8 },
  stepSub: { color: C.mut, fontSize: 14, lineHeight: 20 },

  // Row toggle (for sources)
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowOn: { borderColor: C.teal, backgroundColor: "#0D2A22" },
  rowIcon: { fontSize: 20, marginRight: 12 },
  rowLabel: { color: C.ink, fontSize: 15, fontFamily: T.sansM },
  rowLabelOn: { color: C.teal },
  rowDesc: { color: C.mut, fontSize: 12, marginTop: 2 },
  check: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: C.mut,
    alignItems: "center", justifyContent: "center",
  },
  checkOn: { backgroundColor: C.teal, borderColor: C.teal },
  checkMark: { color: "#000", fontSize: 12, fontFamily: T.sansB },

  // Chip grid (for hotel/seat/food prefs)
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 6,
  },
  chipOn: { borderColor: C.teal, backgroundColor: "#0D2A22" },
  chipIcon: { fontSize: 14 },
  chipLabel: { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  chipLabelOn: { color: C.teal },

  // Cabin block (seat prefs)
  cabinBlock: { marginBottom: 20 },
  cabinLabel: { color: C.mut, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1, marginBottom: 10 },

  // Food skip note
  skipNote: { marginTop: 16, alignItems: "center" },
  skipNoteT: { color: C.mut, fontSize: 13 },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.card,
  },
  backBtn: { paddingVertical: 12, paddingHorizontal: 4 },
  backBtnT: { color: C.mut, fontSize: 15 },
});
