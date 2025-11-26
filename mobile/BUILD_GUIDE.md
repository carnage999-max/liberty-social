# Liberty Social - Mobile App Build Guide

This guide will help you build and package the Liberty Social mobile app for Android and iOS.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Expo CLI** - Install globally: `npm install -g expo-cli eas-cli`
3. **EAS Account** - Sign up at https://expo.dev (free tier available)
4. **For iOS builds**: Apple Developer Account ($99/year)
5. **For Android builds**: Google Play Developer Account ($25 one-time)

## Initial Setup

1. **Install dependencies:**
   ```bash
   cd mobile
   npm install
   ```

2. **Login to EAS:**
   ```bash
   eas login
   ```

3. **Configure EAS (if needed):**
   ```bash
   eas build:configure
   ```

## App Configuration

### Current Configuration:
- **App Name**: Liberty Social
- **Bundle ID (iOS)**: `com.libertysocial.app`
- **Package Name (Android)**: `com.libertysocial.app`
- **Version**: 1.0.0
- **EAS Project ID**: `af063308-b482-4d48-8149-c1cef1a1dd13`

### To Change Configuration:

Edit `app.json`:
- `name`: Display name of the app
- `version`: App version (e.g., "1.0.0")
- `ios.bundleIdentifier`: iOS bundle identifier (must be unique)
- `android.package`: Android package name (must be unique)

## Building for Android

### Development Build (APK for testing):
```bash
npm run build:android:preview
```

### Production Build (APK):
```bash
npm run build:android
```

### Production Build (AAB for Play Store):
Edit `eas.json` and change `buildType` from `"apk"` to `"aab"` in the production profile, then:
```bash
npm run build:android
```

### Build Options:
- The build will prompt you for:
  - Build profile (development/preview/production)
  - Keystore (first time only - EAS can generate one)
  
### After Build:
- Download the APK/AAB from the EAS dashboard
- For Play Store: Use `npm run submit:android` or upload manually

## Building for iOS

### Prerequisites:
1. **Apple Developer Account** - Required for production builds
2. **Xcode** (optional, for local builds)

### Development Build:
```bash
npm run build:ios:preview
```

### Production Build:
```bash
npm run build:ios
```

### Build Options:
- The build will prompt you for:
  - Build profile (development/preview/production)
  - Distribution method (App Store, Ad Hoc, Enterprise)
  - Apple Developer credentials (first time)

### After Build:
- Download the IPA from the EAS dashboard
- For App Store: Use `npm run submit:ios` or upload via Xcode/Transporter

## Building for Both Platforms

```bash
npm run build:all
```

## Submitting to Stores

### Google Play Store:
```bash
npm run submit:android
```

### Apple App Store:
```bash
npm run submit:ios
```

## Important Notes

### Icons and Splash Screens:
- Ensure `assets/icon.png` is 1024x1024px
- Ensure `assets/adaptive-icon.png` is 1024x1024px (Android)
- Ensure `assets/splash.png` is appropriate size (recommended: 2732x2732px)

### Permissions:
The app requests the following permissions:
- **iOS**: Photo Library, Camera, Microphone
- **Android**: Storage, Camera, Microphone, Internet

### API Configuration:
- Production API URL is set in `constants/API.ts`
- For different environments, use environment variables or update the file

### Version Updates:
Before each build, update the version in `app.json`:
```json
{
  "expo": {
    "version": "1.0.1"  // Increment this
  }
}
```

## Troubleshooting

### Build Fails:
1. Check EAS dashboard for detailed error logs
2. Ensure all dependencies are installed: `npm install`
3. Clear cache: `expo start -c` or `eas build --clear-cache`

### Permission Issues:
- Verify permissions are correctly set in `app.json`
- For iOS, ensure Info.plist entries are correct
- For Android, check `AndroidManifest.xml` (auto-generated)

### Keystore Issues (Android):
- EAS can generate and manage keystores automatically
- Or provide your own keystore credentials

### Code Signing Issues (iOS):
- Ensure Apple Developer account is active
- Verify bundle identifier matches your App ID
- Check provisioning profiles in Apple Developer portal

## Environment Variables (Optional)

Create `.env` file for environment-specific configs:
```
EXPO_PUBLIC_API_BASE_URL=https://your-api-url.com/api
```

## Testing Builds

### Android:
- Install APK on device: `adb install app-release.apk`
- Or use EAS Build's download link

### iOS:
- Install via TestFlight (recommended)
- Or use Ad Hoc distribution for direct device install

## Next Steps

1. **Test the builds** on physical devices
2. **Update version numbers** before each release
3. **Submit to stores** using the submit commands
4. **Monitor builds** in the EAS dashboard

## Support

- EAS Documentation: https://docs.expo.dev/build/introduction/
- Expo Forums: https://forums.expo.dev/
- EAS Status: https://status.expo.dev/

