// PrivacyPolicyScreen — Wingman
// Explicit, plain-English privacy policy and data processor list.
import React, { useState, useEffect } from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { C, T } from "../theme";
import { tap } from "../components";

export default function PrivacyPolicyScreen({ navigation }) {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://wingman-api-y39a.onrender.com/privacy-html") // Use the new JSON manifest endpoint
      .then(r => r.json())
      .then(d => { setManifest(d); setLoading(false); })
      .catch(() => {
        // Fallback if network fails
        setManifest({
          data_sold_to_third_parties: false,
          third_party_processors: [
            { name: "Anthropic (Claude)", purpose: "AI concierge responses" },
            { name: "Amadeus", purpose: "Flight search and booking" }
          ]
        });
        setLoading(false);
      });
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => { tap(); navigation.goBack(); }}>
          <Text style={s.backBtnT}>← Back</Text>
        </Pressable>
        <Text style={s.headerTitle}>Privacy & Data</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>We don't sell your data.</Text>
        <Text style={s.body}>
          Wingman is a premium concierge, not an advertising network. Your data is used exclusively to make your travel seamless. We never sell it, and we never share it for marketing.
        </Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>Our Commitments</Text>
          <Text style={s.bullet}>• Your location is only used when the app is active or when tracking a live trip buffer.</Text>
          <Text style={s.bullet}>• Gmail access is strictly limited to scanning for flight, hotel, and car rental receipts. We do not read personal correspondence.</Text>
          <Text style={s.bullet}>• You can delete your entire account, history, and all associated data at any time via Settings.</Text>
        </View>

        <Text style={s.sectionTitle}>Third-Party Processors</Text>
        <Text style={s.body}>
          To provide services like AI reasoning, flight status, and booking, we securely transmit limited data to the following partners:
        </Text>

        {loading ? <ActivityIndicator color={C.gold} style={{ marginTop: 20 }} /> : (
          <View style={s.processorList}>
            {manifest?.third_party_processors?.map((p, i) => (
              <View key={i} style={s.processorRow}>
                <Text style={s.pName}>{p.name}</Text>
                <Text style={s.pPurpose}>{p.purpose}</Text>
                {p.data_sent && <Text style={s.pData}>Data sent: {p.data_sent}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  backBtn: { paddingVertical: 10, paddingRight: 20 },
  backBtnT: { color: C.gold, fontSize: 16, fontFamily: T.sansM },
  headerTitle: { color: C.white, fontSize: 18, fontFamily: T.sansB, marginLeft: "auto", marginRight: "auto", paddingRight: 40 },
  scroll: { padding: 24, paddingBottom: 80 },
  title: { color: C.white, fontSize: 28, fontFamily: T.serifB, marginBottom: 16 },
  body: { color: "#A39B8F", fontSize: 16, fontFamily: T.sansM, lineHeight: 24, marginBottom: 24 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 32, borderWidth: 1, borderColor: C.line },
  cardTitle: { color: C.gold, fontSize: 14, fontFamily: T.sansB, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 },
  bullet: { color: "#E0D8C8", fontSize: 15, fontFamily: T.sansM, lineHeight: 22, marginBottom: 12 },
  sectionTitle: { color: C.white, fontSize: 20, fontFamily: T.serifB, marginBottom: 16 },
  processorList: { gap: 12 },
  processorRow: { backgroundColor: C.card2, borderRadius: 12, padding: 16 },
  pName: { color: C.white, fontSize: 16, fontFamily: T.sansB, marginBottom: 4 },
  pPurpose: { color: "#A39B8F", fontSize: 14, fontFamily: T.sansM, marginBottom: 8 },
  pData: { color: "#80786C", fontSize: 13, fontFamily: T.sansM },
});
