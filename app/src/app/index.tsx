import { router } from "expo-router";
import { View } from "react-native";
import { Btn, Logo, Row, Screen, T } from "@/components/ui";
import { useTheme } from "@/theme";

const STEPS = [
  "Set one plan for the month.",
  "Up to 5 well-matched people are asked if they're happy to be put forward.",
  "Chat to plan a meet-up. Swap numbers and socials only once you've met and tapped phones.",
];

export default function Welcome() {
  const t = useTheme();
  return (
    <Screen back={false} footer={<>
      <Btn label="Get started" onPress={() => router.push("/verify")} />
      <T variant="small" style={{ textAlign: "center" }}>16+ only. Photo ID check required.</T>
    </>}>
      <View style={{ gap: 18, paddingTop: 24 }}>
        <Logo />
        <T variant="display">Real people.{"\n"}Real plans.{"\n"}<T variant="display" color={t.go}>Meet in person.</T></T>
        <T muted>No followers, no likes, no feed. Set one plan a month and Intro finds up to five people near you who are keen to join in.</T>
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
