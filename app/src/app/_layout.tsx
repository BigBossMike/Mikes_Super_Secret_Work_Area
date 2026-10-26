import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { Unbounded_500Medium, Unbounded_700Bold } from "@expo-google-fonts/unbounded";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "@/components/ui";
import { AppProvider } from "@/store/AppStore";
import { useTheme } from "@/theme";

export default function RootLayout() {
  const t = useTheme();
  const [loaded] = useFonts({ Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Unbounded_500Medium, Unbounded_700Bold });
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AppProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.surface } }} />
        </AppProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
