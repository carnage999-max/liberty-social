# Testing Passkey Implementation on Mobile

## ✅ Passkey Support via react-native-passkeys

**We're using [`react-native-passkeys`](https://github.com/peterferguson/react-native-passkeys) to enable passkey support in React Native.**

This library provides a unified API for creating and authenticating with passkeys across iOS, Android, and web, staying close to the standard `navigator.credentials` API.

### Current Status
- ✅ **Web**: Passkeys work fully in web browsers
- ✅ **React Native**: Passkeys are supported via `react-native-passkeys` library
- ✅ **iOS**: Requires iOS 15.0+ (configured in `app.json`)
- ✅ **Android**: Requires compileSdkVersion 34+ (configured in `app.json`)

### Setup Requirements

#### iOS Setup
1. **Apple App Site Association (AASA) file** must be hosted at:
   ```
   https://mylibertysocial.com/.well-known/apple-app-site-association
   ```
   The file should contain:
   ```json
   {
     "webcredentials": {
       "apps": ["<teamID>.com.libertysocial.app"]
     }
   }
   ```
   Replace `<teamID>` with your Apple Team ID.

2. **Associated Domains** are configured in `app.json`:
   ```json
   "ios": {
     "associatedDomains": ["webcredentials:mylibertysocial.com"]
   }
   ```

