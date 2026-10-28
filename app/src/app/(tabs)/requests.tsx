import { router } from "expo-router";
import { View } from "react-native";
import { Avatar, Btn, Card, Notice, Pill, Row, Screen, T, Tag } from "@/components/ui";
import { useApp, visibleRequests } from "@/store/AppStore";
import { fonts } from "@/theme";

export default function Requests() {
  const { state, actions } = useApp();
  return (
    <Screen inTabs back={false} title="Requests">
      <T variant="small">Intro thinks you'd be a good fit for these plans. They only see you if you say yes, and they're never told if you say no.</T>
      {state.user.paused ? <Notice>You've paused being put forward. Turn it back on from Me.</Notice> : visibleRequests(state).map(r => (
        <Card key={r.id}>
          <Row gap={12} style={{ alignItems: "flex-start" }}>
            <Avatar name={r.name} uri={r.photo} hue={r.hue} />
            <View style={{ flex: 1, gap: 6 }}>
              <T variant="bold">{r.name}, {r.age}</T>
              <T variant="small">is looking for</T>
              <T variant="label">{r.text}</T>
              <Row wrap>{r.why.map(w => <Tag key={w} label={w} />)}</Row>
              <T variant="small"><T variant="small" style={{ fontFamily: fonts.bodyBold }}>Who'll be there: </T>{r.name}{r.group ? ` + ${r.group} other${r.group > 1 ? "s" : ""}` : " only"}</T>
              {r.status === "pending" && <Row wrap>
                <Btn small variant="go" label="Yes, put me forward" onPress={() => actions.answerRequest(r.id, true)} />
                <Btn small variant="ghost" label="Not this time" onPress={() => actions.answerRequest(r.id, false)} />
              </Row>}
              {r.status === "accepted" && <Row wrap><Pill kind="yes" label="You said yes" />
                <Btn small label="Message" onPress={() => { actions.openChat(r.id); router.push(`/chat/${r.id}`); }} /></Row>}
              {r.status === "declined" && <Pill kind="wait" label={`You passed. ${r.name} won't be told.`} />}
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
