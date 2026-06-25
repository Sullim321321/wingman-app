import React, { useRef, useEffect, useState } from "react";
import { View, Text, Pressable, Animated, Easing, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { C } from "./theme";

export const tap = (style = "light") => {
  if (Platform.OS !== "ios") return;
  const m = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium };
  Haptics.impactAsync(m[style] || m.light).catch(() => {});
};
export const success = () => {
  if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

export function Btn({ title, onPress, kind = "primary", style }) {
  if (kind === "ghost") {
    return (
      <Pressable onPress={() => { tap(); onPress?.(); }} style={[g.btnGhost, style]}>
        <Text style={g.btnGhostT}>{title}</Text>
      </Pressable>
    );
  }
  const grad = kind === "accent" ? ["#22D3A6", "#1BBF95"] : ["#5B8CFF", "#4F7DFF"];
  const txt = kind === "accent" ? "#03241B" : "#fff";
  return (
    <Pressable onPress={() => { tap("medium"); onPress?.(); }} style={[{ borderRadius: 14, overflow: "hidden" }, style]}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={g.btn}>
        <Text style={[g.btnT, { color: txt }]}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function BackBar({ nav, label = "" }) {
  return (
    <View style={g.backbar}>
      <Text style={g.back} onPress={() => { tap(); nav.goBack(); }}>‹ Back</Text>
      <Text style={g.backLabel}>{label}</Text>
    </View>
  );
}

export function Chip({ children, color }) {
  return <View style={g.chip}><Text style={[g.chipT, color && { color }]}>{children}</Text></View>;
}

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

export function SetRow({ ic, iconColor, t, sub, right, onPress }) {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap style={g.setRow} onPress={onPress ? () => { tap(); onPress(); } : undefined}>
      <View style={g.setIc}><Text style={{ fontSize: 16, color: iconColor }}>{ic}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={g.setT}>{t}</Text>
        {sub ? <Text style={g.setS}>{sub}</Text> : null}
      </View>
      {right}
    </Wrap>
  );
}

export function Leg({ ic, t, sub, tag, tagColor }) {
  return (
    <View style={g.leg}>
      <View style={g.legIc}><Text>{ic}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={g.legT}>{t}</Text>
        {sub ? <Text style={g.legS}>{sub}</Text> : null}
      </View>
      {tag ? <View style={[g.tag, { backgroundColor: (tagColor || C.teal) + "22" }]}><Text style={[g.tagT, { color: tagColor || C.teal }]}>{tag}</Text></View> : null}
    </View>
  );
}

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

export function ReasonCard({ icon, t, w, wColor, p }) {
  return (
    <View style={g.rcard}>
      <View style={g.rcardH}>
        <View style={g.rcardIc}><Text>{icon}</Text></View>
        <Text style={g.rcardT}>{t}</Text>
        <Text style={[g.rcardW, { color: wColor }]}>{w}</Text>
      </View>
      <Text style={g.rcardP}>{p}</Text>
    </View>
  );
}

export function NtRow({ ic, t }) {
  return (
    <View style={g.ntRow}>
      <View style={g.ntIc}><Text style={{ fontSize: 12 }}>{ic}</Text></View>
      <Text style={g.ntTxt}>{t}</Text>
    </View>
  );
}

export function ContribRow({ label, pct, value, low }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: pct, duration: 900, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, []);
  const width = w.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return (
    <View style={g.crow}>
      <Text style={g.clabel}>{label}</Text>
      <View style={g.cbar}><Animated.View style={[g.cfill, { width }, low && { backgroundColor: C.accent }]} /></View>
      <Text style={g.cval}>{value}</Text>
    </View>
  );
}

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

export function Radar() {
  const sweep = useRef(new Animated.Value(0)).current;
  const storm = useRef(new Animated.Value(0)).current;
  const risk = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(storm, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(storm, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.timing(risk, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true })).start();
  }, []);
  const rot = sweep.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const stormScale = storm.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] });
  const stormOp = storm.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
  const riskScale = risk.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const riskOp = risk.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <View style={r.box}>
      <View style={[r.ring, { width: 136, height: 136, borderRadius: 68, top: 10, left: 10 }]} />
      <View style={[r.ring, { width: 76, height: 76, borderRadius: 38, top: 40, left: 40 }]} />
      <View style={[r.ring, { width: 28, height: 28, borderRadius: 14, top: 64, left: 64 }]} />
      <Animated.View style={[r.sweepWrap, { transform: [{ rotate: rot }] }]}>
        <LinearGradient colors={["rgba(34,211,166,0.5)", "rgba(34,211,166,0)"]} style={r.sweepLine} />
      </Animated.View>
      <Animated.View style={[r.storm, { opacity: stormOp, transform: [{ scale: stormScale }] }]} />
      <View style={r.route} />
      <View style={[r.dot, { top: 90, left: 16, backgroundColor: C.ink }]} />
      <View style={[r.dot, { top: 58, left: 128, backgroundColor: C.teal }]} />
      <Animated.View style={[r.riskRing, { opacity: riskOp, transform: [{ scale: riskScale }] }]} />
      <View style={r.riskDot} />
    </View>
  );
}

