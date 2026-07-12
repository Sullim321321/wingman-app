// FlightActivity — Wingman on the lock screen.
//
// The countdown is NATIVE: `<Text timerInterval={...} countsDown />` maps to
// SwiftUI's Text(timerInterval:), which iOS re-renders every second by itself. No
// push, no poll, no waking the app. Remote updates are only needed when the FACTS
// change (a delay, a gate move) — not for time to pass.
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS FILE IS NOT NORMAL JAVASCRIPT. The 'widget' directive means it is COMPILED
// TO SWIFT, not executed. So the subset of JS you may use is tiny:
//
//   ✗ no template literals      `${a} → ${b}`
//   ✗ no method calls           props.label.toUpperCase()
//   ✗ no helper functions       statusColor(props.status)
//   ✗ no local consts / logic
//   ✓ plain prop references     {props.gate}
//   ✓ modifier calls            font({ size: 15 })
//
// A first version used all four forbidden things and the Swift compiler died with
// "expected identifier after '.' expression" — which is what `.toUpperCase()` looks
// like once it has been turned into Swift.
//
// So EVERY string, colour and label is precomputed in liveActivity.js and passed in
// ready to render. The widget does no work. It only draws.
// ─────────────────────────────────────────────────────────────────────────────

import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";

const INK = "#F4EFE7";
const MUTED = "#9A9086";

/**
 * props — all precomputed. See buildProps() in liveActivity.js.
 *   flightNumber   "AA4436"
 *   route          "PIT → LGA"
 *   statusLabel    "On time" | "Delayed 40m" | "Boarding"
 *   accent         "#C9A96E" | "#E5806B" | "#7FC8A9"
 *   gate           "B12" | "—"
 *   countdownLabel "UNTIL BOARDING" | "UNTIL DEPARTURE"   (already uppercase)
 *   detail         "On time · Terminal C"
 *   countdownFrom  Date
 *   countdownTo    Date
 */
const FlightActivity = (props) => {
  "widget";

  return {
    // ── Lock screen / Notification Center ──────────────────────────────────────
    banner: (
      <VStack modifiers={[padding({ all: 14 })]}>
        <HStack>
          <Text modifiers={[font({ size: 15, weight: "bold" }), foregroundStyle(INK)]}>
            {props.flightNumber}
          </Text>
          <Text modifiers={[font({ size: 15 }), foregroundStyle(MUTED), padding({ leading: 8 })]}>
            {props.route}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(props.accent)]}>
            {props.statusLabel}
          </Text>
        </HStack>

        <HStack modifiers={[padding({ top: 10 })]}>
          <VStack>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(MUTED)]}>GATE</Text>
            <Text modifiers={[font({ size: 22, weight: "bold" }), foregroundStyle(INK)]}>
              {props.gate}
            </Text>
          </VStack>

          <Spacer />

          <VStack>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(MUTED)]}>
              {props.countdownLabel}
            </Text>
            {/* Ticks by itself. iOS redraws this every second. */}
            <Text
              timerInterval={{ lower: props.countdownFrom, upper: props.countdownTo }}
              countsDown
              modifiers={[font({ size: 22, weight: "bold" }), foregroundStyle(props.accent)]}
            />
          </VStack>
        </HStack>
      </VStack>
    ),

    // ── Dynamic Island, collapsed ──────────────────────────────────────────────
    compactLeading: <Image systemName="airplane" color={props.accent} />,
    compactTrailing: (
      <Text
        timerInterval={{ lower: props.countdownFrom, upper: props.countdownTo }}
        countsDown
        modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(props.accent)]}
      />
    ),
    minimal: <Image systemName="airplane" color={props.accent} />,

    // ── Dynamic Island, expanded ───────────────────────────────────────────────
    expandedLeading: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ size: 10 }), foregroundStyle(MUTED)]}>GATE</Text>
        <Text modifiers={[font({ size: 20, weight: "bold" }), foregroundStyle(INK)]}>
          {props.gate}
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ size: 10 }), foregroundStyle(MUTED)]}>
          {props.countdownLabel}
        </Text>
        <Text
          timerInterval={{ lower: props.countdownFrom, upper: props.countdownTo }}
          countsDown
          modifiers={[font({ size: 20, weight: "bold" }), foregroundStyle(props.accent)]}
        />
      </VStack>
    ),
    expandedBottom: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(INK)]}>
          {props.route}
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(props.accent)]}>
          {props.detail}
        </Text>
      </VStack>
    ),
  };
};

// The name MUST match the entry in app.json's expo-widgets config.
export default createLiveActivity("FlightActivity", FlightActivity);
