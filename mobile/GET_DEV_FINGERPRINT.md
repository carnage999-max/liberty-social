# Quick Guide: Get SHA256 Fingerprint from EAS Development Build

## Step 1: Build Your Development App

```bash
cd mobile
eas build --platform android --profile development
```

## Step 2: Find the SHA256 Fingerprint

After the build completes, EAS will show you the build details. Look for:

1. **In the build output/terminal:**
   - Search for "SHA256" or "fingerprint"
   - It will look like: `SHA256: AA:BB:CC:DD:EE:FF:...`

2. **In the EAS Build dashboard:**
   - Go to https://expo.dev/accounts/[your-account]/projects/liberty-social/builds
   - Click on your latest development build
   - Look for "Certificate fingerprint" or "SHA256" in the build details

3. **From the APK (if you download it):**
   ```bash
   keytool -printcert -jarfile path/to/your-app.apk | grep SHA256
   ```

## Step 3: Format the Fingerprint

The fingerprint from EAS will be in this format:
```
SHA256: AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00
```

You need to:
1. Remove "SHA256: " prefix
2. Remove all colons (:)
3. Convert to uppercase (if not already)
4. Result: `AABBCCDDEEFF11223344556677889900AABBCCDDEEFF11223344556677889900`

## Step 4: Update assetlinks.json

1. Open `frontend/public/.well-known/assetlinks.json`
2. Replace `DEBUG_FINGERPRINT_HERE` with your formatted fingerprint
3. Keep `PRODUCTION_FINGERPRINT_HERE` as a placeholder for now (you'll update it when you build for production)

Example:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.libertysocial.app",
      "sha256_cert_fingerprints": [
        "AABBCCDDEEFF11223344556677889900AABBCCDDEEFF11223344556677889900",
        "PRODUCTION_FINGERPRINT_HERE"
      ]
    }
  }
]
```

## Step 5: Deploy and Test

1. Deploy your frontend (so the assetlinks.json is live)
2. Install your development build on your Android device
3. Test passkey registration - it should work now!

## Note

- The development build fingerprint will work for **development builds only**
- When you build for production, you'll get a different fingerprint
- You can add multiple fingerprints to the array - Android will accept any of them
- So you can have both development AND production fingerprints in the same file

