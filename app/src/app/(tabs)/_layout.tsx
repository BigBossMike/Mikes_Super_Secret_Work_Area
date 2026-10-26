import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { fonts, useTheme } from "@/theme";
import { useApp, visibleRequests } from "@/store/AppStore";

export default function TabsLayout() {
  const t = useTheme();
  const { state } = useApp();
  const pending = state.user.paused ? 0 : visibleRequests(state).filter(r => r.status === "pending").length;
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: t.ink,
      tabBarInactiveTintColor: t.muted,
      tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line, ...(Platform.OS === "web" ? { height: 64, paddingBottom: 8 } : null) },
      tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 12 },
      tabBarBadgeStyle: { backgroundColor: t.go, color: t.goInk, fontFamily: fonts.bodyBold, fontSize: 10 },
    }}>
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="requests" options={{ title: "Requests", tabBarBadge: pending || undefined, tabBarIcon: ({ color, size }) => <Ionicons name="person-add-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="me" options={{ title: "Me", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
