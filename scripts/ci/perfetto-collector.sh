#!/bin/bash

##
# Perfetto Trace Collection Script for Android Performance Tests
#
# Collects Perfetto FrameTimeline traces during performance test execution
# Requirements: Spec 21, Task 10 - Performance Artifact Collection
#
# Usage:
#   # Start collection
#   ./scripts/ci/perfetto-collector.sh start
#
#   # Stop collection and pull trace
#   ./scripts/ci/perfetto-collector.sh stop
#
# Environment Variables:
#   - PERFETTO_TRACE_PATH: Output path for trace file (default: ./perfetto-trace.pb)
#   - PERFETTO_DURATION_MS: Trace duration in milliseconds (default: 30000)
#   - APP_PACKAGE: Android app package name (default: com.growbro.app)
##

set -e

# Configuration
PERFETTO_TRACE_PATH="${PERFETTO_TRACE_PATH:-./perfetto-trace.pb}"
PERFETTO_DURATION_MS="${PERFETTO_DURATION_MS:-30000}"
APP_PACKAGE="${APP_PACKAGE:-com.growbro.app}"
PERFETTO_PID_FILE="perfetto-pid.txt"
DEVICE_TRACE_PATH="/data/misc/perfetto-traces/trace"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if adb is available
check_adb() {
    if ! command -v adb &> /dev/null; then
        log_error "adb not found. Please install Android SDK Platform Tools."
        exit 1
    fi

    # Check if device is connected
    if ! adb devices | grep -q "device$"; then
        log_error "No Android device/emulator connected."
        exit 1
    fi

    log_info "Android device connected"
}

# Generate Perfetto trace configuration
generate_perfetto_config() {
    cat << 'EOF'
buffers: {
    size_kb: 63488
    fill_policy: RING_BUFFER
}
buffers: {
    size_kb: 2048
    fill_policy: RING_BUFFER
}
data_sources: {
    config {
        name: "linux.ftrace"
        ftrace_config {
            # Scheduling events for frame timeline
            ftrace_events: "sched/sched_switch"
            ftrace_events: "sched/sched_wakeup"
            ftrace_events: "sched/sched_wakeup_new"
            ftrace_events: "sched/sched_waking"
            ftrace_events: "sched/sched_process_exit"
            ftrace_events: "sched/sched_process_free"
            ftrace_events: "task/task_newtask"
            ftrace_events: "task/task_rename"
            
            # CPU frequency and idle events
            ftrace_events: "power/cpu_frequency"
            ftrace_events: "power/cpu_idle"
            ftrace_events: "power/clock_set_rate"
            ftrace_events: "power/suspend_resume"
            
            # IRQ events
            ftrace_events: "irq/irq_handler_entry"
            ftrace_events: "irq/irq_handler_exit"
            
            # System call events
            ftrace_events: "raw_syscalls/sys_enter"
            ftrace_events: "raw_syscalls/sys_exit"
            
            # Memory events
            ftrace_events: "kmem/rss_stat"
            ftrace_events: "kmem/mm_page_alloc"
            ftrace_events: "kmem/mm_page_free"
            ftrace_events: "lowmemorykiller/lowmemory_kill"
            ftrace_events: "oom/oom_score_adj_update"
            ftrace_events: "vmscan/mm_vmscan_direct_reclaim_begin"
            ftrace_events: "vmscan/mm_vmscan_direct_reclaim_end"
            ftrace_events: "vmscan/mm_vmscan_kswapd_wake"
            ftrace_events: "vmscan/mm_vmscan_kswapd_sleep"
            
            # Graphics events for frame timeline
            ftrace_events: "graphics/gpu_mem/gpu_mem_total"
            
            compact: false
        }
    }
}
data_sources: {
    config {
        name: "linux.process_stats"
        target_buffer: 1
        process_stats_config {
            scan_all_processes_on_start: true
        }
    }
}
data_sources: {
    config {
        name: "android.log"
        android_log_config {
            log_ids: LID_DEFAULT
            log_ids: LID_SYSTEM
            log_ids: LID_RADIO
        }
    }
}
data_sources: {
    config {
        name: "android.surfaceflinger.frame"
    }
}
data_sources: {
    config {
        name: "android.surfaceflinger.layers"
    }
}
data_sources: {
    config {
        name: "android.packages_list"
    }
}
duration_ms: DURATION_PLACEHOLDER
EOF
}

