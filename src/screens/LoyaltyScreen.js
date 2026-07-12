import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  TouchableOpacity, TextInput, Modal, ActivityIndicator,
  Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { C, T } from "../theme";
import { BackBar, Btn, g } from "../components";
import * as SecureStore from "expo-secure-store";
import { API_BASE } from "../config";
import { getLoyaltyInsights } from "../api";

// ---------------------------------------------------------------------------
// Program metadata
// ---------------------------------------------------------------------------
const PROGRAMS = {
  marriott:  { name: "Marriott Bonvoy",         icon: "🏨", kind: "hotel",      color: "#B8860B" },
  hilton:    { name: "Hilton Honors",            icon: "🏩", kind: "hotel",      color: "#004F9F" },
  united:    { name: "United MileagePlus",       icon: "✈️", kind: "airline",    color: "#1A6BB5" },
  delta:     { name: "Delta SkyMiles",           icon: "🔵", kind: "airline",    color: "#E51937" },
  american:  { name: "American AAdvantage",      icon: "🦅", kind: "airline",    color: "#C8102E" },
  hyatt:     { name: "World of Hyatt",           icon: "🏛️", kind: "hotel",      color: "#1F4E79" },
  ihg:       { name: "IHG One Rewards",          icon: "🌐", kind: "hotel",      color: "#006747" },
  british:   { name: "British Airways Avios",    icon: "🇬🇧", kind: "airline",   color: "#075AAA" },
  emirates:  { name: "Emirates Skywards",        icon: "🇦🇪", kind: "airline",   color: "#D4AF37" },
  amex_mr:   { name: "Amex Membership Rewards",  icon: "💳", kind: "credit_card",color: "#007BC1" },
};

// Status tiers per program for the picker
const STATUS_TIERS = {
  marriott:  ["Member", "Silver Elite", "Gold Elite", "Platinum Elite", "Titanium Elite", "Ambassador Elite"],
  hilton:    ["Member", "Silver", "Gold", "Diamond"],
  united:    ["Member", "Silver", "Gold", "Platinum", "1K", "Global Services"],
  delta:     ["Member", "Silver Medallion", "Gold Medallion", "Platinum Medallion", "Diamond Medallion"],
  american:  ["Member", "Gold", "Platinum", "Platinum Pro", "Executive Platinum", "Concierge Key"],
  hyatt:     ["Member", "Discoverist", "Explorist", "Globalist"],
  ihg:       ["Member", "Silver Elite", "Gold Elite", "Platinum Elite", "Diamond Elite"],
  british:   ["Member", "Bronze", "Silver", "Gold"],
  emirates:  ["Blue", "Silver", "Gold", "Platinum"],
  amex_mr:   ["Member", "Gold", "Platinum", "Centurion"],
};

