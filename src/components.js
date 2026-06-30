// Wingman Design System — Quiet Luxury / Editorial v2
// Warm espresso + champagne gold + parchment palette
// Hairline Unicode icons (no emoji), Playfair Display + DM Sans

import React, { useRef, useEffect, useState } from "react";
import {
  View, Text, Pressable, Animated, Easing, StyleSheet, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { C, T, GRAD } from "./theme";
// SafeBlur — expo-blur removed; renders a semi-opaque View instead of native UIVisualEffectView
function SafeBlur({ style, children }) {
  return <View style={[style, { backgroundColor: "rgba(15,13,10,0.92)" }]}>{children}</View>;
}

// ─── Haptics ─────────────────────────────────────────────────────────────────
export const tap = (style = "light") => {
  if (Platform.OS !== "ios") return;
  const m = {
    light:  Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy:  Haptics.ImpactFeedbackStyle.Heavy,
  };
  Haptics.impactAsync(m[style] || m.light).catch(() => {});
};
export const success = () => {
  if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};
export const warn = () => {
  if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};

// ─── Serif text component (Playfair Display) ─────────────────────────────────
export function SerifText({ style, italic, bold, children, ...props }) {
  const fontFamily = italic ? T.serifI : (bold ? T.serifB : T.serif);
  return <Text style={[{ fontFamily, letterSpacing: T.trackTight }, style]} {...props}>{children}</Text>;
}

// ─── Primary Button — spring press animation + 3-stop gradient ───────────────
export function Btn({ title, onPress, kind = "primary", style, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  if (kind === "ghost") {
    return (
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        <Pressable
          onPress={() => { tap(); onPress?.(); }}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={g.btnGhost}
          disabled={disabled}
        >
          <Text style={g.btnGhostT}>{title}</Text>
        </Pressable>
      </Animated.View>
    );
  }

  const grad = kind === "accent" ? GRAD.teal : GRAD.gold;
  const txt  = kind === "accent" ? "#021A12" : "#0F0D0A";

  return (
    <Animated.View style={[{ transform: [{ scale }], borderRadius: 14, overflow: "hidden" }, style]}>
      <Pressable
        onPress={() => { tap("medium"); onPress?.(); }}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={{ opacity: disabled ? 0.45 : 1 }}
      >
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={g.btn}
        >
          <Text style={[g.btnT, { color: txt }]}>{title}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Pressable card with spring animation ────────────────────────────────────
export function PressCard({ onPress, style, children }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable onPress={() => { tap(); onPress?.(); }} onPressIn={pressIn} onPressOut={pressOut}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─── Back navigation bar — frosted glass ─────────────────────────────────────
export function BackBar({ nav, label = "", serif = false }) {
  return (
    <SafeBlur intensity={60} tint="dark" style={g.backbarBlur}>
      <View style={g.backbar}>
        <Pressable onPress={() => { tap(); nav.goBack(); }} style={g.backBtn}>
          <Text style={g.backArrow}>‹</Text>
          <Text style={g.back}>Back</Text>
        </Pressable>
        {label ? (
          serif
            ? <SerifText style={g.backLabelSerif}>{label}</SerifText>
            : <Text style={g.backLabel}>{label}</Text>
        ) : null}
        <View style={{ width: 60 }} />
      </View>
    </SafeBlur>
  );
}
// ─── Chip / tag ───────────────────────────────────────────────────────────────
export function Chip({ children, color }) {
  return (
    <View style={g.chip}>
      <Text style={[g.chipT, color && { color }]}>{children}</Text>
    </View>
  );
}

// ─── Segmented control ────────────────────────────────────────────────────────
export function Segmented({ options, value, onChange }) {
  return (
    <View style={g.seg}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => { tap(); onChange(o); }} style={[g.segBtn, value === o && g.segOn]}>
          <Text style={[g.segT, value === o && g.segTOn]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Settings row ─────────────────────────────────────────────────────────────
export function SetRow({ ic, iconColor, t, sub, right, onPress }) {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap style={g.setRow} onPress={onPress ? () => { tap(); onPress(); } : undefined}>
      <View style={[g.setIc, { borderTopColor: "#FFFFFF0A", borderBottomColor: "#00000040" }]}>
        <Text style={{ fontSize: 15, color: iconColor || C.gold, fontFamily: T.sans }}>{ic}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={g.setT}>{t}</Text>
        {sub ? <Text style={g.setS}>{sub}</Text> : null}
      </View>
      {right}
    </Wrap>
  );
}

// ─── Itinerary leg row ────────────────────────────────────────────────────────
export function Leg({ ic, t, sub, tag, tagColor }) {
  return (
    <View style={g.leg}>
      <View style={[g.legIc, { borderTopColor: "#FFFFFF0A", borderBottomColor: "#00000040" }]}>
        <Text style={{ fontSize: 13, color: C.gold }}>{ic}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={g.legT}>{t}</Text>
        {sub ? <Text style={g.legS}>{sub}</Text> : null}
      </View>
      {tag ? (
        <View style={[g.tag, { backgroundColor: (tagColor || C.teal) + "22" }]}>
          <Text style={[g.tagT, { color: tagColor || C.teal }]}>{tag}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Option card (rescue / award search) ─────────────────────────────────────
export function Opt({ title, sub, meta = [], badge, sel }) {
  return (
    <View style={[g.opt, sel && g.optSel]}>
      <View style={g.rowBetween}>
        <Text style={g.optT}>{title}{badge ? <Text style={g.badge}>  {badge}</Text> : null}</Text>
        <View style={[g.radio, sel && g.radioSel]}>{sel ? <View style={g.radioDot} /> : null}</View>
      </View>
      <Text style={g.optS}>{sub}</Text>
      {meta.length ? <View style={g.metaRow}>{meta.map((m, i) => <Chip key={i}>{m}</Chip>)}</View> : null}
    </View>
  );
}

// ─── Reason card (disruption analysis) ───────────────────────────────────────
export function ReasonCard({ icon, t, w, wColor, p }) {
  return (
    <View style={g.rcard}>
      <View style={g.rcardH}>
        <View style={[g.rcardIc, { borderTopColor: "#FFFFFF0A", borderBottomColor: "#00000040" }]}>
          <Text style={{ fontSize: 14, color: C.gold }}>{icon}</Text>
        </View>
        <Text style={g.rcardT}>{t}</Text>
        <Text style={[g.rcardW, { color: wColor }]}>{w}</Text>
      </View>
      <Text style={g.rcardP}>{p}</Text>
    </View>
  );
}

// ─── Notification row ─────────────────────────────────────────────────────────
export function NtRow({ ic, t }) {
  return (
    <View style={g.ntRow}>
      <View style={g.ntIc}>
        <Text style={{ fontSize: 11, color: C.gold }}>{ic}</Text>
      </View>
      <Text style={g.ntTxt}>{t}</Text>
    </View>
  );
}

// ─── Animated contribution bar ────────────────────────────────────────────────
export function ContribRow({ label, pct, value, low }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: pct, duration: 900, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, []);
  const width = w.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return (
    <View style={g.crow}>
      <Text style={g.clabel}>{label}</Text>
      <View style={g.cbar}>
        <Animated.View style={[g.cfill, { width }, low && { backgroundColor: C.gold }]} />
      </View>
      <Text style={g.cval}>{value}</Text>
    </View>
  );
}

// ─── Count-up hook ────────────────────────────────────────────────────────────
export function useCountUp(target, active = true, step = 4, ms = 22) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    setV(0);
    let cur = 0;
    const t = setInterval(() => { cur += step; if (cur >= target) { cur = target; clearInterval(t); } setV(cur); }, ms);
    return () => clearInterval(t);
  }, [active, target]);
  return v;
}

// ─── Skeleton loader shimmer ──────────────────────────────────────────────────
export function Skeleton({ width = "100%", height = 18, radius = 8, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
  }, []);
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [C.card2, C.card3] });
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: bg }, style]} />;
}

