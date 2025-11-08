#!/usr/bin/env node

/**
 * Performance Artifact Collector for CI
 *
 * Collects and organizes performance artifacts from test runs:
 * - RN Performance JSON reports
 * - Sentry trace URLs
 * - Perfetto traces (Android)
 * - Memory metrics
 *
 * Requirements: Spec 21, Task 10 - Performance Artifact Collection
 *
 * Usage:
 *   node scripts/ci/artifact-collector.ts
 *
 * Environment Variables:
 *   - BUILD_HASH: Git commit hash (required)
 *   - COMMIT: Git commit SHA (defaults to BUILD_HASH)
 *   - PLATFORM: android | ios (required)
 *   - DEVICE_MODEL: Device name (required)
 *   - OS_VERSION: Operating system version (required)
 *   - DATASET_SIZE: Test dataset size (required)
 *   - OUTPUT_DIR: Directory for collected artifacts (default: ./performance-artifacts)
 *   - PERFETTO_TRACE_PATH: Path to Perfetto trace file (Android only)
 *   - RN_PERF_JSON_PATH: Path to RN Performance JSON report
 *   - MEMORY_METRICS_PATH: Path to memory metrics JSON file
 *   - SENTRY_ORG: Sentry organization slug (optional)
 *   - SENTRY_PROJECT: Sentry project slug (optional)
 */

import * as fs from 'fs';
import * as path from 'path';

import type {
  ArtifactCollectionConfig,
  PerfettoTraceArtifact,
  PerformanceArtifact,
  PerformanceTestResult,
  RNPerformanceArtifact,
  SentryTraceArtifact,
} from './types/performance-artifacts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const config: ArtifactCollectionConfig = {
  outputDir: process.env.OUTPUT_DIR || './performance-artifacts',
  perfettoTracePath: process.env.PERFETTO_TRACE_PATH || undefined,
  rnPerfJsonPath: process.env.RN_PERF_JSON_PATH || undefined,
  memoryMetricsPath: process.env.MEMORY_METRICS_PATH || undefined,
  sentryOrg: process.env.SENTRY_ORG || undefined,
  sentryProject: process.env.SENTRY_PROJECT || undefined,
  buildHash: process.env.BUILD_HASH || 'unknown',
  commit:
    process.env.COMMIT ||
    process.env.GITHUB_SHA ||
    process.env.BUILD_HASH ||
    'unknown',
  device: process.env.DEVICE_MODEL || 'unknown',
  os: process.env.OS_VERSION || 'unknown',
  platform: (process.env.PLATFORM as 'ios' | 'android') || 'android',
  datasetSize: process.env.DATASET_SIZE || 'unknown',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Log with timestamp
 */
function log(
  message: string,
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO'
): void {
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
 * Ensure output directory exists
 */
function ensureOutputDir(): void {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
    log(`Created output directory: ${config.outputDir}`);
  }
}

/**
 * Create base artifact metadata
 */
function createBaseMetadata(): PerformanceArtifact['metadata'] {
  return {
    timestamp: new Date().toISOString(),
    device: config.device,
    os: config.os,
    buildHash: config.buildHash,
    commit: config.commit,
    datasetSize: config.datasetSize,
    platform: config.platform,
  };
}

// ============================================================================
// ARTIFACT COLLECTORS
// ============================================================================

/**
 * Collect RN Performance JSON artifact
 */
function collectRNPerformanceArtifact(): RNPerformanceArtifact | null {
  if (!config.rnPerfJsonPath || !fs.existsSync(config.rnPerfJsonPath)) {
    log('RN Performance JSON not found, skipping', 'WARN');
    return null;
  }

  log(`Collecting RN Performance JSON: ${config.rnPerfJsonPath}`);

  try {
    const data = JSON.parse(fs.readFileSync(config.rnPerfJsonPath, 'utf8'));

    // Copy to output directory
    const outputPath = path.join(config.outputDir, 'rn-performance.json');
    fs.copyFileSync(config.rnPerfJsonPath, outputPath);

    const artifact: RNPerformanceArtifact = {
      type: 'rnperformance',
      filePath: outputPath,
      metadata: {
        ...createBaseMetadata(),
        originalPath: config.rnPerfJsonPath,
      },
      metrics: {
        averageFPS: data.avgFps || 0,
        p95FrameTime: data.p95FrameTime || 0,
        droppedFrames: data.droppedFrames || 0,
        droppedFramesPct: data.droppedFramesPct || 0,
        jankCount: data.jankCount || 0,
        renderPassCount: data.renderPassCount,
      },
    };

    log(`✓ Collected RN Performance artifact: ${outputPath}`);
    return artifact;
  } catch (error) {
    log(
      `Failed to collect RN Performance artifact: ${(error as Error).message}`,
      'ERROR'
    );
    return null;
  }
}

