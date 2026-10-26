import { Pressable, Text, View } from "react-native";
import { Row, T } from "@/components/ui";
import { fonts, useTheme } from "@/theme";

function Step({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  const t = useTheme();
  const btn = (txt: string, next: number, disabled: boolean) => (
    <Pressable onPress={() => !disabled && onChange(next)} accessibilityRole="button" accessibilityLabel={`${label} ${txt === "−" ? "down" : "up"}`}
      style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: t.line, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 }}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, color: t.ink }}>{txt}</Text>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, gap: 6, alignItems: "center" }}>
      <T variant="small">{label}</T>
      <Row gap={10}>{btn("−", value - 1, value <= min)}<T variant="big" style={{ minWidth: 34, textAlign: "center" }}>{value}</T>{btn("+", value + 1, value >= max)}</Row>
    </View>
  );
}

/** Pick the youngest and oldest ages to be paired with. Adults only. */
export function AgeRange({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  return (
    <Row gap={12}>
      <Step label="Youngest" value={min} min={18} max={max} onChange={v => onChange(v, max)} />
      <Step label="Oldest" value={max} min={min} max={99} onChange={v => onChange(min, v)} />
    </Row>
  );
}
