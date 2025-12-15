"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { resolveFirebaseClientConfig, ensureFirebaseMessaging } from "@/lib/firebase-web";

export default function NotificationDebugPage() {
  const { user, accessToken } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [firebaseConfig, setFirebaseConfig] = useState<any>(null);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const addLog = (message: string) => {
    console.log(`[NotifDebug] ${message}`);
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    addLog("🔍 Starting notification diagnostics...");

    // Check notification permission
    if ("Notification" in window) {
      setPermission(Notification.permission);
      addLog(`✅ Notification API available. Permission: ${Notification.permission}`);
    } else {
      addLog("❌ Notification API not available in this browser");
    }

    // Check service worker support
    if ("serviceWorker" in navigator) {
      addLog("✅ Service Worker API available");
      navigator.serviceWorker.getRegistration("/").then((reg) => {
        if (reg) {
          setSwRegistration(reg);
          addLog(`✅ Service worker registered: ${reg.scope}`);
          addLog(`   Active: ${!!reg.active}`);
          addLog(`   Waiting: ${!!reg.waiting}`);
          addLog(`   Installing: ${!!reg.installing}`);
        } else {
          addLog("⚠️ No service worker registration found");
        }
      });
    } else {
      addLog("❌ Service Worker API not available");
    }
  }, []);

  useEffect(() => {
    if (!user || !accessToken) return;

    const checkFirebase = async () => {
      addLog("🔍 Checking Firebase configuration...");

      try {
        const resolved = await resolveFirebaseClientConfig();
        if (!resolved) {
          addLog("❌ Failed to resolve Firebase client config");
          return;
        }

        const { config, vapidKey: key } = resolved;
        setFirebaseConfig(config);
        setVapidKey(key);

        addLog(`✅ Firebase config resolved`);
        addLog(`   Project ID: ${config.projectId}`);
        addLog(`   Sender ID: ${config.messagingSenderId}`);
        addLog(`   VAPID key available: ${!!key}`);
        if (key) {
          addLog(`   VAPID key length: ${key.length} chars`);
          addLog(`   VAPID key preview: ${key.substring(0, 20)}...`);
        }

        // Try to get FCM token
        addLog("🔍 Attempting to get FCM token...");
        const messaging = await ensureFirebaseMessaging(config);
        if (!messaging) {
          addLog("❌ Failed to initialize Firebase messaging");
          return;
        }
        addLog("✅ Firebase messaging initialized");

        if (!key) {
          addLog("❌ Cannot get FCM token without VAPID key");
          return;
        }

        const reg = await navigator.serviceWorker.getRegistration("/");
        if (!reg) {
          addLog("❌ No service worker registration found");
          return;
        }

        try {
          const token = await messaging.getToken({
            vapidKey: key,
            serviceWorkerRegistration: reg,
          });

          if (token) {
            setFcmToken(token);
            addLog(`✅ FCM token obtained`);
            addLog(`   Token: ${token.substring(0, 50)}...`);
          } else {
            addLog("❌ No FCM token returned (user may have denied permission)");
          }
        } catch (tokenError: any) {
          addLog(`❌ Error getting FCM token: ${tokenError.message}`);
          if (tokenError.code) {
            addLog(`   Error code: ${tokenError.code}`);
          }
        }

      } catch (error: any) {
        addLog(`❌ Error checking Firebase: ${error.message}`);
      }
    };

    checkFirebase();
  }, [user, accessToken]);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      addLog("❌ Notifications not supported");
      return;
    }

    if (Notification.permission === "granted") {
      addLog("✅ Permission already granted");
      return;
    }

    addLog("🔔 Requesting notification permission...");
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      addLog(`📝 Permission result: ${result}`);
    } catch (error: any) {
      addLog(`❌ Error requesting permission: ${error.message}`);
    }
  };

  const sendTestNotification = async () => {
    if (Notification.permission !== "granted") {
      addLog("❌ Cannot send test notification - permission not granted");
      return;
    }

    addLog("📨 Sending test notification...");
    try {
      const notif = new Notification("Test Notification", {
        body: "This is a test notification from Liberty Social",
        icon: "/icon.png",
      });
      addLog("✅ Test notification sent");

      notif.onclick = () => {
        addLog("🖱️ Test notification clicked");
      };
    } catch (error: any) {
      addLog(`❌ Error sending test notification: ${error.message}`);
    }
  };

  const checkServiceWorker = async () => {
    if (!("serviceWorker" in navigator)) {
      addLog("❌ Service workers not supported");
      return;
    }

    addLog("🔍 Checking service worker details...");

    const registrations = await navigator.serviceWorker.getRegistrations();
    addLog(`📝 Total registrations: ${registrations.length}`);

    registrations.forEach((reg, index) => {
      addLog(`\n--- Registration ${index + 1} ---`);
      addLog(`Scope: ${reg.scope}`);
      addLog(`Active: ${reg.active?.scriptURL || "none"}`);
      addLog(`Waiting: ${reg.waiting?.scriptURL || "none"}`);
      addLog(`Installing: ${reg.installing?.scriptURL || "none"}`);
    });

    const controller = navigator.serviceWorker.controller;
    if (controller) {
      addLog(`\n✅ Current controller: ${controller.scriptURL}`);
    } else {
      addLog("\n⚠️ No active service worker controller");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Web Notification Debug</h1>

      {!user && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">⚠️ You must be logged in to test notifications</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">Status</h2>
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-medium">User:</span>{" "}
              {user ? `${user.username} (ID: ${user.id})` : "Not logged in"}
            </div>
            <div>
              <span className="font-medium">Permission:</span>{" "}
              <span
                className={
                  permission === "granted"
                    ? "text-green-600"
                    : permission === "denied"
                    ? "text-red-600"
                    : "text-yellow-600"
                }
              >
                {permission || "unknown"}
              </span>
            </div>
            <div>
              <span className="font-medium">Service Worker:</span>{" "}
              {swRegistration ? "✅ Registered" : "❌ Not registered"}
            </div>
            <div>
              <span className="font-medium">FCM Token:</span>{" "}
              {fcmToken ? "✅ Obtained" : "❌ Not obtained"}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-2">Firebase Config</h2>
          <div className="space-y-1 text-sm">
            {firebaseConfig ? (
              <>
                <div>
                  <span className="font-medium">Project ID:</span> {firebaseConfig.projectId}
                </div>
                <div>
                  <span className="font-medium">Sender ID:</span> {firebaseConfig.messagingSenderId}
                </div>
                <div>
                  <span className="font-medium">VAPID Key:</span>{" "}
                  {vapidKey ? `${vapidKey.substring(0, 20)}...` : "Not available"}
                </div>
              </>
            ) : (
              <div className="text-gray-500">Loading...</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold mb-3">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={requestPermission}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={permission === "granted"}
          >
            Request Permission
          </button>
          <button
            onClick={sendTestNotification}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            disabled={permission !== "granted"}
          >
            Send Test Notification
          </button>
          <button
            onClick={checkServiceWorker}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Check Service Worker
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold mb-3">Debug Log</h2>
        <div className="bg-gray-50 rounded border border-gray-200 p-3 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-sm">No logs yet...</p>
          ) : (
            <div className="space-y-1 font-mono text-xs">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={
                    log.includes("❌")
                      ? "text-red-600"
                      : log.includes("✅")
                      ? "text-green-600"
                      : log.includes("⚠️")
                      ? "text-yellow-600"
                      : "text-gray-700"
                  }
                >
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">What to Check:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Notification permission should be "granted"</li>
          <li>Service worker should be registered</li>
          <li>Firebase config should load from backend</li>
          <li>VAPID key should be ~87-88 characters</li>
          <li>FCM token should be obtained successfully</li>
          <li>Test notification should appear when sent</li>
        </ul>
      </div>
    </div>
  );
}
