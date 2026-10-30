import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { LIVE } from "@/backend/client";
import { Btn, Card, Notice, Screen, T } from "@/components/ui";
import { isMinor } from "@/lib/age";
import { useApp } from "@/store/AppStore";

// The ID check, after the profile is saved (the database needs the profile first).
// Stripe: photo ID and a live selfie in Stripe's sheet. Pilot (no Stripe keys yet): the typed date of birth.
export default function IdCheck() {
  const { state, actions } = useApp();
  const [mode, setMode] = useState<"stripe" | "pilot" | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "info" | "ok" | "warn"; text: string } | null>(null);
  const u = state.user;
  useFocusEffect(useCallback(() => { actions.idCheckMode().then(setMode); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    const needsParent = LIVE && u.age !== null && isMinor(u.age) && state.guardian.status !== "approved";
    router.replace(needsParent ? "/guardian" : "/home");
  };

  const check = async () => {
    setBusy(true); setNote(null);
    const r: { status: string; reason?: string } = mode === "stripe" ? await actions.runIdCheck() : { status: (await actions.pilotVerify()) ? "verified" : "failed" };
    setBusy(false);
    const messages: Record<string, { kind: "info" | "ok" | "warn"; text: string }> = {
      verified: { kind: "ok", text: "You're verified." },
      processing: { kind: "info", text: "Stripe is still checking. This usually takes under a minute; we'll let you know." },
      requires_input: { kind: "warn", text: r.reason ?? "The check didn't go through. Try again with good light and the whole ID in view." },
      canceled: { kind: "info", text: "Check stopped. Start again when you're ready." },
      duplicate: { kind: "warn", text: "That ID has already verified another Intro account. One account per person." },
      too_young: { kind: "warn", text: "Intro is for people aged 16 and over." },
      unavailable: { kind: "warn", text: "This version of the app can't run the ID check. Update Intro and try again." },
      failed: { kind: "warn", text: r.reason ?? "The check didn't go through. Try again." },
    };
    setNote(messages[r.status] ?? messages.failed);
    if (r.status === "verified") setTimeout(next, 900);
  };

  return (
    <Screen title="Check your ID" back={false} footer={u.verified
      ? <Btn label="Continue" onPress={next} />
      : <Btn variant="go" label={busy ? "Checking…" : mode === "pilot" ? "Confirm my age" : "Check my ID"} disabled={busy || mode === null} onPress={check} />}>
      <T muted>Everyone on Intro is ID-checked, so the people you meet are who they say they are.</T>
      <Card variant="sunk">
        <T variant="h3">{mode === "pilot" ? "During the pilot" : "Photo ID and a selfie"}</T>
        {mode === "pilot"
          ? <T variant="small">Intro uses the date of birth you entered. The photo ID check starts before the public launch.</T>
          : <View style={{ gap: 4 }}>
              <T variant="small">• A driver or learner licence, passport or photo ID card</T>
              <T variant="small">• A quick selfie to match it</T>
              <T variant="small">• Takes about a minute, done by Stripe</T>
            </View>}
        <T variant="small">Intro keeps only that you're verified and your date of birth. Stripe deletes the photos once you're verified.</T>
      </Card>
      {note && <Notice kind={note.kind}>{note.text}</Notice>}
    </Screen>
  );
}
