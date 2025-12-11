#!/bin/bash
# Build and install on connected Android device (skip emulator)

cd "$(dirname "$0")"

echo "Checking for connected devices..."
DEVICES=$(adb devices | grep -v "List" | grep "device$" | wc -l)

if [ "$DEVICES" -eq 0 ]; then
    echo "❌ No Android device connected!"
    echo ""
    echo "Please:"
    echo "1. Connect your Android device via USB"
    echo "2. Enable USB Debugging (Settings > Developer Options)"
    echo "3. Run 'adb devices' to verify connection"
    exit 1
fi

echo "✓ Device connected"
echo ""
echo "Building and installing on device..."

# Build and install using Gradle (skips emulator)
cd android
./gradlew installDebug

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Build successful! App installed on device."
    echo ""
    echo "Starting Metro bundler in background..."
    cd ..
    npx expo start &
    echo "Metro bundler started. Open the app on your device to test."
else
    echo ""
    echo "❌ Build failed. Check errors above."
    exit 1
fi

