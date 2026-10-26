import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Avatar, Btn, Pill, Screen, T, useToast } from "@/components/ui";
import { personById, useApp } from "@/store/AppStore";
import { fonts, useTheme } from "@/theme";

// Demo of the in-person handshake. The live app uses Bluetooth plus the
// connect-handshake server function (see docs/research.md, section 4).
export default function Connect() {
  const t = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const ring = useRef(new Animated.Value(0)).current;
  const p = personById(state, id);

  useEffect(() => {
    if (stage !== 1) return;
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    const a = setTimeout(() => setStage(2), 1600);
    return () => { loop.stop(); clearTimeout(a); };
  }, [stage, ring]);

  useEffect(() => {
    if (stage !== 2) return;
    const b = setTimeout(() => { actions.completeConnect(id); router.replace(`/connected/${id}`); }, 900);
    return () => clearTimeout(b);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <Screen title="Connect"><T muted>Nobody to connect with.</T></Screen>;
  const status = (who: "you" | "them") => {
    const ready = who === "you" ? stage >= 1 : stage >= 2;
    if (ready) return <Pill kind="yes" icon="checkmark" label="Ready" />;
    return <Pill kind="wait" label={who === "them" && stage === 1 ? "Looking…" : "Not yet"} />;
  };

  return (
    <Screen title={`Connect with ${p.name}`} background={t.goSoft}>
      <View style={{ alignItems: "center", gap: 22, paddingTop: 8 }}>
        <T variant="big" style={{ fontSize: 18, textAlign: "center" }}>Together in person?{"\n"}Hold your phones close and both press Connect.</T>
        <View style={{ width: 254, height: 254, alignItems: "center", justifyContent: "center" }}>
          {stage === 1 && <Animated.View style={{ position: "absolute", width: 254, height: 254, borderRadius: 127, borderWidth: 3, borderColor: t.go,
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }] }} />}
          <Pressable onPress={() => stage === 0 && setStage(1)} accessibilityRole="button" accessibilityLabel="Connect"
            style={({ pressed }) => ({ width: 210, height: 210, borderRadius: 105, backgroundColor: t.go, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.96 : 1 }] })}>
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, letterSpacing: 0.5, color: t.goInk }}>{stage === 2 ? "DONE" : "CONNECT"}</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
          {(["you", "them"] as const).map(w => (
            <View key={w} style={{ flex: 1, backgroundColor: t.surface, borderRadius: 14, padding: 10, alignItems: "center", gap: 6 }}>
              {w === "you" ? <Avatar name={state.user.name} hue={210} size={34} /> : <Avatar name={p.name} hue={p.hue} size={34} />}
              <T variant="bold">{w === "you" ? "You" : p.name}</T>
              {status(w)}
            </View>
          ))}
        </View>
        <T variant="small" style={{ textAlign: "center" }}>Bluetooth checks the two phones are right next to each other, so details can't be swapped remotely.</T>
        <Btn small variant="ghost" label="Use a QR code instead" onPress={() => toast("In the live app, one phone shows a code and the other scans it.")} />
      </View>
    </Screen>
  );
}
