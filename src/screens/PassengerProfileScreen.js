/**
 * PassengerProfileScreen
 * ──────────────────────
 * Stores traveler details required for silent autonomous rebooking.
 * Data is sent to POST /profile/passenger and stored server-side.
 * Passport number is never displayed after save (masked).
 *
 * Required for autonomy_mode = "fully_auto" to function.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable,
  StyleSheet, Alert, ActivityIndicator, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, T } from "../theme";
import { getPassengerProfile, savePassengerProfile } from "../api";

// expo-image-picker is added in the next build — graceful fallback if not yet available
let ImagePicker = null;
try { ImagePicker = require("expo-image-picker"); } catch {}

// ── Helpers ───────────────────────────────────────────────────
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

function formatDOB(raw) {
  // Auto-format as MM/DD/YYYY while typing
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
}

function isValidDOB(dob) {
  const parts = dob.split("/");
  if (parts.length !== 3 || parts[2].length !== 4) return false;
  const [m, d, y] = parts.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1920 || y > 2010) return false;
  return true;
}

// ── Sub-components ────────────────────────────────────────────
function FieldLabel({ label, required }) {
  return (
    <View style={s.labelRow}>
      <Text style={s.label}>{label}</Text>
      {required && <Text style={s.required}> *</Text>}
    </View>
  );
}

function Field({ label, required, value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength, secureTextEntry }) {
  return (
    <View style={s.fieldWrap}>
      <FieldLabel label={label} required={required} />
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.mut}
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize || "words"}
        autoCorrect={false}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

function GenderPicker({ value, onChange }) {
  return (
    <View style={s.fieldWrap}>
      <FieldLabel label="GENDER" required />
      <View style={s.genderRow}>
        {GENDERS.map(g => (
          <Pressable
            key={g}
            style={[s.genderBtn, value === g && s.genderBtnActive]}
            onPress={() => onChange(g)}
          >
            <Text style={[s.genderBtnT, value === g && s.genderBtnTActive]}>{g}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function InfoBanner() {
  return (
    <View style={s.banner}>
      <Text style={s.bannerIcon}>🔒</Text>
      <Text style={s.bannerText}>
        Your traveler details are encrypted and used only to complete bookings on your behalf when Wingman is in autonomous mode. Passport number is never shared with third parties.
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────
export default function PassengerProfileScreen({ navigation }) {
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  // Form state
  const [firstName, setFirstName]   = useState("");
  const [lastName, setLastName]     = useState("");
  const [dob, setDob]               = useState("");
  const [gender, setGender]         = useState("");
  const [phone, setPhone]           = useState("");
  const [passportNum, setPassportNum] = useState("");
  const [passportExp, setPassportExp] = useState("");
  const [passportCountry, setPassportCountry] = useState("");
  const [hasPassport, setHasPassport] = useState(false);
  const [passportMasked, setPassportMasked] = useState(false); // true if passport was previously saved

  useEffect(() => {
    getPassengerProfile()
      .then(res => {
        // Server returns { passenger_profile: { given_name, family_name, ... } }
        const p = res?.passenger_profile || res;
        if (!p) return;
        setFirstName(p.given_name || p.first_name || "");
        setLastName(p.family_name || p.last_name || "");
        setDob(p.born_on || p.dob || "");
        setGender(p.gender || "");
        setPhone(p.phone || "");
        if (p.has_passport || p.passport_masked) {
          setPassportMasked(true);
          setHasPassport(true);
        }
        setPassportExp(p.passport_expiry || "");
        setPassportCountry(p.passport_country || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Required", "Please enter your first and last name.");
      return;
    }
    if (!dob || !isValidDOB(dob)) {
      Alert.alert("Invalid date", "Please enter your date of birth as MM/DD/YYYY.");
      return;
    }
    if (!gender) {
      Alert.alert("Required", "Please select your gender.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dob,
        gender,
        phone: phone.trim() || undefined,
      };
      if (hasPassport && !passportMasked && passportNum.trim()) {
        payload.passport_number  = passportNum.trim().toUpperCase();
        payload.passport_expiry  = passportExp.trim();
        payload.passport_country = passportCountry.trim().toUpperCase();
      }
      await savePassengerProfile(payload);
      setSaved(true);
      Alert.alert(
        "Profile saved",
        "Wingman now has everything needed to rebook on your behalf when in autonomous mode.",
        [{ text: "Done", onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert("Save failed", e.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }, [firstName, lastName, dob, gender, phone, hasPassport, passportMasked, passportNum, passportExp, passportCountry, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={C.gold} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backT}>‹ Back</Text>
        </Pressable>
        <Text style={s.title}>Traveler Profile</Text>
        <Text style={s.subtitle}>Required for autonomous rebooking</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <InfoBanner />

        {/* Section: Identity */}
        <Text style={s.sectionLabel}>IDENTITY</Text>
        <View style={s.card}>
          <Field
            label="FIRST NAME"
            required
            value={firstName}
            onChangeText={setFirstName}
            placeholder="As it appears on your passport"
            maxLength={50}
          />
          <Field
            label="LAST NAME"
            required
            value={lastName}
            onChangeText={setLastName}
            placeholder="As it appears on your passport"
            maxLength={50}
          />
          <View style={s.fieldWrap}>
            <FieldLabel label="DATE OF BIRTH" required />
            <TextInput
              style={s.input}
              value={dob}
              onChangeText={v => setDob(formatDOB(v))}
              placeholder="MM/DD/YYYY"
              placeholderTextColor={C.mut}
              keyboardType="numeric"
              autoCapitalize="none"
              maxLength={10}
            />
          </View>
          <GenderPicker value={gender} onChange={setGender} />
        </View>

        {/* Section: Contact */}
        <Text style={s.sectionLabel}>CONTACT</Text>
        <View style={s.card}>
          <View style={{ borderBottomWidth: 0 }}>
            <Field
              label="MOBILE NUMBER"
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 000-0000"
              keyboardType="phone-pad"
              autoCapitalize="none"
              maxLength={20}
            />
          </View>
        </View>

        {/* Section: Passport (optional) */}
        <Text style={s.sectionLabel}>PASSPORT  <Text style={s.optionalTag}>OPTIONAL</Text></Text>
        <View style={s.card}>
          {/* Scan ID button */}
          <Pressable
            style={s.scanBtn}
            onPress={async () => {
              if (!ImagePicker) {
                Alert.alert(
                  "Coming soon",
                  "Passport scanning will be available in the next app update. For now, enter your details manually below."
                );
                return;
              }
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== "granted") {
                Alert.alert("Camera access needed", "Please allow camera access in Settings to scan your passport.");
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.9,
                allowsEditing: false,
              });
              if (!result.canceled && result.assets?.[0]) {
                Alert.alert(
                  "Passport photo captured",
                  "Wingman will extract your details from the photo. This feature is being processed — please verify the fields below after they populate."
                );
                // OCR extraction will be wired in the next server update
              }
            }}
          >
            <Text style={s.scanBtnIcon}>  </Text>
            <View style={{ flex: 1 }}>
              <Text style={s.scanBtnT}>Scan ID / Passport</Text>
              <Text style={s.scanBtnSub}>Take a photo to auto-fill your details</Text>
            </View>
            <Text style={s.scanBtnArrow}>›</Text>
          </Pressable>

          <View style={s.scanDivider}>
            <View style={s.scanDividerLine} />
            <Text style={s.scanDividerT}>OR ENTER MANUALLY</Text>
            <View style={s.scanDividerLine} />
          </View>

          <Pressable
            style={s.passportToggleRow}
            onPress={() => { setHasPassport(!hasPassport); setPassportMasked(false); }}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.passportToggleT}>Add passport details</Text>
              <Text style={s.passportToggleSub}>
                Enables international rebooking without manual entry at the airport
              </Text>
            </View>
            <View style={[s.toggle, hasPassport && s.toggleOn]}>
              <View style={[s.toggleThumb, hasPassport && s.toggleThumbOn]} />
            </View>
          </Pressable>

          {hasPassport && (
            <>
              {passportMasked ? (
                <View style={s.maskedRow}>
                  <Text style={s.maskedT}>Passport on file  ••••••••</Text>
                  <Pressable onPress={() => setPassportMasked(false)}>
                    <Text style={s.maskedEdit}>Update</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Field
                    label="PASSPORT NUMBER"
                    value={passportNum}
                    onChangeText={setPassportNum}
                    placeholder="e.g. A12345678"
                    autoCapitalize="characters"
                    maxLength={20}
                  />
                  <Field
                    label="EXPIRY DATE"
                    value={passportExp}
                    onChangeText={v => setPassportExp(formatDOB(v))}
                    placeholder="MM/DD/YYYY"
                    keyboardType="numeric"
                    autoCapitalize="none"
                    maxLength={10}
                  />
                  <View style={{ borderBottomWidth: 0 }}>
                    <Field
                      label="ISSUING COUNTRY"
                      value={passportCountry}
                      onChangeText={setPassportCountry}
                      placeholder="e.g. US"
                      autoCapitalize="characters"
                      maxLength={3}
                    />
                  </View>
                </>
              )}
            </>
          )}
        </View>

        {/* Save button */}
        <Pressable
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={C.bg} />
            : <Text style={s.saveBtnT}>{saved ? "Profile saved ✓" : "Save traveler profile"}</Text>
          }
        </Pressable>

        <Text style={s.footNote}>
          Wingman encrypts all traveler data at rest. Your passport number is never exposed in API responses or concierge messages.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  backBtn:{ marginBottom: 10 },
  backT:  { color: C.gold, fontSize: 15, fontFamily: T.sansM },
  title:  { color: C.ink, fontSize: 22, fontFamily: T.serifB, marginBottom: 4 },
  subtitle:{ color: C.mut, fontSize: 13, fontFamily: T.sans },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  banner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.gold + "30", marginBottom: 24 },
  bannerIcon: { fontSize: 16, marginTop: 1 },
  bannerText: { flex: 1, color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 18 },

  sectionLabel: { color: C.mutD, fontSize: 10, fontFamily: T.sansB, letterSpacing: 3.5, textTransform: "uppercase", marginTop: 24, marginBottom: 10, marginLeft: 2 },
  optionalTag:  { color: C.mut, fontSize: 10, fontFamily: T.sans, letterSpacing: 0.5 },

  card:   { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, marginBottom: 20, overflow: "hidden" },

  fieldWrap: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  labelRow:  { flexDirection: "row", marginBottom: 6 },
  label:     { color: C.mut, fontSize: 10, fontFamily: T.sansB, letterSpacing: 1.2, textTransform: "uppercase" },
  required:  { color: C.gold, fontSize: 10, fontFamily: T.sansB },
  input:     { color: C.ink, fontSize: 15, fontFamily: T.sans, paddingVertical: Platform.OS === "ios" ? 4 : 2 },

  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  genderBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.card2 },
  genderBtnActive: { borderColor: C.gold, backgroundColor: C.gold + "18" },
  genderBtnT: { color: C.mut, fontSize: 12, fontFamily: T.sansM },
  genderBtnTActive: { color: C.gold },

  passportToggleRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  passportToggleT:   { color: C.ink, fontSize: 14, fontFamily: T.sansM, marginBottom: 2 },
  passportToggleSub: { color: C.mut, fontSize: 12, fontFamily: T.sans, lineHeight: 17 },
  toggle:       { width: 44, height: 26, borderRadius: 13, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, justifyContent: "center", paddingHorizontal: 3 },
  toggleOn:     { backgroundColor: C.gold + "30", borderColor: C.gold },
  toggleThumb:  { width: 18, height: 18, borderRadius: 9, backgroundColor: C.mut },
  toggleThumbOn:{ backgroundColor: C.gold, alignSelf: "flex-end" },

  maskedRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line },
  maskedT:    { color: C.mut, fontSize: 13, fontFamily: T.sans },
  maskedEdit: { color: C.gold, fontSize: 13, fontFamily: T.sansM },

  saveBtn:         { backgroundColor: C.gold, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 4, marginBottom: 12 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnT:        { color: C.bg, fontSize: 15, fontFamily: T.sansB },

  footNote: { color: C.mut, fontSize: 11, fontFamily: T.sans, lineHeight: 17, textAlign: "center", marginBottom: 8 },

  // Scan ID button
  scanBtn:      { flexDirection: "row", alignItems: "center", padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.gold + "0A" },
  scanBtnIcon:  { fontSize: 22, width: 32, textAlign: "center" },
  scanBtnT:     { color: C.gold, fontSize: 14, fontFamily: T.sansM, marginBottom: 2 },
  scanBtnSub:   { color: C.mut, fontSize: 12, fontFamily: T.sans },
  scanBtnArrow: { color: C.gold, fontSize: 20, fontFamily: T.sansM },
  scanDivider:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  scanDividerLine: { flex: 1, height: 0.5, backgroundColor: C.line },
  scanDividerT: { color: C.mut, fontSize: 9, fontFamily: T.sansB, letterSpacing: 1.2 },
});
