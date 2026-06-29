// OfflineBanner — shows a subtle banner when the app is displaying cached data
// Usage: <OfflineBanner cached={true} stale={true} cachedAt={timestamp} />
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { C, T } from "../theme";
import { staleLabel } from "../offlineCache";

export default function OfflineBanner({ cached, stale, cachedAt, style }) {
  if (!cached) return null;
  const label = staleLabel(cachedAt);
  return (
    <View style={[s.banner, stale && s.bannerStale, style]}>
      <Text style={s.icon}>📡</Text>
      <Text style={s.text}>
        {stale
          ? `Offline — showing data from ${label}`
          : `Offline — showing recent data`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: C.line,
  },
  bannerStale: {
    borderColor: C.coral + "60",
    backgroundColor: C.coral + "12",
  },
  icon: { fontSize: 12 },
  text: { color: C.mut, fontSize: 12, fontFamily: T.sansM, flex: 1 },
});
