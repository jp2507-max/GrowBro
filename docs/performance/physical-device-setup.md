# Physical Device Setup for Performance Testing

This guide covers the setup and configuration of physical Android devices for performance testing with Perfetto trace collection.

## Device Selection Criteria

### Recommended Devices

**Primary Test Device:**

- **Google Pixel 6a** (Android 14)
  - Representative mid-range device
  - Excellent Perfetto support
  - Target device for performance budgets (TTI ≤1.8s)

**Secondary Test Devices:**

- **Moto G Power / G Play** (Android 13)
  - Lower-end device for worst-case testing
  - Validates performance on budget hardware

### Device Requirements

- Android 12+ (for FrameTimeline support)
- USB debugging enabled
- Developer options enabled
- At least 4GB RAM
- Stable USB connection for ADB

## Android Device Configuration

### 1. Enable Developer Options

1. Go to **Settings** → **About phone**
2. Tap **Build number** 7 times
3. Enter device PIN/password
4. Developer options are now enabled

### 2. Enable USB Debugging

1. Go to **Settings** → **System** → **Developer options**
2. Enable **USB debugging**
3. Connect device via USB
4. Accept the "Allow USB debugging" prompt on device
5. Verify connection: `adb devices`

### 3. Configure Performance Settings

For consistent performance testing, configure these settings:

```bash
# Disable animations (optional, for faster tests)
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0

# Keep screen on during testing
adb shell settings put system screen_off_timeout 1800000  # 30 minutes

# Set performance mode (if supported)
adb shell settings put global low_power 0
```

### 4. Install Required Tools

Ensure you have the following tools installed:

- **Android SDK Platform Tools** (includes ADB)
- **Perfetto CLI** (for trace collection)
- **Maestro CLI** (for test execution)

```bash
# Install Maestro
curl -Ls 'https://get.maestro.mobile.dev' | bash

# Verify installations
adb version
maestro --version
```

## Perfetto Trace Collection

### Basic Trace Collection

**Start trace before running tests:**

```bash
# Start Perfetto trace (runs in background)
adb shell perfetto -c - --txt -o /data/misc/perfetto-traces/trace.pb <<EOF
buffers {
  size_kb: 63488
  fill_policy: RING_BUFFER
}

data_sources {
  config {
    name: "android.surfaceflinger.frametimeline"
  }
}

data_sources {
  config {
    name: "linux.process_stats"
    process_stats_config {
      scan_all_processes_on_start: true
    }
  }
}

duration_ms: 60000
EOF
```

**Run your performance tests:**

```bash
maestro test .maestro/performance/agenda-scroll-performance.yaml
```

**Stop trace and pull results:**

```bash
# Trace stops automatically after duration_ms
# Pull trace file
adb pull /data/misc/perfetto-traces/trace.pb ./perfetto-trace.pb

# Clean up device
adb shell rm /data/misc/perfetto-traces/trace.pb
```

### Advanced Trace Configuration

For more detailed traces, use this configuration:

```bash
adb shell perfetto -c - --txt -o /data/misc/perfetto-traces/trace.pb <<EOF
buffers {
  size_kb: 131072  # 128 MB
  fill_policy: RING_BUFFER
}

# FrameTimeline for jank attribution
data_sources {
  config {
    name: "android.surfaceflinger.frametimeline"
  }
}

# Process stats for memory tracking
data_sources {
  config {
    name: "linux.process_stats"
    process_stats_config {
      scan_all_processes_on_start: true
      proc_stats_poll_ms: 1000
    }
  }
}

# System trace for CPU/GPU
data_sources {
  config {
    name: "linux.ftrace"
    ftrace_config {
      ftrace_events: "sched/sched_switch"
      ftrace_events: "power/suspend_resume"
      ftrace_events: "sched/sched_wakeup"
      ftrace_events: "sched/sched_waking"
      ftrace_events: "sched/sched_blocked_reason"
      ftrace_events: "sched/sched_cpu_hotplug"
    }
  }
}

duration_ms: 60000
EOF
```

### Analyzing Perfetto Traces

