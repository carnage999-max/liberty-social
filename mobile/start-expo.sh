#!/bin/bash
# Script to start Expo server

cd "$(dirname "$0")"

echo "Starting Expo server..."

# Check if port 8081 is already in use
if lsof -ti:8081 > /dev/null 2>&1; then
    echo "⚠ Port 8081 is already in use!"
    echo "Run './stop-expo.sh' first to free the port"
    exit 1
fi

# Start Expo
npx expo start

