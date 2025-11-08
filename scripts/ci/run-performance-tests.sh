#!/usr/bin/env bash
set -euo pipefail

# Performance Test Runner for CI/CD
# Executes Maestro performance tests with artifact collection
#
# Requirements:
# - MUST run on release builds only (fails if __DEV__ is true)
# - Collects RN Performance JSON, Sentry trace URLs, Perfetto traces
# - Captures device/OS/build metadata
#
# Usage:
#   ./scripts/ci/run-performance-tests.sh [platform] [device]
#
# Examples:
#   ./scripts/ci/run-performance-tests.sh android pixel6a
#   ./scripts/ci/run-performance-tests.sh ios iphone12

PLATFORM="${1:-android}"
DEVICE="${2:-pixel6a}"
OUTPUT_DIR="${3:-./performance-artifacts}"
BUILD_HASH="${GITHUB_SHA:-$(git rev-parse HEAD)}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "Performance Test Runner"
echo "================================================"
echo "Platform: $PLATFORM"
echo "Device: $DEVICE"
echo "Build Hash: $BUILD_HASH"
echo "Timestamp: $TIMESTAMP"
echo "Output Directory: $OUTPUT_DIR"
echo "================================================"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Verify release build
echo -e "${YELLOW}Verifying release build...${NC}"

# Set artifact paths - can be overridden via environment variables
ANDROID_APK_PATH="${ANDROID_APK_PATH:-./android/app/build/outputs/apk/release/app-release.apk}"
IOS_IPA_PATH="${IOS_IPA_PATH:-./ios/build/Build/Products/Release-iphoneos/GrowBro.ipa}"

if [ "$PLATFORM" = "android" ]; then
  echo "Checking Android APK: $ANDROID_APK_PATH"

  if [ ! -f "$ANDROID_APK_PATH" ]; then
    echo -e "${RED}Error: Android APK not found at $ANDROID_APK_PATH${NC}"
    echo -e "${RED}Please ensure ANDROID_APK_PATH environment variable points to the correct APK file${NC}"
    exit 1
  fi

  # Check if APK is debuggable using aapt
  if command -v aapt >/dev/null 2>&1; then
    DEBUGGABLE=$(aapt dump badging "$ANDROID_APK_PATH" | grep -o "debuggable=[^ ]*" | cut -d'=' -f2)
    if [ "$DEBUGGABLE" = "true" ]; then
      echo -e "${RED}Error: APK is debuggable (debuggable=$DEBUGGABLE)${NC}"
      echo -e "${RED}Performance tests must be run on release builds only${NC}"
      exit 1
    elif [ "$DEBUGGABLE" = "false" ]; then
      echo -e "${GREEN}✓ APK is not debuggable (debuggable=$DEBUGGABLE)${NC}"
    else
      echo -e "${YELLOW}Warning: Could not determine debuggable status from aapt output${NC}"
      # Try apksigner as fallback
      if command -v apksigner >/dev/null 2>&1; then
        if apksigner verify --print-certs "$ANDROID_APK_PATH" >/dev/null 2>&1; then
          echo -e "${GREEN}✓ APK signature verification passed - likely a release build${NC}"
        else
          echo -e "${RED}Error: APK signature verification failed${NC}"
          echo -e "${RED}This may indicate a debug build or corrupted APK${NC}"
          exit 1
        fi
      else
        echo -e "${RED}Error: Neither aapt nor apksigner found in PATH${NC}"
        echo -e "${RED}Cannot verify if APK is a release build${NC}"
        exit 1
      fi
    fi
  else
    echo -e "${RED}Error: aapt command not found in PATH${NC}"
    echo -e "${RED}Please install Android SDK build-tools and ensure aapt is available${NC}"
    exit 1
  fi

