/**
 * TypeScript type definitions for performance artifacts
 * Used by CI artifact collection and reporting
 */

/**
 * Device information for performance testing
 */
export interface DeviceInfo {
  name: string;
  platform: 'ios' | 'android';
  version: string;
  isPhysical: boolean;
  model?: string;
}

/**
 * Frame performance metrics
 */
export interface FrameMetrics {
  averageFPS: number;
  p95FrameTime: number;
  droppedFrames: number;
  droppedFramesPct: number;
  jankCount: number;
  renderPassCount?: number;
}

/**
 * Memory performance metrics
 */
export interface MemoryMetrics {
  baselineRSS: number;
  peakRSS: number;
  postGCRSS: number;
  deltaMB: number;
  postGCDeltaMB: number;
}

/**
 * Performance artifact metadata
 */
export interface ArtifactMetadata {
  timestamp: string;
  device: string;
  os: string;
  buildHash: string;
  commit: string;
  datasetSize: string | number;
  platform: 'ios' | 'android';
}

/**
 * Performance artifact types
 */
export type ArtifactType =
  | 'perfetto'
  | 'sentry'
  | 'rnperformance'
  | 'reassure'
  | 'memory';

/**
 * Performance artifact
 */
export interface PerformanceArtifact {
  type: ArtifactType;
  filePath?: string;
  url?: string;
  metadata: ArtifactMetadata & Record<string, unknown>;
}

/**
 * Sentry trace artifact
 */
export interface SentryTraceArtifact extends PerformanceArtifact {
  type: 'sentry';
  url: string;
  transactionId?: string;
  transactionName?: string;
}

/**
 * Perfetto trace artifact
 */
export interface PerfettoTraceArtifact extends PerformanceArtifact {
  type: 'perfetto';
  filePath: string;
  sizeMB: number;
}

/**
 * RN Performance JSON artifact
 */
export interface RNPerformanceArtifact extends PerformanceArtifact {
  type: 'rnperformance';
  filePath: string;
  metrics: FrameMetrics;
}

/**
 * Performance test result
 */
export interface PerformanceTestResult {
  testName: string;
  device: DeviceInfo;
  buildHash: string;
  commit: string;
  timestamp: string;
  datasetSize: number;
  metrics: {
    frames?: FrameMetrics;
    memory?: MemoryMetrics;
    startup?: {
      tti: number;
      threshold: number;
    };
    navigation?: {
      p95TransitionMs: number;
    };
    sync?: {
      syncP95Ms: number;
      itemCount: number;
    };
  };
  passed: boolean;
  artifacts: PerformanceArtifact[];
}

/**
 * Artifact collection configuration
 */
export interface ArtifactCollectionConfig {
  outputDir: string;
  perfettoTracePath?: string;
  rnPerfJsonPath?: string;
  memoryMetricsPath?: string;
  sentryOrg?: string;
  sentryProject?: string;
  buildHash: string;
  commit: string;
  device: string;
  os: string;
  platform: 'ios' | 'android';
  datasetSize: string | number;
}
