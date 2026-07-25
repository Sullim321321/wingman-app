// ui.js — the shared design primitives (DA-3).
//
// Screens should COMPOSE from these, not re-declare bg/border/radius/fontSize by hand.
// Every primitive is built from the tokens (theme.js: ramp, SP, R, C, T, CARD), so there
// is nothing left to hardcode — which is how the 54-ad-hoc-sizes drift stops for good.
//
// Primitives:
//   <SectionLabel> — the small-caps bronze label ("NOW", "WHAT'S GOOD IN NASHVILLE")
//   <Card>         — a plane (raised | lifted | inverted | flat) with standard padding
//   <Row>          — a left/right row (title + trailing), the list idiom
//   <Pill>         — a compact fact chip (dot + label)
//   <Stat>         — a number + caption (Insights)
//   <ScreenTitle>  — the serif page title
//   <Hairline>     — the standard divider

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { C, T, SP, R, CARD, ramp } from "../theme";

export function SectionLabel({ children, action, onAction, style }) {
  return (
    <View style={[s.sectionRow, style]}>
      <Text style={s.sectionLabel}>{String(children).toUpperCase()}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}><Text style={s.sectionAction}>{action}</Text></Pressable>
      ) : null}
    </View>
  );
}

export function Card({ plane = "raised", onPress, style, children }) {
  const base = [CARD[plane] || CARD.raised, s.cardPad, style];
  if (onPress) return <Pressable style={({ pressed }) => [base, pressed && { opacity: 0.9 }]} onPress={onPress}>{children}</Pressable>;
  return <View style={base}>{children}</View>;
}

export function Row({ title, subtitle, trailing, onPress, inverted = false, style }) {
  const Body = (
    <View style={[s.row, style]}>
      <View style={{ flex: 1, paddingRight: SP.md }}>
        <Text style={[s.rowTitle, inverted && { color: C.inkD }]} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={[s.rowSub, inverted && { color: C.mutD }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {typeof trailing === "string"
        ? <Text style={s.rowTrail}>{trailing}</Text>
        : (trailing || null)}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{Body}</Pressable> : Body;
}

export function Pill({ children, tone = "neutral" }) {
  const dot = tone === "ok" ? C.teal : tone === "risk" ? C.coral : tone === "accent" ? C.gold : C.mut;
  return (
    <View style={s.pill}>
      <View style={[s.pillDot, { backgroundColor: dot }]} />
      <Text style={s.pillT}>{children}</Text>
    </View>
  );
}

export function Stat({ value, caption }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statCaption}>{String(caption).toUpperCase()}</Text>
    </View>
  );
}

export function ScreenTitle({ children, trailing, style }) {
  return (
    <View style={[s.titleRow, style]}>
      <Text style={s.title}>{children}</Text>
      {trailing || null}
    </View>
  );
}

export function Hairline({ style }) {
  return <View style={[s.hairline, style]} />;
}

const s = StyleSheet.create({
  sectionRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SP.section, marginBottom: SP.gap },
  sectionLabel:  { ...ramp("label"), fontFamily: T.sansB, color: C.gold },
  sectionAction: { ...ramp("sub"), fontFamily: T.sansM, color: C.gold },

  cardPad: { padding: SP.lg },

  row:      { flexDirection: "row", alignItems: "center", paddingVertical: SP.md },
  rowTitle: { ...ramp("callout"), fontFamily: T.serif, color: C.ink },
  rowSub:   { ...ramp("sub"), fontFamily: T.sansM, color: C.mut, marginTop: 2 },
  rowTrail: { ...ramp("sub"), fontFamily: T.sansM, color: C.gold },

  pill:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: R.pill },
  pillDot: { width: 5, height: 5, borderRadius: 2.5 },
  pillT:   { ...ramp("caption"), fontFamily: T.sansM, color: C.mut, letterSpacing: 0.2 },

  stat:        { alignItems: "flex-start" },
  statValue:   { ...ramp("title"), fontFamily: T.serif, color: C.ink },
  statCaption: { ...ramp("label"), fontFamily: T.sansB, color: C.mut, marginTop: 4 },

  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  title:    { ...ramp("title"), fontFamily: T.serif, color: C.ink, flex: 1, paddingRight: SP.md },

  hairline: { height: 1, backgroundColor: C.line },
});
