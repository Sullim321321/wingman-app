// FlightActivity — Wingman on the lock screen.
//
// This is the purest expression of the chief-of-staff promise: your flight status,
// your gate, and the time you have left, visible without opening anything. The
// phone stays in your pocket and Wingman keeps watch.
//
// THE IMPORTANT PART: the countdown is NATIVE.
//
// `<Text timerInterval={...} countsDown />` maps to SwiftUI's Text(timerInterval:),
// which iOS re-renders every second on its own. We do not push, we do not poll, we
// do not wake the app. That means the "live" in Live Activity is real from day one,
// with no APNs key and no server work — remote updates are only needed when the
// FACTS change (a delay, a gate move), not for the clock to tick.
//
// Rendered by expo-widgets into a real SwiftUI widget extension. The 'widget'
// directive marks the component for that compilation — it is not a normal RN tree,
// so keep the logic here trivial and the data pre-computed on the JS side.

import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";

// Wingman's palette, restated here because the widget extension does not share the
// app's theme module — it is compiled separately.
const GOLD  = "#C9A96E";
const INK   = "#F4EFE7";
const MUTED = "#9A9086";
const CORAL = "#E5806B";   // delayed / at risk
const MINT  = "#7FC8A9";   // on time / boarding

function statusColor(status) {
  if (status === "delayed" || status === "cancelled") return CORAL;
  if (status === "boarding") return MINT;
  return GOLD;
}

/**
 * props (all pre-computed in JS — the widget does no work):
 *   carrier       "American Airlines"
 *   flightNumber  "AA4436"
 *   origin        "PIT"
 *   destination   "LGA"
 *   gate          "B12" | ""
 *   terminal      "C"   | ""
 *   status        "on_time" | "delayed" | "boarding" | "cancelled"
 *   statusLabel   "On time" | "Delayed 40m" | "Boarding" | "Cancelled"
 *   countdownFrom Date  — now
 *   countdownTo   Date  — boarding time (or departure if we don't know boarding)
 *   countdownLabel "until boarding" | "until departure"
 */
const FlightActivity = (props) => {
  "widget";

  const accent = statusColor(props.status);
  const range = { lower: props.countdownFrom, upper: props.countdownTo };

  return {
    // ── Lock screen / Notification Center ──────────────────────────────────────
    banner: (
      <VStack modifiers={[padding({ all: 14 })]}>
        <HStack>
          <Text modifiers={[font({ size: 15, weight: "bold" }), foregroundStyle(INK)]}>
            {props.flightNumber}
          </Text>
          <Text modifiers={[font({ size: 15 }), foregroundStyle(MUTED)]}>
            {`  ${props.origin} → ${props.destination}`}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(accent)]}>
            {props.statusLabel}
          </Text>
        </HStack>

        <HStack modifiers={[padding({ top: 10 })]}>
          <VStack>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(MUTED)]}>GATE</Text>
            <Text modifiers={[font({ size: 22, weight: "bold" }), foregroundStyle(INK)]}>
              {props.gate || "—"}
            </Text>
          </VStack>

          <Spacer />

          <VStack>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(MUTED)]}>
              {props.countdownLabel.toUpperCase()}
            </Text>
            {/* Ticks by itself. No push, no poll. */}
            <Text
              timerInterval={range}
              countsDown
              modifiers={[font({ size: 22, weight: "bold" }), foregroundStyle(accent)]}
            />
          </VStack>
        </HStack>
      </VStack>
    ),

    // ── Dynamic Island, collapsed ──────────────────────────────────────────────
    compactLeading: <Image systemName="airplane" color={accent} />,
    compactTrailing: (
      <Text
        timerInterval={range}
        countsDown
        modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(accent)]}
      />
    ),
    minimal: <Image systemName="airplane" color={accent} />,

    // ── Dynamic Island, expanded ───────────────────────────────────────────────
    expandedLeading: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ size: 10 }), foregroundStyle(MUTED)]}>GATE</Text>
        <Text modifiers={[font({ size: 20, weight: "bold" }), foregroundStyle(INK)]}>
          {props.gate || "—"}
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ size: 10 }), foregroundStyle(MUTED)]}>
          {props.countdownLabel.toUpperCase()}
        </Text>
        <Text
          timerInterval={range}
          countsDown
          modifiers={[font({ size: 20, weight: "bold" }), foregroundStyle(accent)]}
        />
      </VStack>
    ),
    expandedBottom: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(INK)]}>
          {`${props.flightNumber} · ${props.origin} → ${props.destination}`}
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(accent)]}>
          {props.terminal ? `${props.statusLabel} · Terminal ${props.terminal}` : props.statusLabel}
        </Text>
      </VStack>
    ),
  };
};

// The name MUST match the entry in app.json's expo-widgets config.
export default createLiveActivity("FlightActivity", FlightActivity);
