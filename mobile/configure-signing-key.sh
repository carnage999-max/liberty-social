#!/bin/bash

# Download and Configure Google Play Upload Key
# This script helps you configure the correct signing key for Liberty Social

echo "============================================"
echo "Google Play Upload Key Configuration"
echo "============================================"
echo ""

KEYSTORE_DIR="/home/binary/Desktop/liberty-social/mobile/android/app"
KEYSTORE_FILE="$KEYSTORE_DIR/upload-keystore.jks"
BUILD_GRADLE="$KEYSTORE_DIR/build.gradle"

echo "Expected Fingerprint:"
echo "SHA1: 6B:36:7A:7C:32:A3:76:CB:AD:2B:34:04:5D:3B:55:1B:DD:FB:E2:8F"
echo ""

echo "Steps to get the correct keystore:"
echo ""
echo "1. Go to Google Play Console:"
echo "   https://play.google.com/console"
echo ""
echo "2. Select 'Liberty Social' app"
echo ""
echo "3. Navigate to: Release > Setup > App integrity > App signing"
echo ""
echo "4. Check if 'Google Play App Signing' is enabled"
echo ""
echo "5a. IF App Signing is enabled:"
echo "    - Look for 'Upload key certificate'"
echo "    - Download or copy the certificate details"
echo "    - OR create a new upload key if prompted"
echo ""
echo "5b. IF App Signing is NOT enabled:"
echo "    - You need the original keystore used for the first upload"
echo "    - Look in backups, old machines, or team storage"
echo ""
echo "6. Once you have the correct keystore file:"
echo "   - Place it at: $KEYSTORE_FILE"
echo "   - Run this script again to verify"
echo ""

# Check if keystore file exists
if [ -f "$KEYSTORE_FILE" ]; then
    echo "============================================"
    echo "Found keystore file!"
    echo "============================================"
    echo ""
    echo "Enter keystore password:"
    read -s KEYSTORE_PASSWORD
    echo ""
    
    echo "Checking fingerprint..."
    FINGERPRINT=$(keytool -list -v -keystore "$KEYSTORE_FILE" -storepass "$KEYSTORE_PASSWORD" 2>&1 | grep "SHA1:" | head -1)
    
    echo "$FINGERPRINT"
    echo ""
    
    if [[ "$FINGERPRINT" == *"6B:36:7A:7C:32:A3:76:CB:AD:2B:34:04:5D:3B:55:1B:DD:FB:E2:8F"* ]]; then
        echo "✅ CORRECT KEYSTORE!"
        echo ""
        echo "Enter key alias:"
        read KEY_ALIAS
        echo ""
        echo "Enter key password:"
        read -s KEY_PASSWORD
        echo ""
        
        # Backup current keystore
        cp "$KEYSTORE_DIR/release.keystore" "$KEYSTORE_DIR/release.keystore.backup.$(date +%Y%m%d%H%M%S)"
        
        # Copy upload keystore to release.keystore
        cp "$KEYSTORE_FILE" "$KEYSTORE_DIR/release.keystore"
        
        echo "✅ Keystore configured!"
        echo ""
        echo "IMPORTANT: Update build.gradle with these credentials:"
        echo "  storePassword: $KEYSTORE_PASSWORD"
        echo "  keyAlias: $KEY_ALIAS"
        echo "  keyPassword: $KEY_PASSWORD"
        echo ""
        echo "After updating build.gradle, run:"
        echo "  cd /home/binary/Desktop/liberty-social/mobile/android"
        echo "  ./gradlew bundleRelease"
        
    else
        echo "❌ WRONG KEYSTORE"
        echo "This keystore does not match the expected fingerprint."
        echo "Please get the correct keystore from Google Play Console."
    fi
else
    echo "============================================"
    echo "No keystore file found"
    echo "============================================"
    echo ""
    echo "Please obtain the correct keystore and place it at:"
    echo "$KEYSTORE_FILE"
    echo ""
    echo "Then run this script again to verify and configure it."
fi

echo ""
echo "============================================"
