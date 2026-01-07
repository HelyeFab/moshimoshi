#!/bin/bash

# Start Firebase Emulators for Tea House Testing
# This script starts the emulators and waits for them to be ready

echo "🔥 Starting Firebase Emulators..."
echo ""
echo "Emulators will be available at:"
echo "  - Emulator UI:  http://localhost:4000"
echo "  - Firestore:    localhost:8080"
echo "  - Functions:    localhost:5001"
echo "  - Auth:         localhost:9099"
echo ""
echo "Press Ctrl+C to stop"
echo ""

firebase emulators:start
