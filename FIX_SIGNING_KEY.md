# Fix: Wrong Signing Key for AAB

## Problem
Your AAB file is signed with the wrong key:
- **Current (Wrong)**: SHA1: `57:99:15:1B:E8:F9:B3:5C:84:FD:41:B3:DD:8C:17:51:41:54:72:B1`
- **Expected**: SHA1: `6B:36:7A:7C:32:A3:76:CB:AD:2B:34:04:5D:3B:55:1B:DD:FB:E2:8F`

The current `release.keystore` at `/mobile/android/app/release.keystore` is incorrect.

---

## Solution: Replace with Correct Keystore

### Step 1: Obtain the Correct Keystore File
You need to find the keystore file that has the fingerprint:
- SHA1: `6B:36:7A:7C:32:A3:76:CB:AD:2B:34:04:5D:3B:55:1B:DD:FB:E2:8F`

This should have been created when you first registered the app on Google Play.

**Common locations to check:**
- Your local development machine
- Your team's secure storage/password manager
- Google Play Console (may show fingerprint but not the file itself)
- Previous build machine or CI/CD system

### Step 2: Backup Current Keystore (Optional)
```bash
cd /home/binary/Desktop/liberty-social/mobile/android/app
cp release.keystore release.keystore.backup
```

### Step 3: Place Correct Keystore
Once you have the correct keystore file:
```bash
# Copy the correct keystore to the expected location
cp /path/to/correct/keystore release.keystore
```

### Step 4: Update build.gradle (if needed)
Check if the keystore password, key alias, or key password changed. Edit `/mobile/android/app/build.gradle`:

```groovy
release {
    storeFile file('release.keystore')
    storePassword 'YOUR_STORE_PASSWORD'      // Update if different
    keyAlias 'YOUR_KEY_ALIAS'                 // Update if different
    keyPassword 'YOUR_KEY_PASSWORD'           // Update if different
}
```

### Step 5: Verify Keystore Fingerprint
Confirm the new keystore has the correct fingerprint:
```bash
cd /home/binary/Desktop/liberty-social/mobile/android/app
keytool -list -v -keystore release.keystore -storepass YOUR_STORE_PASSWORD | grep "SHA1:"
```

Expected output:
```
SHA1: 6B:36:7A:7C:32:A3:76:CB:AD:2B:34:04:5D:3B:55:1B:DD:FB:E2:8F
```

### Step 6: Rebuild AAB with Correct Key
```bash
cd /home/binary/Desktop/liberty-social/mobile/android
./gradlew bundleRelease
```

### Step 7: Verify AAB Signature
Check that the new AAB is signed with the correct key:
```bash
cd /home/binary/Desktop/liberty-social/mobile/android/app/build/outputs/bundle/release
keytool -list -v -jar app-release.aab 2>&1 | grep "SHA1:"
```

---

## Alternative: Generate New Keystore (If Original Lost)

If you've lost the original keystore, you can:

1. **Request new key permission** from Google Play Console
   - Follow Google's process for requesting a new signing key
   - This requires verification and may take time

2. **Upload with Current Key** (if allowed by Google)
   - If the current key was previously used, Google may allow it
   - Check Google Play Console for key history

---

## Current Status

**Current AAB Location:**
- `/home/binary/Desktop/liberty-social/mobile/android/app/build/outputs/bundle/release/app-release.aab`

**Current Wrong Key:**
```
SHA1: 57:99:15:1B:E8:F9:B3:5C:84:FD:41:B3:DD:8C:17:51:41:54:72:B1
```

**Required Correct Key:**
```
SHA1: 6B:36:7A:7C:32:A3:76:CB:AD:2B:34:04:5D:3B:55:1B:DD:FB:E2:8F
```

---

## Quick Reference: build.gradle Signing Configuration

**File**: `/mobile/android/app/build.gradle` (lines 100-112)

```groovy
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    release {
        storeFile file('release.keystore')          // ← Path to keystore
        storePassword 'liberty123'                  // ← Update this
        keyAlias 'release'                          // ← Update this
        keyPassword 'liberty123'                    // ← Update this
    }
}
```

---

## Next Steps

1. **Find or obtain** the keystore with the correct fingerprint
2. **Replace** the current `release.keystore`
3. **Update** `build.gradle` if passwords/aliases differ
4. **Verify** the fingerprint matches
5. **Rebuild** the AAB
6. **Upload** to Google Play

Once you have the correct keystore file, let me know and I can help you integrate it and rebuild!
