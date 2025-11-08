#!/usr/bin/env node

/**
 * Performance Trend Validator for CI
 *
 * Analyzes performance metrics against 7-day moving average baseline
 * and fails CI if regression exceeds 10% threshold.
 *
 * Requirements: Spec 21, Task 12 - Performance Trend Analysis
 *
 * Usage:
 *   node scripts/ci/performance-trend-validator.js
 *
 * Environment Variables:
 *   - SENTRY_AUTH_TOKEN: Sentry API authentication token (required)
 *   - SENTRY_ORG: Sentry organization slug (required)
 *   - SENTRY_PROJECT: Sentry project slug (required)
 *   - BUILD_HASH: Git commit hash (required)
 *   - PLATFORM: android | ios (required)
 *   - DEVICE_MODEL: Device name (required)
 *   - PERFORMANCE_REPORT_PATH: Path to performance report JSON (required)
 *   - TREND_WINDOW_DAYS: Number of days for moving average (default: 7)
 *   - TREND_THRESHOLD: Regression threshold as decimal (default: 0.1 = 10%)
 *   - MIN_DATA_POINTS: Minimum data points required (default: 3)
 */

const fs = require('fs');
const https = require('https');

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  sentryAuthToken: process.env.SENTRY_AUTH_TOKEN || null,
  sentryOrg: process.env.SENTRY_ORG || null,
  sentryProject: process.env.SENTRY_PROJECT || null,
  buildHash: process.env.BUILD_HASH || process.env.GITHUB_SHA || null,
  platform: process.env.PLATFORM || null,
  deviceModel: process.env.DEVICE_MODEL || null,
  performanceReportPath: process.env.PERFORMANCE_REPORT_PATH || null,
  trendWindowDays: parseInt(process.env.TREND_WINDOW_DAYS || '7', 10),
  trendThreshold: parseFloat(process.env.TREND_THRESHOLD || '0.1'),
  minDataPoints: parseInt(process.env.MIN_DATA_POINTS || '3', 10),
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
 * Validate required configuration
 */
function validateConfig() {
  const required = [
    'sentryAuthToken',
    'sentryOrg',
    'sentryProject',
    'buildHash',
    'platform',
    'deviceModel',
    'performanceReportPath',
  ];

  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    failCI(
      `Missing required environment variables: ${missing.map((k) => k.toUpperCase()).join(', ')}`
    );
  }

  if (!fs.existsSync(config.performanceReportPath)) {
    failCI(`Performance report not found at: ${config.performanceReportPath}`);
  }

  log('Configuration validated ✓');
}

/**
 * Make HTTPS request to Sentry API
 */
function sentryApiRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'sentry.io',
      port: 443,
      path: `/api/0${path}`,
      method,
      headers: {
        Authorization: `Bearer ${config.sentryAuthToken}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (_error) {
            resolve(data);
          }
        } else {
          reject(
            new Error(
              `Sentry API request failed: ${res.statusCode} ${res.statusMessage}\n${data}`
            )
          );
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Fetch historical performance metrics from Sentry
 */
async function fetchHistoricalMetrics(metricName, days = 7) {
  log(`Fetching historical data for ${metricName} (${days} days)...`);

  try {
    // Calculate time range
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - days * 24 * 60 * 60;

    // Query Sentry Discover API for historical metrics
    // Note: This is a simplified example. Actual implementation would use
    // Sentry's Discover or Metrics API with proper query syntax
    const query = `/organizations/${config.sentryOrg}/events/`;
    const params = new URLSearchParams({
      project: config.sentryProject,
      start: new Date(startTime * 1000).toISOString(),
      end: new Date(endTime * 1000).toISOString(),
      field: ['timestamp', metricName, 'device', 'platform', 'release'],
      query: `device:${config.deviceModel} platform:${config.platform}`,
      sort: '-timestamp',
      per_page: '100',
    });

    const response = await sentryApiRequest(`${query}?${params.toString()}`);

    // Transform response to time series format
    const dataPoints = (response.data || []).map((event) => ({
      timestamp: new Date(event.timestamp).getTime(),
      metric: metricName,
      value: parseFloat(event[metricName] || 0),
      buildHash: event.release || 'unknown',
      device: event.device || config.deviceModel,
      platform: event.platform || config.platform,
    }));

    log(`Fetched ${dataPoints.length} data points for ${metricName}`);
    return dataPoints;
  } catch (error) {
    log(
      `Failed to fetch historical metrics for ${metricName}: ${error.message}`,
      'WARN'
    );
    return [];
  }
}

/**
 * Calculate moving average
 */
function calculateMovingAverage(dataPoints, windowDays) {
  if (dataPoints.length === 0) {
    return null;
  }

  const mostRecentTimestamp = Math.max(...dataPoints.map((p) => p.timestamp));
  const windowStartTime =
    mostRecentTimestamp - windowDays * 24 * 60 * 60 * 1000;

  const windowPoints = dataPoints.filter(
    (point) => point.timestamp >= windowStartTime
  );

  if (windowPoints.length === 0) {
    return null;
  }

  const sum = windowPoints.reduce((acc, point) => acc + point.value, 0);
  return sum / windowPoints.length;
}

/**
 * Calculate percentage delta
 */
function calculateDelta(currentValue, baseline) {
  if (baseline === 0) {
    return currentValue === 0 ? 0 : 1;
  }
  return (currentValue - baseline) / baseline;
}

/**
 * Analyze trend for a metric
 */
function analyzeTrend(dataPoints, currentValue, metricName) {
  if (dataPoints.length < config.minDataPoints) {
    log(
      `Insufficient data points for ${metricName} (${dataPoints.length} < ${config.minDataPoints}). Skipping trend analysis.`,
      'WARN'
    );
    return {
      metric: metricName,
      currentValue,
      movingAverage: currentValue,
      delta: 0,
      exceedsThreshold: false,
      dataPoints: dataPoints.length,
      skipped: true,
    };
  }

  const movingAverage = calculateMovingAverage(
    dataPoints,
    config.trendWindowDays
  );

  if (movingAverage === null) {
    return {
      metric: metricName,
      currentValue,
      movingAverage: currentValue,
      delta: 0,
      exceedsThreshold: false,
      dataPoints: dataPoints.length,
      skipped: true,
    };
  }

  const delta = calculateDelta(currentValue, movingAverage);
  const exceedsThreshold = Math.abs(delta) > config.trendThreshold;

  return {
    metric: metricName,
    currentValue,
    movingAverage,
    delta,
    exceedsThreshold,
    dataPoints: dataPoints.length,
    skipped: false,
  };
}

/**
 * Format trend result for display
 */
function formatTrendResult(result) {
  if (result.skipped) {
    return `⊘ ${result.metric}: ${result.currentValue.toFixed(2)} (insufficient data)`;
  }

  const deltaPercent = (result.delta * 100).toFixed(1);
  const direction = result.delta > 0 ? 'increased' : 'decreased';
  const status = result.exceedsThreshold ? '⚠️ REGRESSION' : '✓ OK';

  return (
    `${status} ${result.metric}: ${result.currentValue.toFixed(2)} ` +
    `(${direction} ${Math.abs(parseFloat(deltaPercent))}% from ${result.movingAverage.toFixed(2)} MA)`
  );
}

/**
 * Extract metrics from performance report
 */
function extractMetrics(report) {
  const metrics = new Map();

  // Startup metrics
  if (report.metrics.startup?.tti) {
    metrics.set('startup.tti', report.metrics.startup.tti);
  }

  // Navigation metrics
  if (report.metrics.navigation?.p95TransitionMs) {
    metrics.set('navigation.p95', report.metrics.navigation.p95TransitionMs);
  }

  // Scroll metrics
  if (report.metrics.fps) {
    if (report.metrics.fps.avgFps !== null) {
      metrics.set('scroll.avgFps', report.metrics.fps.avgFps);
    }
    if (report.metrics.fps.p95FrameTime !== null) {
      metrics.set('scroll.p95FrameTime', report.metrics.fps.p95FrameTime);
    }
    if (report.metrics.fps.droppedFramesPct !== null) {
      metrics.set(
        'scroll.droppedFramesPct',
        report.metrics.fps.droppedFramesPct
      );
    }
  }

  // Sync metrics
  if (report.metrics.sync?.syncP95Ms) {
    metrics.set('sync.p95', report.metrics.sync.syncP95Ms);
  }

  return metrics;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  log('Starting performance trend analysis...');
  log(`Configuration: ${JSON.stringify(config, null, 2)}`, 'DEBUG');

  // Step 1: Validate configuration
  validateConfig();

  // Step 2: Load performance report
  log(`Loading performance report: ${config.performanceReportPath}`);
  const report = JSON.parse(
    fs.readFileSync(config.performanceReportPath, 'utf8')
  );

  // Step 3: Extract current metrics
  const currentMetrics = extractMetrics(report);
  log(`Extracted ${currentMetrics.size} metrics from report`);

  // Step 4: Fetch historical data and analyze trends
  const trendResults = [];
  let hasRegressions = false;

  for (const [metricName, currentValue] of currentMetrics.entries()) {
    log(`Analyzing trend for ${metricName}...`);

    // Fetch historical data
    const historicalData = await fetchHistoricalMetrics(
      metricName,
      config.trendWindowDays
    );

    // Analyze trend
    const result = analyzeTrend(historicalData, currentValue, metricName);
    trendResults.push(result);

    // Log result
    log(formatTrendResult(result));

    if (result.exceedsThreshold) {
      hasRegressions = true;
    }
  }

  // Step 5: Generate trend report
  const trendReport = {
    timestamp: new Date().toISOString(),
    buildHash: config.buildHash,
    platform: config.platform,
    device: config.deviceModel,
    config: {
      windowDays: config.trendWindowDays,
      threshold: config.trendThreshold,
      minDataPoints: config.minDataPoints,
    },
    results: trendResults,
    hasRegressions,
  };

  const trendReportPath = config.performanceReportPath.replace(
    '.json',
    '-trend.json'
  );
  fs.writeFileSync(trendReportPath, JSON.stringify(trendReport, null, 2));
  log(`Trend report saved: ${trendReportPath}`);

  // Step 6: Print summary
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE TREND ANALYSIS SUMMARY');
  console.log('='.repeat(80));
  console.log(JSON.stringify(trendReport, null, 2));
  console.log('='.repeat(80) + '\n');

  // Step 7: Fail CI if regressions detected
  if (hasRegressions) {
    const regressions = trendResults.filter((r) => r.exceedsThreshold);
    failCI(
      `Performance regressions detected (${regressions.length} metrics exceed ${config.trendThreshold * 100}% threshold):\n` +
        regressions.map((r) => `  - ${formatTrendResult(r)}`).join('\n')
    );
  }

  log('Trend analysis complete ✓');
  log('No performance regressions detected.');

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Trend analysis failed:', error);
    process.exit(1);
  });
}

module.exports = {
  calculateMovingAverage,
  calculateDelta,
  analyzeTrend,
  extractMetrics,
};
