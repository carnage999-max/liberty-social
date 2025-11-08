<div style="display:flex;align-items:center;justify-content:center;flex-direction:column;min-height:140px;">
	<h1 style="font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; font-weight:800; font-size:64px; margin:0; background: linear-gradient(90deg,#0B3D91 0%, #6C5CE7 45%, #FF4D4F 100%); -webkit-background-clip: text; background-clip: text; color: transparent;">Liberty Social</h1>
</div>

## Real-time & Push Notifications

The web app now listens for in-app events over WebSockets and can also opt browsers into Firebase Cloud Messaging push notifications.

1. **API + WebSocket endpoints**
   - `NEXT_PUBLIC_API_BASE_URL=https://<api-host>/api`
   - `NEXT_PUBLIC_WS_BASE_URL=wss://<api-host>`
2. **Firebase web credentials**
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)
   - `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Web Push certificate key from Firebase console)
3. Deploy `public/firebase-messaging-sw.js` with the site (App Router automatically serves it from `/firebase-messaging-sw.js`).
4. Browsers that grant permission will register their FCM token via `/api/device-tokens/` so the Celery worker (configured with `FIREBASE_PROJECT_ID` + `FIREBASE_CREDENTIALS_JSON`) can fan out FCM payloads. If the `NEXT_PUBLIC_FIREBASE_*` env vars are missing at build time, the client now fetches `/api/firebase-config/` at runtime, so keeping those values in the backend env is sufficient.
