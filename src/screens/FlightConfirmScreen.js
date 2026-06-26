import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Btn, g, success } from "../components";
import { C } from "../theme";

export default function FlightConfirmScreen({ navigation, route }) {
  const { booking } = route.params;

  React.useEffect(() => { success(); }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView style={g.scroll}>
        <View style={s.hero}>
          <Text style={s.heroIcon}>✈️</Text>
          <Text style={s.heroTitle}>Booking Confirmed</Text>
          <Text style={s.heroSub}>Your flight has been booked successfully.</Text>
        </View>

        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.label}>Booking reference</Text>
            <Text style={s.value}>{booking.booking_reference || "—"}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Total charged</Text>
            <Text style={[s.value, { color: C.teal }]}>{booking.total_currency} {booking.total_amount}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Duffel order ID</Text>
            <Text style={[s.value, { fontSize: 11, color: C.mut }]}>{booking.order_id}</Text>
          </View>
        </View>

        <View style={s.notice}>
          <Text style={s.noticeT}>Your trip has been added to Wingman. You can view it in the Trips tab.</Text>
        </View>

        <View style={{ marginTop: 24, gap: 12 }}>
          <Btn title="View My Trips" onPress={() => navigation.navigate("Home")} kind="accent" />
          <Btn title="Search More Flights" onPress={() => navigation.navigate("FlightSearch")} kind="ghost" />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: 32 },
  heroIcon: { fontSize: 52, marginBottom: 12 },
  heroTitle: { color: C.ink, fontSize: 24, fontWeight: "800", marginBottom: 6 },
  heroSub: { color: C.mut, fontSize: 14, textAlign: "center" },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  label: { color: C.mut, fontSize: 13 },
  value: { color: C.ink, fontSize: 14, fontWeight: "700" },
  notice: { backgroundColor: "rgba(34,211,166,0.07)", borderWidth: 1, borderColor: "rgba(34,211,166,0.2)", borderRadius: 12, padding: 13 },
  noticeT: { color: C.teal, fontSize: 13, lineHeight: 18 },
});
