import { View } from "react-native";
import { Avatar, Btn, Card, Notice, Pill, Row, Screen, T, ToggleRow } from "@/components/ui";
import { GROUPS } from "@/lib/data";
import { personById, useApp } from "@/store/AppStore";
import { useTheme } from "@/theme";

// Teen side: a preview of what their parent sees on the parent screen (the real one is parent-home.tsx). Never includes chats.
export default function ParentApp() {
  const t = useTheme();
  const { state, actions } = useApp();
  const u = state.user, g = state.guardian, o = state.objective;

  const items: [string, string][] = [];
  if (o) items.push([o.done ? "Finished a plan" : "Set a plan", `${o.text} · ${GROUPS[o.group]}`]);
  state.matches.filter(m => m.status === "agreed").forEach(m => { const p = personById(state, m.id)!; items.push([`Matched with ${p.name}, ${p.age}`, `${p.suburb} · ID verified`]); });
  Object.keys(state.chats).filter(id => state.chats[id].connected).forEach(id => items.push([`Met ${personById(state, id)?.name} in person`, o?.where || "Place shared"]));
  state.requests.filter(r => r.status === "accepted").forEach(r => items.push([`Said yes to ${r.name}'s plan`, r.text]));

  return (
    <Screen title="What your parent sees" right={<Pill kind="wait" label={g.name} />}>
      <Row gap={12}>
        <Avatar name={u.name} hue={210} />
        <View style={{ flex: 1 }}><T variant="bold">{u.name}, {u.age ?? 17}</T><T variant="small">ID verified · {u.suburb}{u.paused ? " · Paused" : ""}</T></View>
      </Row>
      <Card>
        <T variant="h3">Controls</T>
        <ToggleRow title="Approve plans first" sub="Check each plan before Intro asks anyone." value={g.approveObjectives} onChange={v => actions.setGuardianSetting("approveObjectives", v)} />
        <ToggleRow title={`Tell me when ${u.name} meets someone`} sub="Who, when and roughly where." value={g.notifyConnect} onChange={v => actions.setGuardianSetting("notifyConnect", v)} />
        <ToggleRow title="Meet-up check-in" sub={`${u.name} shares the place and time before meeting.`} value={g.meetCheckin} onChange={v => actions.setGuardianSetting("meetCheckin", v)} />
      </Card>
      <Card>
        <T variant="h3">Recent activity</T>
        {items.length ? items.map(([a, b], i) => (
          <View key={i} style={{ borderLeftWidth: 2, borderLeftColor: t.go, paddingLeft: 12, gap: 2 }}><T variant="bold">{a}</T><T variant="small">{b}</T></View>
        )) : <T variant="small">Nothing yet.</T>}
      </Card>
      <Notice>You can't read {u.name}'s chats. If anyone reports a problem involving {u.name}, you're told straight away.</Notice>
      <Btn variant="ghost" label={`${u.paused ? "Turn back on" : "Pause"} ${u.name}'s account`} onPress={() => actions.setPaused(!u.paused)} />
    </Screen>
  );
}
