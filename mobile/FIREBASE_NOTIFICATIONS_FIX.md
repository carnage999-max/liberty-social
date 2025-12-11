# Firebase Push Notifications Fix

## Problem
Getting error: "Default FirebaseApp is not initialized in this process com.libertysocial.app. Make sure to call FirebaseApp.initializeApp(Context) first."

## Root Cause
Firebase needs to be initialized before `expo-notifications` tries to get a push token. The `google-services` plugin should auto-initialize Firebase, but there may be a timing issue.

## Solution Implemented

### 1. Explicit Firebase Initialization
Updated `MainApplication.kt` to:
- Check if Firebase is already initialized
- Load FirebaseOptions from `google-services.json` using `FirebaseOptions.fromResource()`
- Initialize Firebase with explicit options
- Add comprehensive error logging

### 2. Added Firebase Dependencies
Added explicit Firebase dependencies to `android/app/build.gradle`:
```gradle
implementation platform('com.google.firebase:firebase-bom:32.7.0')
implementation 'com.google.firebase:firebase-messaging'
implementation 'com.google.firebase:firebase-analytics'
```

### 3. Added Delay in Token Request
Added a 500ms delay before requesting push token to ensure Firebase is fully initialized.

## Testing

After rebuilding, check the logs for:
- "FirebaseApp initialized successfully with options from google-services.json"
- "FirebaseApp initialization verified - default instance exists"
- "Expo push token obtained successfully"

If you still see errors, check:
1. `google-services.json` is present in `mobile/android/app/`
2. Google Services plugin is applied (check build logs)
3. Firebase dependencies are included in the build

## Next Steps

1. Rebuild the app:
   ```bash
   cd mobile
   npx expo prebuild --clean
   eas build --platform android --profile development
   ```

2. Check logs for Firebase initialization messages

3. If still failing, the issue might be that `expo-notifications` needs Firebase to be initialized differently, or there's a version compatibility issue.

