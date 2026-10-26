import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Avatar, Btn, Notice, Pill, Screen, T } from "@/components/ui";
import { handshakeServices } from "@/handshake/services";
import { useHandshake } from "@/handshake/useHandshake";
import { strongEnough } from "@/lib/handshake";
import { personById, useApp } from "@/store/AppStore";
import { fonts, useTheme } from "@/theme";

// The in-person connect. Both people press the big green button with their
// phones together. Bluetooth swaps codes between the phones and the server
// checks them (src/handshake). The QR code screen is the fallback.
export default function Connect() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const services = handshakeServices();
  const hs = useHandshake(id, { ...services, onConnected: () => { actions.completeConnect(id); router.replace(`/connected/${id}`); } });
  const ring = useRef(new Animated.Value(0)).current;
  const busy = hs.phase === "listening" || hs.phase === "checking";
  const p = personById(state, id);

  useEffect(() => {
    if (!busy) return;
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [busy, ring]);

  if (!p) return <Screen title="Connect"><T muted>Nobody to connect with.</T></Screen>;

  const heardThem = hs.heard.length > 0;
  const heardClose = hs.heard.some(h => strongEnough(h.rssi));
  const goQr = () => router.push(`/connect/qr/${id}`);
  const label = hs.phase === "connected" ? "DONE" : hs.phase === "checking" ? "CHECKING" : hs.phase === "listening" ? "LOOKING" : "CONNECT";
  const canPress = hs.phase === "idle" || hs.phase === "failed" || hs.phase === "unavailable";

  const yours = canPress ? <Pill kind="wait" label="Not yet" /> : <Pill kind="yes" icon="checkmark" label="Ready" />;
  const theirs = () => {
    if (hs.phase === "connected" || (hs.phase === "checking" && heardClose)) return <Pill kind="yes" icon="checkmark" label="Ready" />;
    if (hs.phase === "checking") return <Pill kind="wait" label="Checking…" />;
    if (hs.phase === "listening") return heardClose ? <Pill kind="yes" icon="checkmark" label="Ready" /> : heardThem ? <Pill kind="wait" label="Hold closer" /> : <Pill kind="wait" label="Looking…" />;
    return <Pill kind="wait" label="Not yet" />;
  };

  return (
    <Screen title={`Connect with ${p.name}`} background={t.goSoft}>
      <View style={{ alignItems: "center", gap: 22, paddingTop: 8 }}>
        <T variant="big" style={{ fontSize: 18, textAlign: "center" }}>Together in person?{"\n"}Hold your phones close and both press Connect.</T>
        <View style={{ width: 254, height: 254, alignItems: "center", justifyContent: "center" }}>
          {busy && <Animated.View style={{ position: "absolute", width: 254, height: 254, borderRadius: 127, borderWidth: 3, borderColor: t.go,
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }] }} />}
          <Pressable onPress={() => canPress && hs.startBle()} accessibilityRole="button" accessibilityLabel="Connect" accessibilityState={{ busy }}
            style={({ pressed }) => ({ width: 210, height: 210, borderRadius: 105, backgroundColor: t.go, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed && canPress ? 0.96 : 1 }] })}>
            <Text style={{ fontFamily: fonts.displayBold, fontSize: label.length > 7 ? 20 : 24, letterSpacing: 0.5, color: t.goInk }}>{label}</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
          <View style={{ flex: 1, backgroundColor: t.surface, borderRadius: 14, padding: 10, alignItems: "center", gap: 6 }}>
            <Avatar name={state.user.name} hue={210} size={34} />
            <T variant="bold">You</T>
            {yours}
          </View>
          <View style={{ flex: 1, backgroundColor: t.surface, borderRadius: 14, padding: 10, alignItems: "center", gap: 6 }}>
            <Avatar name={p.name} hue={p.hue} size={34} />
            <T variant="bold">{p.name}</T>
            {theirs()}
          </View>
        </View>

        {hs.phase === "failed" && <Notice kind="warn">{hs.reason}</Notice>}
        {hs.phase === "unavailable" && <Notice kind="info">{hs.reason}</Notice>}

        <T variant="small" style={{ textAlign: "center" }}>
          {services.live
            ? "Bluetooth checks the two phones are right next to each other, so details can't be swapped remotely."
            : "Demo: the other phone is pretend. The QR code is real, so two phones running Intro can connect that way."}
        </T>
        <Btn small variant={hs.phase === "unavailable" ? "primary" : "ghost"} label="Use a QR code instead" onPress={goQr} />
      </View>
    </Screen>
  );
}
