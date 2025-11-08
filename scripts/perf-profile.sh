#!/bin/bash
# Performance Profiling Script
# Launches a release build with performance monitoring enabled

set -e

PLATFORM=${1:-android}
OUTPUT_DIR="performance-artifacts"
export OUTPUT_DIR

echo "🚀 Starting performance profiling for $PLATFORM..."

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Set environment variables for performance monitoring
export SENTRY_ENABLE_TRACING=true
export RN_PERFORMANCE_ENABLED=true

case "$PLATFORM" in
  android)
    echo "📱 Building and running Android release build..."
    echo ""
    echo "⚠️  Make sure to:"
    echo "   1. Connect your Android device via USB"
    echo "   2. Enable USB debugging"
    echo "   3. Run 'adb devices' to verify connection"
    echo ""
    
    # Build and run release build
    pnpm run android:production
    
    echo ""
    echo "📊 Performance monitoring is active!"
    echo ""
    echo "To collect Perfetto traces (Android 12+):"
    echo "  1. Open Chrome and navigate to: ui.perfetto.dev"
    echo "  2. Click 'Record new trace'"
    echo "  3. Select your device"
    echo "  4. Choose 'Frame Timeline' preset"
    echo "  5. Start recording and interact with the app"
    echo "  6. Stop recording and save the trace to: $OUTPUT_DIR/"
    echo ""
    echo "Sentry transaction URLs will be logged to the console."
    echo "⚠️  Note: No automated export runs. Manually save traces/reports to: $OUTPUT_DIR/"
    ;;
    
  ios)
    echo "📱 Building and running iOS release build..."
    echo ""
    echo "⚠️  Make sure to:"
    echo "   1. Connect your iOS device via USB"
    echo "   2. Trust the development certificate"
    echo "   3. Select your device in Xcode"
    echo ""

    # Build and run release build
    pnpm run ios:production

    echo ""
    echo "📊 Performance monitoring is active!"
    echo ""
    echo "To collect Instruments data:"
    echo "  1. Open Xcode"
    echo "  2. Go to Xcode > Open Developer Tool > Instruments"
    echo "  3. Select 'Time Profiler' or 'System Trace'"
    echo "  4. Choose your device and app"
    echo "  5. Start recording and interact with the app"
    echo "  6. Stop recording and save the trace to: $OUTPUT_DIR/"
    echo ""
    echo "Sentry transaction URLs will be logged to the console."
    echo "⚠️  Note: No automated export runs. Manually save traces/reports to: $OUTPUT_DIR/"
    ;;
    
  *)
    echo "❌ Invalid platform: $PLATFORM"
    echo "Usage: pnpm perf:profile [android|ios]"
    exit 1
    ;;
esac

echo ""
echo "✅ Performance profiling session started!"
echo "📁 Artifacts will be saved to: $OUTPUT_DIR/"
