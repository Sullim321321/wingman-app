// ConfirmSheet — the one calm confirmation moment.
//
// Every side-effectful action (book, hold, pay, cancel, send) confirms through this and
// only this. It states plainly WHAT will happen, the COST, and whether it's REVERSIBLE —
// the three things a person needs before they commit. No raw Alert.alert, no bespoke
// per-screen sheet. Quiet-luxury language: ivory lifted plane, deep-ink primary, one line
// per fact.

import React from "react";
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { C, T, SP, R, CARD } from "../theme";
import { useTheme, useThemedStyles } from "../ThemeContext";

/**
 * @param visible      show/hide
 * @param kicker       small label, e.g. "CONFIRM & BOOK" (optional)
 * @param title        the headline — what this is, e.g. "The Hoxton, Williamsburg"
 * @param line         the plain-language sentence of what will happen + cost
 * @param facts        [{ label, value }] — optional detail rows (dates, refund window)
 * @param note         a reversibility/reassurance line (optional), e.g. "Refundable until Sep 8"
 * @param confirmLabel primary button text (default "Confirm")
 * @param destructive  tints the primary control coral (for cancel/delete)
 * @param busy         shows a spinner on the primary control
 * @param onConfirm / onCancel
 */
export default function ConfirmSheet({
  visible, kicker, title, line, facts = [], note,
  confirmLabel = "Confirm", cancelLabel = "Not yet",
  destructive = false, busy = false, onConfirm, onCancel,
}) {
  const { C } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={s.scrim} onPress={busy ? undefined : onCancel}>
        <Pressable style={s.sheet} onPress={() => {}}>
          {kicker ? <Text style={[s.kicker, destructive && { color: C.coral }]}>{kicker}</Text> : null}
          {title ? <Text style={s.title}>{title}</Text> : null}
          {line ? <Text style={s.line}>{line}</Text> : null}

          {facts.length ? (
            <View style={s.facts}>
              {facts.map((f, i) => (
                <View key={i} style={s.factRow}>
                  <Text style={s.factLabel}>{f.label}</Text>
                  <Text style={s.factValue}>{f.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {note ? <Text style={s.note}>{note}</Text> : null}

          <View style={s.actions}>
            <Pressable style={s.ghost} onPress={onCancel} disabled={busy}>
              <Text style={s.ghostT}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[s.primary, destructive && s.primaryDestructive, busy && { opacity: 0.7 }]}
              onPress={onConfirm}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color={destructive ? "#fff" : C.inkD} />
                : <Text style={[s.primaryT, destructive && { color: "#fff" }]}>{confirmLabel}</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (C) => ({
  scrim: { flex: 1, backgroundColor: "rgba(33,30,26,0.35)", justifyContent: "flex-end" },
  sheet: { ...CARD.lifted, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: SP.xl, paddingBottom: SP.xxxl },
  kicker: { fontFamily: T.sansB, fontSize: 10, letterSpacing: 2.4, color: C.gold, marginBottom: SP.sm },
  title: { fontFamily: T.serif, fontSize: 22, color: C.ink, lineHeight: 27 },
  line: { fontFamily: T.sans, fontSize: 15, color: C.ink, lineHeight: 21, marginTop: SP.sm },

  facts: { marginTop: SP.lg, borderTopWidth: 1, borderTopColor: C.line, paddingTop: SP.md, gap: SP.sm },
  factRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  factLabel: { fontFamily: T.sansM, fontSize: 13, letterSpacing: 0.3, color: C.mut },
  factValue: { fontFamily: T.sansM, fontSize: 13, color: C.ink },

  note: { fontFamily: T.garamondI, fontStyle: "italic", fontSize: 13, color: C.mut, marginTop: SP.md, lineHeight: 19 },

  actions: { flexDirection: "row", gap: SP.md, marginTop: SP.xl },
  ghost: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  ghostT: { fontFamily: T.sansM, fontSize: 15, color: C.mut },
  primary: { flex: 1.4, backgroundColor: C.parch, borderRadius: R.lg, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  primaryDestructive: { backgroundColor: C.coral },
  primaryT: { fontFamily: T.sansM, fontSize: 15, color: C.inkD },
});
