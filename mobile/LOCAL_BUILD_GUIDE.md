# Local Android Build Guide

Since EAS build quota is exhausted, here's how to build locally.

## Prerequisites

1. **Android Studio** installed with:
   - Android SDK (API 34)
   - Android SDK Build-Tools
   - Android Emulator (optional, for testing)

2. **Java Development Kit (JDK)** 17 or higher

3. **Environment Variables**:
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   ```

## Build Steps

### 1. Prebuild (if needed)
If you don't have an `android/` directory:
```bash
cd mobile
npx expo prebuild --platform android
```

### 2. Install Dependencies
```bash
cd mobile
npm install
```

### 3. Start Metro Bundler
In one terminal:
```bash
cd mobile
npx expo start
```

### 4. Build and Run on Device/Emulator

**Option A: Using Expo CLI (Recommended)**
```bash
cd mobile
npx expo run:android
```

**Option B: Using Gradle directly**
```bash
cd mobile/android
./gradlew assembleDebug
# APK will be in: android/app/build/outputs/apk/debug/app-debug.apk
```

**Option C: Install on connected device**
```bash
cd mobile/android
./gradlew installDebug
```

## Testing

1. **Physical Device**:
   - Enable USB debugging
   - Connect via USB
   - Run `npx expo run:android`

2. **Emulator**:
   - Start an emulator from Android Studio
   - Run `npx expo run:android`

## Troubleshooting

- **"SDK not found"**: Install Android SDK via Android Studio
- **"Java version error"**: Install JDK 17+
- **"Gradle sync failed"**: Check `android/build.gradle` and `android/app/build.gradle`
- **"Module not found"**: Run `npm install` in the `mobile` directory

## What to Test

After building:
1. ✅ Passkey registration (Settings > Security)
2. ✅ Passkey authentication (Login screen)
3. ✅ Push notifications (should get token without Firebase errors)

