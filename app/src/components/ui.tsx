import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Switch,
  Text, TextInput, TextInputProps, TextProps, TextStyle, View, ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { avatarColor, fonts, useTheme } from "@/theme";

type Variant = "body" | "small" | "bold" | "label" | "eyebrow" | "h3" | "title" | "big" | "display";

const TEXT: Record<Variant, TextStyle> = {
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  bold: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 19 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" },
  h3: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20 },
  title: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22 },
  big: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25 },
  display: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 37, letterSpacing: -1 },
};

export function T({ variant = "body", color, muted, style, ...rest }: TextProps & { variant?: Variant; color?: string; muted?: boolean }) {
  const t = useTheme();
  const c = color ?? (muted || variant === "small" || variant === "eyebrow" ? t.muted : t.ink);
  return <Text {...rest} style={[TEXT[variant], { color: c }, style]} />;
}

/** A full screen with an optional header, scrolling body and fixed footer. */
export function Screen({ title, back = true, right, footer, children, scroll = true, inTabs = false, background }: {
  title?: ReactNode; back?: boolean | string; right?: ReactNode; footer?: ReactNode; children: ReactNode;
  scroll?: boolean; inTabs?: boolean; background?: string;
}) {
  const t = useTheme();
  const goBack = () => {
    if (typeof back === "string") router.replace(back as never);
    else if (router.canGoBack()) router.back();
    else router.replace("/home");
  };
  return (
    <SafeAreaView edges={inTabs ? ["top"] : ["top", "bottom"]} style={{ flex: 1, backgroundColor: background ?? t.surface }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {(title || right) && (
          <View style={s.top}>
            {back !== false && (
              <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={[s.back, { borderColor: t.line, backgroundColor: t.surface }]}>
                <Ionicons name="chevron-back" size={18} color={t.ink} />
              </Pressable>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>{typeof title === "string" ? <T variant="title">{title}</T> : title}</View>
            {right}
          </View>
        )}
        {scroll ? (
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        ) : (
          <View style={[s.body, { flex: 1 }]}>{children}</View>
        )}
        {footer && <View style={[s.foot, { borderTopColor: t.line, backgroundColor: t.surface }]}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Btn({ label, onPress, variant = "primary", small, disabled }: {
  label: string; onPress: () => void; variant?: "primary" | "go" | "ghost"; small?: boolean; disabled?: boolean;
}) {
  const t = useTheme();
  const bg = variant === "primary" ? t.ink : variant === "go" ? t.go : "transparent";
  const fg = variant === "primary" ? t.surface : variant === "go" ? t.goInk : t.ink;
  return (
    <Pressable
      onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      style={({ pressed }) => [
        small ? s.btnSm : s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === "ghost" && { borderWidth: 1, borderColor: t.line },
      ]}>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: small ? 14 : 16, color: fg, textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ variant = "plain", children, style }: { variant?: "plain" | "sunk" | "hero"; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const v = variant === "hero" ? { backgroundColor: t.heroBg, borderWidth: 0 }
    : variant === "sunk" ? { backgroundColor: t.sunk, borderWidth: 0 }
    : { backgroundColor: t.surface, borderWidth: 1, borderColor: t.line };
  return <View style={[s.card, v, style]}>{children}</View>;
}

export function Row({ children, wrap, gap = 8, style }: { children: ReactNode; wrap?: boolean; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, wrap && { flexWrap: "wrap" }, style]}>{children}</View>;
}

export function Chips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  const t = useTheme();
  return (
    <Row wrap>
      {options.map(o => {
        const on = selected.includes(o);
        return (
          <Pressable key={o} onPress={() => onToggle(o)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={[s.chip, { borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.surface }]}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: on ? t.surface : t.ink }}>{o}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function Tag({ label }: { label: string }) {
  const t = useTheme();
  return <View style={[s.tag, { backgroundColor: t.sunk }]}><Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: t.muted }}>{label}</Text></View>;
}

export function Pill({ kind, label, icon }: { kind: "wait" | "yes" | "no" | "done"; label: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const t = useTheme();
  const c = { wait: [t.sunk, t.muted], yes: [t.goSoft, t.goDeep], no: [t.warnSoft, t.warn], done: [t.go, t.goInk] }[kind];
  return (
    <View style={[s.pill, { backgroundColor: c[0] }]}>
      {icon && <Ionicons name={icon} size={12} color={c[1]} />}
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: c[1] }}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, hue, size = 44, anon }: { name?: string; hue?: number; size?: number; anon?: boolean }) {
  const t = useTheme();
  const base = { width: size, height: size, borderRadius: size / 2, alignItems: "center" as const, justifyContent: "center" as const };
  if (anon) return <View style={[base, { backgroundColor: t.sunk, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.line }]}><Text style={{ color: t.muted, fontFamily: fonts.bodyBold, fontSize: size * 0.4 }}>?</Text></View>;
  return <View style={[base, { backgroundColor: avatarColor(hue ?? 210) }]}><Text style={{ color: "#fff", fontFamily: fonts.bodyBold, fontSize: size * 0.4 }}>{name?.[0] ?? "?"}</Text></View>;
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{label}{hint ? <T variant="small"> {hint}</T> : null}</T>
      <TextInput
        placeholderTextColor={t.muted} {...input}
        style={[s.input, { borderColor: t.line, backgroundColor: t.sunk, color: t.ink }, input.multiline && { minHeight: 72, textAlignVertical: "top" }]}
      />
    </View>
  );
}

export function ToggleRow({ title, sub, value, onChange }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Row gap={12} style={{ justifyContent: "space-between" }}>
      <View style={{ flex: 1, gap: 2 }}><T variant="bold">{title}</T>{sub ? <T variant="small">{sub}</T> : null}</View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={title} trackColor={{ true: t.go, false: t.line }} thumbColor="#FFFFFF" />
    </Row>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "ok" | "warn"; children: ReactNode }) {
  const t = useTheme();
  const [bg, fg] = kind === "ok" ? [t.goSoft, t.goDeep] : kind === "warn" ? [t.warnSoft, t.warn] : [t.sunk, t.ink];
  return <View style={[s.notice, { backgroundColor: bg }]}><Text style={{ fontFamily: kind === "info" ? fonts.body : fonts.bodySemi, fontSize: 14, lineHeight: 19, color: fg }}>{children}</Text></View>;
}

export function Logo({ size = 22, color }: { size?: number; color?: string }) {
  const t = useTheme();
  return <Text style={{ fontFamily: fonts.displayBold, fontSize: size, letterSpacing: -size * 0.04, color: color ?? t.ink }}>intro<Text style={{ color: t.go }}>.</Text></Text>;
}

// Toasts: short confirmations shown above the bottom of the screen
const ToastCtx = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setText(msg);
    timer.current = setTimeout(() => setText(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {text && (
        <View pointerEvents="none" style={[s.toast, { backgroundColor: t.ink }]} accessibilityLiveRegion="polite">
          <Text style={{ color: t.surface, fontFamily: fonts.bodySemi, fontSize: 14 }}>{text}</Text>
        </View>
      )}
    </ToastCtx.Provider>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, minHeight: 60 },
  back: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24, gap: 16 },
  foot: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, gap: 10 },
  btn: { borderRadius: 14, paddingVertical: 15, paddingHorizontal: 18, alignSelf: "stretch" },
  btnSm: { borderRadius: 11, paddingVertical: 9, paddingHorizontal: 14, alignSelf: "flex-start" },
  card: { borderRadius: 18, padding: 16, gap: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  tag: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 15 },
  notice: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  toast: { position: "absolute", left: 16, right: 16, bottom: 100, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
});
