import { router } from "expo-router";
import { View } from "react-native";
import { Avatar, Btn, Card, Pill, Row, Screen, T, Tag, ToggleRow } from "@/components/ui";
import { ageBand, bandLabel } from "@/lib/age";
import { LIVE } from "@/backend/client";
import { useApp } from "@/store/AppStore";

export default function Me() {
  const { state, actions } = useApp();
  const u = state.user, g = state.guardian;
  const settings: [keyof typeof g, string][] = [["approveObjectives", "Approve each plan first"], ["notifyConnect", "Get a message when you meet someone"], ["meetCheckin", "Ask where and when you're meeting"]];
  return (
    <Screen inTabs back={false} title="Me">
      <Row gap={12}>
        <Avatar name={u.name} hue={210} size={72} />
        <View style={{ flex: 1, gap: 6 }}>
          <T variant="big">{u.name}</T>
          <Row wrap>
            {u.verified ? <Pill kind="yes" icon="checkmark" label="ID verified" /> : <Pill kind="no" label="Not verified" />}
            <Tag label={u.age !== null ? bandLabel(ageBand(u.age)) : "Age not checked"} />
            <Tag label={u.suburb} />
          </Row>
        </View>
      </Row>
      <Card>
        <T variant="h3">Into</T>
        <Row wrap>{u.interests.map(i => <Tag key={i} label={i} />)}</Row>
        <Btn small variant="ghost" label="Edit my answers" onPress={() => router.push("/profile")} />
      </Card>
      <Card><ToggleRow title="Can be put forward" sub="Turn off to stop appearing in other people's matches." value={!u.paused} onChange={v => actions.setPaused(!v)} /></Card>
      <Card>
        <T variant="h3">Privacy</T>
        <T variant="small">Nobody can browse or search Intro. You're only ever shown to someone you've been paired with and said yes to.</T>
        <ToggleRow title="Hide me from my contacts" sub="People in your phone contacts are never paired with you, and never see you. Checked privately. Your contacts aren't stored." value={u.hideContacts} onChange={v => actions.setPrivacy("hideContacts", v)} />
        {actions.isMinor()
          ? <ToggleRow title="Keep my school out" sub={`Never pair me with people from ${u.school || "my school"}.`} value={u.keepSchoolOut} onChange={v => actions.setPrivacy("keepSchoolOut", v)} />
          : <ToggleRow title="Keep my workplace out" sub={`Never pair me with people from ${u.workplace || "where I work"}.`} value={u.keepWorkplaceOut} onChange={v => actions.setPrivacy("keepWorkplaceOut", v)} />}
        <ToggleRow title="Discreet notifications" sub={'Notifications just say "Intro: you have an update".'} value={u.discreet} onChange={v => actions.setPrivacy("discreet", v)} />
      </Card>
      {actions.isMinor() && (
        <Card>
          <T variant="h3">Parent controls</T>
          <T variant="small">Linked to {g.name} ({g.rel}). Their settings:</T>
          {settings.map(([k, l]) => <T key={k} variant="small" muted={!g[k]}>• {l}{g[k] ? "" : " (off)"}</T>)}
          <T variant="small">Your chats stay private. {g.name} can't read them.</T>
          <Btn small variant="ghost" label={`See what ${g.name} sees`} onPress={() => router.push("/parent")} />
        </Card>
      )}
      <Card>
        <T variant="h3">Plan</T>
        <T variant="small">{state.plan === "unlimited" ? "Unlimited objectives, $10 a month." : `Free: 1 objective a month${state.credits ? ` plus ${state.credits} extra` : ""}.`}</T>
        <Btn small variant="ghost" label="Change plan" onPress={() => router.push("/plans")} />
      </Card>
      <Btn small variant="ghost" label={LIVE ? "Sign out" : "Restart demo"} onPress={() => { actions.reset(); router.replace("/"); }} />
    </Screen>
  );
}
