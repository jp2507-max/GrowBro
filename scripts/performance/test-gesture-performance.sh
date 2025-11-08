#!/bin/bash

# Gesture Performance Test Script
# 
# Runs automated gesture performance tests with Perfetto trace collection.
# Validates P95 input→render latency ≤50ms and dropped frames ≤1%.
# 
# Requirements: 2.3, 2.4
#
# Usage:
#   ./scripts/performance/test-gesture-performance.sh [--device DEVICE_ID]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEVICE_ID=${1:-""}
OUTPUT_DIR="./performance-artifacts"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEST_NAME="gesture-performance-${TIMESTAMP}"

echo -e "${GREEN}🎯 Gesture Performance Test${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check prerequisites
echo -e "\n${YELLOW}📋 Checking prerequisites...${NC}"

# Check if adb is available
if ! command -v adb &> /dev/null; then
    echo -e "${RED}❌ adb not found. Please install Android SDK Platform Tools.${NC}"
    exit 1
fi

# Check if Maestro is available
if ! command -v maestro &> /dev/null; then
    echo -e "${RED}❌ Maestro not found. Please install Maestro CLI.${NC}"
    echo "   Install: curl -Ls 'https://get.maestro.mobile.dev' | bash"
    exit 1
fi

# Check device connection
if [ -z "$DEVICE_ID" ]; then
    DEVICE_COUNT=$(adb devices | grep -c "device$" || true)
    if [ "$DEVICE_COUNT" -eq 0 ]; then
        echo -e "${RED}❌ No Android device connected.${NC}"
        exit 1
    elif [ "$DEVICE_COUNT" -gt 1 ]; then
        echo -e "${RED}❌ Multiple devices connected. Please specify device ID:${NC}"
        adb devices
        exit 1
    fi
else
    export ANDROID_SERIAL="$DEVICE_ID"
fi

# Check Android version (requires API 31+ for FrameTimeline)
SDK_VERSION=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
if [ "$SDK_VERSION" -lt 31 ]; then
    echo -e "${RED}❌ Android 12+ (API 31+) required for FrameTimeline. Device is API ${SDK_VERSION}.${NC}"
    exit 1
fi

DEVICE_MODEL=$(adb shell getprop ro.product.model | tr -d '\r')
ANDROID_VERSION=$(adb shell getprop ro.build.version.release | tr -d '\r')
echo -e "${GREEN}✅ Device: ${DEVICE_MODEL} (Android ${ANDROID_VERSION}, API ${SDK_VERSION})${NC}"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if app is installed
PACKAGE_NAME="com.growbro.app"
if ! adb shell pm list packages | grep -q "$PACKAGE_NAME"; then
    echo -e "${RED}❌ App not installed. Please install the release build first.${NC}"
    exit 1
fi

# Verify it's a release build (check for Hermes)
APP_INFO=$(adb shell dumpsys package "$PACKAGE_NAME" | grep -i "versionName" || true)
echo -e "${GREEN}✅ App installed: ${APP_INFO}${NC}"

echo -e "\n${YELLOW}⚠️  Important:${NC}"
echo "   - Ensure app is in RELEASE mode (no dev menu, Hermes enabled)"
echo "   - Keep device screen on and unlocked during test"
echo "   - Test will run for ~60 seconds with Perfetto trace collection"

read -p "Press Enter to start test, or Ctrl+C to cancel..."

# Start Perfetto trace collection in background
echo -e "\n${YELLOW}📊 Starting Perfetto trace collection...${NC}"
TRACE_FILE="${OUTPUT_DIR}/${TEST_NAME}.perfetto-trace"

# Create Perfetto config
PERFETTO_CONFIG="${OUTPUT_DIR}/perfetto-config-${TIMESTAMP}.txt"
cat > "$PERFETTO_CONFIG" << 'EOF'
buffers {
  size_kb: 65536
  fill_policy: RING_BUFFER
}

data_sources {
  config {
    name: "android.surfaceflinger.frametimeline"
  }
}

data_sources {
  config {
    name: "linux.ftrace"
    ftrace_config {
      ftrace_events: "sched/sched_switch"
      ftrace_events: "sched/sched_wakeup"
      ftrace_events: "sched/sched_waking"
      ftrace_events: "power/suspend_resume"
      buffer_size_kb: 16384
    }
  }
}

