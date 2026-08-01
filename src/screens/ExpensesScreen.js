// ExpensesScreen — trip expense report (Roadmap 2, UX #4, first version)
// Builds a categorized report from the prices already on a trip's bookings, lets
// you fill in any missing amounts, and exports a clean report. Client-side; the
// Gmail receipt auto-capture is a later enrichment.
import React, { useState, useMemo } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, Alert, Share, Platform, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
// SDK 54 swapped expo-file-system's default export to the NEW API and moved the
// old one to /legacy. cacheDirectory, writeAsStringAsync and EncodingType (all
// used below) live in the legacy API — importing the default here would compile
// fine and then fail at runtime, silently breaking the CSV export.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { C, T, SHADOW, litEdge } from "../theme";
import { BackBar, FadeRise, tap } from "../components";
import { UpgradeSheet } from "../components/UpgradeSheet";
import { editLeg, getMe, getTripExpenseMeta, setTripExpenseMeta } from "../api";
import { useTheme, useThemedStyles } from "../ThemeContext";

const CATEGORY = {
  flight: "Flights", hotel: "Lodging", airbnb: "Lodging", car: "Ground",
  transfer: "Ground", train: "Rail", ferry: "Ferry", dining: "Dining",
  restaurant: "Dining", activity: "Activities", cruise: "Cruise", other: "Other",
};
const CATEGORY_ICON = {
  Flights: "airplane-outline", Lodging: "bed-outline", Ground: "car-outline",
  Rail: "train-outline", Ferry: "boat-outline", Dining: "restaurant-outline",
  Activities: "ticket-outline", Cruise: "boat-outline", Other: "bookmark-outline",
};

