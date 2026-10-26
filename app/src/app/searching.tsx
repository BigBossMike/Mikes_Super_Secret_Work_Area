import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { Logo, Screen, T } from "@/components/ui";
import { useApp } from "@/store/AppStore";
import { useTheme } from "@/theme";

export default function Searching() {
  const t = useTheme();
  const { state } = useApp();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    if (state.searchPhase === "done") router.replace("/matches");
    if (state.searchPhase === "failed") router.replace("/home");
  }, [state.searchPhase]);

  const waitingOnParent = state.searchPhase === "guardian";
  return (
    <Screen back={false} scroll={false}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
        <View style={{ width: 140, height: 140, alignItems: "center", justifyContent: "center" }}>
          <Animated.View style={{ position: "absolute", width: 140, height: 140, borderRadius: 70, borderWidth: 2, borderColor: t.go,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] }) }] }} />
          <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: t.goSoft, alignItems: "center", justifyContent: "center" }}><Logo /></View>
        </View>
        <T variant="big" style={{ fontSize: 18, textAlign: "center" }}>
          {waitingOnParent ? `Waiting for ${state.guardian.name} to OK your plan…` : `Finding people near ${state.user.suburb}…`}
        </T>
        <T variant="small" style={{ textAlign: "center" }}>
          {waitingOnParent ? "Usually takes a few minutes. Sped up for the demo." : "Checking interests, free time and distance."}
        </T>
      </View>
    </Screen>
  );
}
