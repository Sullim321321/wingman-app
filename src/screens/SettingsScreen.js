// SettingsScreen — Trust Controls & Preferences
// Warm espresso palette + champagne gold + DM Sans

import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView, ScrollView, View, Text, Switch, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { C, T } from "../theme";
import { BackBar, Segmented, SetRow, Chip, Btn, g } from "../components";
import { useAuth } from "../auth";
import { getPolicy, updatePolicy, updateLocale, getHotelAffinity, removeHotelAffinity } from "../api";

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

export default function SettingsScreen({ navigation }) {
  const { email, signOut } = useAuth();

  // Alert toggles
  const [weather, setWeather] = useState(true);
  const [drops,   setDrops]   = useState(true);
  const [quiet,   setQuiet]   = useState(false);

  // Locale
  const [locale,   setLocale]   = useState("en");
  const [currency, setCurrency] = useState("USD");

  // UI state
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);

  useEffect(() => {
    loadPolicy();
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
      trackColor={{ true: C.gold, false: C.card2 }}
      thumbColor={v ? C.inkD : C.mut}
      ios_backgroundColor={C.card2}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={s.app}>
        <BackBar nav={navigation} label="Trust controls" />
        <ActivityIndicator color={C.gold} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Trust controls" />

        <View style={g.trustNote}>
          <Text style={g.trustNoteT}>
            You're always in control.{" "}
            <Text style={{ color: C.gold, fontFamily: T.sansB }}>
              Wingman never moves money or books above your limit without an explicit "yes."
            </Text>
          </Text>
        </View>

        <Text style={g.sectionT}>MONITORING</Text>
        <View style={g.group}>
          <SetRow ic="~" iconColor={C.gold} t="Weather & delay watch" sub="Predict disruptions before the airline" right={sw(weather, "weather_alerts")} />
          <SetRow ic="v" iconColor={C.gold} t="Price & seat-drop alerts" sub="Better seats or fares on booked trips" right={sw(drops, "price_alerts")} />
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic=")" iconColor={C.gold} t="Quiet hours" sub="Hold non-urgent pings 10p–7a" right={sw(quiet, "quiet_hours")} />
          </View>
        </View>

        <Text style={g.sectionT}>LANGUAGE & CURRENCY</Text>
        <View style={g.group}>
          <View style={s.localeRow}>
            <Text style={s.localeLabel}>Language</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {LANGUAGES.map((lang) => (
                <Chip
                  key={lang.code}
                  color={locale === lang.code ? C.gold : undefined}
                  onPress={() => handleLocaleChange(lang.code, null)}
                  style={s.localeChip}
                >
                  {lang.label}
                </Chip>
              ))}
            </ScrollView>
          </View>
          <View style={[s.localeRow, { borderBottomWidth: 0 }]}>
            <Text style={s.localeLabel}>Currency</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {CURRENCIES.map((cur) => (
                <Chip
                  key={cur}
                  color={currency === cur ? C.teal : undefined}
                  onPress={() => handleLocaleChange(null, cur)}
                  style={s.localeChip}
                >
                  {cur}
                </Chip>
              ))}
            </ScrollView>
          </View>
        </View>

        <Text style={g.sectionT}>CONNECTED ACCOUNTS</Text>
        <View style={g.group}>
          <SetRow ic="@" iconColor={C.gold} t="Inbox" sub="Sync travel emails automatically" right={<Chip color={C.teal}>Manage ›</Chip>} onPress={() => navigation.navigate("DataSources")} />
          <SetRow ic="$" iconColor={C.gold} t="Payment & trip protection" sub="Manage payment methods" right={<Chip>Manage</Chip>} onPress={() => navigation.navigate("Subscription")} />
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic="+" iconColor={C.gold} t="All channels & privacy" sub="Email, Calendar, WhatsApp, Messages" right={<Chip color={C.gold}>Manage ›</Chip>} onPress={() => navigation.navigate("Connections")} />
          </View>
        </View>

        <Text style={g.sectionT}>BOOK FLIGHTS</Text>
        <View style={g.group}>
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic="+" iconColor={C.gold} t="Search & book flights" sub="Powered by Duffel — 300+ airlines" right={<Chip color={C.gold}>Search ›</Chip>} onPress={() => navigation.navigate("FlightSearch")} />
          </View>
        </View>

        <Text style={g.sectionT}>TASTE PROFILE</Text>
        <View style={g.group}>
          <SetRow ic="*" iconColor={C.gold} t="Editorial sources & preferences" sub="Sources, hotel soft-specs, seat prefs, dietary" right={<Chip color={C.gold}>Edit ›</Chip>} onPress={() => navigation.navigate("TasteSetup", { fromSettings: true })} />
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic="H" iconColor={C.gold} t="Home address" sub="Pre-filled as Uber dropoff when you land" right={<Chip color={C.teal}>Set ›</Chip>} onPress={() => navigation.navigate("HomeAddress")} />
          </View>
        </View>

        <Text style={g.sectionT}>WHAT WINGMAN KNOWS ABOUT YOU</Text>
        <HotelAffinitySection />

        <Text style={g.sectionT}>LOYALTY PROGRAMS</Text>
        <View style={g.group}>
          <SetRow ic="L" iconColor={C.gold} t="Frequent flyer & hotel programs" sub="Marriott, Hilton, United, Delta, Hyatt & more" right={<Chip color={C.teal}>Manage ›</Chip>} onPress={() => navigation.navigate("Loyalty")} />
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic="◈" iconColor={C.teal} t="Lounge access cards" sub="Amex Platinum, Priority Pass, Chase Sapphire & more" right={<Chip color={C.teal}>Edit ›</Chip>} onPress={() => navigation.navigate("LoungeCards")} />
          </View>
        </View>

        <Text style={g.sectionT}>AUTONOMY & DATA</Text>
        <View style={g.group}>
          <SetRow ic="◈" iconColor={C.gold} t="Autonomy settings" sub="Delegation policy, approval thresholds, payment prefs" right={<Chip color={C.gold}>Edit ›</Chip>} onPress={() => navigation.navigate("Autonomy")} />
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic="◎" iconColor={C.gold} t="Data sources" sub="Gmail, Calendar, Messages — ambient ingestion" right={<Chip color={C.gold}>Manage ›</Chip>} onPress={() => navigation.navigate("DataSources")} />
          </View>
        </View>

        <Text style={g.sectionT}>SUBSCRIPTION</Text>
        <View style={g.group}>
          <View style={{ borderBottomWidth: 0 }}>
            <SetRow ic="P" iconColor={C.gold} t="Wingman Pro / Elite" sub="Manage your subscription and billing" right={<Chip color={C.gold}>Manage ›</Chip>} onPress={() => navigation.navigate("Subscription")} />
          </View>
        </View>

        <Text style={g.sectionT}>ACCOUNT</Text>
        <Text style={s.acct}>Signed in as {email || "—"}</Text>
        <Btn title="Sign out" kind="ghost" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:  { flex: 1, backgroundColor: C.bg },
  acct: { color: C.mut, fontSize: 14, fontFamily: T.sans, marginBottom: 14, letterSpacing: 0.1 },
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
});
