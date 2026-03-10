declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: {
            isNotDisplayed?: () => boolean;
            isSkippedMoment?: () => boolean;
            isDismissedMoment?: () => boolean;
            getNotDisplayedReason?: () => string;
            getSkippedReason?: () => string;
            getDismissedReason?: () => string;
          }) => void) => void;
        };
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function getGoogleClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("Google sign-in is not configured.");
  }
  return clientId;
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser."));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script."));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export async function requestGoogleIdToken(): Promise<string> {
  const clientId = getGoogleClientId();
  await loadGoogleIdentityScript();

  if (!window.google?.accounts?.id) {
    throw new Error("Google sign-in is unavailable in this browser.");
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };
    const succeed = (credential: string) => {
      if (settled) return;
      settled = true;
      resolve(credential);
    };

    window.google?.accounts?.id?.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        if (response?.credential) {
          succeed(response.credential);
          return;
        }
        fail("Google sign-in did not return a credential.");
      },
    });

    window.google?.accounts?.id?.prompt((notification) => {
      if (settled) return;
      if (notification?.isNotDisplayed?.()) {
        const reason = notification.getNotDisplayedReason?.() || "not displayed";
        fail(`Google sign-in unavailable (${reason}).`);
      } else if (notification?.isSkippedMoment?.()) {
        const reason = notification.getSkippedReason?.() || "skipped";
        fail(`Google sign-in was skipped (${reason}).`);
      } else if (notification?.isDismissedMoment?.()) {
        const reason = notification.getDismissedReason?.() || "dismissed";
        fail(`Google sign-in was dismissed (${reason}).`);
      }
    });

    setTimeout(() => fail("Google sign-in timed out."), 60_000);
  });
}
