// Where this phone is, for the "same place" check. Only used at the moment of
// connecting; the server keeps the suburb, never the exact spot.
import * as ExpoLocation from "expo-location";
import type { Location } from "@/lib/handshake";

export async function whereAmI(timeoutMs = 8000): Promise<Location | null> {
  const perm = await ExpoLocation.requestForegroundPermissionsAsync();
  if (!perm.granted) return null;

  const fresh = ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High }).catch(() => null);
  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs));
  const pos = (await Promise.race([fresh, timeout])) ?? (await ExpoLocation.getLastKnownPositionAsync({ maxAge: 60_000 }).catch(() => null));
  if (!pos) return null;
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy_m: pos.coords.accuracy ?? null };
}
