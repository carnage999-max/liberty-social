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

export class GoogleSignInError extends Error {
  code: "cancelled" | "config" | "unavailable" | "failed";

  constructor(message: string, code: GoogleSignInError["code"]) {
    super(message);
    this.name = "GoogleSignInError";
    this.code = code;
  }
}

let googleScriptPromise: Promise<void> | null = null;

function getGoogleClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new GoogleSignInError("Google sign-in is not configured.", "config");
  }
  return clientId;
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new GoogleSignInError("Google sign-in is only available in the browser.", "unavailable")
    );
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new GoogleSignInError("Failed to load Google script.", "unavailable")),
        {
          once: true,
        }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new GoogleSignInError("Failed to load Google script.", "unavailable"));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export async function requestGoogleIdToken(): Promise<string> {
  const clientId = getGoogleClientId();
  await loadGoogleIdentityScript();

  if (!window.google?.accounts?.id) {
    throw new GoogleSignInError("Google sign-in is unavailable in this browser.", "unavailable");
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new GoogleSignInError(message, "failed"));
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
        reject(new GoogleSignInError("Google sign-in did not return a credential.", "failed"));
      },
    });

    window.google?.accounts?.id?.prompt((notification) => {
      if (settled) return;
      if (notification?.isNotDisplayed?.()) {
        const reason = notification.getNotDisplayedReason?.() || "not displayed";
        reject(
          new GoogleSignInError(`Google sign-in unavailable (${reason}).`, "unavailable")
        );
      } else if (notification?.isSkippedMoment?.()) {
        settled = true;
        reject(new GoogleSignInError("Google sign-in cancelled.", "cancelled"));
      } else if (notification?.isDismissedMoment?.()) {
        settled = true;
        reject(new GoogleSignInError("Google sign-in cancelled.", "cancelled"));
      }
    });

    setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new GoogleSignInError("Google sign-in timed out.", "cancelled"));
    }, 60_000);
  });
}
