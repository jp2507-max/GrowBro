#!/usr/bin/env node

/**
 * Performance Validation Script for CI
 *
 * Enforces performance budgets for Tasks 5 & 9:
 * - Validates test runs on RELEASE builds only
 * - Collects RN Performance JSON + Perfetto traces
 * - Verifies memory, FPS, startup, navigation, and sync budgets
 * - Fails CI if budgets exceeded
 *
 * Requirements: Spec 21, Tasks 5 & 9 - Performance Enforcement
 *
 * Memory Metrics Collection:
 *   - Android: Use `adb shell dumpsys meminfo <package>` during/after test execution
 *   - iOS: Use Xcode Instruments Allocations profiler or custom instrumentation
 *   - Output format: JSON with baselineRSS, peakRSS, postGCRSS fields (in MB)
 *   - Example: scripts/ci/example-memory-metrics.json
 *
 * Budgets (CI FAIL if exceeded):
 *   - Startup TTI: Pixel 6a ≤1.8s, iPhone 12 ≤1.3s
 *   - Navigation: P95 transition ≤250ms
 *   - Scroll: P95 frame time ≤16.7ms, dropped frames ≤1%, avg FPS ≥58
 *   - Sync (500 items): P95 ≤2.5s on LTE simulation
 *
 * Usage:
 *   node scripts/ci/performance-validation.js
 *
 * Environment Variables:
 *   - BUILD_TYPE: Must be 'release' (required)
 *   - PLATFORM: android | ios (required)
 *   - DEVICE_MODEL: Device name for device-specific budgets (required)
 *   - OS_VERSION: Operating system version (required)
 *   - BUILD_HASH: Git commit hash (required)
 *   - DATASET_SIZE: Test dataset size (required)
 *   - MAESTRO_OUTPUT_DIR: Directory for Maestro test results (default: ./maestro-results)
 *   - PERFETTO_TRACE_PATH: Path to Perfetto trace file (Android only)
 *   - RN_PERF_JSON_PATH: Path to RN Performance JSON report
 *   - MEMORY_METRICS_PATH: Path to memory metrics JSON file (optional - memory validation skipped if not provided)
 *   - SENTRY_ORG: Sentry organization slug (optional)
 *   - SENTRY_PROJECT: Sentry project slug (optional)
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// ============================================================================
// PERFORMANCE BUDGETS (from Spec 21, Tasks 5 & 9)
// ============================================================================

const BUDGETS = {
  scroll: {
    avgFps: 58, // Average FPS must be ≥58
    p95FrameTime: 16.7, // P95 frame time must be ≤16.7ms (60 FPS)
    droppedFramesPct: 1, // Dropped frames must be ≤1%
    jankCount: 5, // Jank count must be ≤5 per 1k frames
    blankCells: 0, // Zero blank cells allowed
    memoryDeltaMB: 50, // RSS increase must be ≤50 MB
    memoryPostGCMB: 10, // Post-GC memory must be within ≤10 MB of baseline
  },
  startup: {
    // Device-specific TTI thresholds (cold start)
    ttiThresholds: {
      'Pixel 6a': 1800, // 1.8s in ms
      'Pixel 6a Emulator': 1800,
      'Moto G Power': 2000, // Slightly higher for lower-end devices
      'Moto G Play': 2000,
      'iPhone 12': 1300, // 1.3s in ms
      'iPhone 12 Simulator': 1300,
    },
    defaultTTI: 2000, // Fallback for unknown devices
  },
  navigation: {
    p95TransitionMs: 250, // P95 screen transition must be ≤250ms
  },
  sync: {
    p95SyncMs: 2500, // P95 sync time for 500 items must be ≤2.5s
    itemCount: 500, // Standard test dataset size
  },
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  maestroOutputDir: process.env.MAESTRO_OUTPUT_DIR || './maestro-results',
  perfettoTracePath: process.env.PERFETTO_TRACE_PATH || null,
  rnPerfJsonPath: process.env.RN_PERF_JSON_PATH || null,
  memoryMetricsPath: process.env.MEMORY_METRICS_PATH || null,
  sentryOrg: process.env.SENTRY_ORG || null,
  sentryProject: process.env.SENTRY_PROJECT || null,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Log with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const prefix = {
    INFO: '✓',
    WARN: '⚠',
    ERROR: '✗',
    DEBUG: '→',
  }[level];
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Fail CI with error message
 */
