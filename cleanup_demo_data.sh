#!/bin/bash

# Liberty Social - Demo Data Cleanup Script
# This script removes all demo data created by setup_demo_data.py

echo ""
echo "🗑️  Liberty Social - Demo Data Cleanup"
echo "========================================"
echo ""

# Navigate to backend directory
cd "$(dirname "$0")/backend"

# Check if Python is available
if ! command -v python &> /dev/null; then
    echo "❌ Python not found. Please install Python first."
    exit 1
fi

echo "🔍 Checking for demo data..."
echo ""

# Run the cleanup command
python manage.py cleanup_demo_data

echo ""
echo "🎯 Cleanup complete!"
echo ""
