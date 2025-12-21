#!/bin/bash
# Fetch keystore from EAS and replace the local one

echo "Fetching keystore from EAS..."
echo ""
echo "Run this command manually:"
echo ""
echo "  npx eas-cli credentials"
echo ""
echo "Then select:"
echo "  1. Android"
echo "  2. production-aab (or production)"
echo "  3. Download credentials"
echo "  4. Save keystore to: android/app/release.keystore"
echo ""
echo "This will download the keystore that matches the upload certificate!"
