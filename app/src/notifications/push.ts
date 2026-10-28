// Push notifications, live app only.
//
// The phone asks permission once, gets its Expo push token and the store saves
// it with register_push_token. The database sends the notifications itself
// when something happens (supabase/migrations/0005_push.sql).
//
// Needs a development or store build: Expo Go can't receive push notifications.
// In Expo Go, a simulator or the web build, getPushToken returns null and the
// app carries on without them.
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const TOKEN_KEY = "intro.pushToken";

const projectId = (): string | null =>
  (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId ?? null;

/** This phone's push token, asking permission the first time. Null when not allowed or not possible here. */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
  const id = projectId();
  if (!id) return null;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", { name: "Intro", importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
    return token;
  } catch {
    return null;
  }
}

/** The token this phone registered last, so it can be removed on sign-out. */
export function savedPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
}
