// The Supabase connection. Set EXPO_PUBLIC_SUPABASE_URL and
// EXPO_PUBLIC_SUPABASE_ANON_KEY (see .env.example) and the app runs live.
// Leave them blank and it runs the demo with sample people.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when the app is pointed at a real Supabase project. */
export const LIVE = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = LIVE
  ? createClient(url!, anonKey!, {
      auth: {
        // The session is kept on the phone so people stay signed in.
        storage: Platform.OS === "web" ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Keep the sign-in token fresh while the app is on screen, and stop while it's in the background.
if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", s => {
    if (s === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export function supabaseConfig(): { url: string; anonKey: string } | null {
  return LIVE ? { url: url!, anonKey: anonKey! } : null;
}

/** The signed-in person's access token, for calling server functions. Null when signed out or in demo mode. */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
