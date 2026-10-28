import { router, useLocalSearchParams } from "expo-router";
import { type ComponentRef, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Btn, Notice, Row, Screen, T } from "@/components/ui";
import { personById, useApp } from "@/store/AppStore";
import { fonts, useTheme } from "@/theme";

export default function ChatScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const [text, setText] = useState("");
  const [confirmBlock, setConfirmBlock] = useState(false);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const p = personById(state, id);
  const c = state.chats[id];
  if (!p || !c) return <Screen title="Chat"><T muted>This chat isn't available.</T></Screen>;

  // Meet-up check-in: a 16 or 17 year old whose parent asked to know where and when.
  const checkin = !c.connected && actions.isMinor() && state.guardian.meetCheckin;

  const send = () => {
    const msg = text.trim();
    if (!msg) return;
    if (actions.sendMessage(id, msg) === "sent") setText("");
  };

  return (
    <Screen scroll={false}
      title={<Row gap={10}><Avatar name={p.name} uri={p.photo} hue={p.hue} size={34} /><View><T variant="title">{p.name}</T>
        <Row gap={4}><Ionicons name={c.connected ? "checkmark" : "lock-closed"} size={11} color={t.muted} /><T variant="small">{c.connected ? "Connected" : "Details locked"}</T></Row></View></Row>}
      right={<Row gap={6}><Btn small variant="ghost" label="Report" onPress={() => actions.report(id)} /><Btn small variant="ghost" label="Block" onPress={() => setConfirmBlock(true)} /></Row>}
      footer={confirmBlock ? <>
        <Notice kind="warn">Block {p.name}? You won't be paired or able to chat again. They aren't told.</Notice>
        <Row gap={8}>
          <Btn label="Block" onPress={() => { actions.block(id); router.replace("/home"); }} />
          <Btn variant="ghost" label="Cancel" onPress={() => setConfirmBlock(false)} />
        </Row>
      </> : <>
        {checkin && <Btn small variant="ghost" label="Share where and when you're meeting" onPress={() => router.push(`/meetup/${id}`)} />}
        {c.connected
          ? <Btn variant="ghost" label={`See ${p.name}'s details`} onPress={() => router.push(`/connected/${id}`)} />
          : <Btn variant="go" label="Met up? Connect in person" onPress={() => router.push(`/connect/${id}`)} />}
        <Row>
          <TextInput value={text} onChangeText={setText} onSubmitEditing={send} placeholder="Plan where to meet…" placeholderTextColor={t.muted}
            accessibilityLabel="Message" returnKeyType="send"
            style={[s.input, { borderColor: t.line, backgroundColor: t.sunk, color: t.ink }]} />
          <Pressable onPress={send} accessibilityRole="button" style={[s.send, { backgroundColor: t.ink }]}>
            <Text style={{ color: t.surface, fontFamily: fonts.bodyBold }}>Send</Text>
          </Pressable>
        </Row>
      </>}>
      <ScrollView ref={scroller} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
        {c.msgs.map((m, i) => m.from === "sys"
          ? <T key={i} variant="small" style={{ textAlign: "center", paddingHorizontal: 12 }}>{m.text}</T>
          : <View key={i} style={[s.msg,
              m.from === "them" && { backgroundColor: t.sunk, alignSelf: "flex-start", borderBottomLeftRadius: 6 },
              m.from === "me" && { backgroundColor: t.ink, alignSelf: "flex-end", borderBottomRightRadius: 6 },
              m.from === "blocked" && { backgroundColor: t.warnSoft, alignSelf: "stretch", maxWidth: "100%", borderRadius: 12 }]}>
              <Text style={{ fontFamily: m.from === "blocked" ? fonts.bodySemi : fonts.body, fontSize: m.from === "blocked" ? 13 : 15,
                color: m.from === "me" ? t.surface : m.from === "blocked" ? t.warn : t.ink }}>{m.text}</Text>
            </View>)}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  msg: { maxWidth: "80%", paddingVertical: 9, paddingHorizontal: 13, borderRadius: 18 },
  input: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 16, fontFamily: fonts.body, fontSize: 15 },
  send: { borderRadius: 999, paddingHorizontal: 18, alignSelf: "stretch", justifyContent: "center" },
});