const KIND_LABEL = { hotel: "Hotel", airline: "Airline", credit_card: "Card" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(n) {
  if (!n && n !== 0) return "—";
  return Number(n).toLocaleString();
}
function relTime(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function statusColor(status) {
  if (!status) return C.mut;
  const s = status.toLowerCase();
  if (s.includes("ambassador") || s.includes("centurion") || s.includes("concierge key") ||
      s.includes("global services") || s.includes("1k") || s.includes("diamond") ||
      s.includes("titanium") || s.includes("globalist") || s.includes("platinum")) {
    return "#D4AF37"; // Gold — top tier
  }
  if (s.includes("gold") || s.includes("premier gold") || s.includes("explorist")) return "#F59E0B";
  if (s.includes("silver") || s.includes("discoverist") || s.includes("bronze")) return "#94A3B8";
  return C.mut;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ProgressBar({ value, max, color }) {
  if (!value || !max) return null;
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={ps.barTrack}>
      <View style={[ps.barFill, { width: `${pct}%`, backgroundColor: color || C.gold }]} />
    </View>
  );
}

function AccountCard({ acct, onSync, onEdit, onDisconnect }) {
  const prog = PROGRAMS[acct.program] || {};
  const syncing = acct._syncing;
  const pointsLabel = prog.kind === "airline" ? "miles" : "points";
  const segLabel = prog.kind === "airline" ? "segments" : "nights";
  const segValue = prog.kind === "airline" ? acct.segments_ytd : acct.nights_ytd;
  const hasBalance = acct.points_balance && acct.points_balance > 0;

  return (
    <View style={ps.card}>
      {/* Header */}
      <View style={ps.cardHeader}>
        <Text style={ps.icon}>{prog.icon || "⭐"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={ps.progName}>{prog.name || acct.program}</Text>
          {acct.member_name && <Text style={ps.memberName}>{acct.member_name}</Text>}
          {acct.account_number && !acct.member_name && (
            <Text style={ps.memberName}>#{acct.account_number}</Text>
          )}
        </View>
        {acct.elite_status && (
          <View style={[ps.statusBadge, { borderColor: statusColor(acct.elite_status) }]}>
            <Text style={[ps.statusText, { color: statusColor(acct.elite_status) }]}>
              {acct.elite_status.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Balance — show dashes with "Add balance" prompt if not yet synced */}
      <View style={ps.balanceRow}>
        <View style={ps.balanceBlock}>
          {hasBalance ? (
            <>
              <Text style={ps.balanceNum}>{fmt(acct.points_balance)}</Text>
              <Text style={ps.balanceLabel}>{pointsLabel}</Text>
            </>
          ) : (
            <>
              <Text style={[ps.balanceNum, { color: C.mut, fontSize: 18 }]}>—</Text>
              <TouchableOpacity onPress={() => onEdit(acct.program)}>
                <Text style={ps.addBalanceHint}>Add balance →</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {segValue != null && segValue > 0 && (
          <View style={[ps.balanceBlock, { alignItems: "flex-end" }]}>
            <Text style={ps.balanceNum}>{fmt(segValue)}</Text>
            <Text style={ps.balanceLabel}>{segLabel} YTD</Text>
          </View>
        )}
      </View>

      {/* Progress to next tier */}
      {acct.elite_level_next && acct.points_to_next_level != null && (
        <View style={ps.progressSection}>
          <View style={ps.progressHeader}>
            <Text style={ps.progressLabel}>Progress to {acct.elite_level_next}</Text>
            <Text style={ps.progressLabel}>{fmt(acct.points_to_next_level)} needed</Text>
          </View>
          <ProgressBar
            value={acct.points_balance}
            max={acct.points_balance + acct.points_to_next_level}
            color={statusColor(acct.elite_level_next)}
          />
        </View>
      )}

      {/* Expiration warning */}
      {acct.expiration_date && (
        <View style={ps.expiryRow}>
          <Text style={ps.expiryText}>
            ⏳ Points expire {new Date(acct.expiration_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={ps.cardFooter}>
        <Text style={ps.syncTime}>
          {acct.last_synced ? `Updated ${relTime(acct.last_synced)}` : "Add your balance"}
        </Text>
        <View style={ps.cardActions}>
          <TouchableOpacity onPress={() => onEdit(acct.program)} style={ps.actionBtn} disabled={syncing}>
            <Text style={ps.actionBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDisconnect(acct.program)} style={[ps.actionBtn, ps.actionBtnDanger]}>
            <Text style={[ps.actionBtnText, { color: "#C97B6E" }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Connect / Edit Modal — manual entry (no password required)
// ---------------------------------------------------------------------------
function ConnectModal({ visible, onClose, onConnect, editProgram, editData }) {
  const isEdit = !!editProgram;
  const [program, setProgram] = useState(null);
  const [memberNumber, setMemberNumber] = useState("");
  const [memberName, setMemberName] = useState("");
  const [eliteStatus, setEliteStatus] = useState("");
  const [pointsBalance, setPointsBalance] = useState("");
  const [nightsYtd, setNightsYtd] = useState("");
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginField, setLoginField] = useState("");
  const [passwordField, setPasswordField] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [awSyncing, setAwSyncing] = useState(false);

  useEffect(() => {
    if (editProgram) {
      setProgram(editProgram);
      setMemberNumber(editData?.account_number || "");
      setMemberName(editData?.member_name || "");
      setEliteStatus(editData?.elite_status || "");
      setPointsBalance(editData?.points_balance ? String(editData.points_balance) : "");
      setNightsYtd(editData?.nights_ytd ? String(editData.nights_ytd) : "");
    }
  }, [editProgram, editData]);

  const reset = () => {
    setProgram(null);
    setMemberNumber(""); setMemberName(""); setEliteStatus("");
    setPointsBalance(""); setNightsYtd(""); setShowStatusPicker(false);
    setLoginField(""); setPasswordField(""); setShowPassword(false); setAwSyncing(false);
  };

  const handleSubmit = async () => {
    if (!program) return;
    setLoading(true);
    try {
      if (loginField && passwordField) setAwSyncing(true);
      await onConnect(program, {
        member_number: memberNumber || undefined,
        member_name: memberName || undefined,
        elite_status: eliteStatus || undefined,
        points_balance: pointsBalance ? parseInt(pointsBalance.replace(/,/g, "")) : undefined,
        nights_ytd: nightsYtd ? parseInt(nightsYtd) : undefined,
        login: loginField || undefined,
        password: passwordField || undefined,
      }, isEdit);
      reset();
      onClose();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const tiers = program ? (STATUS_TIERS[program] || []) : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <SafeAreaView style={ps.modal}>
        <View style={ps.modalHeader}>
          <Text style={ps.modalTitle}>{isEdit ? "Update Account" : "Connect Loyalty Account"}</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Text style={ps.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={ps.modalScroll} keyboardShouldPersistTaps="handled">
          {!program ? (
            <>
              <Text style={ps.modalSub}>Select a program to connect:</Text>
              {["airline", "hotel", "credit_card"].map(kind => (
                <View key={kind}>
                  <Text style={ps.kindHeader}>{KIND_LABEL[kind]}S</Text>
                  {Object.entries(PROGRAMS)
                    .filter(([, p]) => p.kind === kind)
                    .map(([key, p]) => (
                      <TouchableOpacity key={key} style={ps.progRow} onPress={() => setProgram(key)}>
                        <Text style={ps.progRowIcon}>{p.icon}</Text>
                        <Text style={ps.progRowName}>{p.name}</Text>
                        <Text style={ps.progRowArrow}>›</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              ))}
            </>
          ) : (
            <>
              {!isEdit && (
                <TouchableOpacity onPress={() => setProgram(null)} style={ps.backLink}>
                  <Text style={ps.backLinkText}>‹ Back</Text>
                </TouchableOpacity>
              )}
              <View style={ps.selectedProg}>
                <Text style={ps.selectedProgIcon}>{PROGRAMS[program]?.icon}</Text>
                <Text style={ps.selectedProgName}>{PROGRAMS[program]?.name}</Text>
              </View>

              {/* Status tier */}
              <Text style={ps.fieldLabel}>ELITE STATUS</Text>
              <TouchableOpacity
                style={[ps.input, ps.statusSelector]}
                onPress={() => setShowStatusPicker(!showStatusPicker)}
              >
                <Text style={eliteStatus ? ps.statusSelectorText : ps.statusSelectorPlaceholder}>
                  {eliteStatus || "Select your status tier"}
                </Text>
                <Text style={{ color: C.gold }}>▾</Text>
              </TouchableOpacity>
              {showStatusPicker && (
                <View style={ps.statusPickerList}>
                  {tiers.map(tier => (
                    <TouchableOpacity
                      key={tier}
                      style={[ps.statusPickerItem, eliteStatus === tier && ps.statusPickerItemActive]}
                      onPress={() => { setEliteStatus(tier); setShowStatusPicker(false); }}
                    >
                      <Text style={[ps.statusPickerText, eliteStatus === tier && { color: statusColor(tier) }]}>
                        {tier}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Member number */}
              <Text style={ps.fieldLabel}>MEMBER NUMBER (optional)</Text>
              <TextInput
                style={ps.input}
                value={memberNumber}
                onChangeText={setMemberNumber}
                placeholder="e.g. 123456789"
                placeholderTextColor={C.mut}
                autoCapitalize="none"
                keyboardType="default"
              />

              {/* Points balance */}
              <Text style={ps.fieldLabel}>
                {PROGRAMS[program]?.kind === "airline" ? "MILES BALANCE (optional)" : "POINTS BALANCE (optional)"}
              </Text>
              <TextInput
                style={ps.input}
                value={pointsBalance}
                onChangeText={setPointsBalance}
                placeholder="e.g. 125000"
                placeholderTextColor={C.mut}
                keyboardType="numeric"
              />

              {/* Nights YTD (hotels only) */}
              {PROGRAMS[program]?.kind === "hotel" && (
                <>
                  <Text style={ps.fieldLabel}>NIGHTS THIS YEAR (optional)</Text>
                  <TextInput
                    style={ps.input}
                    value={nightsYtd}
                    onChangeText={setNightsYtd}
                    placeholder="e.g. 73"
                    placeholderTextColor={C.mut}
                    keyboardType="numeric"
                  />
                </>
              )}

              {/* Loyalty credentials for auto-sync via AwardWallet */}
              {!isEdit && (
                <>
                  <View style={ps.credentialsDivider}>
                    <View style={ps.credentialsDividerLine} />
                    <Text style={ps.credentialsDividerText}>AUTO-SYNC (optional)</Text>
                    <View style={ps.credentialsDividerLine} />
                  </View>
                  <Text style={ps.credentialsNote}>
                    Enter your {PROGRAMS[program]?.name} login to let Wingman automatically sync your balance, nights, and elite status.
                  </Text>
                  <Text style={ps.fieldLabel}>{PROGRAMS[program]?.loginLabel || "EMAIL OR MEMBER NUMBER"}</Text>
                  <TextInput
                    style={ps.input}
                    value={loginField}
                    onChangeText={setLoginField}
                    placeholder="e.g. you@email.com"
                    placeholderTextColor={C.mut}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                  <Text style={ps.fieldLabel}>PASSWORD</Text>
                  <View style={ps.passwordRow}>
                    <TextInput
                      style={[ps.input, { flex: 1, marginBottom: 0 }]}
                      value={passwordField}
                      onChangeText={setPasswordField}
                      placeholder="Your loyalty account password"
                      placeholderTextColor={C.mut}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="password"
                    />
                    <TouchableOpacity style={ps.passwordToggle} onPress={() => setShowPassword(!showPassword)}>
                      <Text style={{ color: C.mut, fontSize: 13 }}>{showPassword ? "HIDE" : "SHOW"}</Text>
                    </TouchableOpacity>
                  </View>
                  {awSyncing && (
                    <View style={ps.awSyncingBanner}>
                      <ActivityIndicator size="small" color={C.gold} />
                      <Text style={ps.awSyncingText}>Syncing your account data…</Text>
                    </View>
                  )}
                </>
              )}
              <View style={[ps.privacyNote, { flexDirection: "row", alignItems: "flex-start", gap: 7 }]}>
                <Ionicons name="lock-closed-outline" size={13} color={C.mut} style={{ marginTop: 1 }} />
                <Text style={[ps.privacyNoteText, { flex: 1 }]}>
                  Your credentials are encrypted and stored securely. Wingman never sells or shares your data.
                </Text>
              </View>

              <TouchableOpacity
                style={[ps.connectBtn, !program && ps.connectBtnDisabled]}
                onPress={handleSubmit}
                disabled={loading || !program}
              >
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={ps.connectBtnText}>{isEdit ? "Save Changes" : `Add ${PROGRAMS[program]?.name}`}</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
// ── What Wingman actually noticed ────────────────────────────────────────────
// Connecting a loyalty account used to get you a list of numbers back. This is the
// part that earns the connection: what's expiring, what's within reach, and which
// booking might not have your number on it.
//
// Note what's absent: no "best card for this booking", no award availability. We
// don't hold earning rates or award inventory, and a chief of staff who guesses
// confidently about a $4,000 booking is worse than one who says nothing.
function InsightCard({ item }) {
  const tone =
    item.urgency === "high"   ? C.coral
    : item.urgency === "medium" ? C.gold
    : C.mut;
  const icon =
    item.kind === "points_expiring" ? "hourglass-outline"
    : item.kind === "status_gap"    ? "trending-up-outline"
    : "pricetag-outline";

  return (
    <View style={ins.card}>
      <View style={ins.head}>
        <Ionicons name={icon} size={16} color={tone} style={{ marginRight: 8 }} />
        <Text style={[ins.title, { color: tone }]} numberOfLines={2}>{item.title}</Text>
      </View>
      <Text style={ins.body}>{item.body}</Text>
    </View>
  );
}

const ins = StyleSheet.create({
  wrap:  { marginBottom: 22 },
  label: { fontFamily: T.sans, fontSize: 10, letterSpacing: T.trackWide, color: C.mut, marginBottom: 10 },
  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    borderRadius: 14, padding: 14, marginBottom: 8,
  },
  head:  { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  title: { fontFamily: T.sansM, fontSize: 14, flex: 1, lineHeight: 19 },
  body:  { fontFamily: T.sans, fontSize: 13, lineHeight: 19, color: C.mut },
  none:  { fontFamily: T.sans, fontSize: 13, lineHeight: 19, color: C.mut },
});

export default function LoyaltyScreen({ navigation }) {
  const [accounts, setAccounts] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editProgram, setEditProgram] = useState(null);
  const [editData, setEditData] = useState(null);
  const [token, setToken] = useState(null);

  // Get auth token
  useEffect(() => {
    SecureStore.getItemAsync("wingman_token").then(t => setToken(t));
  }, []);

  const fetchAccounts = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_BASE}/loyalty`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setAccounts(data.accounts || []);
    } catch (e) {
      console.error("[loyalty] fetch error:", e.message);
    }
    // Insights are a bonus, not a prerequisite — never let them break the screen.
    try {
      setInsights((await getLoyaltyInsights()).insights || []);
    } catch (_) {
      setInsights([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchAccounts(); }, [fetchAccounts]));

  // Connect new or update existing
  const handleConnect = async (program, fields, isEdit) => {
    if (isEdit) {
      // PATCH to update existing account
      const resp = await fetch(`${API_BASE}/loyalty/${program}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(fields),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Update failed");
    } else {
      // POST to connect new account
      const resp = await fetch(`${API_BASE}/loyalty/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ program, ...fields }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Connection failed");
    }
    await fetchAccounts();
  };

  const handleEdit = (program) => {
    const acct = accounts.find(a => a.program === program);
    setEditProgram(program);
    setEditData(acct);
    setModalVisible(true);
  };

  const handleDisconnect = (program) => {
    const prog = PROGRAMS[program];
    Alert.alert(
      `Remove ${prog?.name || program}?`,
      "Wingman will stop tracking this account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive", onPress: async () => {
            await fetch(`${API_BASE}/loyalty/${program}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            await fetchAccounts();
          },
        },
      ]
    );
  };

  const openAddModal = () => {
    setEditProgram(null);
    setEditData(null);
    setModalVisible(true);
  };

  // Total points summary
  const totalByKind = accounts.reduce((acc, a) => {
    const kind = PROGRAMS[a.program]?.kind || "other";
    acc[kind] = (acc[kind] || 0) + (a.points_balance || 0);
    return acc;
  }, {});

  return (
    <SafeAreaView style={ps.app}>
      <ScrollView
        contentContainerStyle={g.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAccounts(); }} tintColor={C.gold} />}
      >
        <BackBar nav={navigation} label="Loyalty Programs" />

        {/* Summary strip */}
        {accounts.length > 0 && (
          <View style={ps.summaryStrip}>
            {Object.entries(totalByKind).filter(([, v]) => v > 0).map(([kind, total]) => (
              <View key={kind} style={ps.summaryItem}>
                <Text style={ps.summaryNum}>{fmt(total)}</Text>
                <Text style={ps.summaryLabel}>{KIND_LABEL[kind] || kind} pts</Text>
              </View>
            ))}
            <View style={ps.summaryItem}>
              <Text style={ps.summaryNum}>{accounts.length}</Text>
              <Text style={ps.summaryLabel}>programs</Text>
            </View>
          </View>
        )}

        {/* What Wingman noticed — the reason to connect an account at all.
            Sits ABOVE the balances, because a list of numbers is not a service. */}
        {!loading && accounts.length > 0 && (
          <View style={ins.wrap}>
            <Text style={ins.label}>WHAT NEEDS YOU</Text>
            {insights.length === 0 ? (
              <View style={ins.card}>
                <Text style={ins.none}>
                  Nothing expiring, nothing within reach of a status bump. I'll tell you
                  the moment that changes.
                </Text>
              </View>
            ) : (
              insights.map((item, i) => (
                <InsightCard key={`${item.kind}-${item.program}-${i}`} item={item} />
              ))
            )}
          </View>
        )}

        {/* Connected accounts */}
        {loading ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />
        ) : accounts.length === 0 ? (
          <View style={ps.empty}>
            <Ionicons name="trophy-outline" size={30} color={C.gold} style={ps.emptyIcon} />
            <Text style={ps.emptyTitle}>No loyalty accounts yet</Text>
            <Text style={ps.emptySub}>Add your frequent flyer and hotel programs. Wingman will factor your status into every recommendation — hotel upgrades, seat suggestions, and lounge access.</Text>
          </View>
        ) : (
          accounts.map(acct => (
            <AccountCard
              key={acct.program}
              acct={acct}
              onEdit={handleEdit}
              onDisconnect={handleDisconnect}
            />
          ))
        )}

        {/* Add account button */}
        <TouchableOpacity style={ps.addBtn} onPress={openAddModal}>
          <Text style={ps.addBtnText}>+ Add a Program</Text>
        </TouchableOpacity>

        <Text style={ps.footer}>
          Add your status and balance manually, or connect Gmail to auto-import from loyalty emails.
        </Text>
      </ScrollView>

      <ConnectModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setEditProgram(null); setEditData(null); }}
        onConnect={handleConnect}
        editProgram={editProgram}
        editData={editData}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const ps = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  summaryStrip: { flexDirection: "row", backgroundColor: C.card, borderRadius: 12, marginHorizontal: 16, marginBottom: 20, padding: 16, justifyContent: "space-around", borderWidth: 1, borderColor: C.line },
  summaryItem: { alignItems: "center" },
  summaryNum: { color: C.ink, fontSize: 22, fontFamily: T.sansB },
  summaryLabel: { color: C.mut, fontSize: 10, marginTop: 3, fontFamily: T.sans, letterSpacing: 1 },
  card: { backgroundColor: C.card, borderRadius: 16, marginHorizontal: 16, marginBottom: 14, padding: 18, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)" },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  icon: { fontSize: 28, marginRight: 12 },
  progName: { color: C.ink, fontSize: 16, fontFamily: T.sansB },
  memberName: { color: C.mut, fontSize: 12, marginTop: 2, fontFamily: T.sans },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.5 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  balanceBlock: {},
  balanceNum: { color: C.ink, fontSize: 28, fontFamily: T.sansB, letterSpacing: -0.5 },
  balanceLabel: { color: C.mut, fontSize: 11, marginTop: 3, fontFamily: T.sans },
  addBalanceHint: { color: C.gold, fontSize: 12, fontFamily: T.sansM, marginTop: 4 },
  progressSection: { marginBottom: 12 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { color: C.mut, fontSize: 11, fontFamily: T.sans },
  barTrack: { height: 3, backgroundColor: C.line, borderRadius: 2 },
  barFill: { height: 3, borderRadius: 2 },
  expiryRow: { backgroundColor: "rgba(201,169,110,0.08)", borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "rgba(201,169,110,0.25)" },
  expiryText: { color: C.gold, fontSize: 12, fontFamily: T.sans },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 12, marginTop: 6 },
  syncTime: { color: C.mut, fontSize: 11, fontFamily: T.sans },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  actionBtnDanger: { borderColor: "rgba(201,107,110,0.3)" },
  actionBtnText: { color: C.gold, fontSize: 12, fontFamily: T.sansM },
  empty: { alignItems: "center", paddingHorizontal: 32, paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: C.ink, fontSize: 20, fontFamily: T.sansB, marginBottom: 10, textAlign: "center" },
  emptySub: { color: C.mut, fontSize: 14, lineHeight: 22, textAlign: "center", fontFamily: T.sans },
  addBtn: { marginHorizontal: 16, marginTop: 8, marginBottom: 12, backgroundColor: C.gold, borderRadius: 14, padding: 16, alignItems: "center" },
  addBtnText: { color: "#000000", fontSize: 15, fontFamily: T.sansB },
  footer: { color: C.mut, fontSize: 11, textAlign: "center", marginHorizontal: 24, marginBottom: 24, lineHeight: 17 },
  // Modal
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: C.line },
  modalTitle: { color: C.ink, fontSize: 18, fontFamily: T.sansB },
  modalClose: { color: C.mut, fontSize: 20 },
  modalScroll: { padding: 20, paddingBottom: 60 },
  modalSub: { color: C.mut, fontSize: 14, marginBottom: 20 },
  kindHeader: { color: C.mut, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  progRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  progRowIcon: { fontSize: 22, marginRight: 12 },
  progRowName: { flex: 1, color: C.ink, fontSize: 15 },
  progRowArrow: { color: C.mut, fontSize: 18 },
  backLink: { marginBottom: 16 },
  backLinkText: { color: C.gold, fontSize: 15 },
  selectedProg: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  selectedProgIcon: { fontSize: 32, marginRight: 12 },
  selectedProgName: { color: C.ink, fontSize: 18, fontFamily: T.sansB },
  fieldLabel: { color: C.mut, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1.5, marginBottom: 8, marginTop: 20 },
  input: { backgroundColor: C.card, borderRadius: 12, padding: 14, color: C.ink, fontSize: 15, borderWidth: 1, borderColor: C.line },
  statusSelector: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusSelectorText: { color: C.ink, fontSize: 15 },
  statusSelectorPlaceholder: { color: C.mut, fontSize: 15 },
  statusPickerList: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, marginTop: 4, overflow: "hidden" },
  statusPickerItem: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: C.line },
  statusPickerItemActive: { backgroundColor: "rgba(201,169,110,0.08)" },
  statusPickerText: { color: C.ink, fontSize: 14 },
  privacyNote: { backgroundColor: "rgba(201,169,110,0.06)", borderRadius: 10, padding: 12, marginTop: 20, borderWidth: 1, borderColor: "rgba(201,169,110,0.2)" },
  privacyNoteText: { color: C.mut, fontSize: 12, lineHeight: 18 },
  credentialsDivider: { flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 8 },
  credentialsDividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  credentialsDividerText: { color: C.mut, fontSize: 10, letterSpacing: 1.5, marginHorizontal: 10 },
  credentialsNote: { color: C.mut, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  passwordToggle: { paddingHorizontal: 10, paddingVertical: 14, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 8 },
  awSyncingBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(212,175,55,0.1)", borderRadius: 8, padding: 10, marginBottom: 10 },
  awSyncingText: { color: C.gold, fontSize: 13 },
  connectBtn: { backgroundColor: C.gold, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 24 },
  connectBtnDisabled: { opacity: 0.4 },
  connectBtnText: { color: "#000000", fontSize: 15, fontFamily: T.sansB },
});
