import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../utils/api';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../contexts/AuthContext';
import * as Passkeys from '../modules/expo-passkeys/src/index';

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

      // Log what backend returns for debugging
      console.log('Backend options response:', JSON.stringify({
        hasUser: !!publicKeyOptions.user,
        userKeys: publicKeyOptions.user ? Object.keys(publicKeyOptions.user) : [],
        user: publicKeyOptions.user,
      }, null, 2));

      // Ensure user object exists with required fields
      if (!publicKeyOptions.user) {
        throw new Error('Invalid registration options: user object is missing');
      }

      // react-native-passkeys expects JSON-serializable data (base64url strings, not ArrayBuffers)
      // The library handles ArrayBuffer conversion internally
      // So we need to keep everything as strings/base64url, not convert to ArrayBuffer
      
      // Try passing the raw backend response with minimal modifications
      // Only update challenge to use the one from response
      publicKeyOptions.challenge = optionsResponse.challenge;
      
      // Verify user.name exists in the raw response
      if (!publicKeyOptions.user.name) {
        console.error('ERROR: user.name missing in raw backend response!', publicKeyOptions.user);
        throw new Error('Backend did not return user.name');
      }
      
      console.log('Using raw backend response - user.name:', publicKeyOptions.user.name);
      console.log('Raw user.name type:', typeof publicKeyOptions.user.name);

      // Keep excludeCredentials as base64url strings (not ArrayBuffers)
      // react-native-passkeys will handle the conversion
      if (publicKeyOptions.excludeCredentials) {
        // Keep them as-is (base64url strings)
        publicKeyOptions.excludeCredentials = publicKeyOptions.excludeCredentials.map(
          (cred: any) => ({
            ...cred,
            id: cred.id, // Keep as base64url string
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

      // Manually serialize to JSON and parse back to see what the library will receive
      // This helps debug if user.name is lost during serialization
      console.log('Before JSON serialization - user.name:', publicKeyOptions.user.name);
      
      const jsonString = JSON.stringify(publicKeyOptions);
      const hasNameInJson = jsonString.includes('"name"') && jsonString.includes(publicKeyOptions.user.name);
      console.log('JSON string contains user.name:', hasNameInJson);
      
      // Extract just the user part from JSON to verify
      const userMatch = jsonString.match(/"user":\s*\{[^}]*"name"[^}]*\}/);
      if (userMatch) {
        console.log('User object in JSON:', userMatch[0].substring(0, 150));
      }
      
      const parsedOptions = JSON.parse(jsonString);
      
      // Verify user.name still exists after JSON round-trip
      if (!parsedOptions.user || !parsedOptions.user.name) {
        console.error('ERROR: user.name lost during JSON serialization!');
        console.error('Parsed user object:', parsedOptions.user);
        throw new Error('user.name was lost during JSON serialization');
      }
      
      console.log('After JSON round-trip - user.name:', parsedOptions.user.name);
      
      // The library might be checking for user.name in a specific way
      // Try ensuring the user object is at the top level of publicKey, not nested
      // Also ensure all fields are explicitly set as strings
      const finalOptions = {
        challenge: String(parsedOptions.challenge),
        rp: {
          id: String(parsedOptions.rp?.id || ''),
          name: String(parsedOptions.rp?.name || ''),
        },
        user: {
          id: String(parsedOptions.user.id),
          name: String(parsedOptions.user.name), // Explicitly ensure it's a string
          displayName: String(parsedOptions.user.displayName),
        },
        pubKeyCredParams: parsedOptions.pubKeyCredParams || [],
        authenticatorSelection: parsedOptions.authenticatorSelection || {},
      };

      // Add optional fields
      if (parsedOptions.timeout) finalOptions.timeout = parsedOptions.timeout;
      if (parsedOptions.attestation) finalOptions.attestation = parsedOptions.attestation;
      if (parsedOptions.excludeCredentials) {
        finalOptions.excludeCredentials = parsedOptions.excludeCredentials;
      }

      // Final verification
      if (!finalOptions.user.name) {
        throw new Error('user.name is missing in finalOptions');
      }

      console.log('Final options user.name:', finalOptions.user.name);
      console.log('Final options structure:', JSON.stringify({
        hasUser: !!finalOptions.user,
        userName: finalOptions.user.name,
        userKeys: Object.keys(finalOptions.user),
      }));

      // Our custom module returns base64url strings directly
      const credential = await Passkeys.create(finalOptions);

      if (!credential) {
        throw new Error('Failed to create passkey');
      }

      // Step 3: Extract credential data (already in base64url format)
      const credentialId = credential.id;
      const clientDataJSON = credential.response.clientDataJSON;
      const attestationObject = credential.response.attestationObject;

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

      // react-native-passkeys expects JSON-serializable data (base64url strings, not ArrayBuffers)
      // Keep challenge as base64url string
      publicKeyOptions.challenge = optionsResponse.challenge;

      // Keep allowCredentials as base64url strings (not ArrayBuffers)
      // react-native-passkeys will handle the conversion
      if (publicKeyOptions.allowCredentials) {
        publicKeyOptions.allowCredentials = publicKeyOptions.allowCredentials.map(
          (cred: any) => ({
            ...cred,
            id: cred.id, // Keep as base64url string
          })
        );
      }

      // Step 2: Get credential using our custom module
      if (!Passkeys || typeof Passkeys.get !== 'function') {
        throw new Error(
          'ExpoPasskeys module is not available. ' +
          'Please ensure the module is properly configured.'
        );
      }

      // Our custom module returns base64url strings directly
      const credential = await Passkeys.get(publicKeyOptions);

      if (!credential) {
        throw new Error('Failed to authenticate with passkey');
      }

      // Step 3: Extract credential data (already in base64url format)
      const credentialId = credential.id;
      const clientDataJSON = credential.response.clientDataJSON;
      const authenticatorData = credential.response.authenticatorData;
      const signature = credential.response.signature;
      const userHandle = credential.response.userHandle || null;

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

