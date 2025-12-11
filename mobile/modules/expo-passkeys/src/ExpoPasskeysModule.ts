// Fallback implementation for web
export default {
  isSupported(): boolean {
    // Check if WebAuthn is available
    return typeof navigator !== 'undefined' &&
           typeof navigator.credentials !== 'undefined' &&
           typeof navigator.credentials.create === 'function';
  },

  async create(options: any): Promise<any> {
    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported on this platform');
    }

    const credential = await navigator.credentials.create({
      publicKey: options.publicKey,
    }) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Failed to create credential');
    }

    // Convert ArrayBuffer to base64url
    const arrayBufferToBase64url = (buffer: ArrayBuffer): string => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const response = credential.response as AuthenticatorAttestationResponse;
    
    return {
      id: arrayBufferToBase64url(credential.rawId),
      rawId: arrayBufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
        attestationObject: arrayBufferToBase64url(response.attestationObject),
      },
    };
  },

  async get(options: any): Promise<any> {
    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported on this platform');
    }

    const credential = await navigator.credentials.get({
      publicKey: options.publicKey,
    }) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Failed to get credential');
    }

    // Convert ArrayBuffer to base64url
    const arrayBufferToBase64url = (buffer: ArrayBuffer): string => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const response = credential.response as AuthenticatorAssertionResponse;
    
    return {
      id: arrayBufferToBase64url(credential.rawId),
      rawId: arrayBufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
        authenticatorData: arrayBufferToBase64url(response.authenticatorData),
        signature: arrayBufferToBase64url(response.signature),
        userHandle: response.userHandle ? arrayBufferToBase64url(response.userHandle) : null,
      },
    };
  },
};

