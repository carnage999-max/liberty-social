# Passkey Configuration Files

These files are required for passkey support in the mobile app.

## Files

1. **apple-app-site-association** - Required for iOS passkey support
2. **assetlinks.json** - Required for Android passkey support

## Setup Instructions

### iOS (apple-app-site-association)

1. **Get your Apple Team ID:**
   - Go to [Apple Developer Portal](https://developer.apple.com/account)
   - Your Team ID is shown in the top right corner (e.g., `ABC123DEF4`)

2. **Update the file:**
   - Open `frontend/public/.well-known/apple-app-site-association`
   - Replace `TEAM_ID` with your actual Apple Team ID
   - Example: `"apps": ["ABC123DEF4.com.libertysocial.app"]`

3. **Verify the file is accessible:**
   - After deploying, check: `https://mylibertysocial.com/.well-known/apple-app-site-association`
   - It should return JSON with `Content-Type: application/json`
   - The file should NOT have a `.json` extension

### Android (assetlinks.json)

1. **Get your app's SHA256 certificate fingerprints:**
   - **The fingerprint changes for different build types!** You need to add ALL fingerprints you use:
     - Debug/Development builds
     - Production builds
     - Preview builds
   - See `GET_FINGERPRINTS.md` for detailed instructions on how to get fingerprints
   - **Quick method for EAS Build:** Check the build output after running `eas build --platform android`
   - **From APK:** `keytool -printcert -jarfile app.apk | grep SHA256`
   - **From keystore:** `keytool -list -v -keystore keystore.jks -alias alias | grep SHA256`

2. **Update the file:**
   - Open `frontend/public/.well-known/assetlinks.json`
   - Replace `DEBUG_FINGERPRINT_HERE` with your debug/development fingerprint
   - Replace `PRODUCTION_FINGERPRINT_HERE` with your production fingerprint
   - Add more fingerprints to the array if you have additional build types
   - **Format:** Remove colons and spaces, use uppercase (e.g., `AABBCCDDEEFF...`)

3. **Verify the file is accessible:**
   - After deploying, check: `https://mylibertysocial.com/.well-known/assetlinks.json`
   - It should return valid JSON

## Testing

After updating and deploying:

- **iOS:** Test passkey registration on an iOS device (iOS 15+)
- **Android:** Test passkey registration on an Android device (Android 9+)

## Notes

- Both files must be served over HTTPS
- The files must be accessible without authentication
- Next.js serves files from `public/` at the root, so these files will be at:
  - `/.well-known/apple-app-site-association`
  - `/.well-known/assetlinks.json`