// ─── Skeleton card (3-line placeholder) ──────────────────────────────────────
export function SkeletonCard({ style }) {
  return (
    <View style={[g.skCard, style]}>
      <Skeleton width="55%" height={14} radius={7} style={{ marginBottom: 10 }} />
      <Skeleton width="80%" height={11} radius={6} style={{ marginBottom: 7 }} />
      <Skeleton width="65%" height={11} radius={6} />
    </View>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
export function EmptyState({ icon = "✦", headline, sub, cta, onCta }) {
  return (
    <View style={g.empty}>
      <Text style={g.emptyIc}>{icon}</Text>
      <SerifText bold style={g.emptyH}>{headline}</SerifText>
      {sub ? <Text style={g.emptyS}>{sub}</Text> : null}
      {cta ? (
        <Btn title={cta} onPress={onCta} style={{ marginTop: 20, width: 200 }} />
      ) : null}
    </View>
  );
}

// ─── Radar animation (InsightsScreen) ────────────────────────────────────────
export function Radar() {
  const sweep = useRef(new Animated.Value(0)).current;
  const storm = useRef(new Animated.Value(0)).current;
  const risk  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(storm, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(storm, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.timing(risk, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true })).start();
  }, []);
  const rot        = sweep.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const stormScale = storm.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] });
  const stormOp    = storm.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
  const riskScale  = risk.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const riskOp     = risk.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <View style={r.box}>
      <View style={[r.ring, { width: 136, height: 136, borderRadius: 68, top: 10, left: 10 }]} />
      <View style={[r.ring, { width: 76,  height: 76,  borderRadius: 38, top: 40, left: 40 }]} />
      <View style={[r.ring, { width: 28,  height: 28,  borderRadius: 14, top: 64, left: 64 }]} />
      <Animated.View style={[r.sweepWrap, { transform: [{ rotate: rot }] }]}>
        <LinearGradient colors={[C.gold + "88", C.gold + "00"]} style={r.sweepLine} />
      </Animated.View>
      <Animated.View style={[r.storm, { opacity: stormOp, transform: [{ scale: stormScale }] }]} />
      <View style={r.route} />
      <View style={[r.dot, { top: 90, left: 16, backgroundColor: C.ink }]} />
      <View style={[r.dot, { top: 58, left: 128, backgroundColor: C.gold }]} />
      <Animated.View style={[r.riskRing, { opacity: riskOp, transform: [{ scale: riskScale }] }]} />
      <View style={r.riskDot} />
    </View>
  );
}