// generic execution stepper screen body
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
      <Text style={g.execH}>{title}</Text>
      <Text style={g.execSub}>{sub}</Text>
      {steps.map((st, i) => (
        <View key={i} style={g.step}>
          <View style={[g.stepC, i < done && g.stepDone, i === done && g.stepRun]}>
            <Text style={{ color: i < done ? "#04241B" : C.mut, fontWeight: "700" }}>{i < done ? "✓" : i + 1}</Text>
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

export const g = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 40 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionT: { color: C.mut, fontSize: 11, letterSpacing: 1.5, fontWeight: "700", marginTop: 22, marginBottom: 10 },
  backbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  back: { color: C.ink, fontSize: 15, fontWeight: "600" },
  backLabel: { color: C.mut, fontSize: 13 },
  btn: { paddingVertical: 15, alignItems: "center", borderRadius: 14 },
  btnT: { fontSize: 15, fontWeight: "700" },
  btnGhost: { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnGhostT: { color: C.ink, fontSize: 14, fontWeight: "700" },
  chip: { backgroundColor: "#0E1530", borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  chipT: { color: C.mut, fontSize: 11 },
  seg: { flexDirection: "row", backgroundColor: "#0E1530", borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 3, gap: 3 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  segOn: { backgroundColor: C.accent },
  segT: { color: C.mut, fontSize: 12, fontWeight: "600" },
  segTOn: { color: "#fff" },
  setRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  setIc: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#0E1530", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  setT: { color: C.ink, fontSize: 14, fontWeight: "600" },
  setS: { color: C.mut, fontSize: 12, marginTop: 1 },
  group: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 14 },
  trustNote: { backgroundColor: "rgba(34,211,166,0.07)", borderWidth: 1, borderColor: "rgba(34,211,166,0.22)", borderRadius: 12, padding: 13, marginBottom: 6 },
  trustNoteT: { color: C.mut, fontSize: 12.5, lineHeight: 18 },
  feat: { flexDirection: "row", gap: 9, alignItems: "flex-start", paddingVertical: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  leg: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12 },
  legIc: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  legT: { color: C.ink, fontSize: 14, fontWeight: "600" },
  legS: { color: C.mut, fontSize: 12, marginTop: 1 },
  tag: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  tagT: { fontSize: 11, fontWeight: "700" },
  opt: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 10 },
  optSel: { borderColor: C.teal, backgroundColor: "rgba(34,211,166,0.07)" },
  optT: { color: C.ink, fontSize: 15, fontWeight: "700", flex: 1 },
  badge: { color: C.teal, fontSize: 11, fontWeight: "700" },
  optS: { color: C.mut, fontSize: 12.5, marginTop: 4, lineHeight: 17 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  radioSel: { borderColor: C.teal },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.teal },
  rcard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 15, marginBottom: 12 },
  rcardH: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  rcardIc: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#0E1530", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  rcardT: { color: C.ink, fontWeight: "700", fontSize: 14, flex: 1 },
  rcardW: { fontSize: 12, fontWeight: "700" },
  rcardP: { color: C.mut, fontSize: 12.5, lineHeight: 18 },
  ntRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 7 },
  ntIc: { width: 24, height: 24, borderRadius: 7, backgroundColor: "rgba(34,211,166,0.12)", alignItems: "center", justifyContent: "center" },
  ntTxt: { color: C.ink, fontSize: 13.5 },
  crow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 11 },
  clabel: { width: 92, fontSize: 12, color: C.ink },
  cbar: { flex: 1, height: 9, borderRadius: 99, backgroundColor: "#0E1530", overflow: "hidden" },
  cfill: { height: "100%", borderRadius: 99, backgroundColor: C.coral },
  cval: { width: 32, textAlign: "right", fontSize: 12, fontWeight: "700", color: C.ink },
  execWrap: { flex: 1, padding: 24, paddingTop: 40 },
  execH: { color: C.ink, fontSize: 20, fontWeight: "700" },
  execSub: { color: C.mut, fontSize: 13, marginBottom: 18, marginTop: 4 },
  step: { flexDirection: "row", gap: 13, alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  stepC: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  stepRun: { borderColor: C.accent },
  stepDone: { borderColor: C.teal, backgroundColor: C.teal },
  stepT: { color: C.ink, fontSize: 14, fontWeight: "600" },
  stepS: { color: C.mut, fontSize: 12, marginTop: 1 },
});

const r = StyleSheet.create({
  box: { width: 156, height: 156, borderRadius: 78, alignSelf: "center", marginTop: 4, marginBottom: 8, backgroundColor: "#101A33", borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  ring: { position: "absolute", borderWidth: 1, borderColor: "rgba(91,140,255,0.14)" },
  sweepWrap: { position: "absolute", width: 156, height: 156, alignItems: "center" },
  sweepLine: { position: "absolute", top: 6, left: 77, width: 2, height: 72 },
  storm: { position: "absolute", width: 58, height: 42, borderRadius: 29, top: 30, left: 40, backgroundColor: "rgba(255,92,122,0.5)" },
  route: { position: "absolute", top: 84, left: 18, width: 120, height: 2, borderRadius: 2, backgroundColor: C.accent, transform: [{ rotate: "-13deg" }] },
  dot: { position: "absolute", width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: C.bg },
  riskDot: { position: "absolute", top: 60, left: 74, width: 12, height: 12, borderRadius: 6, backgroundColor: C.coral, zIndex: 3 },
  riskRing: { position: "absolute", top: 60, left: 74, width: 12, height: 12, borderRadius: 6, backgroundColor: C.coral, zIndex: 2 },
});
