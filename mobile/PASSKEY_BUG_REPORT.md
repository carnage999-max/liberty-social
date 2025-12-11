# Passkey Registration Bug Report

## Issue
When attempting to register a passkey on Android using `react-native-passkeys` v0.4.0, the following error occurs:

```
Call to function 'ReactNativePasskeys.create' has been rejected. 
--> Caused by: java.lang.illegalArgumentException: user.name must be defined in request.json
```

## Evidence
Our logs confirm that `user.name` is present at every step:

1. **Backend Response**: `user.name` is present in the raw backend response
2. **JavaScript Object**: `user.name` exists in the JavaScript object before calling `Passkeys.create()`
3. **JSON Serialization**: `user.name` survives JSON.stringify/parse round-trip
4. **Final Options**: `user.name` is present in the final options object passed to `Passkeys.create()`

## Code Structure
The options object we pass to `Passkeys.create()` has the following structure:

```typescript
{
  publicKey: {
    challenge: string,
    rp: { id: string, name: string },
    user: {
      id: string,
      name: string,  // ✅ Present and verified
      displayName: string
    },
    pubKeyCredParams: [...],
    authenticatorSelection: {...},
    excludeCredentials: [...]
  }
}
```

## Library Source Analysis
The library uses Expo's Record system (`@Field` annotations) to parse JSON. The `PublicKeyCredentialUserEntity` class in `PasskeyOptions.kt` defines:

```kotlin
class PublicKeyCredentialUserEntity: Record {
  @Field var name: String = ""
  @Field var displayName: String = ""
  @Field var id: String = ""
}
```

## Conclusion
This appears to be a bug in the library's native Android validation logic, which checks for `user.name` in the JSON string before Expo's Record system parses it. The validation may be failing due to:
- Incorrect JSON structure detection
- Timing issue with JSON serialization
- Bug in Expo's Record parsing for nested objects

## Workaround Attempts
We've tried:
1. ✅ Ensuring `user.name` is explicitly set as a string
2. ✅ Reconstructing the entire options object with explicit types
3. ✅ JSON round-trip to ensure serialization compatibility
4. ✅ Verifying the object structure matches WebAuthn spec

None of these workarounds resolved the issue.

## Recommendation
File an issue with the library maintainer at: https://github.com/peterferguson/react-native-passkeys/issues

Include:
- This bug report
- The logs showing `user.name` is present
- The exact error message
- Android version (Android 15)
- Library version (0.4.0)

