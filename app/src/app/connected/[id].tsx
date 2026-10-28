import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Avatar, Btn, Card, Notice, Screen, T } from "@/components/ui";
import { personById, useApp } from "@/store/AppStore";

export default function Connected() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const p = personById(state, id);
  if (!p) return <Screen title="Connected"><T muted>Nothing here.</T></Screen>;
  // Live: the details the server unlocked when both phones checked out. Demo: made-up ones.
  const c = state.contacts?.[id];
  const rows: [string, string][] = c
    ? [["Name", c.full_name || p.name], ["Mobile", c.mobile ?? "Not shared"], ["Instagram", c.instagram ? `@${c.instagram.replace(/^@/, "")}` : "Not shared"]]
    : [["Name", `${p.name} ${p.lastName}`], ["Mobile", "0491 570 156"], ["Instagram", `@${p.name.toLowerCase()}.${p.lastName.toLowerCase()}.example`]];
  return (
    <Screen title="Connected" back={false} footer={<Btn label="Back to home" onPress={() => router.replace("/home")} />}>
      <View style={{ alignItems: "center", gap: 12 }}>
        <Avatar name={p.name} uri={p.photo} hue={p.hue} size={72} />
        <T variant="big">You've met {p.name}.</T>
      </View>
      <Card>
        <T variant="eyebrow">Now unlocked</T>
        {rows.map(([k, v]) => <View key={k} style={{ flexDirection: "row", gap: 14 }}><T muted style={{ width: 84 }}>{k}</T><T variant="bold" style={{ flex: 1 }}>{v}</T></View>)}
        {!c && <T variant="small">Example details. The 0491 570 number is from the range reserved for fiction.</T>}
      </Card>
      <Notice kind="ok">That's it from us. Put the phone away and enjoy it.</Notice>
      {actions.isMinor() && state.guardian.notifyConnect && <T variant="small">{state.guardian.name} has been told you met {p.name}.</T>}
    </Screen>
  );
}
