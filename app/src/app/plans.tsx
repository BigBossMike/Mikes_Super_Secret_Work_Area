import { useLocalSearchParams } from "expo-router";
import { ReactNode } from "react";
import { View } from "react-native";
import { LIVE } from "@/backend/client";
import { Btn, Notice, Pill, Row, Screen, T } from "@/components/ui";
import { useApp } from "@/store/AppStore";
import { fonts, useTheme } from "@/theme";

function PlanCard({ name, price, unit, text, current, action }: { name: string; price: string; unit?: string; text: string; current?: boolean; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ borderWidth: 1.5, borderColor: current ? t.go : t.line, borderRadius: 18, padding: 16, gap: 8 }}>
      <Row style={{ justifyContent: "space-between" }}><T variant="h3">{name}</T>{current && <Pill kind="yes" label="Current" />}</Row>
      <T style={{ fontFamily: fonts.displayBold, fontSize: 26 }}>{price} {unit ? <T variant="small">{unit}</T> : null}</T>
      <T variant="small">{text}</T>
      {action}
    </View>
  );
}

// Pricing (decided 28th October 2026): a 7-day free trial, then $7.99 a month. Being asked is always free.
export default function Plans() {
  const { limit } = useLocalSearchParams<{ limit?: string }>();
  const { state, actions } = useApp();
  const b = state.billing;
  const until = b.renewsAt ? new Date(b.renewsAt).toLocaleDateString("en-AU", { day: "numeric", month: "long" }) : null;
  return (
    <Screen title="Plans">
      {limit && !actions.canStart() && <Notice kind="warn">Start your 7-day free trial to set a plan.</Notice>}
      {b.pilot && <Notice kind="ok">Free during the pilot. Nothing to pay.</Notice>}
      <PlanCard name="Intro" price="$7.99" unit="a month" current={b.subscribed}
        text="7-day free trial. Set as many plans as you like. Cancel any time."
        action={b.subscribed
          ? <T variant="small">{b.inTrial ? `Free trial until ${until}.` : `Renews ${until}.`} Cancel in your App Store or Google Play settings.</T>
          : b.pilot ? null : <Btn small variant="go" label="Start my free trial" onPress={actions.startTrial} />} />
      <PlanCard name="Being asked" price="Free" text="Being asked to join someone else's plan, saying yes and meeting up are always free." />
      <T variant="small">Prices in AUD, including GST. After the free trial the App Store or Google Play charges $7.99 a month unless you cancel.{LIVE ? "" : " Demo only: nothing is charged."}</T>
    </Screen>
  );
}
