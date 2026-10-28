// "Hide me from my contacts": read the phone numbers in the phone's contacts,
// turn each into a fingerprint on the phone (lib/phoneHash.ts) and hand back
// only the fingerprints. Names and numbers never leave the phone.
//
// expo-contacts is loaded only when needed: an older development build
// without it, or the web build, simply reports "unavailable".
import { Platform } from "react-native";
import { phoneHashes } from "@/lib/phoneHash";

export type ContactsAccess = "ok" | "denied" | "unavailable";

export async function readContactHashes(): Promise<{ status: "ok"; hashes: string[] } | { status: "denied" | "unavailable" }> {
  if (Platform.OS === "web") return { status: "unavailable" };
  let C: typeof import("expo-contacts");
  try { C = require("expo-contacts"); } catch { return { status: "unavailable" }; }
  try {
    const { status } = await C.requestPermissionsAsync();
    if (status !== "granted") return { status: "denied" };
    const people = await C.Contact.getAllDetails([C.ContactField.PHONES] as const);
    const numbers = people.flatMap(p => (p.phones ?? []).map(ph => ph.number ?? "")).filter(Boolean);
    return { status: "ok", hashes: phoneHashes(numbers) };
  } catch {
    return { status: "unavailable" };
  }
}
