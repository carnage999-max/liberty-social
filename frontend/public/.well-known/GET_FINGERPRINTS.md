# How to Get Android SHA256 Fingerprints

The SHA256 fingerprint changes depending on the build type (debug vs production). You need to add **all fingerprints** that your app uses to the `assetlinks.json` file.

## Method 1: From EAS Build (Recommended)

If you're using EAS Build, you can get the fingerprint from the build output:

1. **Build your app with EAS:**
   ```bash
   cd mobile
   eas build --platform android --profile production
   ```

2. **After the build completes**, EAS will show you the SHA256 fingerprint in the build logs/output.

3. **For development builds**, run:
   ```bash
   eas build --platform android --profile development
   ```

## Method 2: From an APK/AAB File

If you already have a built APK or AAB file:

### For APK:
```bash
# Extract the certificate
keytool -printcert -jarfile your-app.apk

# Look for "SHA256:" in the output
```

### For AAB (App Bundle):
```bash
# First, extract the AAB (it's a zip file)
unzip your-app.aab

# Then extract the certificate from the signing block
# This is more complex - use Method 3 or 4 instead
```

## Method 3: From Keystore File

If you have the keystore file used to sign the app:

```bash
keytool -list -v -keystore your-keystore.jks -alias your-alias

# Look for "SHA256:" in the Certificate fingerprints section
```

**For EAS Build:**
- EAS manages the keystore for you
- You can download it from EAS if needed, or use Method 1

## Method 4: From Installed App (Development)

If you have the app installed on a device:

```bash
# Connect your device via USB
adb shell pm list packages | grep libertysocial

# Get the package path
adb shell pm path com.libertysocial.app

# Pull the APK
adb pull /data/app/com.libertysocial.app-*/base.apk

# Extract certificate
keytool -printcert -jarfile base.apk
```

## Method 5: Using Android Studio

1. Open your project in Android Studio
2. Go to **Build > Generate Signed Bundle / APK**
3. Select your keystore
4. The fingerprint will be shown in the signing configuration

## Important Notes

1. **Multiple Fingerprints**: You can (and should) add multiple fingerprints to support:
   - Debug builds (development)
   - Production builds (release)
   - Different build profiles (preview, production, etc.)

2. **Format**: The fingerprint should be in uppercase, with colons removed:
   ```
   SHA256: AA:BB:CC:DD:EE:FF:...
   ```
   Becomes:
   ```
   AABBCCDDEEFF...
   ```

3. **EAS Build**: If you're using EAS Build, the fingerprint might be different for each build profile. Check each profile's build output.

## Quick Command Reference

```bash
# Get fingerprint from APK
keytool -printcert -jarfile app.apk | grep SHA256

# Get fingerprint from keystore
keytool -list -v -keystore keystore.jks -alias alias | grep SHA256

# Format: Remove colons and spaces, convert to uppercase
# Example: SHA256: AA:BB:CC becomes AABBCC
```

## After Getting Fingerprints

1. Open `frontend/public/.well-known/assetlinks.json`
2. Replace `DEBUG_FINGERPRINT_HERE` with your debug/development fingerprint
3. Replace `PRODUCTION_FINGERPRINT_HERE` with your production fingerprint
4. Add more fingerprints to the array if you have additional build types
5. Deploy the updated file

## Testing

After updating and deploying, test with:
- Development build
- Production build
- Any other build profiles you use

All should work with passkeys if their fingerprints are in the `assetlinks.json` file.