1. **Open Perfetto UI**: Navigate to https://ui.perfetto.dev
2. **Load trace**: Click "Open trace file" and select your `.pb` file
3. **Key metrics to check**:
   - **Frame Timeline**: Look for red frames (janky frames)
   - **Frame Duration**: Should be ≤16.7ms for 60 FPS
   - **Dropped Frames**: Should be ≤1%
   - **Memory Usage**: Check RSS growth during scrolling

### Interpreting FrameTimeline

- **Green frames**: Rendered on time (≤16.7ms)
- **Yellow frames**: Slightly delayed (16.7-33.3ms)
- **Red frames**: Janky (>33.3ms or dropped)

**Performance Budget:**

- Jank count: ≤5 per 1,000 frames
- P95 frame time: ≤16.7ms
- Average FPS: ≥58

## Automated Performance Testing

### Using the Test Runner Script

```bash
# Run all performance tests with artifact collection
./scripts/ci/run-performance-tests.sh android pixel6a

# Output will be saved to ./performance-artifacts/
```

### CI/CD Integration

For GitHub Actions or similar CI:

```yaml
- name: Run Performance Tests
  run: |
    # Connect to device (physical or emulator)
    adb devices

    # Run performance tests
    ./scripts/ci/run-performance-tests.sh android pixel6a ./artifacts

- name: Upload Performance Artifacts
  uses: actions/upload-artifact@v3
  with:
    name: performance-artifacts
    path: ./artifacts/
```

## Troubleshooting

### Device Not Detected

```bash
# Check USB connection
adb devices

# If device shows as "unauthorized", check device screen for prompt

# Restart ADB server
adb kill-server
adb start-server
```

### Perfetto Trace Fails

```bash
# Check permissions
adb shell ls -la /data/misc/perfetto-traces/

# If permission denied, try:
adb root  # Requires rooted device or userdebug build
adb shell mkdir -p /data/misc/perfetto-traces/
adb shell chmod 777 /data/misc/perfetto-traces/
```

### Performance Tests Fail on Physical Device

1. **Ensure release build**: Dev builds have different performance characteristics
2. **Check battery level**: Low battery can throttle performance
3. **Close background apps**: Other apps can affect results
4. **Disable battery saver**: Can limit CPU/GPU performance
5. **Check thermal throttling**: Let device cool down between tests

### Memory Issues During Testing

```bash
# Clear app data before testing
adb shell pm clear com.obytes.production

# Force garbage collection (if supported)
adb shell am force-stop com.obytes.production
adb shell am start -n com.obytes.production/.MainActivity
```

## Best Practices

### Before Each Test Run

1. **Clear app data** to ensure clean state
2. **Restart device** if running multiple tests
3. **Check battery level** (>50% recommended)
4. **Close background apps**
5. **Let device cool down** if warm

### During Testing

1. **Don't touch the device** during automated tests
2. **Keep USB connected** for stable ADB connection
3. **Monitor device temperature**
4. **Watch for system dialogs** that might interrupt tests

### After Testing

1. **Pull all artifacts** before clearing device
2. **Verify trace files** are not corrupted
3. **Document any anomalies** in test results
4. **Compare against baseline** metrics

## Performance Budgets Reference

### Startup Performance

- **Pixel 6a**: TTI ≤1.8s (cold start)
- **iPhone 12**: TTI ≤1.3s (cold start)

### Scroll Performance (30s continuous scroll, 1k items)

- Average FPS: ≥58
- P95 frame time: ≤16.7ms
- Dropped frames: ≤1%
- Jank count: ≤5 per 1k frames
- Blank cells: 0

### Memory Performance

- RSS increase during scroll: ≤50 MB
- Post-GC memory delta: ≤10 MB from baseline

### Navigation Performance

- Screen transitions: P95 ≤250ms

## Additional Resources

- [Perfetto Documentation](https://perfetto.dev/docs/)
- [Android FrameTimeline Guide](https://source.android.com/docs/core/graphics/frame-timeline)
- [Maestro Documentation](https://maestro.mobile.dev/)
- [React Native Performance](https://reactnative.dev/docs/performance)
