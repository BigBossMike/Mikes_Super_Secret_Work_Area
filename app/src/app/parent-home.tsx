// Parent mode (live app). A parent signs in with the email their teen
// entered, approves the invite, then sees this screen: plans waiting for their
// OK, the controls, meet-ups and activity. Never chats.
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { LIVE } from "@/backend/client";
import { Avatar, Btn, Card, Notice, Pill, Row, Screen, T, ToggleRow } from "@/components/ui";
import { GROUPS } from "@/lib/data";
import { type ParentTeen, useApp } from "@/store/AppStore";
import { useTheme } from "@/theme";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
const when = (iso: string) => new Date(iso).toLocaleString("en-AU", { weekday: "long", hour: "numeric", minute: "2-digit" });
const asTheir = (rel: string) => (rel === "Mum" ? "mum" : rel === "Dad" ? "dad" : "parent or guardian");

export default function ParentHome() {
  const { state, actions } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  // Fresh on every visit: plans waiting, activity and meet-ups change while the screen is closed.
  useFocusEffect(useCallback(() => { if (LIVE) actions.refreshParent(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (LIVE && state.session === "out") router.replace("/"); }, [state.session]);

  if (!LIVE) {
    return <Screen title="Parent"><Notice>Parent mode runs in the live app. In the demo, Me, then "See what Chris sees", shows the parent view.</Notice></Screen>;
  }

  const p = state.parent ?? { invites: [], teens: [] };
  const own = state.hasProfile;
  const run = async (key: string, fn: () => Promise<unknown>) => { setBusy(key); try { await fn(); } finally { setBusy(null); } };

  return (
    <Screen title="Parent" back={own ? "/me" : false} footer={own ? undefined : <>
      <Btn small variant="ghost" label="Use Intro for myself" onPress={() => router.push("/verify")} />
      <Btn small variant="ghost" label="Sign out" onPress={() => { actions.reset(); router.replace("/"); }} />
    </>}>
      {p.invites.map(i => (
        <Card key={i.id}>
          <T variant="big">{i.teenName}, {i.teenAge} wants to join Intro</T>
          <T>{i.teenName} asked you, as their {asTheir(i.rel)}, to approve their account.</T>
          <T variant="small">You'll see the plans {i.teenName} sets (you can approve each one first), who they meet and where, and any safety reports. You won't see their chats.</T>
          <Row gap={8}>
            <Btn small label="Approve" disabled={busy !== null} onPress={() => run(i.id, () => actions.acceptInvite(i.id))} />
            <Btn small variant="ghost" label="This isn't me" disabled={busy !== null} onPress={() => run(i.id, () => actions.declineInvite(i.id))} />
          </Row>
        </Card>
      ))}

      {p.teens.map(t => <Teen key={t.linkId} teen={t} busy={busy} run={run} />)}

      {!p.invites.length && !p.teens.length && (
        <Notice>Nothing is linked to this email yet. When your teen adds you as their parent in Intro, their request shows here.</Notice>
      )}
    </Screen>
  );
}

function Teen({ teen: t, busy, run }: { teen: ParentTeen; busy: string | null; run: (key: string, fn: () => Promise<unknown>) => Promise<void> }) {
  const th = useTheme();
  const { actions } = useApp();
  return (
    <View style={{ gap: 12 }}>
      <Row gap={12}>
        <Avatar name={t.name} uri={t.photo} hue={210} size={56} />
        <View style={{ flex: 1, gap: 6 }}>
          <T variant="big">{t.name}{t.age !== null ? `, ${t.age}` : ""}</T>
          <Row wrap>
            {t.verified ? <Pill kind="yes" icon="checkmark" label="ID verified" /> : <Pill kind="no" label="Not verified" />}
            {t.paused && <Pill kind="wait" label="Paused" />}
          </Row>
        </View>
      </Row>

      {t.pending.length > 0 && (
        <Card>
          <T variant="h3">Waiting for your OK</T>
          {t.pending.map(o => (
            <View key={o.id} style={{ gap: 6 }}>
              <T variant="bold">{o.text}</T>
              <T variant="small">{[GROUPS[o.group], o.when, o.where].filter(Boolean).join(" · ")}</T>
              <Row gap={8}>
                <Btn small label="Approve" disabled={busy !== null} onPress={() => run(o.id, () => actions.decideTeenPlan(o.id, true))} />
                <Btn small variant="ghost" label="Turn down" disabled={busy !== null} onPress={() => run(o.id, () => actions.decideTeenPlan(o.id, false))} />
              </Row>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <T variant="h3">Controls</T>
        <ToggleRow title="Approve plans first" sub="Check each plan before Intro asks anyone." value={t.approveObjectives} onChange={v => actions.setTeenSetting(t.linkId, "approveObjectives", v)} />
        <ToggleRow title={`Tell me when ${t.name} meets someone`} sub="Who, when and roughly where." value={t.notifyConnect} onChange={v => actions.setTeenSetting(t.linkId, "notifyConnect", v)} />
        <ToggleRow title="Meet-up check-in" sub={`${t.name} shares the place and time before meeting.`} value={t.meetCheckin} onChange={v => actions.setTeenSetting(t.linkId, "meetCheckin", v)} />
      </Card>

      {t.meetups.length > 0 && (
        <Card>
          <T variant="h3">Meet-ups</T>
          {t.meetups.map((m, i) => (
            <View key={i} style={{ borderLeftWidth: 2, borderLeftColor: th.go, paddingLeft: 12, gap: 2 }}>
              <T variant="bold">Meeting {m.with}</T>
              <T variant="small">{[m.place, m.at ? when(m.at) : null].filter(Boolean).join(", ")}</T>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <T variant="h3">Recent activity</T>
        {t.activity.length ? t.activity.map((a, i) => (
          <View key={i} style={{ borderLeftWidth: 2, borderLeftColor: th.go, paddingLeft: 12, gap: 2 }}>
            <T variant="bold">{a.title}</T>
            <T variant="small">{a.detail}{a.at ? ` · ${day(a.at)}` : ""}</T>
          </View>
        )) : <T variant="small">Nothing yet.</T>}
      </Card>

      <Notice>You can't read {t.name}'s chats. If anyone reports a problem involving {t.name}, you're told straight away.</Notice>
      <Btn variant="ghost" label={`${t.paused ? "Turn back on" : "Pause"} ${t.name}'s account`} onPress={() => actions.setTeenPaused(t.id, !t.paused)} />
    </View>
  );
}