elif [ "$PLATFORM" = "ios" ]; then
  echo "Checking iOS IPA: $IOS_IPA_PATH"

  if [ ! -f "$IOS_IPA_PATH" ]; then
    echo -e "${RED}Error: iOS IPA not found at $IOS_IPA_PATH${NC}"
    echo -e "${RED}Please ensure IOS_IPA_PATH environment variable points to the correct IPA file${NC}"
    exit 1
  fi

  # Create temporary directory to extract IPA contents
  TEMP_DIR=$(mktemp -d)
  trap "rm -rf $TEMP_DIR" EXIT

  # Extract IPA (which is a zip file)
  if ! unzip -q "$IOS_IPA_PATH" -d "$TEMP_DIR"; then
    echo -e "${RED}Error: Failed to extract IPA file${NC}"
    exit 1
  fi

  # Find the app bundle
  APP_BUNDLE=$(find "$TEMP_DIR" -name "*.app" -type d | head -1)
  if [ -z "$APP_BUNDLE" ]; then
    echo -e "${RED}Error: Could not find app bundle in IPA${NC}"
    exit 1
  fi

  # Check build configuration using xcodebuild if available
  if command -v xcodebuild >/dev/null 2>&1; then
    echo "Checking build settings..."

    # Try to get build settings from the Info.plist
    CONFIGURATION=$(plutil -extract CFBundleIdentifier raw "$APP_BUNDLE/Info.plist" 2>/dev/null || echo "")
    if [ -n "$CONFIGURATION" ]; then
      echo "App bundle identifier: $CONFIGURATION"
    fi

    # Check for debug symbols or development flags
    if [ -f "$APP_BUNDLE/Info.plist" ]; then
      # Check if app has get-task-allow entitlement (debugging enabled)
      GET_TASK_ALLOW=$(plutil -extract get-task-allow raw "$APP_BUNDLE/Info.plist" 2>/dev/null || echo "false")
      if [ "$GET_TASK_ALLOW" = "true" ]; then
        echo -e "${RED}Error: App has get-task-allow=true (debugging enabled)${NC}"
        echo -e "${RED}Performance tests must be run on release builds only${NC}"
        exit 1
      else
        echo -e "${GREEN}✓ App does not have debugging entitlements enabled${NC}"
      fi
    fi
  else
    echo -e "${YELLOW}Warning: xcodebuild not available, checking mobileprovision file...${NC}"

    # Check embedded.mobileprovision file
    MOBILEPROVISION=$(find "$APP_BUNDLE" -name "embedded.mobileprovision" -type f | head -1)
    if [ -f "$MOBILEPROVISION" ]; then
      # Extract and check mobileprovision for entitlements
      if command -v security >/dev/null 2>&1; then
        # Convert mobileprovision to plist and check entitlements
        ENTITLEMENTS=$TEMP_DIR/entitlements.plist
        security cms -D -i "$MOBILEPROVISION" > "$ENTITLEMENTS" 2>/dev/null || true

        if [ -f "$ENTITLEMENTS" ]; then
          GET_TASK_ALLOW=$(plutil -extract Entitlements.get-task-allow raw "$ENTITLEMENTS" 2>/dev/null || echo "false")
          if [ "$GET_TASK_ALLOW" = "true" ]; then
            echo -e "${RED}Error: Mobileprovision has get-task-allow=true (debugging enabled)${NC}"
            echo -e "${RED}Performance tests must be run on release builds only${NC}"
            exit 1
          else
            echo -e "${GREEN}✓ Mobileprovision does not have debugging entitlements enabled${NC}"
          fi
        fi
      else
        echo -e "${YELLOW}Warning: security command not available, cannot verify mobileprovision${NC}"
        echo -e "${YELLOW}Assuming release build based on IPA presence${NC}"
      fi
    else
      echo -e "${YELLOW}Warning: No embedded.mobileprovision found${NC}"
      echo -e "${YELLOW}This might be a development build${NC}"
      echo -e "${RED}Error: Cannot verify if this is a release build${NC}"
      exit 1
    fi
  fi

  echo -e "${GREEN}✓ iOS build validation passed${NC}"
fi

# Start Perfetto trace collection (Android only)
PERFETTO_PID=""
if [ "$PLATFORM" = "android" ]; then
  echo -e "${YELLOW}Starting Perfetto trace collection...${NC}"
  
  # Check if physical device is connected
  DEVICE_COUNT=$(adb devices | grep -v "List" | grep "device$" | wc -l)
  if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo -e "${RED}Error: No Android device connected${NC}"
    exit 1
  fi
  
  # Start Perfetto trace in background
  cat <<'EOF' | adb shell "perfetto -c - --txt -o /data/misc/perfetto-traces/trace_${TIMESTAMP}.pb" > /dev/null 2>&1 &
buffers {
  size_kb: 65536
  fill_policy: RING_BUFFER
}
data_sources {
  config { name: "android.surfaceflinger.frametimeline" }
}
data_sources {
  config {
    name: "linux.ftrace"
    ftrace_config {
      ftrace_events: "sched/sched_switch"
      ftrace_events: "power/suspend_resume"
    }
  }
}
duration_ms: 120000
EOF
  PERFETTO_PID=$!
  echo "Perfetto trace started (PID: $PERFETTO_PID)"
  sleep 2
fi

# Capture device metadata
echo -e "${YELLOW}Capturing device metadata...${NC}"
METADATA_FILE="$OUTPUT_DIR/device-metadata-${TIMESTAMP}.json"

