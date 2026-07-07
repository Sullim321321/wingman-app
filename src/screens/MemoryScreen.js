// MemoryScreen — "About Me"
// Shows what Wingman has learned about the user across all sessions.
// Users can review, correct, or delete any field.
// New facts are added by telling the concierge naturally — no forms needed.

import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView, ScrollView, View, Text, Pressable,
  TextInput, Alert, ActivityIndicator, StyleSheet,
} from "react-native";
import { C, T } from "../theme";
import { SerifText, BackBar, tap } from "../components";
import { getMemory, updateMemory, deleteMemoryField } from "../api";

const FIELD_META = [
  { key: "identity",        label: "Who you are",             hint: "e.g. Founder, based in London, frequent traveller" },
  { key: "home_base",       label: "Home base",               hint: "e.g. London, UK" },
  { key: "passport",        label: "Passport",                hint: "e.g. British" },
  { key: "travel_style",    label: "Travel style",            hint: "e.g. Efficient, minimal, no fuss" },
  { key: "travel_tier",     label: "Travel tier",             hint: "e.g. Business class on long-haul, upscale hotels" },
  { key: "cabin_default",   label: "Default cabin",           hint: "e.g. Business on flights over 4 hours" },
  { key: "airline_notes",   label: "Airline preferences",     hint: "e.g. JetBlue Mosaic 4, prefer Star Alliance" },
  { key: "loyalty_alliance",label: "Loyalty alliance",        hint: "e.g. Star Alliance, Oneworld, SkyTeam" },
  { key: "loyalty_notes",   label: "Loyalty programs",        hint: "e.g. Marriott Bonvoy Titanium, Hyatt Globalist" },
  { key: "hotel_brands",    label: "Preferred hotel brands",  hint: "e.g. Hoxton, Ace, 1 Hotels, Rosewood" },
  { key: "hotel_must_haves",label: "Hotel must-haves",        hint: "e.g. Cold plunge, Technogym, lap pool, fast WiFi" },
  { key: "food_notes",      label: "Food & dining",           hint: "e.g. No dietary restrictions, loves Japanese" },
  { key: "companions",      label: "Typical travel companions",hint: "e.g. Usually solo, occasionally with partner" },
  { key: "training",        label: "Training & fitness",      hint: "e.g. Training for Thanksgiving 5K, 8 weeks out" },
  { key: "recovery",        label: "Recovery requirements",   hint: "e.g. Cold plunge daily, needs lap pool when racing" },
  { key: "work_context",    label: "Work context",            hint: "e.g. Attends music industry events, tours globally" },
  { key: "interests",       label: "Interests",               hint: "e.g. Music, running, architecture, Japanese food" },
  { key: "dislikes",        label: "Dislikes / avoid",        hint: "e.g. Noisy hotels, chain restaurants, middle seats" },
];

