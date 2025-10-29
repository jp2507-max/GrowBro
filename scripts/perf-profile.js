#!/usr/bin/env node
/**
 * Local performance profiling script
 * Launches a release build with performance monitoring enabled
 * Collects Sentry traces and Perfetto traces (Android 12+)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PLATFORM = process.argv[2] || 'android';
const OUTPUT_DIR = path.join(process.cwd(), 'performance-artifacts');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🔍 Starting performance profiling...');
console.log(`Platform: ${PLATFORM}`);
console.log(`Output directory: ${OUTPUT_DIR}`);

// Set environment variables for performance monitoring
process.env.SENTRY_ENV = 'profiling';
process.env.ENABLE_PERFORMANCE_MONITORING = 'true';

try {
  if (PLATFORM === 'android') {
    console.log('\n📱 Building Android release...');
    execSync('pnpm run android --variant=release', { stdio: 'inherit' });

    console.log('\n📊 Starting Android System Trace...');
    console.log(
      'To capture a Perfetto trace, use Android Studio System Trace or:'
    );
    console.log(
      '  adb shell "perfetto -c - --txt -o /data/misc/perfetto-traces/trace" < perfetto-config.txt'
    );
    console.log('\nPress Ctrl+C when done profiling.');
  } else if (PLATFORM === 'ios') {
    console.log('\n📱 Building iOS release...');
    execSync('pnpm run ios --configuration Release', { stdio: 'inherit' });

    console.log('\n📊 Starting iOS Instruments profiling...');
    console.log('Use Xcode Instruments to capture performance data:');
    console.log('  1. Open Xcode');
    console.log('  2. Product > Profile (⌘I)');
    console.log('  3. Choose "Time Profiler" or "System Trace"');
    console.log('\nPress Ctrl+C when done profiling.');
  } else {
    console.error('❌ Invalid platform. Use "android" or "ios"');
    process.exit(1);
  }

  console.log('\n✅ Performance profiling session started.');
  console.log('📈 Sentry tracing is enabled.');
  console.log('🔗 Check Sentry dashboard for performance traces.');
  console.log(
    `📁 Save any captured traces to: ${path.relative(process.cwd(), OUTPUT_DIR)}`
  );

  console.log('\n📝 Performance profiling instructions:');
  console.log('  1. Interact with the app to generate performance data');
  console.log(
    '  2. Focus on critical user flows (startup, navigation, scrolling)'
  );
  console.log('  3. Check Sentry dashboard for transaction traces');
  console.log('  4. For Android 12+: Capture Perfetto FrameTimeline traces');
  console.log('  5. For iOS: Use Instruments Time Profiler');

  // Keep process alive
  process.stdin.resume();
} catch (error) {
  console.error('❌ Performance profiling failed:', error.message);
  process.exit(1);
}
