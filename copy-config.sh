#!/bin/bash
# Copy config from Docker location to Tauri app location

DOCKER_CONFIG="$(pwd)/config/config.json"
TAURI_CONFIG="$HOME/.mission-control/config.json"

echo "Mission Control Config Copy"
echo "==========================="
echo ""

if [ ! -f "$DOCKER_CONFIG" ]; then
    echo "❌ No Docker config found at: $DOCKER_CONFIG"
    echo "   Did you run Docker first and configure the app?"
    exit 1
fi

echo "✓ Found Docker config: $DOCKER_CONFIG"

# Create Tauri config directory if needed
mkdir -p "$(dirname "$TAURI_CONFIG")"

# Copy the config
cp "$DOCKER_CONFIG" "$TAURI_CONFIG"

echo "✓ Copied to Tauri location: $TAURI_CONFIG"
echo ""
echo "Your config is now ready for the Tauri app!"