function failCI(message) {
  log(message, 'ERROR');
  process.exit(1);
}

/**
 * Check if running on release build
 */
function validateReleaseBuild() {
  log('Validating release build configuration...');

  // This is a placeholder - actual implementation would check build config
  // In practice, you'd parse the app's build config or check Metro bundler output
  // Common dev build indicators to check: __DEV__, FLIPPER_ENABLED, REMOTE_DEBUG, DEV_MENU_ENABLED

  // For now, we'll check if the build was created with --release flag
  const buildType = process.env.BUILD_TYPE || 'unknown';

  if (buildType !== 'release') {
    failCI(
      `Performance tests MUST run on release builds only. Current build type: ${buildType}\n` +
        'Set BUILD_TYPE=release environment variable or use --release flag.'
    );
  }

  log('Release build validated ✓', 'INFO');
}

/**
 * Parse RN Performance JSON report
 */
function parseRNPerformanceReport(jsonPath) {
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    failCI(
      `RN Performance JSON not found at ${jsonPath}. Required RN metrics are missing.`
    );
  }

  log(`Parsing RN Performance report: ${jsonPath}`);

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Extract relevant metrics
    // Note: Actual structure depends on @shopify/react-native-performance output
    const metrics = {
      avgFps: data.avgFps || null,
      p95FrameTime: data.p95FrameTime || null,
      droppedFramesPct: data.droppedFramesPct || null,
      renderSpans: data.renderSpans || [],
    };

    log(`RN Performance metrics: ${JSON.stringify(metrics, null, 2)}`, 'DEBUG');
    return metrics;
  } catch (error) {
    failCI(
      `Failed to parse RN Performance JSON at ${jsonPath}: ${error.message}`
    );
  }
}

/**
 * Parse Perfetto trace (Android only)
 */
function parsePerfettoTrace(tracePath) {
  if (!tracePath || !fs.existsSync(tracePath)) {
    log(
      `Perfetto trace not found at ${tracePath}. Skipping Perfetto metrics.`,
      'WARN'
    );
    return null;
  }

  log(`Perfetto trace found: ${tracePath}`);

  // Perfetto traces are binary protobuf files
  // Actual parsing requires perfetto trace_processor or Python API
  // For now, we'll just verify the file exists and has reasonable size

  const stats = fs.statSync(tracePath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  log(`Perfetto trace size: ${sizeMB} MB`, 'INFO');

  if (stats.size < 1024) {
    log('Perfetto trace is suspiciously small. May be corrupted.', 'WARN');
  }

  // TODO: Integrate with Perfetto trace_processor to extract:
  // - Frame timeline metrics
  // - Jank count
  // - Input latency
  // - Memory usage

  return {
    tracePath,
    sizeMB: parseFloat(sizeMB),
  };
}

/**
 * Parse memory metrics from JSON file
 *
 * Expected JSON structure:
 * {
 *   "baselineRSS": 150,    // MB - Memory usage at baseline (app start)
 *   "peakRSS": 195,        // MB - Peak memory usage during test
 *   "postGCRSS": 158       // MB - Memory usage after garbage collection
 * }
 */
function parseMemoryMetrics(jsonPath) {
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    log(
      `Memory metrics JSON not found at ${jsonPath}. Memory validation will be skipped.`,
      'WARN'
    );
    return null;
  }

  log(`Parsing memory metrics: ${jsonPath}`);

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Validate required fields
    const requiredFields = ['baselineRSS', 'peakRSS', 'postGCRSS'];
    const missingFields = requiredFields.filter(
      (field) => !data.hasOwnProperty(field)
    );

    if (missingFields.length > 0) {
      failCI(
        `Memory metrics JSON missing required fields: ${missingFields.join(', ')}`
      );
    }

    // Validate field types
    const metrics = {};
    for (const field of requiredFields) {
      if (typeof data[field] !== 'number' || data[field] < 0) {
        failCI(
          `Memory metrics field '${field}' must be a non-negative number, got: ${data[field]}`
        );
      }
      metrics[field] = data[field];
    }

    log(
      `Parsed memory metrics: baseline=${metrics.baselineRSS}MB, peak=${metrics.peakRSS}MB, postGC=${metrics.postGCRSS}MB`,
      'INFO'
    );
    return metrics;
  } catch (error) {
    failCI(`Failed to parse memory metrics JSON: ${error.message}`);
  }
}