// ─── Execution stepper (rebooking / rescue flow) ──────────────────────────────
export function ExecStepper({ steps, onDone, title = "Working on it", sub = "One tap. Wingman handles every moving part." }) {
  const [done, setDone] = useState(-1);
  useEffect(() => {
    let i = 0;
    const run = () => {
      setDone(i);
      i++;
      if (i <= steps.length) setTimeout(run, 720);
      else { success(); setTimeout(onDone, 500); }
    };
    run();
  }, []);
  return (
    <View style={g.execWrap}>
      <SerifText style={g.execH}>{title}</SerifText>
      <Text style={g.execSub}>{sub}</Text>
      {steps.map((st, i) => (
        <View key={i} style={g.step}>
          <View style={[g.stepC, i < done && g.stepDone, i === done && g.stepRun]}>
            <Text style={{ color: i < done ? "#04241B" : C.mut, fontWeight: "700", fontFamily: T.sansB }}>
              {i < done ? "✓" : i + 1}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={g.stepT}>{st[0]}</Text>
            <Text style={g.stepS}>{st[1]}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Global style sheet ───────────────────────────────────────────────────────
export const g = StyleSheet.create({
  scroll:      { padding: 18, paddingBottom: 40 },
  rowBetween:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  // Section label — all-caps, wide-tracked, gold (exact deck match)
  sectionT: {
    color: C.gold,
    fontSize: 10,
    letterSpacing: 3.5,
    fontFamily: T.sansB,
    textTransform: "uppercase",
    marginTop: 28,
    marginBottom: 12,
    marginLeft: 2,
  },

  // Back bar — frosted glass
  backbarBlur: { overflow: "hidden" },
  backbar:    {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  backBtn:    { flexDirection: "row", alignItems: "center", gap: 4, width: 60 },
  backArrow:  { color: C.gold, fontSize: 22, lineHeight: 24, fontFamily: T.sansM },
  back:       { color: C.gold, fontSize: 15, fontFamily: T.sansM, letterSpacing: 0.2 },
  backLabel:  { color: C.ink, fontSize: 15, fontFamily: T.sansM, letterSpacing: 0.1 },
  backLabelSerif: { color: C.ink, fontSize: 17, fontFamily: T.serifB, letterSpacing: T.trackTight },

  // Buttons
  btn:        { paddingVertical: 16, alignItems: "center", borderRadius: 14 },
  btnT:       { fontSize: 15, fontFamily: T.sansB, letterSpacing: T.trackMed },
  btnGhost:   {
    borderWidth: 1,
    borderColor: C.gold + "60",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "rgba(201,169,110,0.06)",
  },
  btnGhostT:  { color: C.ink, fontSize: 15, fontFamily: T.sansM, letterSpacing: 0.2 },

  // Chip
  chip:  { backgroundColor: C.card2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.line },
  chipT: { color: C.ink, fontSize: 11, fontFamily: T.sansM, letterSpacing: 0.3 },

  // Segmented control
  seg:    { flexDirection: "row", backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  segOn:  { backgroundColor: C.card2, borderWidth: 1, borderColor: C.gold + "50" },
  segT:   { color: C.mut, fontSize: 12, fontFamily: T.sansM, letterSpacing: 0.3 },
  segTOn: { color: C.gold, fontFamily: T.sansB },

  // Settings row
  setRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  setIc:  {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.card2,
    borderWidth: 1, borderColor: C.line,
    alignItems: "center", justifyContent: "center",
  },
  setT:   { color: C.ink, fontSize: 15, fontFamily: T.sansM, letterSpacing: 0.1 },
  setS:   { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 2, lineHeight: 18 },

  // Group container — with card depth
  group: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderTopColor: "#FFFFFF0A",
    borderBottomColor: "#00000050",
    borderLeftColor: "#FFFFFF05",
    borderRightColor: "#00000030",
    borderRadius: 20,
    paddingHorizontal: 16,
  },

  // Trust note (privacy / ambient sync)
  trustNote:  { backgroundColor: C.gold + "0A", borderWidth: 1, borderColor: C.gold + "30", borderRadius: 14, padding: 16, marginBottom: 8 },
  trustNoteT: { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 20 },

  // Feature row
  feat: { flexDirection: "row", gap: 9, alignItems: "flex-start", paddingVertical: 6 },

  // Meta row (chips)
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },

  // Leg row
  leg:   { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12 },
  legIc: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: C.card2,
    borderWidth: 1, borderColor: C.line,
    alignItems: "center", justifyContent: "center",
  },
  legT:  { color: C.ink, fontSize: 14, fontFamily: T.sansM },
  legS:  { color: C.mut, fontSize: 12, fontFamily: T.sans, marginTop: 1 },
  tag:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagT:  { fontSize: 10, fontFamily: T.sansB, letterSpacing: T.trackMed },

  // Option card — with depth
  opt:      {
    backgroundColor: C.card,
    borderWidth: 1,
    borderTopColor: "#FFFFFF0A",
    borderBottomColor: "#00000050",
    borderLeftColor: "#FFFFFF05",
    borderRightColor: "#00000030",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },
  optSel:   { borderColor: C.gold, borderTopColor: C.goldL, backgroundColor: C.gold + "0A", borderWidth: 1.5 },
  optT:     { color: C.ink, fontSize: 15, fontFamily: T.sansB, flex: 1, letterSpacing: -0.2 },
  badge:    { color: C.gold, fontSize: 10, fontFamily: T.sansB, letterSpacing: 0.8 },
  optS:     { color: C.mut, fontSize: 13, fontFamily: T.sans, marginTop: 4, lineHeight: 19 },
  radio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  radioSel: { borderColor: C.gold },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.gold },

  // Reason card — with depth
  rcard:  {
    backgroundColor: C.card,
    borderWidth: 1,
    borderTopColor: "#FFFFFF0A",
    borderBottomColor: "#00000050",
    borderLeftColor: "#FFFFFF05",
    borderRightColor: "#00000030",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  rcardH: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  rcardIc:{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  rcardT: { color: C.ink, fontFamily: T.sansB, fontSize: 14, flex: 1, letterSpacing: -0.1 },
  rcardW: { fontSize: 11, fontFamily: T.sansB, letterSpacing: 0.8 },
  rcardP: { color: C.mut, fontSize: 13, fontFamily: T.sans, lineHeight: 20 },

  // Notification row
  ntRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 7 },
  ntIc:  { width: 24, height: 24, borderRadius: 7, backgroundColor: C.gold + "18", alignItems: "center", justifyContent: "center" },
  ntTxt: { color: C.ink, fontSize: 13.5, fontFamily: T.sans },

  // Contribution bar
  crow:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 11 },
  clabel: { width: 92, fontSize: 12, fontFamily: T.sans, color: C.ink },
  cbar:   { flex: 1, height: 8, borderRadius: 99, backgroundColor: C.card2, overflow: "hidden" },
  cfill:  { height: "100%", borderRadius: 99, backgroundColor: C.coral },
  cval:   { width: 32, textAlign: "right", fontSize: 12, fontFamily: T.sansB, color: C.ink },

  // Execution stepper
  execWrap: { flex: 1, padding: 24, paddingTop: 40 },
  execH:    { color: C.ink, fontSize: 22, letterSpacing: T.trackTight, marginBottom: 6, fontFamily: T.serifB },
  execSub:  { color: C.mut, fontSize: 14, fontFamily: T.sans, marginBottom: 20, lineHeight: 20 },
  step:     { flexDirection: "row", gap: 14, alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  stepC:    { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  stepRun:  { borderColor: C.gold },
  stepDone: { borderColor: C.teal, backgroundColor: C.teal },
  stepT:    { color: C.ink, fontSize: 15, fontFamily: T.sansM, letterSpacing: 0.1 },
  stepS:    { color: C.mut, fontSize: 13, fontFamily: T.sans, marginTop: 2 },

  // Skeleton
  skCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderTopColor: "#FFFFFF0A",
    borderBottomColor: "#00000050",
    borderLeftColor: "#FFFFFF05",
    borderRightColor: "#00000030",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },

  // Empty state
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingVertical: 60 },
  emptyIc: { fontSize: 36, color: C.gold, marginBottom: 16, fontFamily: T.sans },
  emptyH: { color: C.ink, fontSize: 22, textAlign: "center", marginBottom: 10 },
  emptyS: { color: C.mut, fontSize: 14, fontFamily: T.sans, textAlign: "center", lineHeight: 22 },
});

// ─── Radar styles ─────────────────────────────────────────────────────────────
const r = StyleSheet.create({
  box:       { width: 156, height: 156, borderRadius: 78, alignSelf: "center", marginTop: 4, marginBottom: 8, backgroundColor: "#1C1915", borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  ring:      { position: "absolute", borderWidth: 1, borderColor: C.gold + "22" },
  sweepWrap: { position: "absolute", width: 156, height: 156, alignItems: "center" },
  sweepLine: { position: "absolute", top: 6, left: 77, width: 2, height: 72 },
  storm:     { position: "absolute", width: 58, height: 42, borderRadius: 29, top: 30, left: 40, backgroundColor: "rgba(217,95,95,0.5)" },
  route:     { position: "absolute", top: 84, left: 18, width: 120, height: 1.5, borderRadius: 2, backgroundColor: C.gold, transform: [{ rotate: "-13deg" }] },
  dot:       { position: "absolute", width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: C.bg },
  riskDot:   { position: "absolute", top: 60, left: 74, width: 12, height: 12, borderRadius: 6, backgroundColor: C.coral, zIndex: 3 },
  riskRing:  { position: "absolute", top: 60, left: 74, width: 12, height: 12, borderRadius: 6, backgroundColor: C.coral, zIndex: 2 },
});

// ─── OfflineBanner ────────────────────────────────────────────────────────────
export { default as OfflineBanner } from "./components/OfflineBanner";
