import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C } from "../theme";

// PlanCard — rendered below a concierge message when Claude returns a PLAN tag
// Shows trip highlights, recommended hotels, and a "Save this trip" CTA
export function PlanCard({ plan, onSave }) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  if (!plan) return null;

  const nights = plan.nights || 0;
  const cities = (plan.cities || []).join(' \u2192 ');
  const highlights = (plan.highlights || []).slice(0, 3);
  const hotelLegs = (plan.legs || []).filter(l => l.hotel);
  const flightLegs = (plan.legs || []).filter(l => l.type === 'flight');

  const handleSave = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      await onSave(plan);
      setSaved(true);
    } catch {}
    finally { setSaving(false); }
  };

  return (
    <View style={ps.card}>
      <View style={ps.header}>
        <Text style={ps.title}>{plan.title || cities}</Text>
        <Text style={ps.meta}>
          {nights > 0 ? `${nights} nights` : ''}
          {nights > 0 && cities ? ' \u00b7 ' : ''}
          {cities}
        </Text>
      </View>

      {highlights.length > 0 && (
        <View style={ps.section}>
          {highlights.map((h, i) => (
            <Text key={i} style={ps.highlight}>{'\u2022'} {h}</Text>
          ))}
        </View>
      )}

      {hotelLegs.length > 0 && (
        <View style={ps.section}>
          <Text style={ps.sectionLabel}>HOTELS</Text>
          {hotelLegs.slice(0, 5).map((l, i) => (
            <View key={i} style={ps.hotelRow}>
              {l.city ? <Text style={ps.hotelCity}>{l.city.toUpperCase()}</Text> : null}
              <Text style={ps.hotelName}>{l.hotel}</Text>
              {l.nights ? <Text style={ps.hotelMeta}>{l.nights} nights{l.loyalty_program ? ' \u00b7 ' + l.loyalty_program : ''}</Text> : null}
              {l.why ? <Text style={ps.hotelWhy}>{l.why}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {flightLegs.length > 0 && (
        <View style={ps.section}>
          <Text style={ps.sectionLabel}>FLIGHTS</Text>
          {flightLegs.slice(0, 4).map((l, i) => (
            <Text key={i} style={ps.flightRow}>
              {l.from} \u2192 {l.to}{l.routing ? '  \u00b7  ' + l.routing : ''}{l.date ? '  \u00b7  ' + l.date : ''}
            </Text>
          ))}
        </View>
      )}

      {plan.training_notes ? (
        <View style={[ps.section, { borderBottomWidth: 0 }]}>
          <Text style={ps.sectionLabel}>TRAINING</Text>
          <Text style={ps.trainingNotes}>{plan.training_notes}</Text>
        </View>
      ) : null}

      <Pressable
        style={[ps.saveBtn, saved && ps.saveBtnDone]}
        onPress={handleSave}
        disabled={saving || saved}
      >
        <Text style={[ps.saveBtnT, saved && ps.saveBtnTDone]}>
          {saved ? 'Saved to Trips \u2713' : saving ? 'Saving\u2026' : 'Save this trip'}
        </Text>
      </Pressable>
    </View>
  );
}

const ps = StyleSheet.create({
  card: {
    marginTop: 8,
    backgroundColor: C.parch,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.lineP,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.lineP,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold_Italic',
    fontSize: 15,
    color: C.gold,
    marginBottom: 2,
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: C.mutD,
    letterSpacing: 0.3,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.lineP,
    gap: 4,
  },
  sectionLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    color: C.mutD,
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  highlight: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: C.inkD,
    lineHeight: 20,
  },
  hotelRow: {
    gap: 2,
    marginBottom: 6,
  },
  hotelCity: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    color: C.mutD,
    letterSpacing: 1.2,
  },
  hotelName: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: C.inkD,
  },
  hotelMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: C.mutD,
  },
  hotelWhy: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: C.mutD,
    lineHeight: 17,
  },
  flightRow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: C.inkD,
    lineHeight: 20,
  },
  trainingNotes: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: C.mutD,
    lineHeight: 18,
  },
  saveBtn: {
    margin: 12,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: C.goldGlass,
    borderWidth: 1,
    borderColor: C.gold,
    alignItems: 'center',
  },
  saveBtnDone: {
    backgroundColor: '#2DB89618',
    borderColor: '#2DB896',
  },
  saveBtnT: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: C.gold,
    letterSpacing: 0.5,
  },
  saveBtnTDone: {
    color: '#2DB896',
  },
});
