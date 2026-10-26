import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Btn, Chips, Field, Screen, T, useToast } from "@/components/ui";
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

  const save = () => {
    if (!name.trim()) return toast("Add your first name.");
    if (u.interests.length < 2) return toast("Pick at least 2 things you're into.");
    actions.saveProfile({ name: name.trim(), suburb, school: school.trim(), background: background.trim() });
    router.replace("/home");
  };

  return (
    <Screen title="About you" footer={<Btn label="Save and continue" onPress={save} />}>
      <T muted>Your answers are how Intro finds good matches. Only your first name and photo are shown before you meet.</T>
      <Field label="First name" value={name} onChangeText={setName} maxLength={20} />
      <View style={{ gap: 8 }}><T variant="label">Suburb</T><Chips options={Object.keys(SUBURBS)} selected={[suburb]} onToggle={setSuburb} /></View>
      <View style={{ gap: 8 }}><T variant="label">Things you're into</T><Chips options={INTERESTS} selected={u.interests} onToggle={v => actions.toggleInList("interests", v)} /></View>
      <View style={{ gap: 8 }}><T variant="label">When you're usually free</T><Chips options={TIMES} selected={u.times} onToggle={v => actions.toggleInList("times", v)} /></View>
      <Field label="School" hint="Optional. Lets you keep people from your school out of your matches." value={school} onChangeText={setSchool} placeholder="Your school" />
      <Field label="Cultural background" hint="Optional and private." value={background} onChangeText={setBackground} placeholder="e.g. Samoan, Indian, Greek" />
    </Screen>
  );
}
