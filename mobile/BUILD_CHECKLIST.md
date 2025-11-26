# Build Checklist - Information Needed

## ✅ Already Configured

- [x] App name: "Liberty Social"
- [x] Bundle ID (iOS): `com.libertysocial.app`
- [x] Package name (Android): `com.libertysocial.app`
- [x] EAS Project ID: `af063308-b482-4d48-8149-c1cef1a1dd13`
- [x] Permissions configured for iOS and Android
- [x] Build scripts added to package.json
- [x] EAS build configuration (eas.json)
- [x] Image picker plugin configured
- [x] Notification plugin configured

## ❓ Information Needed From You

### 1. App Store Information
- [ ] **App Display Name** (can be different from "Liberty Social")
- [ ] **App Description** (for App Store/Play Store)
- [ ] **App Category** (e.g., Social Networking)
- [ ] **Keywords/Tags** (for app store search)
- [ ] **Privacy Policy URL** (required for both stores)
- [ ] **Support URL** (optional but recommended)
- [ ] **Marketing URL** (optional)

### 2. Developer Accounts
- [ ] **Apple Developer Account** - Do you have one? ($99/year)
  - If yes, provide Apple ID email
  - If no, you'll need to create one at https://developer.apple.com
- [ ] **Google Play Developer Account** - Do you have one? ($25 one-time)
  - If yes, provide account email
  - If no, create one at https://play.google.com/console

### 3. App Icons & Assets
- [ ] **App Icon** (1024x1024px PNG) - Check if `assets/icon.png` is correct
- [ ] **Adaptive Icon** (1024x1024px PNG) - Check if `assets/adaptive-icon.png` is correct
- [ ] **Splash Screen** - Check if `assets/splash.png` is correct
- [ ] **App Store Screenshots** (various sizes needed)
- [ ] **Play Store Screenshots** (various sizes needed)

### 4. Version Information
- [ ] **Initial Version Number** (currently set to "1.0.0" - is this correct?)
- [ ] **Build Number** (auto-incremented by EAS, but you can set initial)

### 5. Signing & Certificates
- [ ] **Android Keystore** - Do you have one?
  - If yes, provide keystore file and credentials
  - If no, EAS can generate one automatically
- [ ] **iOS Certificates** - EAS can manage these automatically
  - Just need Apple Developer account access

### 6. API Configuration
- [ ] **Production API URL** - Currently set to:
  - `https://ma3vebz3bj.us-east-1.awsapprunner.com/api`
  - Is this correct for production?
- [ ] **Environment Variables** - Any API keys or secrets needed?

### 7. Build Preferences
- [ ] **Build Type Preference**:
  - Android: APK (testing) or AAB (Play Store)?
  - iOS: Development, Ad Hoc, or App Store?
- [ ] **Distribution Method**:
  - Internal testing first?
  - Direct to production?
  - TestFlight/Internal Testing?

## 📋 Quick Start Commands

Once you have the above information, you can start building:

```bash
# Install EAS CLI globally (if not already installed)
npm install -g eas-cli

# Login to EAS
eas login

# Build for Android (preview/APK)
npm run build:android:preview

# Build for iOS (preview)
npm run build:ios:preview

# Build for production
npm run build:all
```

## 🎯 Minimum Requirements to Start Building

To start building immediately, you only need:

1. ✅ EAS account (free) - Sign up at https://expo.dev
2. ✅ Run `eas login` in the mobile directory
3. ✅ Run `npm install` to ensure dependencies are installed

For **testing builds** (APK/IPA), you can start right away!

For **store submission**, you'll need:
- Apple Developer Account (iOS)
- Google Play Developer Account (Android)

## 📝 Next Steps

1. **Review the configuration** in `app.json` - update bundle ID/package name if needed
2. **Check your assets** - ensure icons and splash screens are correct
3. **Test a preview build** first before production
4. **Update version numbers** before each release

## 🔧 Customization Options

If you need to change any of the following, let me know:

- App name
- Bundle identifier / Package name
- Version number
- Permissions
- API endpoints
- Build profiles
- Icon/splash screen assets

