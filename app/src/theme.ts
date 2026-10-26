import { useColorScheme } from "react-native";

const light = {
  field: "#EEF1F5",
  surface: "#FFFFFF",
  sunk: "#F4F6F9",
  ink: "#15213B",
  muted: "#5A657A",
  line: "#DDE2EA",
  go: "#12A150",
  goDeep: "#0B7A3B",
  goSoft: "#E3F5EA",
  goInk: "#FFFFFF",
  warn: "#C2410C",
  warnSoft: "#FDEDE4",
  heroBg: "#15213B",
  heroFg: "#FFFFFF",
  heroMuted: "rgba(255,255,255,0.72)",
};

export type Theme = typeof light;

const dark: Theme = {
  field: "#0C111B",
  surface: "#141B28",
  sunk: "#1A2333",
  ink: "#E8EDF5",
  muted: "#9AA5B8",
  line: "#273246",
  go: "#22C063",
  goDeep: "#43D67E",
  goSoft: "#13301F",
  goInk: "#04180B",
  warn: "#FF8A5B",
  warnSoft: "#3A1E12",
  heroBg: "#1E2B44",
  heroFg: "#E8EDF5",
  heroMuted: "rgba(232,237,245,0.72)",
};

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const fonts = {
  display: "Unbounded_500Medium",
  displayBold: "Unbounded_700Bold",
  body: "Figtree_400Regular",
  bodyMedium: "Figtree_500Medium",
  bodySemi: "Figtree_600SemiBold",
  bodyBold: "Figtree_700Bold",
};

/** Avatar colour from a hue, readable with white text in both themes. */
export const avatarColor = (hue: number) => `hsl(${hue}, 55%, 42%)`;
