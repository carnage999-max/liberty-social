"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushNotificationInitializer() {
  usePushNotifications();
  return null;
}
