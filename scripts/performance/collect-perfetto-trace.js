#!/usr/bin/env node

/**
 * Perfetto Trace Collection Script
 *
 * Collects Perfetto FrameTimeline traces for gesture performance validation.
 * Requires Android 12+ device with USB debugging enabled.
 *
 * Usage:
 *   node scripts/performance/collect-perfetto-trace.js --test gesture-performance
 *
 * Requirements: 2.3, 2.4
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const TRACE_DURATION_SECONDS = 30;
const OUTPUT_DIR = path.join(__dirname, '../../performance-artifacts');
const PERFETTO_CONFIG = {
  buffers: [
    {
      size_kb: 65536,
      fill_policy: 'RING_BUFFER',
    },
  ],
  data_sources: [
    {
      config: {
        name: 'android.surfaceflinger.frametimeline',
      },
    },
    {
      config: {
        name: 'linux.ftrace',
        ftrace_config: {
          ftrace_events: ['sched/sched_switch', 'sched/sched_wakeup'],
          buffer_size_kb: 16384,
        },
      },
    },
  ],
  duration_ms: TRACE_DURATION_SECONDS * 1000,
};

/**
 * Check if adb is available
 */
function checkAdb() {
  try {
    execSync('adb version', { stdio: 'ignore' });
    return true;
  } catch (_error) {
    console.error(
      '❌ adb not found. Please install Android SDK Platform Tools.'
    );
    return false;
  }
}

/**
 * Check if device is connected and running Android 12+
 */
function checkDevice() {
  try {
    const devices = execSync('adb devices', { encoding: 'utf-8' });
    const deviceLines = devices
      .split('\n')
      .filter((line) => line.includes('\tdevice'));

    if (deviceLines.length === 0) {
      console.error(
        '❌ No Android device connected. Please connect a device via USB.'
      );
      return false;
    }

    // Check Android version
    const sdkVersion = execSync('adb shell getprop ro.build.version.sdk', {
      encoding: 'utf-8',
    }).trim();
    const androidVersion = parseInt(sdkVersion, 10);

    if (androidVersion < 31) {
      console.error(
        `❌ Android 12+ required for FrameTimeline. Device is running Android API ${androidVersion}.`
      );
      return false;
    }

    console.log(`✅ Device connected (Android API ${androidVersion})`);
    return true;
  } catch (_error) {
    console.error('❌ Failed to check device:', _error.message);
    return false;
  }
}

/**
 * Start Perfetto trace collection
 */
function startTrace() {
  console.log(
    `\n📊 Starting Perfetto trace collection (${TRACE_DURATION_SECONDS}s)...`
  );

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate config file
  const configPath = path.join(OUTPUT_DIR, 'perfetto-config.txt');
  fs.writeFileSync(configPath, JSON.stringify(PERFETTO_CONFIG, null, 2));

  // Generate output filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const outputPath = path.join(
    OUTPUT_DIR,
    `gesture-trace-${timestamp}.perfetto-trace`
  );

  try {
    // Start trace using perfetto command
    console.log('⏳ Collecting trace data...');
    execSync(
      `adb shell perfetto -c - --json -o /data/misc/perfetto-traces/trace < "${configPath}"`,
      { stdio: 'inherit', timeout: (TRACE_DURATION_SECONDS + 10) * 1000 }
    );

    // Pull trace file from device
    console.log('📥 Pulling trace file from device...');
    execSync(`adb pull /data/misc/perfetto-traces/trace "${outputPath}"`, {
      stdio: 'inherit',
    });

    // Clean up device
    execSync('adb shell rm /data/misc/perfetto-traces/trace', {
      stdio: 'ignore',
    });

    console.log(`\n✅ Trace collected successfully!`);
    console.log(`📁 Output: ${outputPath}`);
    console.log(`\n🔍 View trace at: https://ui.perfetto.dev`);
    console.log(`   Upload the file: ${outputPath}`);

    return outputPath;
  } catch (error) {
    console.error('❌ Failed to collect trace:', error.message);
    return null;
  }
}

/**
 * Analyze trace for gesture performance metrics
 */
function analyzeTrace(tracePath) {
  console.log('\n📈 Analyzing gesture performance...');

  // Note: Full trace analysis requires Perfetto trace processor
  // For now, we just provide instructions for manual analysis
  console.log(`
Manual Analysis Steps:
1. Open https://ui.perfetto.dev in your browser
2. Upload the trace file: ${tracePath}
3. Look for these metrics in FrameTimeline track:
   - Input latency (touch to frame present)
   - Frame drops (missed deadlines)
   - Jank events (>16.7ms frames)

Target Metrics:
- P95 input→render latency: ≤50ms
- Dropped frames: ≤1%
- Continuous gesture smoothness: 60 FPS

Key Tracks to Examine:
- "FrameTimeline" - Frame production timeline
- "SurfaceFlinger" - Display composition
- "app.growbro" - App process activity
- "RenderThread" - UI rendering
  `);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const testName =
    args.find((arg) => arg.startsWith('--test='))?.split('=')[1] ||
    'gesture-performance';

  console.log('🎯 Perfetto Trace Collection for Gesture Performance');
  console.log(`📋 Test: ${testName}\n`);

  // Pre-flight checks
  if (!checkAdb()) {
    process.exit(1);
  }

  if (!checkDevice()) {
    process.exit(1);
  }

  console.log('\n⚠️  Important:');
  console.log('1. Ensure app is running in RELEASE mode');
  console.log(
    '2. Start your gesture test (Maestro script) when trace collection begins'
  );
  console.log(
    '3. Perform continuous gestures throughout the collection period'
  );
  console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to start...');

  // Wait 5 seconds before starting
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Start trace collection
  const tracePath = startTrace();

  if (tracePath) {
    // Analyze trace
    analyzeTrace(tracePath);

    // Generate metadata file
    const metadataPath = tracePath.replace('.perfetto-trace', '.metadata.json');
    const metadata = {
      testName,
      timestamp: new Date().toISOString(),
      duration: TRACE_DURATION_SECONDS,
      tracePath,
      device: execSync('adb shell getprop ro.product.model', {
        encoding: 'utf-8',
      }).trim(),
      androidVersion: execSync('adb shell getprop ro.build.version.release', {
        encoding: 'utf-8',
      }).trim(),
      buildHash: process.env.GITHUB_SHA || 'local',
      requirements: ['2.3', '2.4'],
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`\n📄 Metadata: ${metadataPath}`);
  }

  process.exit(tracePath ? 0 : 1);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