function MemoryField({ fieldKey, label, hint, value, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value || "");
  const [saving, setSaving]   = useState(false);

  const startEdit = () => {
    tap();
    setDraft(value || "");
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value || "");
  };

  const save = async () => {
    if (!draft.trim()) {
      // Empty = delete
      confirmDelete();
      return;
    }
    setSaving(true);
    try {
      await onSave(fieldKey, draft.trim());
      setEditing(false);
    } catch {
      Alert.alert("Error", "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Remove this?",
      `Remove "${label}" from Wingman's memory?`,
      [
        { text: "Cancel", style: "cancel", onPress: cancel },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            try {
              await onDelete(fieldKey);
              setEditing(false);
            } catch {
              Alert.alert("Error", "Couldn't remove — try again.");
            }
          },
        },
      ]
    );
  };

  const isEmpty = !value;

  return (
    <View style={s.field}>
      <View style={s.fieldHeader}>
        <Text style={s.fieldLabel}>{label}</Text>
        {!editing && (
          <Pressable onPress={startEdit} style={s.editBtn}>
            <Text style={s.editBtnT}>{isEmpty ? "Add" : "Edit"}</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <View style={s.editArea}>
          <TextInput
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={hint}
            placeholderTextColor={C.mut}
            multiline
            autoFocus
          />
          <View style={s.editActions}>
            <Pressable onPress={cancel} style={s.cancelBtn}>
              <Text style={s.cancelBtnT}>Cancel</Text>
            </Pressable>
            {!isEmpty && (
              <Pressable onPress={confirmDelete} style={s.deleteBtn}>
                <Text style={s.deleteBtnT}>Remove</Text>
              </Pressable>
            )}
            <Pressable onPress={save} style={[s.saveBtn, saving && { opacity: 0.5 }]} disabled={saving}>
              <Text style={s.saveBtnT}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={startEdit}>
          {isEmpty ? (
            <Text style={s.fieldEmpty}>{hint}</Text>
          ) : (
            <Text style={s.fieldValue}>{value}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

export default function MemoryScreen({ navigation }) {
  const [loading, setLoading]   = useState(true);
  const [memory, setMemory]     = useState({});
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getMemory();
      setMemory(data?.memory || {});
      setUpdatedAt(data?.updated_at || null);
    } catch {
      Alert.alert("Error", "Couldn't load your profile — check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (key, value) => {
    const updated = await updateMemory({ [key]: value });
    setMemory(updated?.memory || { ...memory, [key]: value });
  };

  const handleDelete = async (key) => {
    await deleteMemoryField(key);
    const next = { ...memory };
    delete next[key];
    setMemory(next);
  };

  const hasAny = Object.keys(memory).some(k => memory[k] && k !== "misc");
  const miscNotes = Array.isArray(memory.misc) ? memory.misc : [];

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <BackBar nav={navigation} label="About Me" />
        <ActivityIndicator color={C.gold} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <BackBar nav={navigation} label="About Me" />

        <View style={s.intro}>
          <SerifText bold style={s.introTitle}>What Wingman knows about you</SerifText>
          <Text style={s.introBody}>
            Wingman builds this profile automatically from your conversations — you never need to fill out a form.
            Everything here is used to personalise every recommendation, without you having to re-explain yourself.
            Tap any field to correct it.
          </Text>
          {updatedAt && (
            <Text style={s.updatedAt}>
              Last updated {new Date(updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          )}
        </View>

        {!hasAny && (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>Nothing here yet</Text>
            <Text style={s.emptyBody}>
              Start a conversation in the concierge — mention where you're based, what airline status you have, what hotels you prefer, or what you're training for. Wingman will remember it automatically.
            </Text>
            <Text style={s.emptyExample}>
              Try: "I have JetBlue Mosaic 4 status and always fly business on long-hauls. I need a cold plunge and Technogym when I'm training."
            </Text>
          </View>
        )}

        {FIELD_META.map(({ key, label, hint }) => (
          <MemoryField
            key={key}
            fieldKey={key}
            label={label}
            hint={hint}
            value={memory[key] || ""}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ))}

        {miscNotes.length > 0 && (
          <View style={s.miscSection}>
            <Text style={s.miscLabel}>OTHER NOTES</Text>
            {miscNotes.map((note, i) => (
              <View key={i} style={s.miscRow}>
                <Text style={s.miscText}>{note}</Text>
                <Pressable
                  onPress={() => {
                    Alert.alert("Remove note?", note, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Remove", style: "destructive",
                        onPress: async () => {
                          const next = miscNotes.filter((_, j) => j !== i);
                          await updateMemory({ misc: next });
                          setMemory(prev => ({ ...prev, misc: next }));
                        },
                      },
                    ]);
                  }}
                  style={s.miscRemove}
                >
                  <Text style={s.miscRemoveT}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer}>
          <Text style={s.footerText}>
            Wingman learns from every conversation. The more you talk to it, the better it knows you.
            Your memory is stored securely and never shared.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.ink },
  scroll:     { paddingBottom: 60 },

  intro:      { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  introTitle: { fontSize: 22, color: C.parchment, marginBottom: 10 },
  introBody:  { fontFamily: T.sans, fontSize: 14, color: C.mut, lineHeight: 20 },
  updatedAt:  { fontFamily: T.sans, fontSize: 12, color: C.mut + "80", marginTop: 8 },

  emptyState:  { marginHorizontal: 20, marginBottom: 24, padding: 20, backgroundColor: C.card, borderRadius: 12 },
  emptyTitle:  { fontFamily: T.sansB, fontSize: 15, color: C.parchment, marginBottom: 8 },
  emptyBody:   { fontFamily: T.sans, fontSize: 14, color: C.mut, lineHeight: 20, marginBottom: 12 },
  emptyExample:{ fontFamily: T.sansI || T.sans, fontSize: 13, color: C.gold + "CC", lineHeight: 18 },

  field:        { marginHorizontal: 20, marginBottom: 2, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  fieldHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  fieldLabel:   { fontFamily: T.sansB, fontSize: 11, color: C.mut, letterSpacing: 0.8, textTransform: "uppercase" },
  fieldValue:   { fontFamily: T.sans, fontSize: 15, color: C.parchment, lineHeight: 21 },
  fieldEmpty:   { fontFamily: T.sans, fontSize: 14, color: C.mut + "60", fontStyle: "italic" },

  editBtn:      { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: C.gold + "60" },
  editBtnT:     { fontFamily: T.sansB, fontSize: 11, color: C.gold },

  editArea:     { marginTop: 6 },
  input:        {
    fontFamily: T.sans, fontSize: 15, color: C.parchment,
    backgroundColor: C.card, borderRadius: 8, padding: 12,
    minHeight: 60, textAlignVertical: "top",
    borderWidth: 1, borderColor: C.gold + "40",
  },
  editActions:  { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 },
  cancelBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: C.card },
  cancelBtnT:   { fontFamily: T.sansB, fontSize: 13, color: C.mut },
  deleteBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: C.card },
  deleteBtnT:   { fontFamily: T.sansB, fontSize: 13, color: "#e05" },
  saveBtn:      { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 8, backgroundColor: C.gold },
  saveBtnT:     { fontFamily: T.sansB, fontSize: 13, color: C.ink },

  miscSection:  { marginHorizontal: 20, marginTop: 16, marginBottom: 8 },
  miscLabel:    { fontFamily: T.sansB, fontSize: 11, color: C.mut, letterSpacing: 0.8, marginBottom: 8 },
  miscRow:      { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  miscText:     { flex: 1, fontFamily: T.sans, fontSize: 14, color: C.parchment, lineHeight: 20 },
  miscRemove:   { paddingLeft: 12, paddingTop: 2 },
  miscRemoveT:  { fontFamily: T.sans, fontSize: 14, color: C.mut },

  footer:       { marginHorizontal: 20, marginTop: 28, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  footerText:   { fontFamily: T.sans, fontSize: 12, color: C.mut + "80", lineHeight: 18, textAlign: "center" },
});
