# Register Current Keystore as Upload Key

You don't have the keystore for the certificate Google expects. Here's how to fix it:

## Option 1: Register Current release.keystore as New Upload Key (FASTEST)

### Step 1: Go to Google Play Console
1. Visit: https://play.google.com/console
2. Select "Liberty Social" app
3. Go to: **Release > Setup > App integrity > App signing**

### Step 2: Register New Upload Key
Look for one of these options:
- **"Request upload key reset"** button
- **"Update upload key"** option
- **"Register new upload certificate"** link

### Step 3: Upload Certificate
Use this file: `/home/binary/Desktop/liberty-social/mobile/android/app/release_cert.pem`

The certificate has been exported from your current release.keystore:
- SHA1: 57:99:15:1B:E8:F9:B3:5C:84:FD:41:B3:DD:8C:17:51:41:54:72:B1

### Step 4: Once Registered
After Google accepts the new upload key, rebuild the AAB:
```bash
cd /home/binary/Desktop/liberty-social/mobile/android
./gradlew clean bundleRelease
```

The AAB will be at:
```
/home/binary/Desktop/liberty-social/mobile/android/app/build/outputs/bundle/release/app-release.aab
```

---

## Option 2: Request Upload Key Reset (If Option 1 Not Available)

If you can't find an option to register a new upload key, request a reset:

1. In App Signing page, click **"Request upload key reset"**
2. Follow verification prompts
3. Wait for approval (2-7 days)
4. Once approved, use current release.keystore

---

## Current Status

✅ **Version**: 1.0.2 (versionCode: 3)
✅ **Keystore**: release.keystore exists at `/home/binary/Desktop/liberty-social/mobile/android/app/`
✅ **Certificate**: Exported to `release_cert.pem`
❌ **Issue**: Google expects different upload key
🔧 **Solution**: Register current keystore as new upload key

---

## What to Look For in Play Console

In the **App Signing** page, you should see:
- **App signing key certificate** (managed by Google)
- **Upload key certificate** (yours - needs to be updated)

You need to update the "Upload key certificate" to match your current release.keystore.
