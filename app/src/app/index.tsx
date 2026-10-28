import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { LIVE } from "@/backend/client";
import { Btn, Logo, Row, Screen, T } from "@/components/ui";
import { isParentUser, useApp } from "@/store/AppStore";
import { useTheme } from "@/theme";

const STEPS = [
  "Set one plan for the month.",
  "Up to 5 well-matched people are asked if they're happy to be put forward.",
  "Chat to plan a meet-up. Swap numbers and socials only once you've met and tapped phones.",
];

export default function Welcome() {
  const t = useTheme();
  const { state } = useApp();
  // Live app: someone already signed in with a profile goes straight to Home; a parent with no profile to the parent screen.
  const parentOnly = !state.hasProfile && isParentUser(state);
  useEffect(() => {
    if (LIVE && state.session === "in" && state.hasProfile) router.replace("/home");
    else if (LIVE && state.session === "in" && parentOnly) router.replace("/parent-home");
  }, [state.session, state.hasProfile, parentOnly]);
  const start = () => router.push(LIVE ? (state.session === "in" ? "/verify" : "/signin") : "/verify");
  return (
    <Screen back={false} footer={<>
      <Btn label="Get started" disabled={LIVE && state.session === "loading"} onPress={start} />
      <T variant="small" style={{ textAlign: "center" }}>16+ only. Photo ID check required. Under-18s and adults are never matched together.</T>
    </>}>
      <View style={{ gap: 18, paddingTop: 24 }}>
        <Logo size={48} />
        <T variant="display">Real people.{"\n"}Real plans.{"\n"}<T variant="display" color={t.go}>Meet in person.</T></T>
        <T muted>Got a plan that needs one more? Extend a digital hand. Like putting your name down at the club, Intro pairs you with up to five people nearby who are keen too.</T>
        <View style={{ gap: 12 }}>
          {STEPS.map((s, i) => (
            <Row key={i} gap={12} style={{ alignItems: "flex-start" }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: t.ink, alignItems: "center", justifyContent: "center" }}>
                <T variant="h3" style={{ fontSize: 12 }}>{i + 1}</T>
              </View>
              <T style={{ flex: 1 }}>{s}</T>
            </Row>
          ))}
        </View>
      </View>
    </Screen>
  );
}