/**
 * Collect Perfetto trace artifact (Android only)
 */
function collectPerfettoArtifact(): PerfettoTraceArtifact | null {
  if (config.platform !== 'android') {
    log('Perfetto traces are Android-only, skipping', 'DEBUG');
    return null;
  }

  if (!config.perfettoTracePath || !fs.existsSync(config.perfettoTracePath)) {
    log('Perfetto trace not found, skipping', 'WARN');
    return null;
  }

  log(`Collecting Perfetto trace: ${config.perfettoTracePath}`);

  try {
    const stats = fs.statSync(config.perfettoTracePath);
    const sizeMB = stats.size / 1024 / 1024;

    // Copy to output directory
    const outputPath = path.join(config.outputDir, 'perfetto-trace.pb');
    fs.copyFileSync(config.perfettoTracePath, outputPath);

    const artifact: PerfettoTraceArtifact = {
      type: 'perfetto',
      filePath: outputPath,
      sizeMB: parseFloat(sizeMB.toFixed(2)),
      metadata: {
        ...createBaseMetadata(),
        originalPath: config.perfettoTracePath,
        sizeBytes: stats.size,
      },
    };

    log(`✓ Collected Perfetto trace: ${outputPath} (${sizeMB.toFixed(2)} MB)`);
    return artifact;
  } catch (error) {
    log(
      `Failed to collect Perfetto artifact: ${(error as Error).message}`,
      'ERROR'
    );
    return null;
  }
}

/**
 * Collect Sentry trace URLs from logs or environment
 */