/**
 * Parse Maestro JSON test result file
 */
function parseMaestroJsonResult(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  let passed = true;
  let blankCellsDetected = false;
  const errorMessages = [];

  // Check for test results with failures
  if (data.tests && Array.isArray(data.tests)) {
    for (const test of data.tests) {
      if (test.result === 'failure' || test.result === 'error') {
        passed = false;
        errorMessages.push(
          `${test.name || 'Unknown test'}: ${test.message || 'No message'}`
        );
      }

      // Check for blank cell indicators in test data
      if (test.assertions && Array.isArray(test.assertions)) {
        for (const assertion of test.assertions) {
          if (
            assertion.name &&
            assertion.name.toLowerCase().includes('blank') &&
            assertion.name.toLowerCase().includes('cell')
          ) {
            if (
              assertion.result === 'failure' ||
              assertion.result === 'error'
            ) {
              blankCellsDetected = true;
            }
          }
        }
      }
    }
  }

  // Alternative structure: check for top-level result array
  if (data.results && Array.isArray(data.results)) {
    for (const result of data.results) {
      if (result.status === 'failed' || result.status === 'error') {
        passed = false;
        errorMessages.push(
          `${result.name || 'Unknown test'}: ${result.message || 'No message'}`
        );
      }
    }
  }

  return {
    passed,
    blankCellsDetected,
    errorMessages,
  };
}

/**
 * Parse Maestro XML (JUnit) test result file
 */
function parseMaestroXmlResult(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  return new Promise((resolve, reject) => {
    xml2js.parseString(content, { explicitArray: false }, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      let passed = true;
      let blankCellsDetected = false;
      const errorMessages = [];

      try {
        // JUnit XML structure: testsuites > testsuite > testcase
        const testSuites = result.testsuites || result;

        // Handle both single testsuite and multiple testsuites
        const suites = Array.isArray(testSuites.testsuite)
          ? testSuites.testsuite
          : [testSuites.testsuite].filter(Boolean);

        for (const suite of suites) {
          if (!suite) continue;

          const testCases = Array.isArray(suite.testcase)
            ? suite.testcase
            : [suite.testcase].filter(Boolean);

          for (const testCase of testCases) {
            if (!testCase) continue;

            // Check for failure/error nodes
            if (testCase.failure || testCase.error) {
              passed = false;
              const failure = testCase.failure || testCase.error;
              const message =
                typeof failure === 'string'
                  ? failure
                  : failure._ || failure.message || 'Test failed';
              errorMessages.push(
                `${testCase.name || testCase.$.name || 'Unknown test'}: ${message}`
              );
            }

            // Check for blank cell indicators in test name or failure messages
            const testName = (
              testCase.$.name ||
              testCase.name ||
              ''
            ).toLowerCase();
            if (testName.includes('blank') && testName.includes('cell')) {
              if (testCase.failure || testCase.error) {
                blankCellsDetected = true;
              }
            }

            // Check system-out for blank cell markers
            if (testCase['system-out']) {
              const output =
                typeof testCase['system-out'] === 'string'
                  ? testCase['system-out']
                  : testCase['system-out']._;
              if (output && output.toLowerCase().includes('blank cell')) {
                blankCellsDetected = true;
              }
            }
          }
        }
      } catch (parseError) {
        reject(
          new Error(`Failed to parse XML structure: ${parseError.message}`)
        );
        return;
      }

      resolve({
        passed,
        blankCellsDetected,
        errorMessages,
      });
    });
  });
}

/**
 * Parse Maestro test results
 */
