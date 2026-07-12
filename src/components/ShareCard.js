// ShareCard — beautiful, branded share artifacts (Design #8)
// Renders an editorial card (ROI or trip), captures it to a PNG, and opens the
// native share sheet. Uses react-native-view-shot + expo-sharing.

import React, { useRef, useState } from "react";
import { View, Text, Modal, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { C, T } from "../theme";
import { tap, WMark, Wordmark } from "../components";

export function ShareCardModal({ visible, onClose, data = {} }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const doShare = async () => {
    try {
      setBusy(true);
      const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your Wingman card" });
      }
    } catch (e) {
      // swallow — sharing is best-effort
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.scrim} onPress={onClose}>
        <Pressable style={st.previewWrap} onPress={() => {}}>
          {/* ── The captured card ── */}
          <View ref={cardRef} collapsable={false} style={st.card}>
            <LinearGradient colors={["#26211B", "#141110"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.cardGrad}>
              <View style={st.brandRow}>
                <WMark size={26} color={C.gold} />
                <Wordmark size={12} color={C.gold} />
              </View>

              {/* The "roi" variant lived here — a card reading "TOTAL VALUE
                  PROTECTED · $430 · Across 1 disruption Wingman handled for me."
                  Made to be posted.

                  Sharing a beautiful card of a trip you're taking is a pleasure.
                  Sharing a receipt for how much your concierge saved you is a
                  boast, and it makes the service look like it needs the publicity.
                  A trip is worth sharing. A refund is not. */}
              <View style={st.body}>
                <Text style={st.kicker}>{(data.dates || "TRACKED BY WINGMAN").toUpperCase()}</Text>
                <Text style={st.bigTrip}>{data.title || "My next trip"}</Text>
                {data.route ? <Text style={st.sub}>{data.route}</Text> : null}
              </View>

              <View style={st.footRule} />
              <Text style={st.foot}>My chief of staff for travel · wingmantravel.app</Text>
            </LinearGradient>
          </View>

          {/* ── Actions ── */}
          <View style={st.actions}>
            <Pressable style={[st.shareBtn, busy && { opacity: 0.6 }]} onPress={() => { tap(); doShare(); }} disabled={busy}>
              {busy ? <ActivityIndicator color={C.inkD} /> : <Text style={st.shareBtnT}>Share</Text>}
            </Pressable>
            <Pressable style={st.closeBtn} onPress={() => { tap(); onClose(); }}>
              <Text style={st.closeBtnT}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)", alignItems: "center", justifyContent: "center", padding: 24 },
  previewWrap: { width: "100%", maxWidth: 360, alignItems: "center" },
  card: { width: 300, height: 380, borderRadius: 22, overflow: "hidden" },
  cardGrad: { flex: 1, padding: 26, justifyContent: "flex-start", borderWidth: 1, borderColor: "rgba(201,169,110,0.30)", borderRadius: 22 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  mark: { width: 26, height: 26, borderRadius: 6, borderWidth: 1, borderColor: C.gold, alignItems: "center", justifyContent: "center" },
  markT: { fontFamily: T.serifI, fontSize: 15, color: C.gold },
  brand: { fontFamily: T.sansB, fontSize: 12, letterSpacing: 3, color: C.gold },
  body: { flex: 1, justifyContent: "center" },
  kicker: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2, color: C.mut, marginBottom: 12 },
  big: { fontFamily: T.serifB, fontSize: 56, lineHeight: 60, color: C.ink },
  bigTrip: { fontFamily: T.garamondSI, fontSize: 40, lineHeight: 44, color: C.ink },
  sub: { fontFamily: T.garamondI, fontSize: 17, lineHeight: 24, color: C.mut, marginTop: 12 },
  footRule: { height: 1, backgroundColor: "rgba(201,169,110,0.25)", marginBottom: 12 },
  foot: { fontFamily: T.sansM, fontSize: 11, letterSpacing: 0.3, color: C.gold },
  actions: { flexDirection: "row", gap: 12, marginTop: 20, width: 300 },
  shareBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, backgroundColor: C.gold, alignItems: "center" },
  shareBtnT: { fontFamily: T.sansB, fontSize: 15, color: C.inkD },
  closeBtn: { paddingVertical: 15, paddingHorizontal: 24, borderRadius: 14, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  closeBtnT: { fontFamily: T.sansM, fontSize: 15, color: C.ink },
});
