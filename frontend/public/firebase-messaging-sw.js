importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js");

const swUrl = new URL(self.location);
const firebaseConfig = {};
for (const [key, value] of swUrl.searchParams.entries()) {
  firebaseConfig[key] = value;
}

let firebaseReady = false;

if (!firebaseConfig.messagingSenderId) {
  console.warn("[push-sw] Missing Firebase config. Push disabled.");
} else {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    firebaseReady = true;
  } catch (err) {
    console.error("[push-sw] Failed to initialise Firebase app", err);
  }
}

let messaging = null;
if (firebaseReady) {
  if (
    firebase.messaging &&
    typeof firebase.messaging.isSupported === "function" &&
    firebase.messaging.isSupported()
  ) {
    try {
      messaging = firebase.messaging();
    } catch (err) {
      console.warn("[push-sw] Unable to start Firebase messaging", err);
    }
  }
}

function extractNotification(payload) {
  const notification = payload?.notification || {};
  const dataNotification = payload?.data?.notification;
  let parsedData = dataNotification;

  if (typeof dataNotification === "string") {
    try {
      parsedData = JSON.parse(dataNotification);
    } catch {
      // ignore JSON errors
    }
  }

  return {
    title:
      notification.title ||
      parsedData?.title ||
      parsedData?.verb ||
      "Liberty Social",
    body:
      notification.body ||
      parsedData?.body ||
      "You have a new notification on Liberty Social.",
    data: payload?.data || {},
  };
}

function broadcastToClients(message) {
  self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage(message);
      });
    });
}

function showNotification(notification) {
  const options = {
    body: notification.body,
    icon: "/icon.png",
    data: {
      url:
        notification.data?.url ||
        notification.data?.target_url ||
        "/app/notifications",
      raw: notification.data,
    },
  };
  self.registration.showNotification(notification.title, options);
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const notification = extractNotification(payload);
    showNotification(notification);
    broadcastToClients({
      type: "notification.push",
      payload: notification,
    });
  });
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const data = event.data?.json();
        const notification = extractNotification(data || {});
        showNotification(notification);
        broadcastToClients({
          type: "notification.push",
          payload: notification,
        });
      } catch (err) {
        console.warn("[push-sw] Failed to handle generic push event", err);
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    event.notification?.data?.url || "/app/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
