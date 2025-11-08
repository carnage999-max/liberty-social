"use client";

import { useEffect } from "react";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { FirebaseWebConfig } from "@/lib/firebase-web";
import {
  buildFirebaseServiceWorkerSrc,
  ensureFirebaseMessaging,
  resolveFirebaseClientConfig,
} from "@/lib/firebase-web";

const STORAGE_KEY = "liberty_push_token_v1";

type StoredToken = {
  token: string;
  userId: string;
};

function readStoredToken(): StoredToken | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredToken;
  } catch (err) {
    console.warn("[push] Failed to read stored token", err);
    return null;
  }
}

function writeStoredToken(data: StoredToken) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("[push] Failed to persist token", err);
  }
}

async function registerServiceWorker(config: FirebaseWebConfig) {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) {
    console.warn("[push] Service workers are not supported in this browser");
    return null;
  }

  try {
    const src = buildFirebaseServiceWorkerSrc(config);
    const registration = await navigator.serviceWorker.register(src, {
      scope: "/",
    });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.error("[push] Failed to register Firebase service worker", err);
    return null;
  }
}

async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (err) {
    console.warn("[push] Notification permission request failed", err);
    return false;
  }
}

export function usePushNotifications() {
  const { user, accessToken } = useAuth();

  useEffect(() => {
    if (!user || !accessToken) return;
    if (typeof window === "undefined") return;
    const userId = user.id;

    let cancelled = false;

    async function enablePush() {
      const resolved = await resolveFirebaseClientConfig();
      if (!resolved) {
        console.warn("[push] Firebase configuration unavailable");
        return;
      }
      const { config, vapidKey } = resolved;
      if (!vapidKey) {
        console.warn("[push] Missing Firebase VAPID key");
        return;
      }

      const permissionGranted = await requestNotificationPermission();
      if (!permissionGranted || cancelled) return;

      const registration = await registerServiceWorker(config);
      if (!registration || cancelled) return;

      const messaging = await ensureFirebaseMessaging(config);
      if (!messaging || cancelled) return;

      try {
        const token: string | null = await messaging.getToken({
          vapidKey,
          serviceWorkerRegistration: registration,
        });
        if (!token || cancelled) return;

        const stored = readStoredToken();
        if (stored?.token === token && stored?.userId === userId) {
          return;
        }

        await apiPost(
          "/device-tokens/",
          { token, platform: "web" },
          { token: accessToken, cache: "no-store" }
        );

        writeStoredToken({ token, userId });
      } catch (err) {
        console.error("[push] Failed to register device token", err);
      }
    }

    void enablePush();

    return () => {
      cancelled = true;
    };
  }, [user, accessToken]);
}
