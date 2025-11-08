#!/usr/bin/env node

/**
 * Performance Report Generator for CI
 *
 * Generates comprehensive performance reports with all metadata
 * Requirements: Spec 21, Task 10 - Performance Artifact Collection
 *
 * Usage:
 *   node scripts/ci/generate-performance-report.ts
 *
 * Environment Variables:
 *   - BUILD_HASH: Git commit hash (required)
 *   - COMMIT: Git commit SHA (defaults to BUILD_HASH)
 *   - PLATFORM: android | ios (required)
 *   - DEVICE_MODEL: Device name (required)
 *   - OS_VERSION: Operating system version (required)
 *   - DATASET_SIZE: Test dataset size (required)
 *   - OUTPUT_DIR: Directory for report (default: ./performance-artifacts)
 *   - RN_PERF_JSON_PATH: Path to RN Performance JSON report
 *   - MEMORY_METRICS_PATH: Path to memory metrics JSON file
 *   - PERFETTO_TRACE_PATH: Path to Perfetto trace file (Android only)
 *   - SENTRY_TRACE_URLS: Comma-separated Sentry trace URLs
 */

import * as fs from 'fs';
import * as path from 'path';

interface PerformanceReport {
  timestamp: string;
  buildHash: string;
  commit: string;
  device: {
    name: string;
    platform: 'ios' | 'android';
    version: string;
    isPhysical: boolean;
  };
  datasetSize: number;
  metrics: {
    frames?: {
      averageFPS: number;
      p95FrameTime: number;
      droppedFrames: number;
      droppedFramesPct: number;
      jankCount: number;
    };
    memory?: {
      baselineRSS: number;
      peakRSS: number;
      postGCRSS: number;
      deltaMB: number;
      postGCDeltaMB: number;
    };
    cpu?: {
      peak: number;
      average: number;
    };
  };
  artifacts: {
    rnPerformanceJson?: string;
    perfettoTrace?: string;
    memoryMetrics?: string;
    sentryTraceUrls: string[];
  };
  passed: boolean;
}

// Configuration
const config = {
  outputDir: process.env.OUTPUT_DIR || './performance-artifacts',
  buildHash: process.env.BUILD_HASH || 'unknown',
  commit:
    process.env.COMMIT ||
    process.env.GITHUB_SHA ||
    process.env.BUILD_HASH ||
    'unknown',
  device: process.env.DEVICE_MODEL || 'unknown',
  os: process.env.OS_VERSION || 'unknown',
  platform: (process.env.PLATFORM as 'ios' | 'android') || 'android',
  datasetSize: parseInt(process.env.DATASET_SIZE || '0', 10),
  rnPerfJsonPath: process.env.RN_PERF_JSON_PATH,
  memoryMetricsPath: process.env.MEMORY_METRICS_PATH,
  perfettoTracePath: process.env.PERFETTO_TRACE_PATH,
  sentryTraceUrls:
    process.env.SENTRY_TRACE_URLS?.split(',').filter(Boolean) || [],
};

function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
  const timestamp = new Date().toISOString();
  const prefix = { INFO: '✓', WARN: '⚠', ERROR: '✗' }[level];
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function parseRNPerformanceMetrics():
  | PerformanceReport['metrics']['frames']
  | undefined {
  if (!config.rnPerfJsonPath || !fs.existsSync(config.rnPerfJsonPath)) {
    log('RN Performance JSON not found', 'WARN');
    return undefined;
  }

  try {
    const data = JSON.parse(fs.readFileSync(config.rnPerfJsonPath, 'utf8'));
    return {
      averageFPS: data.avgFps || 0,
      p95FrameTime: data.p95FrameTime || 0,
      droppedFrames: data.droppedFrames || 0,
      droppedFramesPct: data.droppedFramesPct || 0,
      jankCount: data.jankCount || 0,
    };
  } catch (error) {
    log(
      `Failed to parse RN Performance JSON: ${(error as Error).message}`,
      'ERROR'
    );
    return undefined;
  }
}

function parseMemoryMetrics():
  | PerformanceReport['metrics']['memory']
  | undefined {
  if (!config.memoryMetricsPath || !fs.existsSync(config.memoryMetricsPath)) {
    log('Memory metrics not found', 'WARN');
    return undefined;
  }

  try {
    const data = JSON.parse(fs.readFileSync(config.memoryMetricsPath, 'utf8'));
    const deltaMB = data.peakRSS - data.baselineRSS;
    const postGCDeltaMB = data.postGCRSS - data.baselineRSS;

    return {
      baselineRSS: data.baselineRSS,
      peakRSS: data.peakRSS,
      postGCRSS: data.postGCRSS,
      deltaMB,
      postGCDeltaMB,
    };
  } catch (error) {
    log(`Failed to parse memory metrics: ${(error as Error).message}`, 'ERROR');
    return undefined;
  }
}

