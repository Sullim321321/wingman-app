// InviteScreen — the referral loop.
//
// The pitch is deliberately not "get free stuff." Wingman's promise is that
// someone competent is quietly handling your travel; the thing worth sharing is
// that relief, not a coupon. So the screen leads with what your friend gets and
// treats your own reward as a footnote.
//
// It also reports invited and activated SEPARATELY. "12 invited" is a vanity
// number — it counts people who did nothing. "3 travelling" is the real one.
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
      setErr("Couldn't load your invite code. Pull to try again.");
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
        message:
          `I've been using Wingman — it watches my flights and sorts out the mess before I know there is one.\n\n` +
          `Use my invite code ${code} when you sign up and you'll start with ${data.friend_points} points.`,
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
      <BackBar nav={navigation} label="Invite" />

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
          <Text style={s.err}>{err || "Couldn't load your invite code."}</Text>
        ) : (
          <>
            <FadeRise delay={40}>
              <Text style={s.hed}>Give someone their evening back.</Text>
              <Text style={s.dek}>
                Anyone who joins with your code starts with {data.friend_points} points —
                and a Wingman watching their flights from the first day.
              </Text>
            </FadeRise>

            <FadeRise delay={120}>
              <View style={s.codeCard}>
                <Text style={s.codeLabel}>YOUR INVITE CODE</Text>
                <Text
                  style={s.code}
                  accessibilityLabel={`Your invite code is ${String(code).split("").join(" ")}`}
                >
                  {code}
                </Text>
                <Pressable
                  onPress={copyCode}
                  style={s.copyBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Copy invite code"
                >
                  <Text style={s.copyT}>{copied ? "Copied" : "Copy code"}</Text>
                </Pressable>
              </View>
            </FadeRise>

            <FadeRise delay={180}>
              <Pressable
                onPress={shareInvite}
                style={s.shareBtn}
                accessibilityRole="button"
                accessibilityLabel="Share your invitation"
              >
                <Text style={s.shareT}>Share invitation</Text>
              </Pressable>
            </FadeRise>

            {/* Honest scoreboard. "Signed up" is context; "travelling" is the number. */}
            <FadeRise delay={240}>
              <View style={s.stats}>
                <View style={s.stat}>
                  <Text style={s.statN}>{data.activated}</Text>
                  <Text style={s.statL}>travelling{"\n"}with Wingman</Text>
                </View>
                <View style={s.statDiv} />
                <View style={s.stat}>
                  <Text style={s.statN}>{data.invited}</Text>
                  <Text style={s.statL}>signed up</Text>
                </View>
                <View style={s.statDiv} />
                <View style={s.stat}>
                  <Text style={s.statN}>{Number(data.points_earned || 0).toLocaleString()}</Text>
                  <Text style={s.statL}>points{"\n"}earned</Text>
                </View>
              </View>
            </FadeRise>

            <FadeRise delay={300}>
              <Text style={s.fine}>
                Your {data.reward_points} points arrive once someone you invited actually starts
                using Wingman — connects their email, or adds a trip. Not merely for signing up.
                A real traveller is worth rewarding; a new row in a database isn't.
              </Text>
            </FadeRise>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  app:  { flex: 1, backgroundColor: C.bg },
  body: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 96 },

  hed: { fontFamily: T.garamondSI, fontSize: 30, lineHeight: 38, color: C.ink, marginBottom: 10 },
  dek: { fontFamily: T.sans, fontSize: 15, lineHeight: 22, color: C.mut, marginBottom: 26 },

  codeCard: {
    padding: 24,
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
    fontFamily: T.sans, fontSize: 10, letterSpacing: T.trackWide,
    color: C.mut, marginBottom: 14,
  },
  code: {
    fontFamily: T.serifB,
    fontSize: 38,
    color: C.gold,
    letterSpacing: 8,
    // Trailing letter-spacing pushes the last glyph off-centre; nudge it back.
    marginLeft: 8,
    marginBottom: 18,
  },
  copyBtn: {
    paddingVertical: 8, paddingHorizontal: 20, borderRadius: 999,
    // C.gold (#C9A96E) at 35%. There is no alpha helper in the theme — `g` is the
    // shared styles OBJECT from components.js, not a function. Calling it here is
    // what threw "Object is not a function" inside StyleSheet.create, at import
    // time, before React could mount: the white screen.
    borderWidth: 1, borderColor: "rgba(201, 169, 110, 0.35)",
  },
  copyT: { fontFamily: T.sansM, fontSize: 13, color: C.gold },

  shareBtn: {
    backgroundColor: C.gold, borderRadius: 14,
    paddingVertical: 16, alignItems: "center", marginBottom: 28,
  },
  shareT: { fontFamily: T.sansB, fontSize: 15, color: C.bg },

  stats: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    marginBottom: 20,
  },
  stat:    { flex: 1, alignItems: "center" },
  statDiv: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: C.line },
  statN:   { fontFamily: T.serifB, fontSize: 24, color: C.ink, marginBottom: 5 },
  statL:   { fontFamily: T.sans, fontSize: 11, lineHeight: 15, color: C.mut, textAlign: "center" },

  fine: { fontFamily: T.sans, fontSize: 13, lineHeight: 20, color: C.mut },
  err:  { fontFamily: T.sans, fontSize: 15, color: C.mut, textAlign: "center", marginTop: 56 },
});
