import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  ActivityIndicator, Pressable,
} from "react-native";
import { C } from "../theme";
import { Btn, BackBar, Chip, g } from "../components";
import { API_BASE, getToken } from "../api";

const SOURCE_ICONS = {
  gmail: "📧",
  gmail_import: "📧",
  gmail_scan: "📧",
  calendar_sync: "📅",
  message_sync: "💬",
  whatsapp: "💬",
  signal: "✦",
};

const SOURCE_LABELS = {
  gmail: "From your inbox",
  gmail_import: "Booking import",
  gmail_scan: "Email scan",
  calendar_sync: "Calendar",
  message_sync: "Messages",
  signal: "Ambient signal",
};

export default function SignalScreen({ navigation }) {
  const [signals, setSignals] = useState([]);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const token = await getToken();
        const resp = await fetch(`${API_BASE}/signals`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error("Failed to load signals");
        const data = await resp.json();
        if (alive) {
          setSignals(data.signals || []);
          setImports(data.imports || []);
        }
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  const formatRelative = (iso) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // Build a Concierge prefill from a signal
  const buildPrefill = (signal) => {
    if (signal.body) return `Tell me more about: ${signal.body}`;
    if (signal.title) return signal.title;
    return "";
  };

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={g.scroll}>
        <BackBar nav={navigation} label="Ambient signals" />

        {loading && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator color={C.gold} size="small" />
            <Text style={{ color: C.mut, fontSize: 13, marginTop: 10 }}>
              Scanning your connected sources…
            </Text>
          </View>
        )}

        {!loading && error && (
          <View style={s.emptyCard}>
            <Text style={{ color: C.mut, fontSize: 14, textAlign: "center" }}>
              Could not load signals. Connect Gmail or Calendar in Settings.
            </Text>
            <Btn
              title="Go to Connections"
              kind="ghost"
              onPress={() => navigation.navigate("Connections")}
              style={{ marginTop: 12 }}
            />
          </View>
        )}

        {!loading && !error && signals.length === 0 && imports.length === 0 && (
          <View style={s.emptyCard}>
            <Text style={{ color: C.ink, fontSize: 15, fontWeight: "700", marginBottom: 6 }}>
              No signals yet
            </Text>
            <Text style={{ color: C.mut, fontSize: 13, textAlign: "center", lineHeight: 19 }}>
              Connect Gmail, Calendar, or Messages to let Wingman catch travel signals automatically.
            </Text>
            <Btn
              title="Connect sources"
              kind="accent"
              onPress={() => navigation.navigate("Connections")}
              style={{ marginTop: 14 }}
            />
          </View>
        )}

        {!loading && signals.length > 0 && (
          <>
            <Text style={g.sectionT}>CAUGHT SIGNALS</Text>
            {signals.map((sig) => (
              <Pressable
                key={sig.id}
                style={s.signalCard}
                onPress={() => navigation.navigate("Concierge", { prefill: buildPrefill(sig) })}
              >
                <View style={s.signalHeader}>
                  <Text style={s.signalIcon}>{SOURCE_ICONS[sig.type] || "✦"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.signalSource}>{SOURCE_LABELS[sig.type] || sig.type}</Text>
                    {sig.trip_title && (
                      <Text style={s.signalTrip}>{sig.trip_title}</Text>
                    )}
                  </View>
                  <Text style={s.signalTime}>{formatRelative(sig.created_at)}</Text>
                </View>
                <Text style={s.signalTitle}>{sig.title}</Text>
                {sig.body && (
                  <Text style={s.signalBody} numberOfLines={2}>{sig.body}</Text>
                )}
                <Text style={s.signalCta}>Ask Wingman →</Text>
              </Pressable>
            ))}
          </>
        )}

        {!loading && imports.length > 0 && (
          <>
            <Text style={g.sectionT}>BOOKING IMPORTS</Text>
            {imports.map((imp) => {
              const parsed = imp.parsed || {};
              return (
                <View key={imp.id} style={s.importCard}>
                  <View style={s.importRow}>
                    <View style={s.importIc}>
                      <Text style={{ fontSize: 15 }}>📧</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.importTitle}>
                        {parsed.title || parsed.destination || "Booking confirmation"}
                      </Text>
                      <Text style={s.importSub}>
                        {parsed.origin && parsed.destination
                          ? `${parsed.origin} → ${parsed.destination}`
                          : imp.raw_subject?.split(":").slice(1).join(":").trim().slice(0, 50) || "Email import"}
                      </Text>
                    </View>
                    <Chip color={imp.trip_id ? C.teal : C.gold}>
                      {imp.trip_id ? "Added" : "Pending"}
                    </Chip>
                  </View>
                </View>
              );
            })}
            <Btn
              title="Scan inbox for more"
              kind="ghost"
              onPress={async () => {
                try {
                  const token = await getToken();
                  await fetch(`${API_BASE}/auth/gmail/import`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  // Reload
                  setLoading(true);
                  const resp = await fetch(`${API_BASE}/signals`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const data = await resp.json();
                  setSignals(data.signals || []);
                  setImports(data.imports || []);
                } catch (_) {}
                setLoading(false);
              }}
              style={{ marginTop: 10 }}
            />
          </>
        )}

        {!loading && (signals.length > 0 || imports.length > 0) && (
          <View style={s.sticky}>
            <Text style={s.sum}>
              Wingman watches your connected sources — you approve before anything books
            </Text>
            <Btn
              title="✦  Open Concierge"
              kind="accent"
              onPress={() => navigation.navigate("Concierge")}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  emptyCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    borderRadius: 16, padding: 20, alignItems: "center", marginTop: 20,
  },
  signalCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  signalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  signalIcon: { fontSize: 16, marginTop: 1 },
  signalSource: { color: C.teal, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  signalTrip: { color: C.mut, fontSize: 11, marginTop: 1 },
  signalTime: { color: C.mut, fontSize: 11 },
  signalTitle: { color: C.ink, fontSize: 14, fontWeight: "600", marginBottom: 4 },
  signalBody: { color: C.mut, fontSize: 13, lineHeight: 18, marginBottom: 6 },
  signalCta: { color: C.gold, fontSize: 12, fontWeight: "700" },
  importCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
    borderRadius: 14, padding: 12, marginBottom: 8,
  },
  importRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  importIc: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#0E1530", borderWidth: 1, borderColor: C.line,
    alignItems: "center", justifyContent: "center",
  },
  importTitle: { color: C.ink, fontSize: 14, fontWeight: "600" },
  importSub: { color: C.mut, fontSize: 12, marginTop: 1 },
  sticky: { marginTop: 18, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  sum: { color: C.mut, fontSize: 12, textAlign: "center", marginBottom: 8, lineHeight: 17 },
});
