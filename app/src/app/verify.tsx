import { router } from "expo-router";
import { useState } from "react";
import { LIVE } from "@/backend/client";
import { Btn, Card, Field, Notice, Screen, T } from "@/components/ui";
import { ageBand, bandLabel, isMinor } from "@/lib/age";
import { useApp } from "@/store/AppStore";

export default function Verify() {
  const { state, actions } = useApp();
  const [dob, setDob] = useState(state.user.dob);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const u = state.user;

  const scan = async () => {
    setError(""); setBusy(true);
    const r = await actions.verify(dob);
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  // Live: the profile comes first (the database needs it), then the parent sign-off for under-18s.
  const ready = LIVE ? u.age !== null : u.verified;
  const next = () => router.push(!LIVE && u.age !== null && isMinor(u.age) ? "/guardian" : "/profile");

  return (
    <Screen title="Check your age" footer={<Btn label="Continue" disabled={!ready} onPress={next} />}>
      <T muted>Everyone on Intro is ID-checked, so the people you meet are who they say they are. You must be 16 or older.</T>
      <Field label="Date of birth" hint="YYYY-MM-DD" value={dob} onChangeText={setDob} keyboardType="numbers-and-punctuation" autoCorrect={false} />
      <Card variant="sunk">
        <T variant="h3">Photo ID</T>
        <T variant="small">Driver or learner licence, passport, or a Queensland Proof of Age card, plus a quick selfie to match it.</T>
        {LIVE ? <T variant="small">You'll do the photo ID check after your profile.</T>
          : <Btn small variant="ghost" label="Scan my ID (demo)" onPress={scan} disabled={busy} />}
      </Card>
      {error ? <Notice kind="warn">{error}</Notice>
        : busy ? <Notice>Checking your ID and selfie…</Notice>
        : u.age !== null && (u.verified || LIVE) ? <Notice kind="ok">{LIVE ? "Age" : "Verified. Age"} {u.age}, so you'll be matched in the {bandLabel(ageBand(u.age))} group.</Notice> : null}
      <T variant="small">{LIVE
        ? "Your ID check confirms this date. Intro keeps only that you're verified and your date of birth, never the ID photo."
        : "In the real app a verification provider checks the ID. Intro stores only that you're verified and your age, never the ID photo."}</T>
    </Screen>
  );
}
