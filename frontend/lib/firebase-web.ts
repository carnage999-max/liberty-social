"use client";

import { API_BASE } from "@/lib/api";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

export type FirebaseMessagingInstance = {
  getToken(options: {
    vapidKey: string;
    serviceWorkerRegistration: ServiceWorkerRegistration;
  }): Promise<string | null>;
  onMessage?: (callback: (payload: any) => void) => () => void;
};

type FirebaseMessagingFactory = {
  (): FirebaseMessagingInstance;
  isSupported?: () => boolean;
};

type FirebaseNamespace = {
  apps?: unknown[];
  initializeApp: (config: FirebaseWebConfig) => void;
  messaging?: FirebaseMessagingFactory;
};

declare global {
  interface Window {
    firebase?: FirebaseNamespace;
  }
}

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const SDK_SOURCES = [
  "https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js",
];

let messagingPromise: Promise<FirebaseMessagingInstance | null> | null = null;
const loadedScripts = new Set<string>();
let remoteConfigPromise:
  | Promise<{ config: FirebaseWebConfig; vapidKey?: string } | null>
  | null = null;

function loadScript(src: string) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (loadedScripts.has(src)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`
    );
    if (existing) {
      loadedScripts.add(src);
      return resolve();
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

function getEnvFirebaseWebConfig(): FirebaseWebConfig | null {
  const missing = REQUIRED_ENV_VARS.filter(
    (envVar) => !process.env[envVar] || !process.env[envVar]?.trim()
  );
  if (missing.length > 0) {
    return null;
  }

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!.trim(),
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!.trim(),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!.trim(),
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!.trim(),
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim(),
  };
}

export function getFirebaseVapidKey(): string | null {
  const key = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!key || !key.trim()) {
    // This is not an error - we can get the key from backend
    return null;
  }
  const trimmedKey = key.trim();

  // Validate VAPID key format (should be base64url-encoded, typically starts with B)
  if (!trimmedKey.startsWith('B') || trimmedKey.length < 80) {
    console.error("[push] Invalid VAPID key format in NEXT_PUBLIC_FIREBASE_VAPID_KEY");
    console.error("[push] Key should be base64url-encoded and start with 'B'");
    console.error("[push] Key length:", trimmedKey.length, "(expected ~87-88 characters)");
    console.error("[push] Key preview:", trimmedKey.substring(0, 10) + "...");
    return null;
  }

  return trimmedKey;
}

export async function ensureFirebaseMessaging(
  config: FirebaseWebConfig
): Promise<FirebaseMessagingInstance | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;

  // Validate config before proceeding
  if (!config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId) {
    console.error("[push] Invalid Firebase config - missing required fields:", {
      hasApiKey: !!config.apiKey,
      hasProjectId: !!config.projectId,
      hasMessagingSenderId: !!config.messagingSenderId,
      hasAppId: !!config.appId,
    });
    return null;
  }

  if (messagingPromise) {
    return messagingPromise;
  }

  messagingPromise = (async () => {
    try {
      for (const src of SDK_SOURCES) {
        await loadScript(src);
      }
      const firebase = window.firebase;
      if (!firebase) {
        console.warn("[push] Firebase namespace unavailable on window");
        return null;
      }
      if (!firebase.apps || firebase.apps.length === 0) {
        console.log("[push] Initializing Firebase with config:", { projectId: config.projectId });
        firebase.initializeApp(config);
      }
      if (!firebase.messaging) {
        console.warn("[push] firebase.messaging() not available");
        return null;
      }
      const supportsMessaging =
        typeof firebase.messaging.isSupported === "function"
          ? firebase.messaging.isSupported()
          : true;
      if (!supportsMessaging) {
        console.warn("[push] Firebase messaging not supported in this browser");
        return null;
      }
      return firebase.messaging();
    } catch (err) {
      console.error("[push] Failed to initialise Firebase messaging", err);
      return null;
    }
  })();

  return messagingPromise;
}

export function buildFirebaseServiceWorkerSrc(config: FirebaseWebConfig): string {
  const params = new URLSearchParams();
  Object.entries(config).forEach(([key, value]) => {
    if (value) {
      params.append(key, value);
    }
  });
  return `/firebase-messaging-sw.js?${params.toString()}`;
}

async function fetchFirebaseConfigFromBackend() {
  if (typeof window === "undefined") return null;
  if (!remoteConfigPromise) {
    const endpoint = API_BASE
      ? `${API_BASE}/firebase-config/`
      : "/api/firebase-config/";
    remoteConfigPromise = fetch(endpoint, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          config: FirebaseWebConfig;
          vapidKey?: string;
        };
      })
      .catch((error) => {
        console.warn("[push] Failed to fetch Firebase config", error);
        return null;
      });
  }
  return remoteConfigPromise;
}

export async function resolveFirebaseClientConfig(): Promise<{
  config: FirebaseWebConfig;
  vapidKey: string | null;
} | null> {
  const envConfig = getEnvFirebaseWebConfig();
  const envVapid = getFirebaseVapidKey();

  // Debug: Log what we have from environment
  console.log('[push] Environment config available:', !!envConfig);
  console.log('[push] Environment VAPID available:', !!envVapid);

  if (envConfig && envVapid) {
    console.log('[push] Using environment Firebase config');
    return { config: envConfig, vapidKey: envVapid };
  }

  console.log('[push] Fetching Firebase config from backend...');
  const remote = await fetchFirebaseConfigFromBackend();
  if (!remote) {
    console.warn('[push] Backend config unavailable');
    if (envConfig) {
      console.log('[push] Falling back to environment config (no VAPID)');
      return { config: envConfig, vapidKey: envVapid };
    }
    console.error('[push] No Firebase configuration available');
    return null;
  }

  const finalConfig = envConfig ?? remote.config;
  const finalVapid = envVapid ?? remote.vapidKey ?? null;

  // Validate and fix remote VAPID key if using it
  if (!envVapid && remote.vapidKey) {
    let remoteKey = remote.vapidKey.trim();
    console.log('[push] Backend VAPID key received, length:', remoteKey.length);
    console.log('[push] Backend VAPID key preview:', remoteKey.substring(0, 20) + '...');

    // Check if key is doubled (common mistake - 174 chars instead of 87)
    if (remoteKey.length > 100 && remoteKey.length % 2 === 0) {
      const half = remoteKey.length / 2;
      const firstHalf = remoteKey.substring(0, half);
      const secondHalf = remoteKey.substring(half);

      if (firstHalf === secondHalf) {
        console.warn('[push] ⚠️ VAPID key appears to be duplicated, using first half only');
        remoteKey = firstHalf;
        remote.vapidKey = remoteKey;
        console.log('[push] Fixed VAPID key length:', remoteKey.length);
      }
    }

    // Basic validation - VAPID keys should be base64url-encoded and typically 87-88 chars
    if (remoteKey.length < 80) {
      console.error('[push] Backend returned VAPID key that is too short');
      console.error('[push] VAPID key length:', remoteKey.length, '(expected ~87-88 characters)');
      console.error('[push] Make sure the FIREBASE_WEB_VAPID_KEY environment variable is set correctly in AWS');
      console.error('[push] Get the key from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates');
      return null;
    }

    // Warning if it doesn't start with 'B' but continue anyway
    if (!remoteKey.startsWith('B')) {
      console.warn('[push] VAPID key does not start with "B" - this may indicate an incorrect key');
      console.warn('[push] Most Firebase VAPID keys start with "B". Please verify the key is correct.');
    }
  }

  console.log('[push] Using merged config - env:', !!envConfig, 'remote:', !!remote.config);
  console.log('[push] Final VAPID source:', envVapid ? 'environment' : (remote.vapidKey ? 'backend' : 'none'));

  return {
    config: finalConfig,
    vapidKey: finalVapid,
  };
}