#### Android Setup
1. **Asset Links file** must be hosted at:
   ```
   https://mylibertysocial.com/.well-known/assetlinks.json
   ```
   Generate this file using the [Android Asset Links Assistant](https://developers.google.com/digital-asset-links/tools/generator).

2. **Build properties** are configured in `app.json`:
   ```json
   "android": {
     "compileSdkVersion": 34
   }
   ```

---

## Prerequisites

1. **Backend must be deployed** with Phase 1 & 2 endpoints:
   - `/auth/passkey/register/begin/`
   - `/auth/passkey/register/complete/`
   - `/auth/passkey/authenticate/begin/`
   - `/auth/passkey/authenticate/complete/`
   - `/auth/passkey/status/`
   - `/auth/passkey/remove/{id}/`
   - `/auth/devices/`
   - `/auth/sessions/`
   - `/auth/activity/`

2. **Device Requirements:**
   - **iOS**: iOS 16+ (for native passkey support)
   - **Android**: Android 9+ (for native passkey support)
   - **Web**: Modern browser with WebAuthn support (Chrome, Safari, Edge, Firefox)

3. **Development Build Required:**
   - Passkeys require a development build (not Expo Go)
   - Run: `npx expo run:ios` or `npx expo run:android`

## Testing Phase 1: Core Passkey Support

### 1. Test Passkey Registration

**Steps:**
1. Start the mobile app (development build)
2. Log in with username/password
3. Navigate to **Settings** → **Security & Sessions**
4. Scroll to "Passkeys (WebAuthn)" section
5. Tap **"Enable Passkey"** button
6. Enter a device name (optional) or use default
7. Tap **"Continue"**
8. Complete the biometric/passkey prompt on your device

**Expected Results:**
- ✅ Passkey registration prompt appears
- ✅ After successful registration, passkey appears in the list
- ✅ Device name is displayed
- ✅ Created date is shown
- ✅ "Add Another Passkey" button appears

**Troubleshooting:**
- If "Passkeys are not available on this device" appears:
  - Check iOS version (must be 16+)
  - Check Android version (must be 9+)
  - For web, check browser compatibility
- If registration fails:
  - Check backend logs for errors
  - Verify API endpoint is accessible
  - Check network connectivity

### 2. Test Passkey Authentication (Login)

**Steps:**
1. Log out of the app
2. On the login screen, you should see **"Sign in with Passkey"** button
3. Tap the button
4. Complete the biometric/passkey prompt
5. You should be logged in automatically

**Expected Results:**
- ✅ "Sign in with Passkey" button appears (if passkey is available)
- ✅ Biometric/passkey prompt appears
- ✅ After authentication, user is logged in
- ✅ Redirected to feed screen

**Troubleshooting:**
- If button doesn't appear:
  - Check if WebAuthn is available (`isPasskeyAvailable`)
  - Verify device supports passkeys
- If authentication fails:
  - Check backend logs
  - Verify passkey was registered correctly
  - Try registering a new passkey

### 3. Test Passkey Removal

**Steps:**
1. Go to **Settings** → **Security & Sessions**
2. Find a registered passkey
3. Tap **"Remove"** button
4. Confirm removal in the dialog

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ After confirmation, passkey is removed
- ✅ Passkey disappears from the list
- ✅ If it was the last passkey, "Enable Passkey" button appears again

## Testing Phase 2: Device & Session Management

### 1. Test Device List

**Steps:**
1. Go to **Settings** → **Security & Sessions**
2. Scroll to "Your Devices" section

**Expected Results:**
- ✅ All registered devices are listed
- ✅ Device name is displayed
- ✅ Location (if available) is shown
- ✅ Created date and last used date are shown
- ✅ Edit and delete icons are visible

### 2. Test Device Rename

**Steps:**
1. In "Your Devices" section, tap the **pencil icon** on a device
2. Enter a new device name
3. Tap **"Save"**

**Expected Results:**
- ✅ Modal opens with current device name
- ✅ After saving, device name updates
- ✅ Updated name appears in the list

### 3. Test Device Removal

**Steps:**
1. In "Your Devices" section, tap the **trash icon** on a device
2. Confirm removal in the dialog

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ After confirmation, device is removed
- ✅ Device disappears from the list
- ✅ Associated passkey is also revoked

**Note:** You cannot remove the device you're currently using if it's the only one.

### 4. Test Active Sessions

**Steps:**
1. Go to **Settings** → **Security & Sessions**
2. Scroll to "Active Sessions" section

**Expected Results:**
- ✅ Current session is marked as "Current"
- ✅ All active sessions are listed
- ✅ Device name, location, IP address are shown
- ✅ Created date and last activity are shown

### 5. Test "Sign Out of All Other Devices"

**Steps:**
1. In "Active Sessions" section, tap **"Sign out of all other devices"**
2. Confirm the action

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ After confirmation, all other sessions are revoked
- ✅ Only current session remains
- ✅ You remain logged in on this device

### 6. Test Activity Log

**Steps:**
1. Go to **Settings** → **Security & Sessions**
2. Scroll to "Recent Login Activity" section

**Expected Results:**
- ✅ Recent login attempts are listed
- ✅ Authentication method (Password/Passkey) is shown
- ✅ Device name, location, IP address are shown
- ✅ Timestamp is displayed

## Testing Scenarios

### Scenario 1: First Time Passkey Setup
1. New user logs in with password
2. Goes to Security & Sessions
3. Registers first passkey
4. Logs out
5. Logs in with passkey ✅

### Scenario 2: Multiple Devices
1. Register passkey on Device A
2. Register passkey on Device B
3. View devices list - should see both
4. Remove Device B
5. Try to login on Device B - should fail ✅

### Scenario 3: Session Management
1. Login on Device A
2. Login on Device B
3. View active sessions - should see both
4. On Device A, sign out of all other devices
5. Device B session should be revoked ✅

## Common Issues & Solutions

### Issue: "Passkeys are not available on this device"
**Solution:**
- iOS: Update to iOS 16+
- Android: Update to Android 9+
- Check if device has biometric authentication enabled

### Issue: Registration fails silently
**Solution:**
- Check backend logs
- Verify API endpoints are accessible
- Check network connectivity
- Verify backend is deployed with latest code

### Issue: Login with passkey doesn't work
**Solution:**
- Verify passkey was registered successfully
- Check if passkey was removed
- Try registering a new passkey
- Check backend authentication logs

### Issue: WebAuthn API not available
**Solution:**
- Use development build (not Expo Go)
- Check device OS version
- For web, use a supported browser

## Debugging Tips

1. **Check Console Logs:**
   - Look for WebAuthn API errors
   - Check API request/response logs
   - Verify token authentication

2. **Backend Logs:**
   - Check ECS logs for passkey endpoints
   - Verify challenge generation
   - Check credential verification

3. **Network:**
   - Verify API base URL is correct
   - Check CORS settings
   - Verify authentication tokens

4. **Device:**
   - Ensure biometric authentication is set up
   - Check device passcode is enabled
   - Verify device supports passkeys

## Quick Test Checklist

- [ ] Passkey registration works
- [ ] Passkey appears in list after registration
- [ ] "Sign in with Passkey" button appears on login
- [ ] Passkey authentication works
- [ ] Passkey removal works
- [ ] Device list displays correctly
- [ ] Device rename works
- [ ] Device removal works
- [ ] Active sessions list displays
- [ ] "Sign out of all other devices" works
- [ ] Activity log displays recent logins
- [ ] Current session is marked correctly

## Next Steps After Testing

If all tests pass:
1. ✅ Phase 1 & 2 are complete
2. Ready for production deployment
3. Consider Phase 4 (Recovery Phrase) if needed

If issues are found:
1. Check backend deployment
2. Verify API endpoints
3. Check device compatibility
4. Review error logs

