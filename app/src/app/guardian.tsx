import { router } from "expo-router";
import { useState } from "react";
import { Btn, Card, Chips, Field, Notice, Screen, T } from "@/components/ui";
import { useApp, type Guardian } from "@/store/AppStore";

export default function GuardianSignOff() {
  const { state, actions } = useApp();
  const g = state.guardian;
  const [name, setName] = useState(g.name);
  const [rel, setRel] = useState<Guardian["rel"]>(g.rel);
  const [phone, setPhone] = useState(g.phone);

  return (
    <Screen title="Parent or guardian" footer={<Btn label="Continue" disabled={g.status !== "approved"} onPress={() => router.push("/profile")} />}>
      <T muted>You're under 18, so a parent or guardian needs to OK your account. They get the free Intro parent app.</T>
      <Field label="Their first name" value={name} onChangeText={setName} maxLength={20} />
      <T variant="label">They're your</T>
      <Chips options={["Mum", "Dad", "Guardian"]} selected={[rel]} onToggle={v => setRel(v as Guardian["rel"])} />
      <Field label="Their mobile" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Btn small variant="ghost" label="Send request (demo)" disabled={!name.trim() || g.status === "sent"}
        onPress={() => actions.sendGuardianRequest({ name: name.trim(), rel, phone: phone.trim() })} />
      {g.status === "sent" && <Notice>Waiting for {g.name} to approve…</Notice>}
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
