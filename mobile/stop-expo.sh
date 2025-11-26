#!/bin/bash
# Script to stop Expo server and free port 8081

echo "Stopping Expo server..."

# Find and kill processes using port 8081
PID=$(lsof -ti:8081)
if [ -n "$PID" ]; then
    echo "Found process $PID using port 8081"
    kill -9 $PID 2>/dev/null
    echo "✓ Killed process $PID"
else
    echo "No process found on port 8081"
fi

# Also kill any remaining expo processes
EXPO_PIDS=$(ps aux | grep -i "expo start" | grep -v grep | awk '{print $2}')
if [ -n "$EXPO_PIDS" ]; then
    echo "Killing remaining Expo processes..."
    echo "$EXPO_PIDS" | xargs kill -9 2>/dev/null
    echo "✓ Cleaned up Expo processes"
fi

# Verify port is free
sleep 1
if lsof -ti:8081 > /dev/null 2>&1; then
    echo "⚠ Warning: Port 8081 may still be in use"
else
    echo "✓ Port 8081 is now free"
fi

