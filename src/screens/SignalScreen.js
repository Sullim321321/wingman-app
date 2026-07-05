import React, { useState, useEffect } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet,
  ActivityIndicator, Pressable,
} from "react-native";
import { C, T } from "../theme";
import { Btn, BackBar, Chip, g, tap } from "../components";
import { getSignals, triggerGmailImport } from "../api";

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
        const data = await getSignals();
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
              onPress={() => { tap(); navigation.navigate("Connections"); }}
              style={{ marginTop: 12 }}
            />
          </View>
        )}

        {!loading && !error && signals.length === 0 && imports.length === 0 && (
          <View>
            <View style={s.emptyCard}>
              <Text style={{ color: C.ink, fontSize: 15, fontFamily: T.sansB, marginBottom: 6 }}>
                No signals yet
              </Text>
              <Text style={{ color: C.mut, fontSize: 13, textAlign: "center", lineHeight: 19 }}>
                Connect Gmail or Calendar and Wingman will catch things like these automatically — before they become problems.
              </Text>
              <Btn
                title="Connect sources"
                kind="accent"
                onPress={() => { tap(); navigation.navigate("Connections"); }}
                style={{ marginTop: 14 }}
              />
            </View>

            {/* Sample signal cards — greyed out to show what’s possible */}
            <Text style={[g.sectionT, { opacity: 0.5 }]}>EXAMPLE SIGNALS</Text>
            {[
              { icon: "✉️", source: "Gmail", title: "BA178 check-in is now open", body: "Online check-in for your London → New York flight opens now. Select your seat before they go.", cta: "Check in now" },
              { icon: "⚠️", source: "Flight alert", title: "LHR T5 security wait: 35 min", body: "Heathrow Terminal 5 security is running 35 minutes. Leave 15 minutes earlier than planned.", cta: "Adjust plan" },
              { icon: "🏨", source: "Gmail", title: "Hotel confirmation: The Ned London", body: "Your reservation at The Ned is confirmed for 3 nights from 12 Jul. Check-in from 3pm.", cta: "Add to trip" },
            ].map((ex, i) => (
              <View key={i} style={[s.signalCard, { opacity: 0.4 }]}>
                <View style={s.signalHeader}>
                  <Text style={s.signalIcon}>{ex.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.signalSource}>{ex.source}</Text>
                  </View>
                </View>
                <Text style={s.signalTitle}>{ex.title}</Text>
                <Text style={s.signalBody} numberOfLines={2}>{ex.body}</Text>
                <Text style={s.signalCta}>{ex.cta} →</Text>
              </View>
            ))}
          </View>
        )}

        {!loading && signals.length > 0 && (
          <>
            <Text style={g.sectionT}>CAUGHT SIGNALS</Text>
            {signals.map((sig) => (
              <Pressable
                key={sig.id}
                style={s.signalCard}
                onPress={() => { tap(); navigation.navigate("Concierge", { prefill: buildPrefill(sig) }); }}
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
                  await triggerGmailImport();
                  setLoading(true);
                  const data = await getSignals();
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
              onPress={() => { tap(); navigation.navigate("Concierge"); }}
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
  signalSource: { color: C.teal, fontSize: 11, fontFamily: T.sansB, letterSpacing: 0.5 },
  signalTrip: { color: C.mut, fontSize: 11, marginTop: 1 },
  signalTime: { color: C.mut, fontSize: 11 },
  signalTitle: { color: C.ink, fontSize: 14, fontFamily: T.sansM, marginBottom: 4 },
  signalBody: { color: C.mut, fontSize: 13, lineHeight: 18, marginBottom: 6 },
  signalCta: { color: C.gold, fontSize: 12, fontFamily: T.sansB },
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
  importTitle: { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  importSub: { color: C.mut, fontSize: 12, marginTop: 1 },
  sticky: { marginTop: 18, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  sum: { color: C.mut, fontSize: 12, textAlign: "center", marginBottom: 8, lineHeight: 17 },
});
