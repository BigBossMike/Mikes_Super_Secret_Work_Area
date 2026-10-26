import { router } from "expo-router";
import { Avatar, Btn, Card, Logo, Pill, Row, Screen, T } from "@/components/ui";
import { MONTH_NAME, personById, useApp } from "@/store/AppStore";
import { useTheme } from "@/theme";

export default function Home() {
  const t = useTheme();
  const { state, actions } = useApp();
  const o = state.objective;

  const start = () => router.push(actions.canStart() ? "/objective" : "/plans?limit=1");
  const left = actions.objectivesLeft();
  const count = (k: string) => state.matches.filter(m => (state.chats[m.id]?.connected ? "agreed" : m.status) === k).length;

  return (
    <Screen inTabs back={false} title={<Logo />} right={<Pill kind={state.plan === "free" ? "wait" : "yes"} label={state.plan === "unlimited" ? "Unlimited" : "Free plan"} />}>
      <T variant="big" style={{ fontSize: 22 }}>Hi {state.user.name}.</T>
      {!o ? (
        <Card variant="hero">
          <T variant="eyebrow" color={t.go}>{MONTH_NAME} objective</T>
          <T variant="big" color={t.heroFg}>What would you like to do this month?</T>
          <T variant="small" color={t.heroMuted}>Tell us the plan. We'll find up to 5 people nearby who are keen to join in.</T>
          <T variant="small" color={t.heroMuted}>{actions.canStart() ? (left === Infinity ? "Unlimited objectives." : `You have ${left} objective${left > 1 ? "s" : ""} left.`) : "You've used this month's objective."}</T>
          <Btn variant="go" label="Set my objective" onPress={start} />
        </Card>
      ) : o.done ? (
        <Card variant="hero">
          <T variant="eyebrow" color={t.go}>{MONTH_NAME} objective · done</T>
          <T variant="big" color={t.heroFg}>{o.text}</T>
          <T variant="small" color={t.heroMuted}>You met {personById(state, state.lastConnected ?? "")?.name ?? "someone"} and swapped details. Nice work.</T>
          <Btn variant="go" label="Set another objective" onPress={start} />
        </Card>
      ) : (
        <Card variant="hero">
          <T variant="eyebrow" color={t.go}>{MONTH_NAME} objective</T>
          <T variant="big" color={t.heroFg}>{o.text}</T>
          <T variant="small" color={t.heroMuted}>{[o.when, o.where].filter(Boolean).join(" · ")}</T>
          <Row>{state.matches.map(m => {
            const p = personById(state, m.id)!;
            const shown = m.status === "agreed" || state.chats[m.id]?.connected;
            return shown ? <Avatar key={m.id} name={p.name} hue={p.hue} size={34} /> : <Avatar key={m.id} anon size={34} />;
          })}</Row>
          <T variant="small" color={t.heroFg}>{count("agreed")} agreed · {count("asking")} deciding · {count("passed")} passed</T>
          <Btn variant="go" label="See matches" onPress={() => router.push("/matches")} />
        </Card>
      )}
      <Card variant="sunk">
        <T variant="h3">Meeting someone new</T>
        <T variant="small">Meet somewhere public the first time, and tell a friend or parent where you're going. It's fine to bring a friend along. You can report or block anyone from the chat.</T>
      </Card>
    </Screen>
  );
}
