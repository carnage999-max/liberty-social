import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../utils/api';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../contexts/AuthContext';
import * as Passkeys from 'react-native-passkeys';

export type PasskeyCredential = {
  id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type PasskeyStatus = {
  has_passkey: boolean;
  credentials: PasskeyCredential[];
};

// Check if WebAuthn is available using react-native-passkeys
function isWebAuthnAvailable(): boolean {
  try {
    // react-native-passkeys provides isSupported() method
    if (Passkeys && typeof Passkeys.isSupported === 'function') {
      return Passkeys.isSupported();
    }
    // Fallback: check if create and get methods exist
    if (Passkeys && typeof Passkeys.create === 'function' && typeof Passkeys.get === 'function') {
      return true;
    }
  } catch (error) {
    console.warn('Error checking WebAuthn support:', error);
  }
  
  // For native platforms, assume available if library is installed
  // The library will handle platform-specific checks
  return Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web';
}

// Convert base64url to ArrayBuffer
function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : '';
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
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Get device name
function getDeviceName(): string {
  if (Platform.OS === 'ios') {
    return 'iOS Device';
  } else if (Platform.OS === 'android') {
    return 'Android Device';
  }
  return 'Mobile Device';
}

export function usePasskey() {
  const { isAuthenticated, accessToken } = useAuth();
  const [status, setStatus] = useState<PasskeyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    setIsAvailable(isWebAuthnAvailable());
  }, []);

  // Fetch passkey status
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<PasskeyStatus>('/auth/passkey/status/');
      setStatus(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch passkey status');
      console.error('Error fetching passkey status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch status if user is authenticated and WebAuthn is available
    if (isAvailable && isAuthenticated && accessToken) {
      fetchStatus();
    }
  }, [isAvailable, isAuthenticated, accessToken, fetchStatus]);

  // Register a new passkey
  const register = useCallback(async (deviceName?: string) => {
    if (!isAvailable) {
      throw new Error('WebAuthn is not available on this device');
    }

    if (!isAuthenticated || !accessToken) {
      throw new Error('You must be logged in to register a passkey');
    }

    try {
      setLoading(true);
      setError(null);

      // Step 1: Get registration options from backend (requires authentication)
      const optionsResponse = await apiClient.post<{
        options: any;
        challenge: string;
      }>('/auth/passkey/register/begin/', {});

      const publicKeyOptions = optionsResponse.options;
      if (!publicKeyOptions) {
        throw new Error('Invalid registration options');
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
        publicKeyOptions.excludeCredentials = publicKeyOptions.excludeCredentials.map(
          (cred: any) => ({
            ...cred,
            id: base64urlToArrayBuffer(cred.id),
          })
        );
      }

      // Step 2: Create credential using react-native-passkeys
      if (!Passkeys || typeof Passkeys.create !== 'function') {
        throw new Error(
          'react-native-passkeys library is not available. ' +
          'Please ensure react-native-passkeys is installed and properly configured.'
        );
      }

      // react-native-passkeys provides create method that handles base64url conversion automatically
      // It accepts the same options as navigator.credentials.create but handles conversions
      const credential = await Passkeys.create({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create passkey');
      }

      // Step 3: Convert credential to base64url for backend
      const credentialId = arrayBufferToBase64url(credential.rawId);
      const response = credential.response as AuthenticatorAttestationResponse;
      const clientDataJSON = arrayBufferToBase64url(response.clientDataJSON);
      const attestationObject = arrayBufferToBase64url(response.attestationObject);

      // Get device info
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
      };

      // Step 4: Send credential to backend
      await apiClient.post('/auth/passkey/register/complete/', {
        credential: {
          id: credentialId,
          rawId: credentialId,
          type: 'public-key',
          response: {
            clientDataJSON: clientDataJSON,
            attestationObject: attestationObject,
          },
        },
        challenge: optionsResponse.challenge,
        device_name: deviceName || getDeviceName(),
        device_info: deviceInfo,
      });

      // Refresh status
      await fetchStatus();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to register passkey';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isAvailable, fetchStatus]);

  // Authenticate with passkey
  const authenticate = useCallback(async () => {
    if (!isAvailable) {
      throw new Error('WebAuthn is not available on this device');
    }

    try {
      setLoading(true);
      setError(null);

      // Step 1: Get authentication options from backend
      const optionsResponse = await apiClient.post<{
        options: any;
        challenge: string;
      }>('/auth/passkey/authenticate/begin/');

      const publicKeyOptions = optionsResponse.options;
      if (!publicKeyOptions) {
        throw new Error('Invalid authentication options');
      }

      // Convert challenge from base64url to ArrayBuffer
      publicKeyOptions.challenge = base64urlToArrayBuffer(optionsResponse.challenge);

      // Convert allowCredentials if present
      if (publicKeyOptions.allowCredentials) {
        publicKeyOptions.allowCredentials = publicKeyOptions.allowCredentials.map(
          (cred: any) => ({
            ...cred,
            id: base64urlToArrayBuffer(cred.id),
          })
        );
      }

      // Step 2: Get credential using react-native-passkeys
      if (!Passkeys || typeof Passkeys.get !== 'function') {
        throw new Error(
          'react-native-passkeys library is not available. ' +
          'Please ensure react-native-passkeys is installed and properly configured.'
        );
      }

      // react-native-passkeys provides get method that handles base64url conversion automatically
      const credential = await Passkeys.get({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to authenticate with passkey');
      }

      // Step 3: Convert credential to base64url for backend
      const credentialId = arrayBufferToBase64url(credential.rawId);
      const response = credential.response as AuthenticatorAssertionResponse;
      const clientDataJSON = arrayBufferToBase64url(response.clientDataJSON);
      const authenticatorData = arrayBufferToBase64url(response.authenticatorData);
      const signature = arrayBufferToBase64url(response.signature);
      const userHandle = response.userHandle
        ? arrayBufferToBase64url(response.userHandle)
        : null;

      // Get device info
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
      };

      // Step 4: Send credential to backend and get tokens
      const result = await apiClient.post<{
        access_token: string;
        refresh_token: string;
        user_id: string;
      }>('/auth/passkey/authenticate/complete/', {
        credential: {
          id: credentialId,
          rawId: credentialId,
          type: 'public-key',
          response: {
            clientDataJSON: clientDataJSON,
            authenticatorData: authenticatorData,
            signature: signature,
            userHandle: userHandle,
          },
        },
        challenge: optionsResponse.challenge,
        device_info: deviceInfo,
      });

      return {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        user_id: result.user_id || '',
      };
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to authenticate with passkey';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isAvailable, fetchStatus]);

  // Remove a passkey
  const removePasskey = useCallback(async (credentialId: string) => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.delete(`/auth/passkey/remove/${credentialId}/`);
      await fetchStatus();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to remove passkey';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    isAvailable,
    fetchStatus,
    register,
    authenticate,
    removePasskey,
  };
}

