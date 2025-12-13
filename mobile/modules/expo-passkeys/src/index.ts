import { requireNativeModule, Platform } from 'expo-modules-core';

// Import the native module. On web, it will use ExpoPasskeysModule.ts
// On native platforms, it will use the native module
let ExpoPasskeysModule: any;

if (Platform.OS === 'web') {
  ExpoPasskeysModule = require('./ExpoPasskeysModule').default;
} else {
  // On native platforms, try to get the native module using requireNativeModule
  try {
    console.log('[Passkeys] Attempting to load native module using requireNativeModule...');
    ExpoPasskeysModule = requireNativeModule('ExpoPasskeys');
    console.log('[Passkeys] Native module ExpoPasskeys loaded successfully');
    console.log('[Passkeys] Module methods:', Object.keys(ExpoPasskeysModule || {}));
  } catch (error) {
    console.warn('[Passkeys] Failed to load native module:', error);
    console.warn('[Passkeys] Falling back to web implementation (will throw error on native)');
    ExpoPasskeysModule = require('./ExpoPasskeysModule').default;
  }
}

export interface PublicKeyCredentialCreationOptions {
  challenge: string;
  rp: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: string;
    alg: number;
  }>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    requireResidentKey?: boolean;
    residentKey?: 'required' | 'preferred' | 'discouraged';
    userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  excludeCredentials?: Array<{
    id: string;
    type: string;
    transports?: string[];
  }>;
  timeout?: number;
  attestation?: 'none' | 'indirect' | 'direct';
}

export interface PublicKeyCredentialRequestOptions {
  challenge: string;
  rpId: string;
  allowCredentials?: Array<{
    id: string;
    type: string;
    transports?: string[];
  }>;
  timeout?: number;
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

export interface PublicKeyCredential {
  id: string;
  rawId: string;
  type: string;
  response: {
    clientDataJSON: string;
    attestationObject?: string;
    authenticatorData?: string;
    signature?: string;
    userHandle?: string | null;
  };
}

export function isSupported(): boolean {
  if (!ExpoPasskeysModule) {
    console.warn('[Passkeys] ExpoPasskeysModule is null/undefined');
    return false;
  }
  if (typeof ExpoPasskeysModule.isSupported !== 'function') {
    console.warn('[Passkeys] ExpoPasskeysModule.isSupported is not a function');
    return false;
  }
  const result = ExpoPasskeysModule.isSupported();
  console.log('[Passkeys] ExpoPasskeysModule.isSupported() returned:', result);
  return result;
}

export async function create(
  options: PublicKeyCredentialCreationOptions
): Promise<PublicKeyCredential> {
  if (!ExpoPasskeysModule) {
    throw new Error('ExpoPasskeys module is not available');
  }

  return await ExpoPasskeysModule.create({
    publicKey: options,
  });
}

export async function get(
  options: PublicKeyCredentialRequestOptions
): Promise<PublicKeyCredential> {
  if (!ExpoPasskeysModule) {
    throw new Error('ExpoPasskeys module is not available');
  }

  return await ExpoPasskeysModule.get({
    publicKey: options,
  });
}

export default {
  isSupported,
  create,
  get,
};

