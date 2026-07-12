// InviteScreen — an introduction, not a coupon.
//
// The first version of this paid in Wingman Points: "they start with 250 points,
// you get 500." That was the gamification layer talking. A private travel office
// does not run a referral programme. It grows because one member introduces
// another, and the introduction itself is the currency.
//
// So there is no reward here. Nothing to earn, no tier to climb. The offer is:
// *someone you care about gets looked after*. If that isn't reason enough, a
// discount wasn't going to fix it.
//
// What we DO show is the only honest number: how many of the people you brought
// are actually travelling with Wingman. Not "invited" — travelling.
import React, { useState, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet, Share,
  Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { C, T, SHADOW, litEdge } from "../theme";
import { BackBar, FadeRise, tap } from "../components";
import { getReferral } from "../api";

export default function InviteScreen({ navigation }) {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [err, setErr]               = useState("");

  const load = useCallback(async () => {
    try {
      setData(await getReferral());
      setErr("");
    } catch (_) {
      setErr("Couldn't load your invitation.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const code = data?.code;

  const shareInvite = async () => {
    if (!code) return;
    tap();
    try {
      await Share.share({
        // Reads like a note from a person, not a promo. No exclamation marks, no
        // "sign up today", no reward mentioned — because there isn't one.
        message:
          `I've been using Wingman. It watches my flights and sorts out the mess ` +
          `before I know there is one — hotels told, dinners moved, cars pushed back.\n\n` +
          `If you'd like it to do the same for you, my invitation code is ${code}.`,
      });
    } catch (_) {}
  };

  const copyCode = async () => {
    if (!code) return;
    tap();
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <SafeAreaView style={s.app}>
      <BackBar nav={navigation} label="Invitations" />

      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.mut}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 56 }} />
        ) : err || !data ? (
          <Text style={s.err}>{err || "Couldn't load your invitation."}</Text>
        ) : (
          <>
            <FadeRise delay={40}>
              <Text style={s.hed}>Give someone their evening back.</Text>
              <Text style={s.dek}>
                Wingman takes on a small number of travellers at a time. If there's
                someone whose travel you'd like looked after the way yours is, this
                is how they get in.
              </Text>
            </FadeRise>

            <FadeRise delay={120}>
              <View style={s.codeCard}>
                <Text style={s.codeLabel}>YOUR INVITATION</Text>
                <Text
                  style={s.code}
                  accessibilityLabel={`Your invitation code is ${String(code).split("").join(" ")}`}
                >
                  {code}
                </Text>
                <Pressable
                  onPress={copyCode}
                  style={s.copyBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Copy invitation code"
                >
                  <Text style={s.copyT}>{copied ? "Copied" : "Copy"}</Text>
                </Pressable>
              </View>
            </FadeRise>

            <FadeRise delay={180}>
              <Pressable
                onPress={shareInvite}
                style={s.shareBtn}
                accessibilityRole="button"
                accessibilityLabel="Send your invitation"
              >
                <Text style={s.shareT}>Send it</Text>
              </Pressable>
            </FadeRise>

            {/* One number, and it's the only one that means anything. Not "12
                invited" — that counts people who did nothing. */}
            {data.activated > 0 && (
              <FadeRise delay={240}>
                <Text style={s.tally}>
                  {data.activated} {data.activated === 1 ? "person you introduced is" : "people you introduced are"} travelling with Wingman.
                </Text>
              </FadeRise>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:  { flex: 1, backgroundColor: C.bg },
  body: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 140 },

  hed: { fontFamily: T.garamondSI, fontSize: 30, lineHeight: 38, color: C.ink, marginBottom: 12 },
  dek: { fontFamily: T.sans, fontSize: 15, lineHeight: 23, color: C.mut, marginBottom: 30 },

  codeCard: {
    padding: 26,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 14,
    ...litEdge,
    ...SHADOW.soft,
  },
  codeLabel: {
    fontFamily: T.sans, fontSize: 9, letterSpacing: T.trackWide,
    color: C.mut, marginBottom: 16,
  },
  code: {
    fontFamily: T.serifB,
    fontSize: 38,
    color: C.gold,
    letterSpacing: 8,
    marginLeft: 8,   // trailing letter-spacing pushes the last glyph off-centre
    marginBottom: 20,
  },
  copyBtn: {
    paddingVertical: 8, paddingHorizontal: 22, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(201, 169, 110, 0.35)",
  },
  copyT: { fontFamily: T.sansM, fontSize: 13, color: C.gold },

  shareBtn: {
    backgroundColor: C.gold, borderRadius: 14,
    paddingVertical: 16, alignItems: "center", marginBottom: 26,
  },
  shareT: { fontFamily: T.sansB, fontSize: 15, color: C.inkD },

  tally: {
    fontFamily: T.garamondI, fontSize: 16, lineHeight: 24,
    color: C.mut, textAlign: "center",
  },

  err: { fontFamily: T.sans, fontSize: 15, color: C.mut, textAlign: "center", marginTop: 56 },
});