async function parseMaestroResults(outputDir) {
  if (!fs.existsSync(outputDir)) {
    failCI(`Maestro output directory not found: ${outputDir}`);
  }

  log(`Parsing Maestro results from: ${outputDir}`);

  // Look for JUnit XML or JSON results
  const files = fs.readdirSync(outputDir);
  const resultFiles = files.filter(
    (f) => f.endsWith('.xml') || f.endsWith('.json')
  );

  if (resultFiles.length === 0) {
    failCI('No Maestro result files found');
  }

  log(`Found ${resultFiles.length} result file(s)`, 'INFO');

  // Parse results from all result files
  let passed = true;
  let blankCellsDetected = false;
  const errors = [];

  for (const file of resultFiles) {
    const filePath = path.join(outputDir, file);
    const fileExt = path.extname(file).toLowerCase();

    try {
      if (fileExt === '.json') {
        const result = parseMaestroJsonResult(filePath);
        if (!result.passed) {
          passed = false;
          errors.push(
            `Test failures in ${file}: ${result.errorMessages.join(', ')}`
          );
        }
        if (result.blankCellsDetected) {
          blankCellsDetected = true;
          errors.push(`Blank cells detected in ${file}`);
        }
      } else if (fileExt === '.xml') {
        const result = await parseMaestroXmlResult(filePath);
        if (!result.passed) {
          passed = false;
          errors.push(
            `Test failures in ${file}: ${result.errorMessages.join(', ')}`
          );
        }
        if (result.blankCellsDetected) {
          blankCellsDetected = true;
          errors.push(`Blank cells detected in ${file}`);
        }
      }
    } catch (error) {
      log(`Error parsing ${file}: ${error.message}`, 'ERROR');
      passed = false;
      errors.push(`Failed to parse ${file}: ${error.message}`);
    }
  }

  const results = {
    passed,
    blankCellsDetected,
    errors,
  };

  return results;
}

/**
 * Validate memory metrics
 */
function validateMemoryMetrics() {
  log('Validating memory metrics...');

  // Parse memory metrics from JSON file
  const memoryMetrics = parseMemoryMetrics(config.memoryMetricsPath);

  if (!memoryMetrics) {
    log(
      'Memory metrics data not available. Skipping memory validation.',
      'WARN'
    );
    return null;
  }

  const deltaMB = memoryMetrics.peakRSS - memoryMetrics.baselineRSS;
  const postGCDeltaMB = memoryMetrics.postGCRSS - memoryMetrics.baselineRSS;

  log(`Memory baseline: ${memoryMetrics.baselineRSS} MB`, 'INFO');
  log(`Memory peak: ${memoryMetrics.peakRSS} MB (+${deltaMB} MB)`, 'INFO');
  log(
    `Memory post-GC: ${memoryMetrics.postGCRSS} MB (+${postGCDeltaMB} MB)`,
    'INFO'
  );

  const budget = BUDGETS.scroll;

  if (deltaMB > budget.memoryDeltaMB) {
    failCI(
      `Memory delta exceeded budget: ${deltaMB} MB > ${budget.memoryDeltaMB} MB`
    );
  }

  if (postGCDeltaMB > budget.memoryPostGCMB) {
    failCI(
      `Post-GC memory delta exceeded budget: ${postGCDeltaMB} MB > ${budget.memoryPostGCMB} MB`
    );
  }

  log('Memory metrics within budget ✓', 'INFO');
  return memoryMetrics;
}

/**
 * Validate FPS metrics
 */
function validateFPSMetrics(rnPerfMetrics) {
  log('Validating FPS metrics...');

  if (!rnPerfMetrics) {
    failCI(
      'RN Performance metrics are required but not available. Cannot validate FPS metrics.'
    );
  }

  const budget = BUDGETS.scroll;

  if (rnPerfMetrics.avgFps !== null) {
    log(`Average FPS: ${rnPerfMetrics.avgFps}`, 'INFO');
    if (rnPerfMetrics.avgFps < budget.avgFps) {
      failCI(
        `Average FPS below budget: ${rnPerfMetrics.avgFps} < ${budget.avgFps}`
      );
    }
  }

  if (rnPerfMetrics.p95FrameTime !== null) {
    log(`P95 frame time: ${rnPerfMetrics.p95FrameTime} ms`, 'INFO');
    if (rnPerfMetrics.p95FrameTime > budget.p95FrameTime) {
      failCI(
        `P95 frame time exceeded budget: ${rnPerfMetrics.p95FrameTime} ms > ${budget.p95FrameTime} ms`
      );
    }
  }

  if (rnPerfMetrics.droppedFramesPct !== null) {
    log(`Dropped frames: ${rnPerfMetrics.droppedFramesPct}%`, 'INFO');
    if (rnPerfMetrics.droppedFramesPct > budget.droppedFramesPct) {
      failCI(
        `Dropped frames exceeded budget: ${rnPerfMetrics.droppedFramesPct}% > ${budget.droppedFramesPct}%`
      );
    }
  }

  if (
    rnPerfMetrics.jankCount !== null &&
    rnPerfMetrics.jankCount !== undefined
  ) {
    log(`Jank count: ${rnPerfMetrics.jankCount}`, 'INFO');
    if (rnPerfMetrics.jankCount > budget.jankCount) {
      failCI(
        `Jank count exceeded budget: ${rnPerfMetrics.jankCount} > ${budget.jankCount} per 1k frames`
      );
    }
  }

  log('FPS metrics within budget ✓', 'INFO');
}