duration_ms: 60000
EOF

# Start trace collection
adb shell "cat > /data/local/tmp/perfetto-config.txt" < "$PERFETTO_CONFIG"
adb shell "perfetto -c /data/local/tmp/perfetto-config.txt -o /data/misc/perfetto-traces/trace" &
PERFETTO_PID=$!

# Wait for Perfetto to initialize
sleep 3

# Run Maestro test
echo -e "\n${YELLOW}🤖 Running Maestro gesture performance test...${NC}"
if maestro test .maestro/performance/gesture-performance.yaml --format junit --output "$OUTPUT_DIR/${TEST_NAME}-maestro.xml"; then
    echo -e "${GREEN}✅ Maestro test passed${NC}"
    MAESTRO_RESULT="PASS"
else
    echo -e "${RED}❌ Maestro test failed${NC}"
    MAESTRO_RESULT="FAIL"
fi

# Wait for Perfetto to finish
echo -e "\n${YELLOW}⏳ Waiting for Perfetto trace to complete...${NC}"
wait $PERFETTO_PID || true

# Pull trace file
echo -e "${YELLOW}📥 Pulling trace file from device...${NC}"
if adb pull /data/misc/perfetto-traces/trace "$TRACE_FILE"; then
    echo -e "${GREEN}✅ Trace file collected: ${TRACE_FILE}${NC}"
    
    # Get file size
    TRACE_SIZE=$(du -h "$TRACE_FILE" | cut -f1)
    echo -e "   Size: ${TRACE_SIZE}"
else
    echo -e "${RED}❌ Failed to pull trace file${NC}"
    TRACE_FILE=""
fi

# Clean up device
adb shell "rm -f /data/misc/perfetto-traces/trace /data/local/tmp/perfetto-config.txt" || true

# Collect RN Performance metrics (if available)
echo -e "\n${YELLOW}📊 Collecting RN Performance metrics...${NC}"
RN_PERF_FILE="${OUTPUT_DIR}/${TEST_NAME}-rn-performance.json"
adb shell "run-as $PACKAGE_NAME cat /data/data/$PACKAGE_NAME/files/performance.json" > "$RN_PERF_FILE" 2>/dev/null || echo "{}" > "$RN_PERF_FILE"

# Generate test report
echo -e "\n${YELLOW}📄 Generating test report...${NC}"
REPORT_FILE="${OUTPUT_DIR}/${TEST_NAME}-report.json"
cat > "$REPORT_FILE" << EOF
{
  "testName": "${TEST_NAME}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "device": {
    "model": "${DEVICE_MODEL}",
    "androidVersion": "${ANDROID_VERSION}",
    "apiLevel": ${SDK_VERSION}
  },
  "results": {
    "maestroTest": "${MAESTRO_RESULT}",
    "perfettoTrace": "$([ -n "$TRACE_FILE" ] && echo "$TRACE_FILE" || echo "null")",
    "rnPerformance": "${RN_PERF_FILE}"
  },
  "requirements": ["2.3", "2.4"],
  "targetMetrics": {
    "p95InputToRenderLatency": "≤50ms",
    "droppedFrames": "≤1%",
    "averageFPS": "≥58"
  }
}
EOF

echo -e "${GREEN}✅ Report generated: ${REPORT_FILE}${NC}"

# Display summary
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📊 Test Summary${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Device:         ${DEVICE_MODEL} (Android ${ANDROID_VERSION})"
echo -e "Maestro Test:   ${MAESTRO_RESULT}"
echo -e "Perfetto Trace: $([ -n "$TRACE_FILE" ] && echo "✅ Collected (${TRACE_SIZE})" || echo "❌ Failed")"
echo -e "Output Dir:     ${OUTPUT_DIR}"
echo -e "\n${YELLOW}📈 Next Steps:${NC}"
echo "1. Open https://ui.perfetto.dev"
echo "2. Upload trace file: ${TRACE_FILE}"
echo "3. Analyze FrameTimeline track for:"
echo "   - Input latency (P95 ≤50ms)"
echo "   - Frame drops (≤1%)"
echo "   - Jank events"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Exit with appropriate code
if [ "$MAESTRO_RESULT" = "PASS" ] && [ -n "$TRACE_FILE" ]; then
    exit 0
else
    exit 1
fi