function fmt(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return ""; }
}
function money(n, cur = "USD") {
  const v = Number(n) || 0;
  try { return v.toLocaleString("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }); }
  catch { return `$${Math.round(v).toLocaleString()}`; }
}

export default function ExpensesScreen({ route, navigation }) {
  const { C } = useTheme();
  const s = useThemedStyles(makeStyles);
  const trip = route.params?.trip || {};
  const [legs, setLegs] = useState(trip.legs || []);
  const [isPro, setIsPro] = useState(true);   // assume yes until known — never wrongly gate
  const [showUpgrade, setShowUpgrade] = useState(false);
  // E4 · reimbursement metadata — purpose + project/cost code, persisted per trip.
  const [purpose, setPurpose] = useState("");
  const [projectCode, setProjectCode] = useState("");

  React.useEffect(() => {
    if (!trip.id) return;
    let on = true;
    getTripExpenseMeta(trip.id).then((r) => {
      if (!on || !r?.expense) return;
      setPurpose(r.expense.purpose || "");
      setProjectCode(r.expense.project_code || "");
    }).catch(() => {});
    return () => { on = false; };
  }, [trip.id]);

  const saveMeta = () => {
    if (!trip.id) return;
    setTripExpenseMeta(trip.id, {
      purpose: purpose.trim() || null,
      project_code: projectCode.trim() || null,
    }).catch(() => {});
  };

  React.useEffect(() => {
    let on = true;
    getMe()
      .then(me => {
        if (!on) return;
        const tier = (me?.subscription_tier || "free").toLowerCase();
        const status = (me?.subscription_status || "").toLowerCase();
        setIsPro(tier !== "free" && status !== "inactive");
      })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  const currency = legs.find(l => l.currency)?.currency || "USD";

  // E3 · each item carries its OWN currency — a Eurostar leg in EUR and a JFK hotel in USD
  // must never be summed into one meaningless number.
  const items = useMemo(() => legs.map(l => ({
    id: l.id,
    category: CATEGORY[l.type] || "Other",
    name: l.carrier || l.destination || l.type || "Booking",
    date: l.departs_at || l.arrives_at,
    amount: l.price_total != null ? Number(l.price_total) : null,
    currency: l.currency || currency,
  })).sort((a, b) => (a.date || "") < (b.date || "") ? -1 : 1), [legs, currency]);

  const missing = items.filter(i => i.amount == null).length;

  // Totals are per-currency, never cross-currency. `primaryCur` (the most-spent currency)
  // is the headline; the rest are shown honestly alongside, not folded in.
  const totalsByCur = useMemo(() => {
    const m = {};
    for (const i of items) if (i.amount != null) m[i.currency] = (m[i.currency] || 0) + i.amount;
    return m;
  }, [items]);
  const currencies = Object.keys(totalsByCur).sort((a, b) => totalsByCur[b] - totalsByCur[a]);
  const primaryCur = currencies[0] || currency;
  const mixed = currencies.length > 1;
  const total = totalsByCur[primaryCur] || 0;   // headline + bar denominator (primary currency)

  // On-screen breakdown stays within the primary currency so the bars share one scale;
  // the CSV/report below carries every currency in full.
  const byCategory = useMemo(() => {
    const m = {};
    for (const i of items) {
      if (i.amount == null || i.currency !== primaryCur) continue;
      m[i.category] = (m[i.category] || 0) + i.amount;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [items, primaryCur]);

  // Per (category, currency) for the export — the accurate, full-fidelity breakdown.
  const byCatCur = useMemo(() => {
    const m = {};
    for (const i of items) {
      if (i.amount == null) continue;
      const k = i.category + "|" + i.currency;
      m[k] = (m[k] || 0) + i.amount;
    }
    return Object.entries(m).map(([k, amt]) => { const [cat, cur] = k.split("|"); return { cat, cur, amt }; })
      .sort((a, b) => b.amt - a.amt);
  }, [items]);

  const setAmount = (item) => {
    if (Platform.OS !== "ios" || !Alert.prompt) {
      Alert.alert("Add amount", "Edit this booking to add its price.");
      return;
    }
    Alert.prompt(
      item.name,
      "Enter the amount for this booking",
      async (value) => {
        const cents = parseFloat((value || "").replace(/[^0-9.]/g, ""));
        if (!isFinite(cents)) return;
        setLegs(prev => prev.map(l => l.id === item.id ? { ...l, price_total: cents, currency } : l));
        try { await editLeg(trip.id, item.id, { price_total: cents, currency }); } catch {}
      },
      "plain-text",
      item.amount != null ? String(item.amount) : "",
      "numeric",
    );
  };

  const exportReport = async () => {
    const lines = [`EXPENSE REPORT — ${trip.title || "Trip"}`];
    if (purpose.trim()) lines.push(`Purpose: ${purpose.trim()}`);
    if (projectCode.trim()) lines.push(`Project / cost code: ${projectCode.trim()}`);
    lines.push(`${"—".repeat(36)}`, "");
    let lastDate = null;
    for (const i of items) {
      const d = fmt(i.date);
      if (d && d !== lastDate) { lines.push(d.toUpperCase()); lastDate = d; }
      lines.push(`  ${i.category.padEnd(11)} ${i.name}  ${i.amount != null ? money(i.amount, i.currency) : "—"}`);
    }
    lines.push("", `${"—".repeat(36)}`);
    for (const [cat, amt] of byCategory) lines.push(`  ${cat.padEnd(11)} ${money(amt, primaryCur)}`);
    for (const cur of currencies) lines.push(`  TOTAL ${currencies.length > 1 ? `(${cur})` : "      "}  ${money(totalsByCur[cur], cur)}`);
    if (missing > 0) lines.push("", `  (${missing} booking${missing !== 1 ? "s" : ""} without an amount)`);
    lines.push("", "Tracked by Wingman — wingmantravel.app");
    try { await Share.share({ message: lines.join("\n") }); } catch {}
  };

  const exportCsv = async () => {
    // The reimbursement-ready export is the Pro moment — offered right where the
    // value is obvious, not as a nag. The on-screen report stays free.
    if (!isPro) { setShowUpgrade(true); return; }
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
    const num = (n) => (n != null ? Number(n).toFixed(2) : "");
    // Reimbursement-ready: a header block (trip · dates · currency), the itemised table,
    // per-category subtotals, then the grand total — the shape a finance team expects.
    const dates = items.map((i) => i.date).filter(Boolean).sort();
    const range = dates.length ? `${day(dates[0])} to ${day(dates[dates.length - 1])}` : "";
    const rows = [];
    rows.push([esc("Expense report"), esc(trip.title || "Trip")].join(","));
    if (range) rows.push([esc("Dates"), esc(range)].join(","));
    rows.push([esc("Currency"), esc(currencies.join(", ") || currency)].join(","));
    if (purpose.trim()) rows.push([esc("Purpose"), esc(purpose.trim())].join(","));
    if (projectCode.trim()) rows.push([esc("Project / cost code"), esc(projectCode.trim())].join(","));
    rows.push("");
    rows.push(["Date", "Category", "Vendor", "Amount", "Currency"].join(","));
    for (const i of items) {
      rows.push([esc(day(i.date)), esc(i.category), esc(i.name), esc(num(i.amount)), esc(i.currency)].join(","));
    }
    rows.push("");
    rows.push([esc("Subtotals by category")].join(","));
    for (const { cat, cur, amt } of byCatCur) {
      rows.push([esc(""), esc(cat), esc(""), esc(num(amt)), esc(cur)].join(","));
    }
    rows.push("");
    // One TOTAL per currency — reimbursement never sums across currencies.
    for (const cur of currencies) {
      rows.push([esc(""), esc(""), esc(currencies.length > 1 ? `TOTAL (${cur})` : "TOTAL"), esc(num(totalsByCur[cur])), esc(cur)].join(","));
    }
    if (missing > 0) rows.push([esc(""), esc(""), esc(`${missing} booking(s) without an amount`), esc(""), esc("")].join(","));
    const csv = rows.join("\n");
    try {
      const safe = (trip.title || "trip").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const stamp = dates.length ? "-" + day(dates[0]) : "";
      const uri = `${FileSystem.cacheDirectory}wingman-expenses-${safe}${stamp}.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Export expenses (CSV)", UTI: "public.comma-separated-values-text" });
      } else {
        await Share.share({ message: csv });
      }
    } catch {
      try { await Share.share({ message: csv }); } catch {}
    }
  };

  return (
    <SafeAreaView style={s.app}>
      <BackBar nav={navigation} label="Expenses" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Total hero */}
        <FadeRise style={s.hero}>
          <Text style={s.heroKicker}>TOTAL — {trip.title || "TRIP"}</Text>
          <Text style={s.heroValue}>{money(total, primaryCur)}</Text>
          {mixed ? (
            <Text style={s.heroSub}>
              + {currencies.filter(c => c !== primaryCur).map(c => money(totalsByCur[c], c)).join(" · ")}
            </Text>
          ) : null}
          <Text style={s.heroSub}>
            {items.length} booking{items.length !== 1 ? "s" : ""}{missing > 0 ? ` · ${missing} need an amount` : " · complete"}
          </Text>
          {items.length > 0 ? (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable style={s.exportBtn} onPress={() => { tap(); exportReport(); }}>
                <Ionicons name="share-outline" size={16} color={C.inkD} />
                <Text style={s.exportBtnT}>Report</Text>
              </Pressable>
              <Pressable style={s.exportBtnAlt} onPress={() => { tap(); exportCsv(); }}>
                <Ionicons name="document-outline" size={16} color={C.gold} />
                <Text style={s.exportBtnAltT}>CSV</Text>
              </Pressable>
            </View>
          ) : null}
        </FadeRise>

        {/* E4 · Reimbursement details — carried into the export header */}
        {items.length > 0 ? (
          <View style={s.metaCard}>
            <Text style={s.metaLabel}>PURPOSE</Text>
            <TextInput
              style={s.metaInput}
              value={purpose}
              onChangeText={setPurpose}
              onEndEditing={saveMeta}
              onBlur={saveMeta}
              placeholder="e.g. Q3 client visit"
              placeholderTextColor={C.mutD}
              returnKeyType="done"
            />
            <Text style={[s.metaLabel, { marginTop: 14 }]}>PROJECT / COST CODE</Text>
            <TextInput
              style={s.metaInput}
              value={projectCode}
              onChangeText={setProjectCode}
              onEndEditing={saveMeta}
              onBlur={saveMeta}
              placeholder="e.g. ACME-4471"
              placeholderTextColor={C.mutD}
              autoCapitalize="characters"
              returnKeyType="done"
            />
          </View>
        ) : null}

        {/* Category breakdown */}
        {byCategory.length > 0 ? (
          <View style={s.breakdown}>
            {byCategory.map(([cat, amt]) => (
              <View key={cat} style={s.breakRow}>
                <Ionicons name={CATEGORY_ICON[cat] || "bookmark-outline"} size={16} color={C.gold} style={{ width: 26 }} />
                <Text style={s.breakCat}>{cat}</Text>
                <View style={s.breakBarTrack}>
                  <View style={[s.breakBarFill, { width: `${Math.max((amt / total) * 100, 3)}%` }]} />
                </View>
                <Text style={s.breakAmt}>{money(amt, primaryCur)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Line items */}
        <Text style={s.sectionLabel}>LINE ITEMS</Text>
        <View style={s.list}>
          {items.map((i, idx) => (
            <Pressable
              key={i.id || idx}
              style={[s.itemRow, idx > 0 && s.itemRowBorder]}
              onPress={() => { tap(); setAmount(i); }}
            >
              <Ionicons name={CATEGORY_ICON[i.category] || "bookmark-outline"} size={18} color={C.mut} style={{ width: 26 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.itemName} numberOfLines={1}>{i.name}</Text>
                <Text style={s.itemMeta}>{i.category}{i.date ? ` · ${fmt(i.date)}` : ""}</Text>
              </View>
              {i.amount != null ? (
                <Text style={s.itemAmt}>{money(i.amount, currency)}</Text>
              ) : (
                <Text style={s.itemAdd}>Add  ›</Text>
              )}
            </Pressable>
          ))}
          {items.length === 0 ? (
            <Text style={s.empty}>No bookings on this trip yet.</Text>
          ) : null}
        </View>
        <Text style={s.footNote}>Amounts fill in automatically from your booking and receipt emails — tap any line to add or adjust one.</Text>
      </ScrollView>

      <UpgradeSheet
        visible={showUpgrade}
        moment="expenses"
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() => { setShowUpgrade(false); navigation.navigate("Subscription"); }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C) => ({
  app: { flex: 1, backgroundColor: C.bg },
  hero: {
    marginHorizontal: 24, marginTop: 12, padding: 22, borderRadius: 18,
    backgroundColor: C.card, borderWidth: 1, borderColor: "rgba(201,169,110,0.3)", ...litEdge, ...SHADOW.soft,
  },
  heroKicker: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 1.6, color: C.mutD, marginBottom: 8 },
  heroValue: { fontFamily: T.display, fontSize: 44, color: C.ink, lineHeight: 50 },
  heroSub: { fontFamily: T.sans, fontSize: 13, color: C.mut, marginTop: 6 },
  exportBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 13, borderRadius: 12, backgroundColor: C.gold,
  },
  exportBtnT: { fontFamily: T.sansB, fontSize: 15, color: C.inkD },
  exportBtnAlt: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 13, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 1, borderColor: C.gold,
  },
  exportBtnAltT: { fontFamily: T.sansB, fontSize: 15, color: C.gold },

  metaCard: { marginHorizontal: 24, marginTop: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 16 },
  metaLabel: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 1.6, color: C.mutD, marginBottom: 6 },
  metaInput: { fontFamily: T.sansM, fontSize: 15, color: C.ink, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 6 },
  breakdown: { marginHorizontal: 24, marginTop: 18, gap: 12 },
  breakRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  breakCat: { fontFamily: T.sansM, fontSize: 13, color: C.ink, width: 74 },
  breakBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.card2, overflow: "hidden" },
  breakBarFill: { height: "100%", borderRadius: 3, backgroundColor: C.gold },
  breakAmt: { fontFamily: T.sansM, fontSize: 13, color: C.mut, width: 64, textAlign: "right" },

  sectionLabel: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2, color: C.mut, marginHorizontal: 24, marginTop: 26, marginBottom: 10 },
  list: { marginHorizontal: 24, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, overflow: "hidden", ...litEdge },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: C.line },
  itemName: { fontFamily: T.sansM, fontSize: 15, color: C.ink },
  itemMeta: { fontFamily: T.sans, fontSize: 13, color: C.mut, marginTop: 2 },
  itemAmt: { fontFamily: T.sansM, fontSize: 15, color: C.ink },
  itemAdd: { fontFamily: T.sansM, fontSize: 13, color: C.gold },
  empty: { fontFamily: T.sans, fontSize: 13, color: C.mut, padding: 18, textAlign: "center" },
  footNote: { fontFamily: T.sans, fontSize: 13, lineHeight: 18, color: C.mut, marginHorizontal: 24, marginTop: 14, opacity: 0.8 },
});