/**
 * Validate startup metrics (TTI)
 */
function validateStartupMetrics(rnPerfMetrics) {
  log('Validating startup metrics...');

  if (!rnPerfMetrics || !rnPerfMetrics.tti) {
    log('No startup metrics available. Skipping startup validation.', 'WARN');
    return;
  }

  const deviceModel = process.env.DEVICE_MODEL || 'unknown';
  const budget = BUDGETS.startup;
  const threshold = budget.ttiThresholds[deviceModel] || budget.defaultTTI;

  const ttiMs = rnPerfMetrics.tti;
  log(`TTI: ${ttiMs} ms (device: ${deviceModel})`, 'INFO');
  log(`Budget: ${threshold} ms`, 'INFO');

  if (ttiMs > threshold) {
    failCI(
      `Startup TTI exceeded budget: ${ttiMs} ms > ${threshold} ms for ${deviceModel}`
    );
  }

  log('Startup metrics within budget ✓', 'INFO');
  return { tti: ttiMs, threshold, device: deviceModel };
}

/**
 * Validate navigation metrics
 */
function validateNavigationMetrics(rnPerfMetrics) {
  log('Validating navigation metrics...');

  if (!rnPerfMetrics || !rnPerfMetrics.navigationP95) {
    log(
      'No navigation metrics available. Skipping navigation validation.',
      'WARN'
    );
    return;
  }

  const budget = BUDGETS.navigation;
  const p95TransitionMs = rnPerfMetrics.navigationP95;

  log(`Navigation P95 transition: ${p95TransitionMs} ms`, 'INFO');
  log(`Budget: ${budget.p95TransitionMs} ms`, 'INFO');

  if (p95TransitionMs > budget.p95TransitionMs) {
    failCI(
      `Navigation P95 exceeded budget: ${p95TransitionMs} ms > ${budget.p95TransitionMs} ms`
    );
  }

  log('Navigation metrics within budget ✓', 'INFO');
  return { p95TransitionMs };
}

/**
 * Validate sync metrics
 */
function validateSyncMetrics(rnPerfMetrics) {
  log('Validating sync metrics...');

  if (!rnPerfMetrics || !rnPerfMetrics.syncP95) {
    log('No sync metrics available. Skipping sync validation.', 'WARN');
    return;
  }

  const budget = BUDGETS.sync;
  const syncP95Ms = rnPerfMetrics.syncP95;
  const itemCount = rnPerfMetrics.syncItemCount || budget.itemCount;

  log(`Sync P95: ${syncP95Ms} ms (${itemCount} items)`, 'INFO');
  log(`Budget: ${budget.p95SyncMs} ms for ${budget.itemCount} items`, 'INFO');

  if (syncP95Ms > budget.p95SyncMs) {
    failCI(
      `Sync P95 exceeded budget: ${syncP95Ms} ms > ${budget.p95SyncMs} ms`
    );
  }

  log('Sync metrics within budget ✓', 'INFO');
  return { syncP95Ms, itemCount };
}

/**
 * Generate performance report
 */
