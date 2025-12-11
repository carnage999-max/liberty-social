# Building on Physical Android Device

## Steps

### 1. Connect Your Device

1. Enable **Developer Options** on your Android device:
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings > Developer Options

2. Enable **USB Debugging**:
   - Settings > Developer Options > USB Debugging (turn ON)

3. Connect device via USB cable

4. On your device, when prompted, tap "Allow USB debugging" and check "Always allow from this computer"

### 2. Verify Device is Connected

```bash
cd mobile
adb devices
```

You should see your device listed, e.g.:
```
List of devices attached
ABC123XYZ    device
```

### 3. Build and Install (Skip Emulator)

**Option A: Build APK and install manually**
```bash
cd mobile/android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**Option B: Use Expo with device flag**
```bash
cd mobile
# Set environment variable to prevent emulator auto-start
export EXPO_NO_EMULATOR=1
npx expo run:android --device
```

**Option C: Use Gradle install directly**
```bash
cd mobile/android
./gradlew installDebug
```

### 4. Start Metro Bundler Separately

In a separate terminal:
```bash
cd mobile
npx expo start
```

Then open the app on your device.

## Troubleshooting

- **"No devices found"**: Check USB debugging is enabled, try different USB cable/port
- **"Unauthorized"**: Check device screen for USB debugging authorization prompt
- **"Offline"**: Run `adb kill-server && adb start-server`, then reconnect device

