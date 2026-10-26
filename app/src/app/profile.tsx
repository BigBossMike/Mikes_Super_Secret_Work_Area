import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { LIVE } from "@/backend/client";
import { AgeRange } from "@/components/AgeRange";
import { Btn, Chips, Field, Screen, T, useToast } from "@/components/ui";
import { ageRangeLimits, effectiveAgeRange, isMinor } from "@/lib/age";
import { INTERESTS, SUBURBS, TIMES } from "@/lib/data";
import { useApp } from "@/store/AppStore";

export default function Profile() {
  const { state, actions } = useApp();
  const toast = useToast();
  const u = state.user;
  const [name, setName] = useState(u.name);
  const [suburb, setSuburb] = useState(u.suburb);
  const [school, setSchool] = useState(u.school);
  const [background, setBackground] = useState(u.background);
  const [workplace, setWorkplace] = useState(u.workplace);
  const adult = u.age !== null && !isMinor(u.age);
  const [range, setRange] = useState(effectiveAgeRange(u.age ?? 17, u.ageMin ?? undefined, u.ageMax ?? undefined));

  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast("Add your first name.");
    if (u.interests.length < 2) return toast("Pick at least 2 things you're into.");
    setSaving(true);
    const ok = await actions.saveProfile({
      name: name.trim(), suburb, school: school.trim(), background: background.trim(), workplace: workplace.trim(),
      ...(adult ? { ageMin: range[0], ageMax: range[1] } : {}),
    });
    setSaving(false);
    if (!ok) return;
    // Live: under-18s do the parent sign-off after the profile exists.
    const needsParent = LIVE && u.age !== null && isMinor(u.age) && state.guardian.status !== "approved";
    router.replace(needsParent ? "/guardian" : "/home");
  };

  return (
    <Screen title="About you" footer={<Btn label={saving ? "Saving…" : "Save and continue"} disabled={saving} onPress={save} />}>
      <T muted>Your answers are how Intro finds good matches. Only your first name and photo are shown before you meet.</T>
      <Field label="First name" value={name} onChangeText={setName} maxLength={20} />
      <View style={{ gap: 8 }}><T variant="label">Suburb</T><Chips options={Object.keys(SUBURBS)} selected={[suburb]} onToggle={setSuburb} /></View>
      <View style={{ gap: 8 }}><T variant="label">Things you're into</T><Chips options={INTERESTS} selected={u.interests} onToggle={v => actions.toggleInList("interests", v)} /></View>
      <View style={{ gap: 8 }}><T variant="label">When you're usually free</T><Chips options={TIMES} selected={u.times} onToggle={v => actions.toggleInList("times", v)} /></View>
      {adult && (
        <View style={{ gap: 8 }}>
          <T variant="label">Pair me with people aged</T>
          <AgeRange min={range[0]} max={range[1]} limits={ageRangeLimits(u.age ?? 18)} onChange={(a, b) => setRange([a, b])} />
          <T variant="small">You're only ever paired with people inside this range, and only if you're inside theirs. It can be up to 20 years either side of your age, and never under 18.</T>
        </View>
      )}
      {adult
        ? <Field label="Workplace" hint="Optional. Keeps people from work out of your matches." value={workplace} onChangeText={setWorkplace} placeholder="Where you work" />
        : <Field label="School" hint="Optional. Lets you keep people from your school out of your matches." value={school} onChangeText={setSchool} placeholder="Your school" />}
      <Field label="Cultural background" hint="Optional and private." value={background} onChangeText={setBackground} placeholder="e.g. Samoan, Indian, Greek" />
    </Screen>
  );
}