# Start Perfetto trace collection
start_collection() {
    log_info "Starting Perfetto trace collection..."
    
    check_adb
    
    # Generate config with duration
    config=$(generate_perfetto_config | sed "s/DURATION_PLACEHOLDER/${PERFETTO_DURATION_MS}/")
    
    # Start Perfetto in background
    log_info "Starting Perfetto with ${PERFETTO_DURATION_MS}ms duration..."
    
    # Use adb shell to start perfetto in background
    echo "$config" | adb shell "perfetto -c - --txt -o ${DEVICE_TRACE_PATH}" &
    perfetto_pid=$!
    
    # Save PID for later cleanup
    echo "$perfetto_pid" > "$PERFETTO_PID_FILE"
    
    log_info "Perfetto started (PID: $perfetto_pid)"
    log_info "Trace will be saved to: ${DEVICE_TRACE_PATH}"
    
    # Wait a moment for Perfetto to initialize
    sleep 2
    
    log_info "✓ Perfetto collection started successfully"
}

# Stop Perfetto trace collection and pull trace
stop_collection() {
    log_info "Stopping Perfetto trace collection..."
    
    check_adb
    
    # Kill Perfetto process if PID file exists
    if [ -f "$PERFETTO_PID_FILE" ]; then
        perfetto_pid=$(cat "$PERFETTO_PID_FILE")
        log_info "Stopping Perfetto process (PID: $perfetto_pid)..."
        kill "$perfetto_pid" 2>/dev/null || log_warn "Perfetto process already stopped"
        rm "$PERFETTO_PID_FILE"
    else
        log_warn "No PID file found, Perfetto may have already stopped"
    fi
    
    # Wait for trace to be written
    sleep 2
    
    # Pull trace from device
    log_info "Pulling Perfetto trace from device..."
    
    if adb shell "[ -f ${DEVICE_TRACE_PATH} ]"; then
        adb pull "${DEVICE_TRACE_PATH}" "${PERFETTO_TRACE_PATH}"
        
        if [ -f "${PERFETTO_TRACE_PATH}" ]; then
            trace_size=$(du -h "${PERFETTO_TRACE_PATH}" | cut -f1)
            log_info "✓ Trace pulled successfully: ${PERFETTO_TRACE_PATH} (${trace_size})"
            
            # Verify trace is not empty
            if [ ! -s "${PERFETTO_TRACE_PATH}" ]; then
                log_error "Trace file is empty!"
                exit 1
            fi
        else
            log_error "Failed to pull trace file"
            exit 1
        fi
    else
        log_error "Trace file not found on device: ${DEVICE_TRACE_PATH}"
        exit 1
    fi
    
    # Clean up device trace
    log_info "Cleaning up device trace..."
    adb shell "rm -f ${DEVICE_TRACE_PATH}" || log_warn "Failed to clean up device trace"
    
    log_info "✓ Perfetto collection stopped successfully"
    log_info "View trace at: https://ui.perfetto.dev"
}

# Main command dispatcher
case "${1:-}" in
    start)
        start_collection
        ;;
    stop)
        stop_collection
        ;;
    *)
        echo "Usage: $0 {start|stop}"
        echo ""
        echo "Commands:"
        echo "  start  - Start Perfetto trace collection"
        echo "  stop   - Stop collection and pull trace from device"
        echo ""
        echo "Environment Variables:"
        echo "  PERFETTO_TRACE_PATH   - Output path for trace (default: ./perfetto-trace.pb)"
        echo "  PERFETTO_DURATION_MS  - Trace duration in ms (default: 30000)"
        echo "  APP_PACKAGE          - Android app package (default: com.growbro.app)"
        exit 1
        ;;
esac
