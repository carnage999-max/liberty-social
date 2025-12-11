import { NativeModulesProxy } from 'expo-modules-core';

// Import the native module. On web, it will use ExpoPasskeysModule.ts
// On native platforms, it will use the native module
const ExpoPasskeysModule = 
  NativeModulesProxy.ExpoPasskeys || 
  require('./ExpoPasskeysModule').default;

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
  return ExpoPasskeysModule?.isSupported() ?? false;
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

