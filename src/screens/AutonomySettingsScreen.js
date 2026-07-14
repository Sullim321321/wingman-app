import React, { useState, useEffect } from "react";
import {
  ScrollView, View, Text, Pressable, StyleSheet,
  Switch, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Slider replaced with Segmented to avoid native dependency
import { C, T } from "../theme";
import { BackBar, Btn, g, tap } from "../components";
import { getPolicy, updatePolicy } from "../api";

const MODES = [
  {
    id: "always_ask",
    icon: "◻",
    title: "Always ask",
    desc: "Wingman surfaces options and waits for your approval before taking any action.",
  },
  {
    id: "auto_under_threshold",
    icon: "◈",
    title: "Auto-approve under threshold",
    desc: "Wingman acts instantly when the rescue cost is below your limit. You approve anything above.",
  },
  {
    id: "fully_auto",
    icon: "◆",
    title: "Full autonomy",
    desc: "Wingman executes the best option automatically. You receive a summary after. Requires a saved traveler profile.",
  },
];

const PAYMENT_PREFS = [
  { id: "cash_first",   label: "Cash first",   desc: "Prefer paying cash over redeeming points." },
  { id: "points_first", label: "Points first",  desc: "Burn points before spending cash." },
  { id: "best_value",   label: "Best value",    desc: "Wingman picks whichever saves the most net value." },
];

const CABIN_PREFS = [
  { id: "economy",  label: "Economy" },
  { id: "premium",  label: "Premium Economy" },
  { id: "business", label: "Business" },
  { id: "first",    label: "First" },
];

export default function AutonomySettingsScreen({ navigation }) {
  const [autonomyMode, setAutonomyMode] = useState("always_ask");
  const [threshold, setThreshold] = useState(500);
  const [paymentPref, setPaymentPref] = useState("best_value");
  const [cabinPref, setCabinPref] = useState("economy");
  const [notifyOnAction, setNotifyOnAction] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPolicy()
      .then((data) => {
        if (data?.policy) {
          const p = data.policy;
          if (p.autonomy_mode) setAutonomyMode(p.autonomy_mode);
          if (p.threshold != null) setThreshold(p.threshold);
          if (p.payment_preference) setPaymentPref(p.payment_preference);
          if (p.cabin_preference) setCabinPref(p.cabin_preference);
          if (p.notify_on_action != null) setNotifyOnAction(p.notify_on_action);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await updatePolicy({
        autonomy_mode: autonomyMode,
        threshold,
        payment_preference: paymentPref,
        cabin_preference: cabinPref,
        notify_on_action: notifyOnAction,
      });
      tap("medium");
      Alert.alert("Policy saved", "Wingman will follow these rules for all future disruptions.");
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.app}>
        <BackBar nav={navigation} label="Autonomy Settings" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.gold} />
        </View>
      </SafeAreaView>
    );
  }

  const dialIndex = Math.max(0, MODES.findIndex((m) => m.id === autonomyMode));

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Autonomy Settings" />

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroH}>You decide how much{"\n"}to delegate.</Text>
          <Text style={s.heroSub}>
            Move the dial to match your comfort. Wingman waits for your word — or handles it silently within the limits you set. Every autonomous action is logged and reversible.
          </Text>
        </View>

        {/* Delegation dial */}
        <View style={s.dialWrap}>
          <View style={s.dialLabels}>
            <Text style={s.dialLabelL}>ASK ME{"\n"}EVERY TIME</Text>
            <Text style={s.dialLabelR}>HANDLE IT{"\n"}SILENTLY</Text>
          </View>
          <View style={s.dialTrack}>
            <View style={s.dialLine} />
            {MODES.map((m, i) => (
              <Pressable key={m.id} style={s.dialStop} onPress={() => { tap(); setAutonomyMode(m.id); }}>
                {dialIndex === i
                  ? <View style={s.dialKnob}><View style={s.dialKnobDot} /></View>
                  : <View style={s.dialDot} />}
              </Pressable>
            ))}
          </View>
          <Text style={s.dialCurrent}>{MODES[dialIndex].title}</Text>
        </View>

        {/* Autonomy mode detail */}
        <Text style={g.sectionT}>WHAT EACH LEVEL DOES</Text>
        <View style={g.group}>
          {MODES.map((m, i) => (
            <Pressable
              key={m.id}
              style={[s.modeRow, i === MODES.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => { tap(); setAutonomyMode(m.id); }}
            >
              <View style={[s.modeRadio, autonomyMode === m.id && s.modeRadioOn]}>
                {autonomyMode === m.id && <View style={s.modeRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={s.modeIcon}>{m.icon}</Text>
                  <Text style={[s.modeTitle, autonomyMode === m.id && { color: C.gold }]}>{m.title}</Text>
                </View>
                <Text style={s.modeDesc}>{m.desc}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Traveler profile prompt — required for fully_auto */}
        {autonomyMode === "fully_auto" && (
          <Pressable
            style={s.profilePrompt}
            onPress={() => navigation.navigate("PassengerProfile")}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.profilePromptT}>Traveler profile required</Text>
              <Text style={s.profilePromptSub}>Wingman needs your name, DOB, and gender to rebook on your behalf. Passport is optional.</Text>
            </View>
            <Text style={{ color: C.gold, fontSize: 18 }}>›</Text>
          </Pressable>
        )}

        {/* Threshold slider — only show for auto mode */}
        {autonomyMode === "auto_under_threshold" && (
          <View>
            <Text style={g.sectionT}>AUTO-APPROVE THRESHOLD</Text>
            <View style={[g.group, { paddingVertical: 20 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <Text style={s.thresholdLabel}>Auto-approve rebooking under</Text>
                <Text style={s.thresholdValue}>${threshold.toFixed(0)}</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {[100, 250, 500, 1000, 2000].map(v => (
                  <Pressable
                    key={v}
                    onPress={() => { tap(); setThreshold(v); }}
                    style={[s.thresholdBtn, threshold === v && s.thresholdBtnActive]}
                  >
                    <Text style={[s.thresholdBtnT, threshold === v && s.thresholdBtnTActive]}>${v.toLocaleString()}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.thresholdNote}>
                Wingman will automatically rebook when the best rescue option costs less than ${threshold.toFixed(0)}. You approve anything above.
              </Text>
            </View>
          </View>
        )}

        {/* Payment preference */}
        <Text style={g.sectionT}>PAYMENT PREFERENCE</Text>
        <View style={g.group}>
          {PAYMENT_PREFS.map((p, i) => (
            <Pressable
              key={p.id}
              style={[s.prefRow, i === PAYMENT_PREFS.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => { tap(); setPaymentPref(p.id); }}
            >
              <View style={[s.modeRadio, paymentPref === p.id && s.modeRadioOn]}>
                {paymentPref === p.id && <View style={s.modeRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.prefTitle, paymentPref === p.id && { color: C.gold }]}>{p.label}</Text>
                <Text style={s.prefDesc}>{p.desc}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Cabin preference */}
        <Text style={g.sectionT}>RESCUE CABIN PREFERENCE</Text>
        <View style={[g.group, { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16 }]}>
          {CABIN_PREFS.map((c) => (
            <Pressable
              key={c.id}
              style={[s.cabinChip, cabinPref === c.id && s.cabinChipOn]}
              onPress={() => { tap(); setCabinPref(c.id); }}
            >
              <Text style={[s.cabinChipT, cabinPref === c.id && s.cabinChipTOn]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Notify on action */}
        <Text style={g.sectionT}>NOTIFICATIONS</Text>
        <View style={g.group}>
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTitle}>Notify when Wingman acts</Text>
              <Text style={s.switchSub}>Receive a push notification every time Wingman takes an autonomous action on your behalf.</Text>
            </View>
            <Switch
              value={notifyOnAction}
              onValueChange={setNotifyOnAction}
              trackColor={{ false: C.line, true: "rgba(201,169,110,0.4)" }}
              thumbColor={notifyOnAction ? C.gold : C.mut}
            />
          </View>
        </View>

        <Btn
          title={saving ? "Saving…" : "Save Policy"}
          onPress={save}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },

  hero: { marginBottom: 20 },
  heroH: { color: C.ink, fontSize: 28, fontFamily: T.serifB, lineHeight: 36, marginBottom: 10 },
  heroSub: { color: C.mut, fontSize: 14, lineHeight: 21 },

  dialWrap: { marginBottom: 26 },
  dialLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  dialLabelL: { color: C.mutD, fontSize: 10, letterSpacing: 2, fontFamily: T.sansM, lineHeight: 14 },
  dialLabelR: { color: C.mut, fontSize: 10, letterSpacing: 2, fontFamily: T.sansM, lineHeight: 14, textAlign: "right" },
  dialTrack: { flexDirection: "row", alignItems: "center", height: 40, position: "relative" },
  dialLine: { position: "absolute", left: 12, right: 12, height: 1, backgroundColor: "rgba(201,169,110,0.35)" },
  dialStop: { flex: 1, alignItems: "center", justifyContent: "center" },
  dialDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: C.mut, backgroundColor: C.bg },
  dialKnob: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: C.gold, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  dialKnobDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.gold },
  dialCurrent: { color: C.gold, fontSize: 15, fontFamily: T.serifB, textAlign: "center", marginTop: 10 },

  modeRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  modeRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.line, alignItems: "center", justifyContent: "center", marginTop: 2 },
  modeRadioOn: { borderColor: C.gold },
  modeRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.gold },
  modeIcon: { fontSize: 14, color: C.gold },
  modeTitle: { color: C.ink, fontSize: 15, fontFamily: T.sansB },
  modeDesc: { color: C.mut, fontSize: 12, lineHeight: 18, marginTop: 3 },

  thresholdLabel: { color: C.mut, fontSize: 13 },
  thresholdValue: { color: C.gold, fontSize: 26, fontFamily: T.serifB },
  sliderEdge: { color: C.mut, fontSize: 11 },
  thresholdBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  thresholdBtnActive: { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.1)" },
  thresholdBtnT: { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  thresholdBtnTActive: { color: C.gold },
  thresholdNote: { color: C.mut, fontSize: 12, lineHeight: 18, marginTop: 8 },

  prefRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  prefTitle: { color: C.ink, fontSize: 14, fontFamily: T.sansB },
  prefDesc: { color: C.mut, fontSize: 12, lineHeight: 18, marginTop: 2 },

  cabinChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  cabinChipOn: { borderColor: C.gold, backgroundColor: "rgba(201,169,110,0.1)" },
  cabinChipT: { color: C.mut, fontSize: 13, fontFamily: T.sansM },
  cabinChipTOn: { color: C.gold },

  switchRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  switchTitle: { color: C.ink, fontSize: 15, fontFamily: T.sansB },
  switchSub: { color: C.mut, fontSize: 12, lineHeight: 18, marginTop: 3 },

  profilePrompt: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.gold + "40", marginBottom: 16 },
  profilePromptT: { color: C.ink, fontSize: 14, fontFamily: T.sansB, marginBottom: 2 },
  profilePromptSub: { color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 17 },
});
