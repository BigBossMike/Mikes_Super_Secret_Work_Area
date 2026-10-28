// Shows notifications while Intro is open (except for the screen you're already
// on, such as the open chat) and opens the right screen when one is tapped.
// Rendered once, inside the store, in the root layout (live app only).
import * as Notifications from "expo-notifications";
import { type Href, router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { routeFromData } from "@/lib/pushRoutes";
import { useApp } from "@/store/AppStore";

export function PushRouting() {
  const { state } = useApp();
  const path = usePathname();
  const here = useRef(path);
  here.current = path;
  const ready = state.session === "in" && state.hasProfile;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const pending = useRef<string | null>(null);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async n => {
        const same = routeFromData(n.request.content.data) === here.current;
        return { shouldShowBanner: !same, shouldShowList: true, shouldPlaySound: !same, shouldSetBadge: false };
      },
    });
    const open = (r: Notifications.NotificationResponse | null) => {
      const route = r ? routeFromData(r.notification.request.content.data) : null;
      if (!route) return;
      if (readyRef.current) router.push(route as Href);
      else pending.current = route;
    };
    // Opened by tapping a notification while Intro was closed.
    try {
      open(Notifications.getLastNotificationResponse());
      Notifications.clearLastNotificationResponse();
    } catch { /* not available here (Expo Go) */ }
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  // Tapped before sign-in had loaded: go there once Home is up.
  useEffect(() => {
    if (!ready || !pending.current) return;
    const route = pending.current;
    pending.current = null;
    const t = setTimeout(() => router.push(route as Href), 300);
    return () => clearTimeout(t);
  }, [ready]);

  return null;
}
