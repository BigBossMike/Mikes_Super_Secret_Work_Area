// The phone's half of the ID check: Stripe's sheet takes a photo of the ID
// and a live selfie, and sends them straight to Stripe (never through Intro).
// The module is loaded only when needed, so Expo Go, the web build and older
// development builds simply report "unavailable".
import { Image, Platform } from "react-native";

export type SheetResult = "completed" | "canceled" | "failed" | "unavailable";

export async function presentIdCheck(sessionId: string, ephemeralKeySecret: string): Promise<{ result: SheetResult; message?: string }> {
  if (Platform.OS === "web") return { result: "unavailable" };
  let sdk: typeof import("@stripe/stripe-identity-react-native");
  try { sdk = require("@stripe/stripe-identity-react-native"); } catch { return { result: "unavailable" }; }
  try {
    const logo = Image.resolveAssetSource(require("../../assets/icon.png"));
    if (!logo) return { result: "unavailable" };
    const { status, error } = await sdk.presentIdentityVerificationSheet({ sessionId, ephemeralKeySecret, brandLogo: logo });
    if (status === "FlowCompleted") return { result: "completed" };
    if (status === "FlowCanceled") return { result: "canceled" };
    return { result: "failed", message: error?.localizedMessage ?? error?.message };
  } catch (e) {
    return { result: "unavailable", message: e instanceof Error ? e.message : String(e) };
  }
}