function collectSentryTraceArtifacts(): SentryTraceArtifact[] {
  const artifacts: SentryTraceArtifact[] = [];

  if (!config.sentryOrg || !config.sentryProject) {
    log('Sentry not configured, skipping trace URL collection', 'DEBUG');
    return artifacts;
  }

  log('Collecting Sentry trace URLs...');

  // Check for Sentry trace URLs in environment variables
  const sentryTraceUrls =
    process.env.SENTRY_TRACE_URLS?.split(',').filter(Boolean) || [];

  for (const url of sentryTraceUrls) {
    const artifact: SentryTraceArtifact = {
      type: 'sentry',
      url: url.trim(),
      metadata: createBaseMetadata(),
    };
    artifacts.push(artifact);
    log(`✓ Collected Sentry trace URL: ${url}`);
  }

  // Also check for trace URLs in a dedicated file
  const sentryTraceFile = path.join(config.outputDir, 'sentry-traces.txt');
  if (fs.existsSync(sentryTraceFile)) {
    const urls = fs
      .readFileSync(sentryTraceFile, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (const url of urls) {
      if (!sentryTraceUrls.includes(url)) {
        const artifact: SentryTraceArtifact = {
          type: 'sentry',
          url,
          metadata: createBaseMetadata(),
        };
        artifacts.push(artifact);
        log(`✓ Collected Sentry trace URL from file: ${url}`);
      }
    }
  }

  if (artifacts.length === 0) {
    log('No Sentry trace URLs found', 'WARN');
  }

  return artifacts;
}

/**
 * Collect memory metrics artifact
 */
function collectMemoryMetricsArtifact(): PerformanceArtifact | null {
  if (!config.memoryMetricsPath || !fs.existsSync(config.memoryMetricsPath)) {
    log('Memory metrics not found, skipping', 'WARN');
    return null;
  }

  log(`Collecting memory metrics: ${config.memoryMetricsPath}`);

  try {
    const data = JSON.parse(fs.readFileSync(config.memoryMetricsPath, 'utf8'));

    // Copy to output directory
    const outputPath = path.join(config.outputDir, 'memory-metrics.json');
    fs.copyFileSync(config.memoryMetricsPath, outputPath);

    const artifact: PerformanceArtifact = {
      type: 'memory',
      filePath: outputPath,
      metadata: {
        ...createBaseMetadata(),
        originalPath: config.memoryMetricsPath,
        baselineRSS: data.baselineRSS,
        peakRSS: data.peakRSS,
        postGCRSS: data.postGCRSS,
        deltaMB: data.peakRSS - data.baselineRSS,
        postGCDeltaMB: data.postGCRSS - data.baselineRSS,
      },
    };

    log(`✓ Collected memory metrics artifact: ${outputPath}`);
    return artifact;
  } catch (error) {
    log(
      `Failed to collect memory metrics artifact: ${(error as Error).message}`,
      'ERROR'
    );
    return null;
  }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Generate comprehensive performance report
 */
function generatePerformanceReport(
  artifacts: PerformanceArtifact[]
): PerformanceTestResult {
  log('Generating performance report...');

  const report: PerformanceTestResult = {
    testName: 'Performance Test Run',
    device: {
      name: config.device,
      platform: config.platform,
      version: config.os,
      isPhysical:
        !config.device.toLowerCase().includes('emulator') &&
        !config.device.toLowerCase().includes('simulator'),
    },
    buildHash: config.buildHash,
    commit: config.commit,
    timestamp: new Date().toISOString(),
    datasetSize:
      typeof config.datasetSize === 'number'
        ? config.datasetSize
        : parseInt(config.datasetSize as string, 10) || 0,
    metrics: {},
    passed: true,
    artifacts,
  };

  // Extract metrics from artifacts
  const rnPerfArtifact = artifacts.find((a) => a.type === 'rnperformance') as
    | RNPerformanceArtifact
    | undefined;
  if (rnPerfArtifact) {
    report.metrics.frames = rnPerfArtifact.metrics;
  }

  const memoryArtifact = artifacts.find((a) => a.type === 'memory');
  if (memoryArtifact?.metadata) {
    report.metrics.memory = {
      baselineRSS: memoryArtifact.metadata.baselineRSS as number,
      peakRSS: memoryArtifact.metadata.peakRSS as number,
      postGCRSS: memoryArtifact.metadata.postGCRSS as number,
      deltaMB: memoryArtifact.metadata.deltaMB as number,
      postGCDeltaMB: memoryArtifact.metadata.postGCDeltaMB as number,
    };
  }

  const reportPath = path.join(config.outputDir, 'performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log(`✓ Performance report saved: ${reportPath}`);

  return report;
}

/**
 * Generate artifact manifest
 */
function generateArtifactManifest(artifacts: PerformanceArtifact[]): void {
  log('Generating artifact manifest...');

  const manifest = {
    timestamp: new Date().toISOString(),
    buildHash: config.buildHash,
    commit: config.commit,
    device: config.device,
    os: config.os,
    platform: config.platform,
    datasetSize: config.datasetSize,
    artifactCount: artifacts.length,
    artifacts: artifacts.map((artifact) => ({
      type: artifact.type,
      filePath: artifact.filePath,
      url: artifact.url,
      metadata: artifact.metadata,
    })),
  };

  const manifestPath = path.join(config.outputDir, 'artifact-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  log(`✓ Artifact manifest saved: ${manifestPath}`);
}

/**
 * Print summary to console
 */
function printSummary(
  artifacts: PerformanceArtifact[],
  report: PerformanceTestResult
): void {
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE ARTIFACT COLLECTION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Build: ${config.buildHash}`);
  console.log(`Commit: ${config.commit}`);
  console.log(`Device: ${config.device} (${config.os})`);
  console.log(`Platform: ${config.platform}`);
  console.log(`Dataset Size: ${config.datasetSize}`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log('\nArtifacts Collected:');

  for (const artifact of artifacts) {
    if (artifact.filePath) {
      console.log(`  - ${artifact.type}: ${artifact.filePath}`);
    } else if (artifact.url) {
      console.log(`  - ${artifact.type}: ${artifact.url}`);
    }
  }

  console.log('\nOutput Directory: ' + config.outputDir);
  console.log('='.repeat(80) + '\n');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  log('Starting performance artifact collection...');
  log(`Configuration: ${JSON.stringify(config, null, 2)}`, 'DEBUG');

  // Ensure output directory exists
  ensureOutputDir();

  // Collect all artifacts
  const artifacts: PerformanceArtifact[] = [];

  const rnPerfArtifact = collectRNPerformanceArtifact();
  if (rnPerfArtifact) artifacts.push(rnPerfArtifact);

  const perfettoArtifact = collectPerfettoArtifact();
  if (perfettoArtifact) artifacts.push(perfettoArtifact);

  const sentryArtifacts = collectSentryTraceArtifacts();
  artifacts.push(...sentryArtifacts);

  const memoryArtifact = collectMemoryMetricsArtifact();
  if (memoryArtifact) artifacts.push(memoryArtifact);

  // Generate reports
  const report = generatePerformanceReport(artifacts);
  generateArtifactManifest(artifacts);

  // Print summary
  printSummary(artifacts, report);

  log('✓ Artifact collection complete');
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Artifact collection failed:', error);
    process.exit(1);
  });
}

export {
  collectMemoryMetricsArtifact,
  collectPerfettoArtifact,
  collectRNPerformanceArtifact,
  collectSentryTraceArtifacts,
  generatePerformanceReport,
};
