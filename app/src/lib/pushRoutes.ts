// Where a tapped notification may take you. The database puts a screen path in
// each notification's data.url (supabase/migrations/0005_push.sql); the app only
// follows paths on this list, so a notification can never open anything else.

const FIXED = new Set(["/home", "/requests", "/matches", "/parent-home"]);
const CHAT = /^\/chat\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function routeFromData(data: unknown): string | null {
  const url = data && typeof data === "object" ? (data as { url?: unknown }).url : null;
  if (typeof url !== "string") return null;
  return FIXED.has(url) || CHAT.test(url) ? url : null;
}
