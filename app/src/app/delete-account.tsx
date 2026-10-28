import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { LIVE } from "@/backend/client";
import { Btn, Card, Notice, Screen, T } from "@/components/ui";
import { useApp } from "@/store/AppStore";

// Delete my account. Apple requires it in the app; the privacy policy (section 14) says what goes and what stays.
export default function DeleteAccount() {
  const { state, actions } = useApp();
  const [busy, setBusy] = useState(false);
  const del = async () => {
    setBusy(true);
    const ok = await actions.deleteAccount();
    setBusy(false);
    if (ok) router.replace("/");
  };
  return (
    <Screen title="Delete my account" footer={<>
      <Btn label={busy ? "Deleting…" : "Delete my account"} disabled={busy} onPress={del} />
      <Btn variant="ghost" label="Keep my account" disabled={busy} onPress={() => router.back()} />
    </>}>
      <T>This can't be undone.</T>
      <Card>
        <T variant="h3">What's deleted</T>
        <View style={{ gap: 4 }}>
          {["Your profile and photo", "Your plans, matches and chats", "Your contact details and contact fingerprints", "Your sign-in and notifications",
            ...(state.parent?.teens.length ? ["Your link as a parent"] : [])].map(x => <T key={x} variant="small">• {x}</T>)}
        </View>
        <T variant="h3">What stays</T>
        <T variant="small">• People you've met keep the details you shared with them.</T>
        <T variant="small">• Safety reports involving you are kept for the safety team, without your profile.</T>
      </Card>
      {state.billing.subscribed && <Notice kind="warn">Deleting your account doesn't cancel your subscription. Cancel it in your App Store or Google Play settings.</Notice>}
      {!LIVE && <Notice>Demo: this starts the demo again.</Notice>}
    </Screen>
  );
}
