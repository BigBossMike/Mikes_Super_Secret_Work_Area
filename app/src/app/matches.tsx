import { router } from "expo-router";
import { View } from "react-native";
import { Avatar, Btn, Card, Pill, Row, Screen, T, Tag } from "@/components/ui";
import { personById, useApp } from "@/store/AppStore";
import { fonts, useTheme } from "@/theme";

export default function Matches() {
  const t = useTheme();
  const { state, actions } = useApp();
  if (!state.objective) return <Screen title="Your matches" back="/home"><T muted>No objective yet.</T></Screen>;

  return (
    <Screen title="Your matches" back="/home">
      <Card variant="sunk"><T variant="eyebrow">Objective</T><T variant="label">{state.objective.text}</T></Card>
      <T variant="small">We've asked {state.matches.length} people if they're happy to be put forward. You only see who they are once they say yes.</T>
      {state.matches.map(m => {
        const p = personById(state, m.id)!;
        const met = state.chats[m.id]?.connected;
        if (m.status !== "agreed" && !met) {
          const passed = m.status === "passed";
          return (
            <Card key={m.id}><Row gap={12} style={{ alignItems: "flex-start" }}>
              <Avatar anon />
              <View style={{ flex: 1, gap: 6 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <T variant="bold">{passed ? "Not this time" : "Someone nearby"}</T>
                  {passed ? <Pill kind="no" label="Passed" /> : <Pill kind="wait" label="Asking" />}
                </Row>
                <T variant="small">{passed ? "They passed. You won't find out who it was." : "You'll see who they are if they say yes."}</T>
              </View>
            </Row></Card>
          );
        }
        return (
          <Card key={m.id}><Row gap={12} style={{ alignItems: "flex-start" }}>
            <Avatar name={p.name} uri={p.photo} hue={p.hue} />
            <View style={{ flex: 1, gap: 6 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <T variant="bold">{p.name}, {p.age}</T>
                {met ? <Pill kind="done" icon="checkmark" label="Met" /> : <Pill kind="yes" label="Agreed" />}
              </Row>
              <Row wrap>
                <T style={{ fontFamily: fonts.display, fontSize: 13 }} color={t.goDeep}>{m.score}% match</T>
                {m.why.map(w => <Tag key={w} label={w} />)}
              </Row>
              <Btn small variant={met ? "ghost" : "primary"} label={met ? "View" : "Message"} onPress={() => { actions.openChat(m.id); router.push(`/chat/${m.id}`); }} />
            </View>
          </Row></Card>
        );
      })}
    </Screen>
  );
}