function generateReport(): PerformanceReport {
  log('Generating performance report...');

  const report: PerformanceReport = {
    timestamp: new Date().toISOString(),
    buildHash: config.buildHash,
    commit: config.commit,
    device: {
      name: config.device,
      platform: config.platform,
      version: config.os,
      isPhysical:
        !config.device.toLowerCase().includes('emulator') &&
        !config.device.toLowerCase().includes('simulator'),
    },
    datasetSize: config.datasetSize,
    metrics: {},
    artifacts: {
      sentryTraceUrls: config.sentryTraceUrls,
    },
    passed: true,
  };

  // Parse metrics
  const frameMetrics = parseRNPerformanceMetrics();
  if (frameMetrics) {
    report.metrics.frames = frameMetrics;
  }

  const memoryMetrics = parseMemoryMetrics();
  if (memoryMetrics) {
    report.metrics.memory = memoryMetrics;
  }

  // Add artifact paths
  if (config.rnPerfJsonPath && fs.existsSync(config.rnPerfJsonPath)) {
    report.artifacts.rnPerformanceJson = config.rnPerfJsonPath;
  }

  if (config.perfettoTracePath && fs.existsSync(config.perfettoTracePath)) {
    report.artifacts.perfettoTrace = config.perfettoTracePath;
  }

  if (config.memoryMetricsPath && fs.existsSync(config.memoryMetricsPath)) {
    report.artifacts.memoryMetrics = config.memoryMetricsPath;
  }

  return report;
}

function saveReport(report: PerformanceReport): string {
  // Ensure output directory exists
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  const reportPath = path.join(config.outputDir, 'performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log(`Performance report saved: ${reportPath}`);
  return reportPath;
}

function printSummary(report: PerformanceReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE REPORT SUMMARY');
  console.log('='.repeat(80));
  console.log(`Build: ${report.buildHash}`);
  console.log(`Commit: ${report.commit}`);
  console.log(`Device: ${report.device.name} (${report.device.version})`);
  console.log(`Platform: ${report.device.platform}`);
  console.log(`Dataset Size: ${report.datasetSize}`);
  console.log(`Timestamp: ${report.timestamp}`);

  if (report.metrics.frames) {
    console.log('\nFrame Metrics:');
    console.log(`  Average FPS: ${report.metrics.frames.averageFPS}`);
    console.log(`  P95 Frame Time: ${report.metrics.frames.p95FrameTime}ms`);
    console.log(
      `  Dropped Frames: ${report.metrics.frames.droppedFrames} (${report.metrics.frames.droppedFramesPct}%)`
    );
    console.log(`  Jank Count: ${report.metrics.frames.jankCount}`);
  }

  if (report.metrics.memory) {
    console.log('\nMemory Metrics:');
    console.log(`  Baseline RSS: ${report.metrics.memory.baselineRSS}MB`);
    console.log(
      `  Peak RSS: ${report.metrics.memory.peakRSS}MB (+${report.metrics.memory.deltaMB}MB)`
    );
    console.log(
      `  Post-GC RSS: ${report.metrics.memory.postGCRSS}MB (+${report.metrics.memory.postGCDeltaMB}MB)`
    );
  }

  console.log('\nArtifacts:');
  if (report.artifacts.rnPerformanceJson) {
    console.log(`  RN Performance JSON: ${report.artifacts.rnPerformanceJson}`);
  }
  if (report.artifacts.perfettoTrace) {
    console.log(`  Perfetto Trace: ${report.artifacts.perfettoTrace}`);
  }
  if (report.artifacts.memoryMetrics) {
    console.log(`  Memory Metrics: ${report.artifacts.memoryMetrics}`);
  }
  if (report.artifacts.sentryTraceUrls.length > 0) {
    console.log(
      `  Sentry Trace URLs: ${report.artifacts.sentryTraceUrls.length} URL(s)`
    );
    report.artifacts.sentryTraceUrls.forEach((url) => {
      console.log(`    - ${url}`);
    });
  }

  console.log('='.repeat(80) + '\n');
}

async function main(): Promise<void> {
  log('Starting performance report generation...');

  const report = generateReport();
  const reportPath = saveReport(report);
  printSummary(report);

  log('✓ Performance report generation complete');
  log(`Report saved to: ${reportPath}`);

  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Report generation failed:', error);
    process.exit(1);
  });
}

export { generateReport, saveReport };
