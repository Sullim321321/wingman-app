// DestinationImage — a muted place photo as a subtle screen accent (Design #9)
// Fetches a low-saturation Unsplash photo for a city (server-side cached) and lays
// it in as a header wash that fades into the background so text stays legible.
// Renders nothing when there's no city or no photo — a graceful no-op.

import React, { useEffect, useState } from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, T } from "../theme";
import { getDestinationImage } from "../api";

export function DestinationImage({ city, height = 170, style }) {
  const [img, setImg] = useState(null);

  useEffect(() => {
    let on = true;
    setImg(null);
    const q = (city || "").toString().trim();
    if (!q) return;
    getDestinationImage(q).then((d) => { if (on && d && d.url) setImg(d); }).catch(() => {});
    return () => { on = false; };
  }, [city]);

  if (!img?.url) return null;

  return (
    <View style={[{ height, overflow: "hidden" }, style]}>
      <Image source={{ uri: img.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {/* Darken top slightly for status bar legibility, fade to bg at the bottom */}
      <LinearGradient
        colors={["rgba(0,0,0,0.28)", "transparent", C.bg]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {img.credit ? <Text style={st.credit}>{img.credit} / Unsplash</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  credit: {
    position: "absolute",
    right: 10,
    bottom: 8,
    fontFamily: T.sans,
    fontSize: 9,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.3,
  },
});
