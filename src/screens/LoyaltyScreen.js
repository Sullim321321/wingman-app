import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  TouchableOpacity, TextInput, Modal, ActivityIndicator,
  Alert, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { C, T } from "../theme";
import { BackBar, Btn, g } from "../components";
import { getProfile } from "../api";
import * as SecureStore from "expo-secure-store";
import { API_BASE } from "../config";

// ---------------------------------------------------------------------------
// Program metadata (mirrors backend LOYALTY_PROGRAMS)
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
  if (s.includes("platinum") || s.includes("diamond") || s.includes("1k") || s.includes("global")) return "#D4AF37";
  if (s.includes("gold") || s.includes("premier gold")) return "#F59E0B";
  if (s.includes("silver") || s.includes("plus")) return "#94A3B8";
  return C.teal;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ProgressBar({ value, max, color }) {
  if (!value || !max) return null;
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={ps.barTrack}>
      <View style={[ps.barFill, { width: `${pct}%`, backgroundColor: color || C.teal }]} />
    </View>
  );
}

function AccountCard({ acct, onSync, onDisconnect }) {
  const prog = PROGRAMS[acct.program] || {};
  const syncing = acct._syncing;
  const pointsLabel = prog.kind === "airline" ? "miles" : "points";
  const segLabel = prog.kind === "airline" ? "segments" : "nights";
  const segValue = prog.kind === "airline" ? acct.segments_ytd : acct.nights_ytd;

  return (
    <View style={ps.card}>
      {/* Header */}
      <View style={ps.cardHeader}>
        <Text style={ps.icon}>{prog.icon || "⭐"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={ps.progName}>{prog.name || acct.program}</Text>
          {acct.member_name && <Text style={ps.memberName}>{acct.member_name}</Text>}
        </View>
        {acct.elite_status && (
          <View style={[ps.statusBadge, { borderColor: statusColor(acct.elite_status) }]}>
            <Text style={[ps.statusText, { color: statusColor(acct.elite_status) }]}>
              {acct.elite_status}
            </Text>
          </View>
        )}
      </View>

      {/* Balance */}
      <View style={ps.balanceRow}>
        <View style={ps.balanceBlock}>
          <Text style={ps.balanceNum}>{fmt(acct.points_balance)}</Text>
          <Text style={ps.balanceLabel}>{pointsLabel}</Text>
        </View>
        {segValue != null && (
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
          {acct.last_synced ? `Synced ${relTime(acct.last_synced)}` : "Never synced"}
        </Text>
        <View style={ps.cardActions}>
          <TouchableOpacity onPress={() => onSync(acct.program)} style={ps.actionBtn} disabled={syncing}>
            {syncing
              ? <ActivityIndicator size="small" color={C.teal} />
              : <Text style={ps.actionBtnText}>↻ Sync</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDisconnect(acct.program)} style={[ps.actionBtn, ps.actionBtnDanger]}>
            <Text style={[ps.actionBtnText, { color: C.coral }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ConnectModal({ visible, onClose, onConnect }) {
  const [program, setProgram] = useState(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => { setProgram(null); setLogin(""); setPassword(""); };

  const handleConnect = async () => {
    if (!program || !login || !password) return;
    setLoading(true);
    try {
      await onConnect(program, login, password);
      reset();
      onClose();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={ps.modal}>
        <View style={ps.modalHeader}>
          <Text style={ps.modalTitle}>Connect Loyalty Account</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Text style={ps.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={ps.modalScroll}>
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
              <TouchableOpacity onPress={() => setProgram(null)} style={ps.backLink}>
                <Text style={ps.backLinkText}>‹ Back</Text>
              </TouchableOpacity>
              <View style={ps.selectedProg}>
                <Text style={ps.selectedProgIcon}>{PROGRAMS[program]?.icon}</Text>
                <Text style={ps.selectedProgName}>{PROGRAMS[program]?.name}</Text>
              </View>
              <Text style={ps.fieldLabel}>Username / Member Number</Text>
              <TextInput
                style={ps.input}
                value={login}
                onChangeText={setLogin}
                placeholder="Email or member number"
                placeholderTextColor={C.mut}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text style={ps.fieldLabel}>Password</Text>
              <TextInput
                style={ps.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={C.mut}
                secureTextEntry
              />
              <View style={ps.securityNote}>
                <Text style={ps.securityNoteText}>
                  🔒 Your credentials are encrypted in transit and used only to sync your balance via AwardWallet. Wingman never stores your password.
                </Text>
              </View>
              <TouchableOpacity
                style={[ps.connectBtn, (!login || !password) && ps.connectBtnDisabled]}
                onPress={handleConnect}
                disabled={loading || !login || !password}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={ps.connectBtnText}>Connect {PROGRAMS[program]?.name}</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function LoyaltyScreen({ navigation }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchAccounts(); }, [fetchAccounts]));

  const handleConnect = async (program, login, password) => {
    const resp = await fetch(`${API_BASE}/loyalty/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ program, login, password }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Connection failed");
    await fetchAccounts();
  };

  const handleSync = async (program) => {
    setAccounts(prev => prev.map(a => a.program === program ? { ...a, _syncing: true } : a));
    try {
      await fetch(`${API_BASE}/loyalty/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ program }),
      });
      await new Promise(r => setTimeout(r, 3000)); // give backend time to sync
      await fetchAccounts();
    } catch (e) {
      Alert.alert("Sync failed", e.message);
    }
    setAccounts(prev => prev.map(a => ({ ...a, _syncing: false })));
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAccounts(); }} tintColor={C.teal} />}
      >
        <BackBar nav={navigation} label="Loyalty Programs" />

        {/* Summary strip */}
        {accounts.length > 0 && (
          <View style={ps.summaryStrip}>
            {Object.entries(totalByKind).map(([kind, total]) => (
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

        {/* Connected accounts */}
        {loading ? (
          <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />
        ) : accounts.length === 0 ? (
          <View style={ps.empty}>
            <Text style={ps.emptyIcon}>🏆</Text>
            <Text style={ps.emptyTitle}>No loyalty accounts yet</Text>
            <Text style={ps.emptySub}>Connect your frequent flyer and hotel programs. Wingman will track your balance, elite status, and progress to the next tier — and factor it into every recommendation.</Text>
          </View>
        ) : (
          accounts.map(acct => (
            <AccountCard
              key={acct.program}
              acct={acct}
              onSync={handleSync}
              onDisconnect={handleDisconnect}
            />
          ))
        )}

        {/* Add account button */}
        <TouchableOpacity style={ps.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={ps.addBtnText}>+ Connect a Program</Text>
        </TouchableOpacity>

        <Text style={ps.footer}>
          Balances sync every 6 hours via AwardWallet. Wingman uses your loyalty status to optimise hotel and flight recommendations.
        </Text>
      </ScrollView>

      <ConnectModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConnect={handleConnect}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const ps = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  summaryStrip: { flexDirection: "row", backgroundColor: C.card, borderRadius: 14, marginHorizontal: 16, marginBottom: 20, padding: 16, justifyContent: "space-around" },
  summaryItem: { alignItems: "center" },
  summaryNum: { color: C.ink, fontSize: 20, fontFamily: T.sansB },
  summaryLabel: { color: C.mut, fontSize: 11, marginTop: 2 },
  card: { backgroundColor: C.card, borderRadius: 16, marginHorizontal: 16, marginBottom: 14, padding: 16 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  icon: { fontSize: 28, marginRight: 12 },
  progName: { color: C.ink, fontSize: 15, fontFamily: T.sansB },
  memberName: { color: C.mut, fontSize: 12, marginTop: 2 },
  statusBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: T.sansB, letterSpacing: 0.5 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  balanceBlock: {},
  balanceNum: { color: C.ink, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  balanceLabel: { color: C.mut, fontSize: 12, marginTop: 2 },
  progressSection: { marginBottom: 10 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { color: C.mut, fontSize: 11 },
  barTrack: { height: 4, backgroundColor: C.line, borderRadius: 2 },
  barFill: { height: 4, borderRadius: 2 },
  expiryRow: { backgroundColor: "#2A1A0A", borderRadius: 8, padding: 8, marginBottom: 10 },
  expiryText: { color: "#F59E0B", fontSize: 12 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, marginTop: 4 },
  syncTime: { color: C.mut, fontSize: 11 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  actionBtnDanger: { borderColor: C.coral + "44" },
  actionBtnText: { color: C.teal, fontSize: 12, fontFamily: T.sansM },
  empty: { alignItems: "center", paddingHorizontal: 32, paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: C.ink, fontSize: 18, fontFamily: T.sansB, marginBottom: 10, textAlign: "center" },
  emptySub: { color: C.mut, fontSize: 14, lineHeight: 21, textAlign: "center" },
  addBtn: { marginHorizontal: 16, marginTop: 8, marginBottom: 12, backgroundColor: C.teal, borderRadius: 14, padding: 16, alignItems: "center" },
  addBtnText: { color: "#0A0E1C", fontSize: 15, fontFamily: T.sansB },
  footer: { color: C.mut, fontSize: 11, textAlign: "center", marginHorizontal: 24, marginBottom: 24, lineHeight: 17 },
  // Modal
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: C.line },
  modalTitle: { color: C.ink, fontSize: 18, fontFamily: T.sansB },
  modalClose: { color: C.mut, fontSize: 20 },
  modalScroll: { padding: 20 },
  modalSub: { color: C.mut, fontSize: 14, marginBottom: 20 },
  kindHeader: { color: C.mut, fontSize: 11, fontFamily: T.sansB, letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  progRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  progRowIcon: { fontSize: 22, marginRight: 12 },
  progRowName: { flex: 1, color: C.ink, fontSize: 15 },
  progRowArrow: { color: C.mut, fontSize: 18 },
  backLink: { marginBottom: 16 },
  backLinkText: { color: C.teal, fontSize: 15 },
  selectedProg: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  selectedProgIcon: { fontSize: 32, marginRight: 12 },
  selectedProgName: { color: C.ink, fontSize: 18, fontFamily: T.sansB },
  fieldLabel: { color: C.mut, fontSize: 12, fontFamily: T.sansM, letterSpacing: 0.5, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: C.card, borderRadius: 12, padding: 14, color: C.ink, fontSize: 15, borderWidth: 1, borderColor: C.line },
  securityNote: { backgroundColor: "#0F2A1A", borderRadius: 10, padding: 12, marginTop: 16 },
  securityNoteText: { color: "#4ADE80", fontSize: 12, lineHeight: 18 },
  connectBtn: { backgroundColor: C.teal, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 24 },
  connectBtnDisabled: { opacity: 0.4 },
  connectBtnText: { color: "#0A0E1C", fontSize: 15, fontFamily: T.sansB },
});
