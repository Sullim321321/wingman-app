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
import { getMemory, updateMemory, deleteMemoryField, getMyConstraints, forgetConstraint } from "../api";

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

  const [standing, setStanding] = useState([]);

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
    // Separate call, separate failure. The profile loading and the constraint graph
    // loading are different questions, and one being down must not blank the other.
    try {
      const c = await getMyConstraints();
      setStanding(c?.constraints || []);
    } catch { /* leave it empty rather than inventing one */ }
  }, []);

  // "No, that isn't true of me." Retires it — it stops being applied to anything from
  // now on, but the row survives, because what Wingman used to believe (and when it
  // stopped) is part of how it explains a decision it made last month.
  const forget = (c) => {
    Alert.alert(
      "Not true of you?",
      `"${c.rationale || c.kind}"\n\nI'll stop applying this to your trips.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Forget it",
          style: "destructive",
          onPress: async () => {
            setStanding((prev) => prev.filter((x) => x.id !== c.id));
            try { await forgetConstraint(c.id); }
            catch { load(); }   // put it back — don't pretend it worked
          },
        },
      ]
    );
  };

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

        {/* ── ALWAYS TRUE OF YOU ────────────────────────────────────────────────
            These used to be listed on the Plan screen, under the trip being planned.
            They don't belong there: they're true of EVERY trip, so they say nothing
            about the one in front of you — they just push the live decisions off the
            bottom of the screen. A chief of staff doesn't recite your dietary
            requirements back to you every time you mention a city.

            Each one shows HOW it was learned, and that is not decoration. "You told me"
            and "I worked it out" are different kinds of fact, and rendering them
            identically is how an inference acquires the authority of a statement. */}
        {standing.length > 0 && (
          <View style={s.stdSection}>
            <Text style={s.stdH}>ALWAYS TRUE OF YOU</Text>
            <Text style={s.stdSub}>
              Applied to every trip, without you asking. Tap to correct.
            </Text>
            {standing.map((c) => (
              <View key={c.id} style={s.std}>
                <View style={s.stdTop}>
                  <Text style={s.stdT}>{c.rationale || c.kind}</Text>
                  <Text style={[
                    s.stdHard,
                    c.hardness === "must" && { color: C.gold },
                  ]}>{String(c.hardness || "").toUpperCase()}</Text>
                </View>
                <View style={s.stdBot}>
                  <Text style={s.stdSrc}>
                    {c.source === "stated"     ? "You told me"
                     : c.source === "observed" ? "I saw you do it"
                     : c.source === "researched" ? "I looked it up"
                     : "I worked it out"}
                    {c.status === "proposed" ? " · not applied until you confirm" : ""}
                  </Text>
                  <Pressable onPress={() => forget(c)} hitSlop={8}>
                    <Text style={s.stdX}>Not true</Text>
                  </Pressable>
                </View>
              </View>
            ))}
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
  // Always true of you — the constraint graph, rendered where you can change it.
  stdSection: { marginTop: 26, marginBottom: 10 },
  stdH:    { fontFamily: T.sansB, fontSize: 11, letterSpacing: 1.6, color: C.gold, marginBottom: 6 },
  stdSub:  { fontFamily: T.sans, fontSize: 13, color: C.mut, marginBottom: 14, lineHeight: 18 },
  std:     { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10,
             borderWidth: 1, borderColor: C.line },
  stdTop:  { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  stdT:    { fontFamily: T.sans, fontSize: 15, color: C.ink, flex: 1, lineHeight: 21 },
  stdHard: { fontFamily: T.sansB, fontSize: 9, letterSpacing: 1.2, color: C.mut, marginTop: 3 },
  stdBot:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  stdSrc:  { fontFamily: T.sans, fontSize: 12, color: C.mut, flex: 1, paddingRight: 10 },
  stdX:    { fontFamily: T.sansM, fontSize: 12, color: C.coral },

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
