// ForwardingScreen — connect your inbox without handing over your inbox.
//
// Wingman asks for gmail.readonly today. That is a RESTRICTED Google scope: it
// triggers a mandatory annual CASA security assessment by a Google-approved
// third-party assessor — real money, real weeks, repeated every twelve months,
// forever. In exchange for read access to every email you have ever received.
//
// This is the other way. You forward a confirmation — or better, you set one Gmail
// filter, once, and it forwards them for you. Wingman sees booking confirmations and
// nothing else. Zero Google scopes. No assessment. No annual fee.
//
// It is also, quietly, the more honest product. "Ambient ingestion" reads much better
// on a slide than "we have permission to read all of your mail."

import React, { useEffect, useState } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { C, T } from "../theme";
import { WMark, tap, success, BackBar, FadeRise, SerifText } from "../components";
import { getInboundAddress } from "../api";

export default function ForwardingScreen({ navigation }) {
  const [addr, setAddr]   = useState(null);
  const [busy, setBusy]   = useState(true);
  const [err, setErr]     = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await getInboundAddress();
        setAddr(r.address);
      } catch (e) {
        setErr(e?.message || "Couldn't fetch your address.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const copy = async () => {
    if (!addr) return;
    tap();
    await Clipboard.setStringAsync(addr);
    success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={s.app}>
      <ScrollView contentContainerStyle={s.scroll}>
        <BackBar nav={navigation} label="Forward your bookings" />

        <FadeRise>
          <SerifText style={s.h}>Your private address.</SerifText>
          <Text style={s.sub}>
            Anything you forward here becomes a trip. Wingman sees your booking
            confirmations — and nothing else in your inbox.
          </Text>

          {/* ── the address ─────────────────────────────────────────────────── */}
          <View style={s.card}>
            {busy ? (
              <ActivityIndicator color={C.gold} />
            ) : err ? (
              <Text style={s.err}>{err}</Text>
            ) : (
              <>
                <Text style={s.label}>YOUR ADDRESS</Text>
                <Text style={s.addr} selectable>{addr}</Text>
                <Pressable style={[s.copy, copied && { backgroundColor: C.teal }]} onPress={copy}>
                  <Text style={[s.copyT, copied && { color: "#0B1F1A" }]}>
                    {copied ? "Copied" : "Copy address"}
                  </Text>
                </Pressable>
                {/* This address IS the credential. Anyone who has it can write to
                    your trips — so say so, plainly, rather than burying it. */}
                <Text style={s.warn}>
                  Keep this private. It's unique to you, and anyone who has it can add
                  bookings to your account.
                </Text>
              </>
            )}
          </View>
        </FadeRise>

        {/* ── the good version: never think about it again ──────────────────── */}
        <FadeRise delay={80}>
          <Text style={s.sectionH}>BETTER: SET IT AND FORGET IT</Text>
          <Text style={s.sectionSub}>
            One Gmail filter, set up once. After that your confirmations arrive on
            their own and you never forward anything again.
          </Text>

          <Step n="1" t="Open Gmail on the web"
                d="Settings (the gear, top right) → See all settings → Filters and Blocked Addresses." />
          <Step n="2" t="Create a new filter"
                d="In the Has the words box, paste:" code={FILTER_QUERY} onCopy={copyText} />
          <Step n="3" t="Choose Forward it"
                d="Tick Forward it, then Add forwarding address, and paste your address above. Gmail will email you a confirmation code — enter it to verify." />
          <Step n="4" t="Apply to existing mail"
                d="Tick Also apply filter to matching conversations to sweep up the trips you've already booked." />

          <View style={s.note}>
            <WMark size={16} color={C.brass} />
            <Text style={s.noteT}>
              This is why Wingman doesn't ask to read your Gmail. It doesn't need to.
            </Text>
          </View>
        </FadeRise>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// The filter query. Deliberately narrow — a filter that forwards too much is a filter
// that hands us mail we have no business seeing, which is the exact thing this screen
// exists to avoid.
const FILTER_QUERY =
  'subject:(confirmation OR itinerary OR booking OR reservation OR "e-ticket" OR ' +
  '"boarding pass" OR "your trip" OR "check-in") ' +
  'OR from:(booking.com OR expedia OR airbnb.com OR united.com OR delta.com OR ' +
  'aa.com OR jetblue.com OR marriott.com OR hilton.com OR hyatt.com OR opentable.com OR resy.com)';

async function copyText(t) {
  await Clipboard.setStringAsync(t);
}

function Step({ n, t, d, code, onCopy }) {
  const [copied, setCopied] = useState(false);
  return (
    <View style={s.step}>
      <View style={s.stepN}><Text style={s.stepNT}>{n}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.stepT}>{t}</Text>
        <Text style={s.stepD}>{d}</Text>
        {code ? (
          <Pressable
            style={s.code}
            onPress={async () => {
              tap();
              await onCopy(code);
              success();
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Text style={s.codeT} numberOfLines={3}>{code}</Text>
            <Text style={s.codeC}>{copied ? "COPIED" : "TAP TO COPY"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40 },

  h: { fontFamily: T.serifB, fontSize: 27, color: C.ink, letterSpacing: -0.5, marginTop: 8, marginBottom: 10 },
  sub: { fontFamily: T.garamondI, fontSize: 17, lineHeight: 25, color: C.mut, marginBottom: 24 },

  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 18, marginBottom: 34 },
  label: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2.4, color: C.mutD, marginBottom: 10 },
  addr: { fontFamily: T.sansM, fontSize: 15, color: C.ink, lineHeight: 22, marginBottom: 16 },
  copy: { backgroundColor: C.gold, borderRadius: 11, paddingVertical: 13, alignItems: "center" },
  copyT: { fontFamily: T.sansB, fontSize: 14, color: C.inkD },
  warn: { fontFamily: T.sansM, fontSize: 11.5, lineHeight: 17, color: C.mut, marginTop: 14 },
  err: { fontFamily: T.sansM, fontSize: 13, color: C.coral },

  sectionH: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 2.4, color: C.mutD, marginBottom: 8 },
  sectionSub: { fontFamily: T.garamondI, fontSize: 15.5, lineHeight: 22, color: C.mut, marginBottom: 22 },

  step: { flexDirection: "row", gap: 13, marginBottom: 20 },
  stepN: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: C.gold,
           alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNT: { fontFamily: T.garamond, fontSize: 12, color: C.gold },
  stepT: { fontFamily: T.sansM, fontSize: 15, color: C.ink, marginBottom: 4 },
  stepD: { fontFamily: T.sans, fontSize: 13.5, lineHeight: 20, color: C.mut },

  code: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderRadius: 10,
          padding: 12, marginTop: 10 },
  codeT: { fontFamily: T.sans, fontSize: 11.5, lineHeight: 17, color: C.mut },
  codeC: { fontFamily: T.sansB, fontSize: 8.5, letterSpacing: 1.4, color: C.gold, marginTop: 8 },

  note: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 12,
          borderTopWidth: 1, borderTopColor: C.line, paddingTop: 18 },
  noteT: { flex: 1, fontFamily: T.garamondI, fontSize: 15, lineHeight: 21, color: C.mut },
});