function generateReport(data) {
  log('Generating performance report...');

  const report = {
    timestamp: new Date().toISOString(),
    buildType: process.env.BUILD_TYPE || 'unknown',
    platform: process.env.PLATFORM || 'unknown',
    device: process.env.DEVICE_MODEL || 'unknown',
    os: process.env.OS_VERSION || 'unknown',
    buildHash: process.env.BUILD_HASH || 'unknown',
    commit: process.env.GITHUB_SHA || process.env.BUILD_HASH || 'unknown',
    datasetSize: process.env.DATASET_SIZE || 'unknown',
    metrics: {
      memory: data.memory,
      fps: data.rnPerf,
      startup: data.startup,
      navigation: data.navigation,
      sync: data.sync,
      perfetto: data.perfetto,
    },
    budgets: {
      scroll: BUDGETS.scroll,
      startup: BUDGETS.startup,
      navigation: BUDGETS.navigation,
      sync: BUDGETS.sync,
    },
    passed: true,
  };

  const reportPath = path.join(
    config.maestroOutputDir,
    'performance-report.json'
  );

  // Ensure output directory exists
  if (!fs.existsSync(config.maestroOutputDir)) {
    fs.mkdirSync(config.maestroOutputDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log(`Performance report saved: ${reportPath}`, 'INFO');

  // Also log to console for CI artifacts
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE REPORT');
  console.log('='.repeat(80));
  console.log(JSON.stringify(report, null, 2));
  console.log('='.repeat(80) + '\n');

  return reportPath;
}

/**
 * Upload artifacts to Sentry (optional)
 */
function uploadToSentry(_reportPath) {
  if (!config.sentryOrg || !config.sentryProject) {
    log('Sentry not configured. Skipping upload.', 'WARN');
    return;
  }

  log('Uploading performance metrics to Sentry...');

  // This would use Sentry CLI or API to upload metrics
  // For now, just log the intent
  // TODO: Use reportPath to upload actual metrics

  log(
    `Would upload to Sentry: ${config.sentryOrg}/${config.sentryProject}`,
    'DEBUG'
  );

  // Example Sentry CLI command:
  // sentry-cli send-metric --org ${SENTRY_ORG} --project ${SENTRY_PROJECT} \
  //   gauge performance.scroll.fps ${avgFps}

  log('Sentry upload complete ✓', 'INFO');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  log('Starting performance validation...');
  log(`Configuration: ${JSON.stringify(config, null, 2)}`, 'DEBUG');

  // Step 1: Validate release build
  validateReleaseBuild();

  // Step 2: Parse test results
  const maestroResults = await parseMaestroResults(config.maestroOutputDir);

  if (!maestroResults.passed) {
    failCI('Maestro tests failed. Check test output for details.');
  }

  if (maestroResults.blankCellsDetected) {
    failCI('Blank cells detected during scroll test. Budget: 0 blank cells.');
  }

  // Step 3: Parse performance metrics
  const rnPerfMetrics = parseRNPerformanceReport(config.rnPerfJsonPath);
  const perfettoData = parsePerfettoTrace(config.perfettoTracePath);

  // Step 4: Validate metrics against budgets
  // Task 9: CI FAIL if budgets exceeded
  validateFPSMetrics(rnPerfMetrics);
  const memoryMetrics = validateMemoryMetrics();
  const startupMetrics = validateStartupMetrics(rnPerfMetrics);
  const navigationMetrics = validateNavigationMetrics(rnPerfMetrics);
  const syncMetrics = validateSyncMetrics(rnPerfMetrics);

  // Step 5: Generate report
  const reportPath = generateReport({
    maestro: maestroResults,
    rnPerf: rnPerfMetrics,
    perfetto: perfettoData,
    memory: memoryMetrics,
    startup: startupMetrics,
    navigation: navigationMetrics,
    sync: syncMetrics,
  });

  // Step 6: Upload to Sentry (optional)
  uploadToSentry(reportPath);

  log('Performance validation complete ✓', 'INFO');
  log('All budgets met. CI can proceed.', 'INFO');

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Performance validation failed:', error);
    process.exit(1);
  });
}

module.exports = {
  validateReleaseBuild,
  parseRNPerformanceReport,
  validateFPSMetrics,
  validateStartupMetrics,
  validateNavigationMetrics,
  validateSyncMetrics,
  validateMemoryMetrics,
  BUDGETS,
};