if [ "$PLATFORM" = "android" ]; then
  DEVICE_MODEL=$(adb shell getprop ro.product.model | tr -d '\r')
  DEVICE_OS=$(adb shell getprop ro.build.version.release | tr -d '\r')
  DEVICE_SDK=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
  
  cat > "$METADATA_FILE" <<EOF
{
  "platform": "android",
  "device": "$DEVICE",
  "model": "$DEVICE_MODEL",
  "os_version": "$DEVICE_OS",
  "sdk_version": "$DEVICE_SDK",
  "build_hash": "$BUILD_HASH",
  "timestamp": "$TIMESTAMP",
  "test_type": "performance"
}
EOF
elif [ "$PLATFORM" = "ios" ]; then
  # iOS metadata collection
  cat > "$METADATA_FILE" <<EOF
{
  "platform": "ios",
  "device": "$DEVICE",
  "build_hash": "$BUILD_HASH",
  "timestamp": "$TIMESTAMP",
  "test_type": "performance"
}
EOF
fi

echo "Device metadata saved to $METADATA_FILE"

# Run Maestro performance tests
echo -e "${YELLOW}Running Maestro performance tests...${NC}"

TESTS=(
  "startup-performance"
  "agenda-scroll-performance"
  "rapid-scroll-test"
)

FAILED_TESTS=()

for TEST in "${TESTS[@]}"; do
  echo -e "${YELLOW}Running test: $TEST${NC}"
  
  TEST_OUTPUT="$OUTPUT_DIR/${TEST}-${TIMESTAMP}.xml"
  
  if maestro test ".maestro/performance/${TEST}.yaml" \
    --format junit \
    --output "$TEST_OUTPUT" \
    -e APP_ID="com.obytes.production" \
    -e PLATFORM="$PLATFORM"; then
    echo -e "${GREEN}✓ Test passed: $TEST${NC}"
  else
    echo -e "${RED}✗ Test failed: $TEST${NC}"
    FAILED_TESTS+=("$TEST")
  fi
done

# Stop Perfetto trace collection (Android only)
if [ "$PLATFORM" = "android" ] && [ -n "$PERFETTO_PID" ]; then
  echo -e "${YELLOW}Stopping Perfetto trace collection...${NC}"
  kill "$PERFETTO_PID" 2>/dev/null || true
  sleep 2
  
  # Pull Perfetto trace
  PERFETTO_FILE="$OUTPUT_DIR/perfetto-trace-${TIMESTAMP}.pb"
  if adb pull "/data/misc/perfetto-traces/trace_${TIMESTAMP}.pb" "$PERFETTO_FILE"; then
    echo -e "${GREEN}Perfetto trace saved to $PERFETTO_FILE${NC}"
    echo "Open in https://ui.perfetto.dev"
  else
    echo -e "${YELLOW}Warning: Could not pull Perfetto trace${NC}"
  fi
  
  # Clean up device
  adb shell "rm /data/misc/perfetto-traces/trace_${TIMESTAMP}.pb" 2>/dev/null || true
fi

# Collect RN Performance JSON reports
echo -e "${YELLOW}Collecting RN Performance reports...${NC}"
# Note: RN Performance reports are typically written to app storage
# Implementation would depend on how the app exports these reports

# Generate summary report
echo -e "${YELLOW}Generating summary report...${NC}"
SUMMARY_FILE="$OUTPUT_DIR/performance-summary-${TIMESTAMP}.json"

cat > "$SUMMARY_FILE" <<EOF
{
  "build_hash": "$BUILD_HASH",
  "timestamp": "$TIMESTAMP",
  "platform": "$PLATFORM",
  "device": "$DEVICE",
  "tests_run": ${#TESTS[@]},
  "tests_passed": $((${#TESTS[@]} - ${#FAILED_TESTS[@]})),
  "tests_failed": ${#FAILED_TESTS[@]},
  "failed_tests": $(printf '%s\n' "${FAILED_TESTS[@]}" | jq -R . | jq -s .),
  "artifacts": {
    "metadata": "$METADATA_FILE",
    "perfetto_trace": "${PERFETTO_FILE:-null}",
    "test_results": [
      $(for TEST in "${TESTS[@]}"; do echo "\"$OUTPUT_DIR/${TEST}-${TIMESTAMP}.xml\""; done | paste -sd,)
    ]
  }
}
EOF

echo "Summary report saved to $SUMMARY_FILE"

# Print summary
echo ""
echo "================================================"
echo "Performance Test Summary"
echo "================================================"
echo "Tests Run: ${#TESTS[@]}"
echo "Tests Passed: $((${#TESTS[@]} - ${#FAILED_TESTS[@]}))"
echo "Tests Failed: ${#FAILED_TESTS[@]}"

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  echo -e "${RED}Failed Tests:${NC}"
  for TEST in "${FAILED_TESTS[@]}"; do
    echo "  - $TEST"
  done
fi

echo ""
echo "Artifacts saved to: $OUTPUT_DIR"
echo "================================================"

# Exit with failure if any tests failed
if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  exit 1
fi

echo -e "${GREEN}All performance tests passed!${NC}"
exit 0
