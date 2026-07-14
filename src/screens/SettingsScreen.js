// SettingsScreen — Trust Controls & Preferences
// Warm espresso palette + champagne gold + DM Sans

import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView, ScrollView, View, Text, Switch, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { C, T } from "../theme";
import { useTheme } from "../ThemeContext";
import { BackBar, Segmented, SetRow, Chip, Btn, g } from "../components";
import { useAuth } from "../auth";
import { getPolicy, updatePolicy, updateLocale, getHotelAffinity, removeHotelAffinity, updateBriefingTime, getInstructions, deleteInstruction } from "../api";
import { registerForPush } from "../notify";

export const LOCATION_OPT_IN_KEY = "wingman_location_opt_in";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
];

const CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "AED", "SGD",
];

const TIER_LABELS = {
  luxury: "Luxury", boutique: "Boutique", lifestyle: "Lifestyle",
  business: "Business", value: "Value",
};

// ── Hotel Affinity Section ────────────────────────────────────────────────────
function HotelAffinitySection() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getHotelAffinity();
      setHotels(data?.hotels || []);
    } catch (e) {
      // Silently fail — section just stays empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function confirmRemove(propertyName) {
    Alert.alert(
      "Remove from profile",
      `Remove "${propertyName}" from your learned preferences? Wingman will no longer use it as a reference when recommending hotels.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            try {
              await removeHotelAffinity(propertyName);
              setHotels(prev => prev.filter(h => h.property_name !== propertyName));
            } catch (e) {
              Alert.alert("Error", "Couldn't remove — try again.");
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={s.affinityWrap}>
        <ActivityIndicator color={C.gold} size="small" />
      </View>
    );
  }

  if (hotels.length === 0) {
    return (
      <View style={s.affinityWrap}>
        <Text style={s.affinityEmpty}>
          Connect Gmail to let Wingman learn your hotel preferences from your booking history. Once learned, Wingman will always recommend the closest match to your favourite properties.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.affinityWrap}>
      <Text style={s.affinityIntro}>
        Wingman has learned your hotel preferences from your booking history. These are used to personalise every hotel recommendation — if your favourite brand exists in a destination, it's always the first suggestion.
      </Text>
      {hotels.map((h, i) => {
        const attrs = h.attributes || {};
        const tags = Object.entries(attrs)
          .filter(([, v]) => v)
          .map(([k]) => k.replace(/_/g, " "))
          .join(" · ");
        const loc = [h.city, h.country].filter(Boolean).join(", ");
        return (
          <View key={i} style={[s.affinityRow, i === hotels.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={s.affinityLeft}>
              <Text style={s.affinityName}>{h.property_name}</Text>
              <Text style={s.affinitySub}>
                {[
                  loc,
                  h.brand,
                  h.tier ? TIER_LABELS[h.tier] || h.tier : null,
                  h.stay_count > 1 ? `${h.stay_count} stays` : null,
                ].filter(Boolean).join(" · ")}
              </Text>
              {tags ? <Text style={s.affinityTags}>{tags}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => confirmRemove(h.property_name)} style={s.affinityRemove}>
              <Text style={s.affinityRemoveT}>✕</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

// ── Concierge Memory Section ─────────────────────────────────────────────────
function ConciergeMemorySection() {
  const [instructions, setInstructions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getInstructions();
      setInstructions(data?.instructions || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function confirmDelete(id, text) {
    Alert.alert(
      "Forget this?",
      `Remove "${text}" from Wingman's memory? It will no longer apply to future conversations.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Forget", style: "destructive",
          onPress: async () => {
            try {
              await deleteInstruction(id);
              setInstructions(prev => prev.filter(i => i.id !== id));
            } catch {
              Alert.alert("Error", "Couldn't remove — try again.");
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={s.memoryWrap}>
        <ActivityIndicator color={C.gold} size="small" />
      </View>
    );
  }

  if (instructions.length === 0) {
    return (
      <View style={s.memoryWrap}>
        <Text style={s.memoryEmpty}>
          When you tell Wingman something like "always book me an aisle seat" or "never suggest economy," it remembers and applies it automatically. Nothing remembered yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.memoryWrap}>
      <Text style={s.memoryIntro}>
        Wingman applies these automatically in every conversation.
      </Text>
      {instructions.map((item, i) => (
        <View key={item.id} style={[s.memoryRow, i === instructions.length - 1 && { borderBottomWidth: 0 }]}>
          <Text style={s.memoryText} numberOfLines={2}>{item.instruction}</Text>
          <TouchableOpacity onPress={() => confirmDelete(item.id, item.instruction)} style={s.memoryRemove}>
            <Text style={s.memoryRemoveT}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export default function SettingsScreen({ navigation }) {
  const { email, signOut } = useAuth();
  const { appearance, setAppearance } = useTheme();

  // Alert toggles
  const [weather, setWeather] = useState(true);
  const [drops,   setDrops]   = useState(true);
  const [quiet,   setQuiet]   = useState(false);

  // Location opt-in
  const [locationEnabled, setLocationEnabled] = useState(false);

  // Push notifications
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading]  = useState(false);

  // Locale
  const [locale,   setLocale]   = useState("en");
  const [currency, setCurrency] = useState("USD");

  // Morning briefing time
  const [briefingHour, setBriefingHour]       = useState(7);
  const [briefingEnabled, setBriefingEnabled] = useState(true);

  // UI state
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);

  useEffect(() => {
    loadPolicy();
    AsyncStorage.getItem(LOCATION_OPT_IN_KEY).then(v => {
      if (v === "true") setLocationEnabled(true);
    }).catch(() => {});
    // Check current push permission status
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPushEnabled(status === "granted");
    }).catch(() => {});
  }, []);

  async function loadPolicy() {
    try {
      const data = await getPolicy();
      const p = data?.policy || {};
      if (p.weather_alerts != null) setWeather(p.weather_alerts);
      if (p.price_alerts   != null) setDrops(p.price_alerts);
      if (p.quiet_hours    != null) setQuiet(p.quiet_hours);
      if (p.locale)   setLocale(p.locale);
      if (p.currency) setCurrency(p.currency);
      if (p.briefing_hour != null) setBriefingHour(p.briefing_hour);
      if (p.briefing_enabled != null) setBriefingEnabled(p.briefing_enabled);
    } catch (e) {
      console.warn("SettingsScreen loadPolicy:", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(field, value) {
    if (field === "weather_alerts") setWeather(value);
    if (field === "price_alerts")   setDrops(value);
    if (field === "quiet_hours")    setQuiet(value);
    try {
      await updatePolicy({ [field]: value });
    } catch (e) {
      if (field === "weather_alerts") setWeather(!value);
      if (field === "price_alerts")   setDrops(!value);
      if (field === "quiet_hours")    setQuiet(!value);
      console.warn("SettingsScreen toggle save failed:", e.message);
    }
  }

  async function handlePushToggle(value) {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      if (value) {
        const token = await registerForPush();
        if (token) {
          setPushEnabled(true);
        } else {
          Alert.alert(
            "Notifications blocked",
            "To receive flight alerts and your morning briefing, enable notifications in Settings › Notifications › Wingman.",
            [{ text: "OK" }]
          );
        }
      } else {
        // Can't revoke programmatically — direct to Settings
        Alert.alert(
          "Turn off notifications",
          "To disable notifications, go to Settings › Notifications › Wingman and turn off Allow Notifications.",
          [{ text: "OK" }]
        );
      }
    } catch (e) {
      console.warn("[Settings] push toggle error:", e.message);
    } finally {
      setPushLoading(false);
    }
  }

  async function handleLocationToggle(value) {
    if (value) {
      // Request permission before enabling
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location access needed",
          "To give you local recommendations, Wingman needs location access. You can enable it in Settings › Privacy › Location Services.",
          [{ text: "OK" }]
        );
        return;
      }
    }
    setLocationEnabled(value);
    await AsyncStorage.setItem(LOCATION_OPT_IN_KEY, value ? "true" : "false");
  }

  async function handleLocaleChange(newLocale, newCurrency) {
    const l = newLocale   ?? locale;
    const c = newCurrency ?? currency;
    if (newLocale)   setLocale(l);
    if (newCurrency) setCurrency(c);
    try {
      await updateLocale({ locale: l, currency: c });
    } catch (e) {
      console.warn("SettingsScreen locale save failed:", e.message);
    }
  }

  const sw = (v, field) => (
    <Switch
      value={v}
      onValueChange={(val) => handleToggle(field, val)}
      trackColor={{ true: C.teal, false: C.card2 }}
      thumbColor={v ? C.inkD : C.mut}
      ios_backgroundColor={C.card2}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={s.app}>
        <BackBar nav={navigation} label="Settings" />
        <ActivityIndicator color={C.gold} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Settings" />

        <View style={g.trustNote}>
          <Text style={g.trustNoteT}>
            You're always in control.{" "}
            <Text style={{ color: C.gold, fontFamily: T.sansB }}>
              Wingman never moves money or books above your limit without an explicit "yes."
            </Text>
          </Text>
        </View>

        {/* ── Briefing time hero ────────────────────────────────────────────────
            Was a ROW: label+time on the left, four time buttons and a switch on
            the right. The button cluster has a fixed width, so it squeezed the
            left column until the text broke MID-WORD — "MORNIN / G BRIEFIN / G",
            and "7:0 / 0". A column can't be squeezed, because nothing is
            competing for the width. */}
        <View style={s.briefingHero}>
          <View style={s.briefingHeroTop}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.briefingHeroLabel} numberOfLines={1}>MORNING BRIEFING</Text>
              <Text style={s.briefingHeroTime} numberOfLines={1}>{briefingHour}:00</Text>
            </View>
            <Switch
              value={briefingEnabled}
              onValueChange={async (val) => {
                setBriefingEnabled(val);
                try { await updateBriefingTime(briefingHour); } catch {}
              }}
              trackColor={{ true: C.teal, false: C.card2 }}
              thumbColor={briefingEnabled ? C.inkD : C.mut}
              ios_backgroundColor={C.card2}
            />
          </View>

          <Text style={s.briefingHeroSub}>
            {briefingEnabled ? "Your brief arrives each morning at this time." : "Daily briefing is paused."}
          </Text>

          <View style={s.briefingTimeRow}>
            {[6, 7, 8, 9].map(h => (
              <TouchableOpacity
                key={h}
                onPress={async () => {
                  setBriefingHour(h);
                  try { await updateBriefingTime(h); } catch {}
                }}
                style={[s.briefingTimeBtn, briefingHour === h && s.briefingTimeBtnActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: briefingHour === h }}
                accessibilityLabel={`Briefing at ${h} a.m.`}
              >
                <Text style={[s.briefingTimeBtnT, briefingHour === h && s.briefingTimeBtnTActive]}>
                  {h}am
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={g.sectionT}>ALERTS & MONITORING</Text>
        <View style={g.group}>
          <SetRow
            icon="notifications-outline"
            iconColor={C.mut}
            t="Push notifications"
            sub={pushEnabled ? "On — delays, gate changes, daily brief" : "Off — turn on for alerts & briefing"}
            right={
              pushLoading
                ? <ActivityIndicator color={C.gold} size="small" />
                : <Switch value={pushEnabled} onValueChange={handlePushToggle} trackColor={{ true: C.teal, false: C.card2 }} thumbColor={pushEnabled ? C.ink : C.mut} ios_backgroundColor={C.card2} />
            }
          />
          <SetRow icon="cloud-outline" iconColor={C.mut} t="Weather & delay watch" sub="Predict disruptions before the airline" right={sw(weather, "weather_alerts")} />
          <SetRow icon="pricetag-outline" iconColor={C.mut} t="Price & seat-drop alerts" sub="Better seats or fares on booked trips" right={sw(drops, "price_alerts")} />
          <SetRow icon="moon-outline" iconColor={C.mut} t="Quiet hours" sub="Hold non-urgent pings 10p–7a" right={sw(quiet, "quiet_hours")} />
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow icon="location-outline" iconColor={C.mut} t="Use my location" sub="For local restaurant, hotel & experience picks" right={<Switch value={locationEnabled} onValueChange={handleLocationToggle} trackColor={{ true: C.teal, false: C.card2 }} thumbColor={locationEnabled ? C.ink : C.mut} ios_backgroundColor={C.card2} />} />
          </View>
        </View>

        <Text style={g.sectionT}>YOUR PROFILE</Text>
        <View style={g.group}>
          <SetRow icon="person-outline" iconColor={C.mut} t="About me" sub="Identity, preferences, learned hotels & saved instructions" right={<Chip color={C.gold}>View ›</Chip>} onPress={() => navigation.navigate("Memory")} />
          <SetRow icon="airplane-outline" iconColor={C.mut} t="Travel profile" sub="Home airports, seat & cabin, pace, payment" right={<Chip color={C.gold}>Edit ›</Chip>} onPress={() => navigation.navigate("TravelProfile")} />
          <SetRow icon="sparkles-outline" iconColor={C.mut} t="Taste & preferences" sub="Editorial sources, hotel specs, dining, dietary" right={<Chip color={C.gold}>Edit ›</Chip>} onPress={() => navigation.navigate("TasteSetup", { fromSettings: true })} />
          <SetRow icon="home-outline" iconColor={C.mut} t="Home address" sub="Pre-filled as your dropoff when you land" right={<Chip color={C.teal}>Set ›</Chip>} onPress={() => navigation.navigate("HomeAddress")} />
          <SetRow icon="ribbon-outline" iconColor={C.mut} t="Loyalty & lounges" sub="Frequent flyer, hotel programs, lounge cards" right={<Chip color={C.teal}>Manage ›</Chip>} onPress={() => navigation.navigate("Loyalty")} />
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow icon="card-outline" iconColor={C.mut} t="Traveler ID" sub="Name, DOB, passport — for autonomous rebooking" right={<Chip color={C.gold}>Edit ›</Chip>} onPress={() => navigation.navigate("PassengerProfile")} />
          </View>
        </View>

        <Text style={g.sectionT}>AUTOMATION & DATA</Text>
        <View style={g.group}>
          <SetRow icon="options-outline" iconColor={C.mut} t="Autonomy & delegation" sub="How much Wingman does on its own, approval limits" right={<Chip color={C.gold}>Edit ›</Chip>} onPress={() => navigation.navigate("Autonomy")} />
          <SetRow icon="link-outline" iconColor={C.mut} t="Connected accounts & privacy" sub="Gmail, Calendar, Messages — explicit opt-in only" right={<Chip color={C.teal}>Manage ›</Chip>} onPress={() => navigation.navigate("Connections")} />
          <View style={{ borderBottomWidth: 0 }}>
            {/* The alternative to handing over the mailbox. */}
            <SetRow icon="mail-outline" iconColor={C.mut} t="Forward your bookings" sub="Your private import address — no Gmail access needed" right={<Chip color={C.gold}>Set up ›</Chip>} onPress={() => navigation.navigate("Forwarding")} />
          </View>
        </View>

        <Text style={g.sectionT}>PREFERENCES</Text>
        <View style={g.group}>
          <SetRow
            icon="contrast-outline"
            iconColor={C.mut}
            t="Colour scheme"
            sub="System follows your iPhone"
            right={
              <View style={{ flexDirection: "row", gap: 6 }}>
                {["system", "dark", "light"].map(opt => (
                  <TouchableOpacity key={opt} onPress={() => setAppearance(opt)} style={[s.themeBtn, appearance === opt && s.themeBtnActive]}>
                    <Text style={[s.themeBtnT, appearance === opt && s.themeBtnTActive]}>
                      {opt === "system" ? "Auto" : opt === "dark" ? "Dark" : "Light"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            }
          />
          <View style={s.localeRow}>
            <Text style={s.localeLabel}>Language</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {LANGUAGES.map((lang) => (
                <Chip key={lang.code} color={locale === lang.code ? C.gold : undefined} onPress={() => handleLocaleChange(lang.code, null)} style={s.localeChip}>{lang.label}</Chip>
              ))}
            </ScrollView>
          </View>
          <View style={[s.localeRow, { borderBottomWidth: 0 }]}>
            <Text style={s.localeLabel}>Currency</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {CURRENCIES.map((cur) => (
                <Chip key={cur} color={currency === cur ? C.teal : undefined} onPress={() => handleLocaleChange(null, cur)} style={s.localeChip}>{cur}</Chip>
              ))}
            </ScrollView>
          </View>
        </View>

        <Text style={g.sectionT}>SUBSCRIPTION</Text>
        <View style={g.group}>
          <SetRow icon="diamond-outline" iconColor={C.mut} t="Wingman Pro / Elite" sub="Subscription, payment & billing" right={<Chip color={C.gold}>Manage ›</Chip>} onPress={() => navigation.navigate("Subscription")} />
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow icon="gift-outline" iconColor={C.mut} t="Invite a friend" sub="They start with points. So do you, once they travel." right={<Chip color={C.teal}>Invite ›</Chip>} onPress={() => navigation.navigate("Invite")} />
          </View>
        </View>

        <Text style={g.sectionT}>ACCOUNT</Text>
        <Text style={s.acct}>Signed in as {email || "—"}</Text>
        <Btn title="Sign out" kind="ghost" onPress={signOut} />
        <Text style={s.versionT}>Wingman · v1.0.115</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:  { flex: 1, backgroundColor: C.bg },
  acct: { color: C.mut, fontSize: 14, fontFamily: T.sans, marginBottom: 14, letterSpacing: 0.1 },
  versionT: { color: C.mut, fontSize: 11, fontFamily: T.sans, textAlign: "center", marginTop: 8, marginBottom: 24, opacity: 0.5 },
  localeRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  localeLabel: {
    color: C.mut,
    fontSize: 11,
    fontFamily: T.sansB,
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  chipScroll: { flexGrow: 0 },
  localeChip: { marginRight: 8 },
  // Hotel affinity
  affinityWrap: {
    backgroundColor: C.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    overflow: "hidden",
  },
  affinityIntro: {
    color: C.mut,
    fontSize: 13,
    fontFamily: T.sans,
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  affinityEmpty: {
    color: C.mut,
    fontSize: 13,
    fontFamily: T.sans,
    lineHeight: 19,
    padding: 16,
  },
  affinityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  affinityLeft: { flex: 1 },
  affinityName: {
    color: C.ink,
    fontSize: 15,
    fontFamily: T.sansB,
    marginBottom: 2,
  },
  affinitySub: {
    color: C.mut,
    fontSize: 12,
    fontFamily: T.sans,
  },
  affinityTags: {
    color: C.gold,
    fontSize: 11,
    fontFamily: T.sans,
    marginTop: 3,
    textTransform: "lowercase",
  },
  affinityRemove: {
    padding: 8,
    marginLeft: 8,
  },
  affinityRemoveT: {
    color: C.mut,
    fontSize: 14,
    fontFamily: T.sans,
  },
  // Concierge memory
  memoryWrap: {
    backgroundColor: C.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    overflow: "hidden",
  },
  memoryIntro: {
    color: C.mut,
    fontSize: 13,
    fontFamily: T.sans,
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  memoryEmpty: {
    color: C.mut,
    fontSize: 13,
    fontFamily: T.sans,
    lineHeight: 19,
    padding: 16,
  },
  memoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  memoryText: {
    flex: 1,
    color: C.ink,
    fontSize: 14,
    fontFamily: T.sans,
    lineHeight: 20,
  },
  memoryRemove: {
    padding: 8,
    marginLeft: 8,
  },
  memoryRemoveT: {
    color: C.mut,
    fontSize: 14,
    fontFamily: T.sans,
  },
  themeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card2,
  },
  themeBtnActive: {
    borderColor: C.gold,
    backgroundColor: `${C.gold}18`,
  },
  themeBtnT: {
    color: C.mut,
    fontSize: 11,
    fontFamily: T.sansM,
    letterSpacing: 0.5,
  },
  themeBtnTActive: {
    color: C.gold,
  },
  // Quick profile shortcuts
  // ── Briefing hero card ──
  briefingHero: {
    marginHorizontal: 20,
    marginBottom: 20,
    marginTop: 4,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "rgba(201,169,110,0.25)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  briefingHeroTop: { flexDirection: "row", alignItems: "center" },
  briefingTimeRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  briefingHeroLabel: {
    fontFamily: T.sansM,
    fontSize: 9,
    letterSpacing: 2,
    color: C.mutD,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  briefingHeroTime: {
    fontFamily: T.garamondSI,
    fontSize: 40,
    color: C.ink,
    lineHeight: 44,
    letterSpacing: -1,
  },
  briefingHeroSub: {
    fontFamily: T.sans,
    fontSize: 12,
    color: C.mut,
    marginTop: 4,
    lineHeight: 16,
  },
  briefingTimeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: C.card2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
  },
  briefingTimeBtnActive: {
    backgroundColor: "rgba(201,169,110,0.15)",
    borderColor: C.gold,
  },
  briefingTimeBtnT: {
    fontFamily: T.sansM,
    fontSize: 12,
    color: C.mut,
  },
  briefingTimeBtnTActive: { color: C.gold },

  profileShortcuts: { marginBottom: 20 },
  profileShortcutsLabel: { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" },
  profileShortcutCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1,
    borderColor: C.gold + "30", padding: 14, alignItems: "flex-start",
  },
  profileShortcutIc:    { color: C.gold, fontSize: 18, marginBottom: 8 },
  profileShortcutLabel: { color: C.ink, fontSize: 12, fontFamily: T.sansB, marginBottom: 3 },
  profileShortcutSub:   { color: C.mut, fontSize: 10, fontFamily: T.sans, lineHeight: 14 },
});
