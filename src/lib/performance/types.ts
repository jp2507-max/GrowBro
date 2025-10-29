/**
 * Performance monitoring types for Sentry and RN Performance integration
 */

import type { PerformanceOperation, PerformanceTransaction } from './constants';

/**
 * Performance span for child operations within a transaction
 */
export interface PerformanceSpan {
  name: string;
  operation: PerformanceOperation;
  startTimestampMs: number;
  endTimestampMs?: number;
  data?: Record<string, unknown>;
}

/**
 * Performance transaction for tracking complete operations
 */
export interface PerformanceTransactionData {
  name: PerformanceTransaction | string;
  operation: string;
  startTimestampMs: number;
  endTimestampMs?: number;
  spans: PerformanceSpan[];
  tags: Record<string, string>;
  data?: Record<string, unknown>;
}

/**
 * RN Performance report from @shopify/react-native-performance
 */
export interface RNPerformanceReport {
  screenName: string;
  timeToInteractive?: number;
  timeToFirstDisplay?: number;
  renderPassCount?: number;
  componentRenderTimes: ComponentRenderTime[];
}

/**
 * Component render timing from RN Performance
 */
export interface ComponentRenderTime {
  componentName: string;
  duration: number;
  timestamp: number;
}

/**
 * Performance metrics for lists
 */
export interface ListPerformanceMetrics {
  averageFPS: number;
  droppedFramePercent: number;
  p95FrameTime: number;
  jankCount: number;
  blankCellCount: number;
}

/**
 * Performance budget violation
 */
export interface PerformanceBudgetViolation {
  metric: string;
  threshold: number;
  actual: number;
  severity: 'warning' | 'error';
}

/**
 * Worklet performance metrics
 */
export interface WorkletPerformanceMetrics {
  inputToRenderLatency: number;
  workletExecutionTime: number;
  droppedFrames: number;
  gestureResponseTimes: number[];
}

/**
 * Performance artifact for CI/CD
 */
export interface PerformanceArtifact {
  type: 'perfetto' | 'sentry' | 'rnperformance' | 'reassure';
  filePath?: string;
  url?: string;
  metadata: Record<string, unknown>;
}
