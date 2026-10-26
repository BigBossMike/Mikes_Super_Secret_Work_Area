import { useLocalSearchParams } from "expo-router";
import { ReactNode } from "react";
import { View } from "react-native";
import { Btn, Notice, Pill, Row, Screen, T } from "@/components/ui";
import { MONTH_NAME, useApp } from "@/store/AppStore";
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

export default function Plans() {
  const { limit } = useLocalSearchParams<{ limit?: string }>();
  const { state, actions } = useApp();
  return (
    <Screen title="Plans">
      {limit && !actions.canStart() && <Notice kind="warn">You've used your free objective for {MONTH_NAME}. Buy one more, or go unlimited.</Notice>}
      <PlanCard name="Free" price="$0" text="1 objective every month. Being put forward is always free." current={state.plan === "free"} />
      <PlanCard name="Extra objective" price="$5" unit="each" text={`One more objective this month, on top of your free one.${state.credits ? ` You have ${state.credits} extra.` : ""}`}
        action={<Btn small label="Buy one objective" onPress={actions.buyOne} />} />
      <PlanCard name="Unlimited" price="$10" unit="a month" text="As many objectives as you like. Cancel any time." current={state.plan === "unlimited"}
        action={state.plan === "unlimited" ? <Btn small variant="ghost" label="Switch back to Free" onPress={() => actions.setPlan("free")} />
          : <Btn small variant="go" label="Go unlimited" onPress={() => actions.setPlan("unlimited")} />} />
      <T variant="small">Prices in AUD. Demo only: nothing is charged. The live app uses Apple and Google in-app purchases.</T>
    </Screen>
  );
}
