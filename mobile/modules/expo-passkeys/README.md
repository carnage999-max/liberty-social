# Expo Passkeys Module

Custom Expo module for WebAuthn passkeys implementation.

## Features

- ✅ Android support using Credential Manager API
- ✅ iOS support using `AuthenticationServices`
- ✅ Web support using native WebAuthn API
- ✅ Full WebAuthn specification compliance

## Installation

This is a local module. It's already included in the project.

## Usage

```typescript
import * as Passkeys from '../modules/expo-passkeys/src';

// Check if passkeys are supported
const isSupported = Passkeys.isSupported();

// Register a passkey
const credential = await Passkeys.create({
  challenge: 'base64url-challenge',
  rp: {
    id: 'example.com',
    name: 'Example App'
  },
  user: {
    id: 'base64url-user-id',
    name: 'user@example.com',
    displayName: 'User Name'
  },
  pubKeyCredParams: [
    { type: 'public-key', alg: -7 }
  ]
});

// Authenticate with passkey
const authCredential = await Passkeys.get({
  challenge: 'base64url-challenge',
  rpId: 'example.com'
});
```

## Android Requirements

- Minimum SDK: 23
- Target SDK: 34
- Requires Credential Manager API (Android 6.0+)

## iOS Requirements

- Minimum iOS: 15.1
- Requires associated domains configuration
- Requires the App ID capability `Associated Domains`
- Requires an `apple-app-site-association` file for your RP ID domain

## Production Notes

- Use the registrable domain as the RP ID, for example `mylibertysocial.com`
- The iOS app must declare `webcredentials:<rp-id>` in associated domains
- The backend should verify the same RP ID for both website and native app requests
