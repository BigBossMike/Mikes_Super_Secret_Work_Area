import { router } from "expo-router";
import { useState } from "react";
import { LIVE } from "@/backend/client";
import { Btn, Card, Chips, Field, Notice, Screen, T } from "@/components/ui";
import { useApp, type Guardian } from "@/store/AppStore";

export default function GuardianSignOff() {
  const { state, actions } = useApp();
  const g = state.guardian;
  const [name, setName] = useState(g.name);
  const [rel, setRel] = useState<Guardian["rel"]>(g.rel);
  const [email, setEmail] = useState(g.email);

  return (
    <Screen title="Parent or guardian" footer={<Btn label="Continue" disabled={g.status !== "approved"} onPress={() => router.replace(LIVE ? "/home" : "/profile")} />}>
      <T muted>You're under 18, so a parent or guardian needs to OK your account. They download Intro and sign in with their own email.</T>
      <Field label="Their first name" value={name} onChangeText={setName} maxLength={20} />
      <T variant="label">They're your</T>
      <Chips options={["Mum", "Dad", "Guardian"]} selected={[rel]} onToggle={v => setRel(v as Guardian["rel"])} />
      <Field label="Their email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <Btn small variant="ghost" label={LIVE ? "Send request" : "Send request (demo)"} disabled={!name.trim() || !email.trim() || g.status === "sent"}
        onPress={() => actions.sendGuardianRequest({ name: name.trim(), rel, email: email.trim() })} />
      {g.status === "sent" && <Notice>{LIVE ? `Waiting for ${g.name}. Ask them to download Intro, sign in with ${g.email} and approve you.` : `Waiting for ${g.name} to approve…`}</Notice>}
      {g.status === "approved" && <Notice kind="ok">{g.name} approved your account.</Notice>}
      <Card variant="sunk">
        <T variant="h3">What they can see</T>
        <T variant="small">The plans you set (they can approve them first), who you meet up with and where, and any safety reports.</T>
        <T variant="h3">What they can't see</T>
        <T variant="small">Your chats.</T>
      </Card>
    </Screen>
  );
}
