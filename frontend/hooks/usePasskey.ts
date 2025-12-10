"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export type PasskeyCredential = {
  id: string; // UUID of the PasskeyCredential model
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type PasskeyStatus = {
  has_passkey: boolean;
  credentials: PasskeyCredential[];
};

// Convert base64url to ArrayBuffer
function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4 ? "=".repeat(4 - (base64.length % 4)) : "";
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert ArrayBuffer to base64url
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function usePasskey() {
  const { accessToken } = useAuth();
  const [status, setStatus] = useState<PasskeyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch passkey status
  const fetchStatus = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<PasskeyStatus>("/auth/passkey/status/", {
        token: accessToken,
      });
      setStatus(data);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch passkey status");
      console.error("Error fetching passkey status:", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      fetchStatus();
    }
  }, [accessToken, fetchStatus]);

  // Register a new passkey
  const register = useCallback(async (deviceName?: string) => {
    if (!accessToken) {
      throw new Error("You must be logged in to register a passkey");
    }

    try {
      setLoading(true);
      setError(null);

      // Step 1: Get registration options from backend
      const optionsResponse = await apiPost<{
        options: any; // The backend returns the inner publicKey options
        challenge: string;
      }>("/auth/passkey/register/begin/", {}, { token: accessToken });

      // The backend returns the inner options, we need to wrap them in publicKey
      const publicKeyOptions = optionsResponse.options;
      if (!publicKeyOptions) {
        throw new Error("Invalid registration options");
      }

      // Convert challenge and user ID from base64url to ArrayBuffer
      publicKeyOptions.challenge = base64urlToArrayBuffer(optionsResponse.challenge);
      if (publicKeyOptions.user?.id) {
        publicKeyOptions.user.id = base64urlToArrayBuffer(
          publicKeyOptions.user.id as unknown as string
        );
      }

      // Convert excludeCredentials if present
      if (publicKeyOptions.excludeCredentials) {
        publicKeyOptions.excludeCredentials = publicKeyOptions.excludeCredentials.map((cred: any) => ({
          ...cred,
          id: base64urlToArrayBuffer(cred.id as unknown as string),
        }));
      }

      // Step 2: Create credential using WebAuthn API
      const credential = (await navigator.credentials.create({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error("Failed to create passkey");
      }

      const response = credential.response as AuthenticatorAttestationResponse;
      if (!response) {
        throw new Error("Invalid credential response");
      }

      // Step 3: Convert response to format expected by backend
      const clientDataJSON = arrayBufferToBase64url(response.clientDataJSON);
      const attestationObject = arrayBufferToBase64url(response.attestationObject);

      const credentialId = arrayBufferToBase64url(credential.rawId);

      // Step 4: Send credential to backend for verification
      await apiPost(
        "/auth/passkey/register/complete/",
        {
          credential: {
            id: credentialId,
            rawId: credentialId,
            type: "public-key",
            response: {
              clientDataJSON,
              attestationObject,
            },
          },
          challenge: optionsResponse.challenge,
          device_name: deviceName || getDeviceName(),
        },
        { token: accessToken }
      );

      // Refresh status
      await fetchStatus();
    } catch (err: any) {
      const errorMessage =
        err?.message || "Failed to register passkey. Please try again.";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [accessToken, fetchStatus]);

  // Authenticate with passkey
  const authenticate = useCallback(async (): Promise<{
    access_token: string;
    refresh_token: string;
    user_id: string;
  }> => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Get authentication options from backend
      const optionsResponse = await apiPost<{
        options: any; // The backend returns the inner publicKey options
        challenge: string;
      }>("/auth/passkey/authenticate/begin/", {});

      // The backend returns the inner options, we need to wrap them in publicKey
      const publicKeyOptions = optionsResponse.options;
      if (!publicKeyOptions) {
        throw new Error("Invalid authentication options");
      }

      // Convert challenge from base64url to ArrayBuffer
      publicKeyOptions.challenge = base64urlToArrayBuffer(optionsResponse.challenge);

      // Convert allowCredentials if present
      if (publicKeyOptions.allowCredentials) {
        publicKeyOptions.allowCredentials = publicKeyOptions.allowCredentials.map((cred: any) => ({
          ...cred,
          id: base64urlToArrayBuffer(cred.id as unknown as string),
        }));
      }

      // Step 2: Get credential using WebAuthn API
      const credential = (await navigator.credentials.get({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error("Failed to authenticate with passkey");
      }

      const response = credential.response as AuthenticatorAssertionResponse;
      if (!response) {
        throw new Error("Invalid credential response");
      }

      // Step 3: Convert response to format expected by backend
      const clientDataJSON = arrayBufferToBase64url(response.clientDataJSON);
      const authenticatorData = arrayBufferToBase64url(response.authenticatorData);
      const signature = arrayBufferToBase64url(response.signature);
      const userHandle = response.userHandle
        ? arrayBufferToBase64url(response.userHandle)
        : null;

      const credentialId = arrayBufferToBase64url(credential.rawId);

      // Step 4: Send credential to backend for verification
      const tokens = await apiPost<{
        access_token: string;
        refresh_token: string;
        user_id?: string;
      }>(
        "/auth/passkey/authenticate/complete/",
        {
          credential: {
            id: credentialId,
            rawId: credentialId,
            type: "public-key",
            response: {
              clientDataJSON,
              authenticatorData,
              signature,
              userHandle,
            },
          },
          challenge: optionsResponse.challenge,
        }
      );

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user_id: tokens.user_id || "",
      };
    } catch (err: any) {
      const errorMessage =
        err?.message || "Failed to authenticate with passkey. Please try again.";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Remove a passkey
  const remove = useCallback(
    async (credentialId: string) => {
      if (!accessToken) {
        throw new Error("You must be logged in to remove a passkey");
      }

      try {
        setLoading(true);
        setError(null);
        await apiDelete(`/auth/passkey/remove/${credentialId}/`, {
          token: accessToken,
        });
        await fetchStatus();
      } catch (err: any) {
        const errorMessage =
          err?.message || "Failed to remove passkey. Please try again.";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [accessToken, fetchStatus]
  );

  return {
    status,
    loading,
    error,
    register,
    authenticate,
    remove,
    refetch: fetchStatus,
  };
}

// Helper function to get device name
function getDeviceName(): string {
  if (typeof navigator === "undefined") return "Unknown Device";
  
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  
  // Try to detect device type
  if (/iPhone|iPad|iPod/.test(ua)) {
    return "iOS Device";
  }
  if (/Android/.test(ua)) {
    return "Android Device";
  }
  if (/Mac/.test(platform)) {
    return "Mac";
  }
  if (/Win/.test(platform)) {
    return "Windows PC";
  }
  if (/Linux/.test(platform)) {
    return "Linux PC";
  }
  
  return "Unknown Device";
}

