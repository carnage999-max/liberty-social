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
    console.log("[push] Registering service worker:", src);

    // Check if already registered
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) {
      console.log("[push] ✅ Service worker already registered:", existing.scope);
      await navigator.serviceWorker.ready;
      return existing;
    }

    const registration = await navigator.serviceWorker.register(src, {
      scope: "/",
    });
    console.log("[push] ✅ Service worker registered successfully");
    await navigator.serviceWorker.ready;
    console.log("[push] ✅ Service worker is ready");
    return registration;
  } catch (err: any) {
    console.error("[push] ❌ Failed to register Firebase service worker:", err);
    console.error("[push] Error name:", err.name);
    console.error("[push] Error message:", err.message);
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
      console.log("[push] 🚀 Starting push notification enablement for user:", userId);

      const resolved = await resolveFirebaseClientConfig();
      if (!resolved) {
        console.warn("[push] ❌ Firebase configuration unavailable");
        return;
      }
      const { config, vapidKey } = resolved;

      console.log("[push] ✅ Firebase config resolved:", {
        projectId: config.projectId,
        hasVapidKey: !!vapidKey,
        vapidKeyLength: vapidKey?.length || 0,
      });

      if (!vapidKey) {
        console.warn("[push] ❌ Missing Firebase VAPID key");
        return;
      }

      const permissionGranted = await requestNotificationPermission();
      if (!permissionGranted || cancelled) {
        console.log("[push] ⚠️ Permission not granted or cancelled. Permission:", Notification?.permission);
        return;
      }
      console.log("[push] ✅ Notification permission granted");

      const registration = await registerServiceWorker(config);
      if (!registration || cancelled) {
        console.error("[push] ❌ Service worker registration failed or cancelled");
        return;
      }
      console.log("[push] ✅ Service worker registered");

      const messaging = await ensureFirebaseMessaging(config);
      if (!messaging || cancelled) {
        console.error("[push] ❌ Firebase messaging initialization failed or cancelled");
        return;
      }
      console.log("[push] ✅ Firebase messaging initialized");

      try {
        console.log("[push] 📲 Requesting FCM token...");
        const token: string | null = await messaging.getToken({
          vapidKey,
          serviceWorkerRegistration: registration,
        });

        if (!token || cancelled) {
          console.warn("[push] ⚠️ No FCM token obtained or cancelled");
          return;
        }

        console.log("[push] ✅ FCM token obtained:", token.substring(0, 30) + "...");

        const stored = readStoredToken();
        if (stored?.token === token && stored?.userId === userId) {
          console.log("[push] ℹ️ Token already registered for this user, skipping API call");
          return;
        }

        console.log("[push] 📤 Sending token to backend...");
        await apiPost(
          "/device-tokens/",
          { token, platform: "web" },
          { token: accessToken, cache: "no-store" }
        );

        console.log("[push] ✅ Token successfully registered with backend");
        writeStoredToken({ token, userId });
      } catch (err: any) {
        console.error("[push] ❌ Failed to register device token:", err);
        console.error("[push] Error name:", err.name);
        console.error("[push] Error message:", err.message);
        if (err.code) {
          console.error("[push] Error code:", err.code);
        }
      }
    }

    void enablePush();

    return () => {
      cancelled = true;
    };
  }, [user, accessToken]);
}
