import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  Pressable, ActivityIndicator, Alert,
} from "react-native";
import { StripeProvider, useStripe } from "@stripe/stripe-react-native";
import { C } from "../theme";
import { g } from "../components";
import { API_BASE, getToken } from "../api";

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_spS4gry030G8chAWaFBaCn7u00qYefZpqB";
const APPLE_MERCHANT_ID = "merchant.app.wingmantravel";

const PLAN_COLORS = {
  pro: C.teal,
  elite: "#818CF8",
};

const PLAN_ICONS = {
  pro: "⚡",
  elite: "🌟",
};

function PlanCard({ plan, planKey, current, onSelect, loading }) {
  const isActive = current === planKey;
  const color = PLAN_COLORS[planKey];
  return (
    <Pressable
      style={[s.planCard, isActive && { borderColor: color, borderWidth: 2 }]}
      onPress={() => !isActive && onSelect(planKey)}
    >
      <View style={s.planHeader}>
        <View style={[s.planIconWrap, { backgroundColor: color + "22" }]}>
          <Text style={{ fontSize: 22 }}>{PLAN_ICONS[planKey]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.planName}>{plan.name}</Text>
          <Text style={s.planPrice}>
            ${(plan.amount / 100).toFixed(2)}
            <Text style={s.planInterval}> / month</Text>
          </Text>
        </View>
        {isActive && (
          <View style={[s.activeBadge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
            <Text style={[s.activeBadgeT, { color }]}>Active</Text>
          </View>
        )}
      </View>
      <View style={s.featureList}>
        {plan.features.map((f, i) => (
          <View key={i} style={s.featureRow}>
            <Text style={[s.featureCheck, { color }]}>✓</Text>
            <Text style={s.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      {!isActive && (
        <Pressable
          style={[s.subscribeBtn, { backgroundColor: color }, loading && { opacity: 0.6 }]}
          onPress={() => onSelect(planKey)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.subscribeBtnT}>Subscribe with Apple Pay</Text>
          )}
        </Pressable>
      )}
    </Pressable>
  );
}

function SubscriptionContent({ navigation }) {
  const { initPaymentSheet, presentPaymentSheet, isPlatformPaySupported } = useStripe();
  const [plans, setPlans] = useState(null);
  const [currentTier, setCurrentTier] = useState("free");
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [applePaySupported, setApplePaySupported] = useState(false);

  useEffect(() => {
    loadPlans();
    checkApplePay();
  }, []);

  async function checkApplePay() {
    const supported = await isPlatformPaySupported();
    setApplePaySupported(supported);
  }

  async function loadPlans() {
    try {
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/subscription/plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setPlans(data.plans);
      setCurrentTier(data.current_tier || "free");
    } catch (e) {
      Alert.alert("Error", "Could not load subscription plans.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe(planKey) {
    setSubscribing(planKey);
    try {
      const token = await getToken();
      // Step 1: Create SetupIntent
      const intentResp = await fetch(`${API_BASE}/subscription/create-intent`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const intentData = await intentResp.json();
      if (intentData.error) throw new Error(intentData.error);
      // Step 2: Init Stripe payment sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Wingman",
        customerId: intentData.customer_id,
        setupIntentClientSecret: intentData.client_secret,
        applePay: {
          merchantCountryCode: "US",
        },
        style: "alwaysDark",
        appearance: {
          colors: {
            primary: PLAN_COLORS[planKey],
            background: C.bg,
            componentBackground: C.card,
            componentText: C.ink,
            primaryText: C.ink,
            secondaryText: C.mut,
          },
        },
      });
      if (initError) throw new Error(initError.message);
      // Step 3: Present payment sheet
      const { error: presentError, paymentOption } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== "Canceled") {
          Alert.alert("Payment failed", presentError.message);
        }
        return;
      }
      // Step 4: Activate subscription on backend
      const activateResp = await fetch(`${API_BASE}/subscription/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey, payment_method_id: paymentOption?.value?.id }),
      });
      const activateData = await activateResp.json();
      if (activateData.error) throw new Error(activateData.error);
      setCurrentTier(planKey);
      Alert.alert(
        "Welcome to Wingman " + (planKey === "elite" ? "Elite 🌟" : "Pro ⚡"),
        "Your subscription is active. All features are now unlocked.",
        [{ text: "Let's go", onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert("Subscription error", e.message);
    } finally {
      setSubscribing(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={s.app}>
        <ActivityIndicator color={C.teal} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.app}>
      <View style={s.head}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnT}>← Back</Text>
        </Pressable>
        <Text style={s.headT}>Wingman Premium</Text>
      </View>
      <ScrollView contentContainerStyle={[g.scroll, { paddingTop: 8 }]}>
        <View style={s.heroCard}>
          <Text style={s.heroIc}>✈️</Text>
          <Text style={s.heroT}>Your personal travel chief of staff</Text>
          <Text style={s.heroSub}>
            Wingman monitors your flights, dispatches your rides, emails your hotels, and briefs your AI concierge — all before you land.
          </Text>
        </View>
        {currentTier !== "free" && (
          <View style={s.activeCard}>
            <Text style={s.activeT}>
              You're on <Text style={{ color: PLAN_COLORS[currentTier] }}>Wingman {currentTier === "elite" ? "Elite 🌟" : "Pro ⚡"}</Text>
            </Text>
            <Text style={s.activeSub}>All features are active. Manage billing in Settings → Subscription.</Text>
          </View>
        )}
        {plans && Object.entries(plans).map(([key, plan]) => (
          <PlanCard
            key={key}
            plan={plan}
            planKey={key}
            current={currentTier}
            onSelect={handleSubscribe}
            loading={subscribing === key}
          />
        ))}
        <View style={s.footer}>
          <Text style={s.footerT}>
            Billed monthly. Cancel anytime in Settings → Subscription. Payments processed securely by Stripe.
          </Text>
          {!applePaySupported && (
            <Text style={[s.footerT, { color: C.amber, marginTop: 8 }]}>
              Apple Pay is not available on this device. A card payment form will be shown instead.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function SubscriptionScreen({ navigation }) {
  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier={APPLE_MERCHANT_ID}
    >
      <SubscriptionContent navigation={navigation} />
    </StripeProvider>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8 },
  headT: { color: C.ink, fontSize: 18, fontWeight: "700", flex: 1 },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backBtnT: { color: C.teal, fontSize: 14, fontWeight: "600" },
  heroCard: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 24, alignItems: "center", marginBottom: 16 },
  heroIc: { fontSize: 40, marginBottom: 10 },
  heroT: { color: C.ink, fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  heroSub: { color: C.mut, fontSize: 13, textAlign: "center", lineHeight: 19 },
  activeCard: { backgroundColor: C.teal + "15", borderRadius: 14, borderWidth: 1, borderColor: C.teal + "40", padding: 16, marginBottom: 16 },
  activeT: { color: C.ink, fontSize: 15, fontWeight: "700", marginBottom: 4 },
  activeSub: { color: C.mut, fontSize: 13 },
  planCard: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, marginBottom: 14 },
  planHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  planIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  planName: { color: C.ink, fontSize: 16, fontWeight: "700" },
  planPrice: { color: C.ink, fontSize: 22, fontWeight: "800", marginTop: 2 },
  planInterval: { color: C.mut, fontSize: 14, fontWeight: "400" },
  activeBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  activeBadgeT: { fontSize: 12, fontWeight: "700" },
  featureList: { gap: 8, marginBottom: 16 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureCheck: { fontSize: 14, fontWeight: "700", width: 16 },
  featureText: { color: C.mut, fontSize: 13, flex: 1 },
  subscribeBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  subscribeBtnT: { color: "#fff", fontSize: 15, fontWeight: "700" },
  footer: { paddingHorizontal: 4, paddingBottom: 32 },
  footerT: { color: C.mut, fontSize: 12, textAlign: "center", lineHeight: 17 },
});
