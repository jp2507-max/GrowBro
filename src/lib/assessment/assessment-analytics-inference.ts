import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';
import type { AssessmentTelemetryModel } from '@/lib/watermelon-models/assessment-telemetry';

import { calculateP95 } from './assessment-analytics-utils';

export type InferenceMetricsFilters = {
  /** Optional start date to limit queries for performance */
  dateFrom?: Date;
  /** Optional end date to limit queries for performance */
  dateTo?: Date;
};

export type InferenceMetrics = {
  totalAssessments: number;
  deviceCount: number;
  cloudCount: number;
  avgDeviceLatencyMs: number;
  avgCloudLatencyMs: number;
  p95DeviceLatencyMs: number;
  p95CloudLatencyMs: number;
  failureCount: number;
  fallbackCount: number;
};

function buildAssessmentQuery(filters?: InferenceMetricsFilters): Q.Where[] {
  const query = [Q.where('status', 'completed')];
  if (filters?.dateFrom) {
    query.push(Q.where('created_at', Q.gte(filters.dateFrom.getTime())));
  }
  if (filters?.dateTo) {
    query.push(Q.where('created_at', Q.lte(filters.dateTo.getTime())));
  }
  return query;
}

function buildTelemetryQuery(filters?: InferenceMetricsFilters): Q.Where[] {
  const query = [];
  if (filters?.dateFrom) {
    query.push(Q.where('timestamp', Q.gte(filters.dateFrom.getTime())));
  }
  if (filters?.dateTo) {
    query.push(Q.where('timestamp', Q.lte(filters.dateTo.getTime())));
  }
  return query;
}

async function fetchAssessments(query: Q.Where[]): Promise<AssessmentModel[]> {
  return database
    .get<AssessmentModel>('assessments')
    .query(...query)
    .fetch();
}

async function fetchTelemetry(
  query: Q.Where[]
): Promise<AssessmentTelemetryModel[]> {
  return database
    .get<AssessmentTelemetryModel>('assessment_telemetry')
    .query(...query)
    .fetch();
}

function separateAssessmentsByMode(assessments: AssessmentModel[]) {
  const deviceAssessments = assessments.filter(
    (a) => a.inferenceMode === 'device'
  );
  const cloudAssessments = assessments.filter(
    (a) => a.inferenceMode === 'cloud'
  );
  return { deviceAssessments, cloudAssessments };
}

function extractLatencies(assessments: AssessmentModel[]): number[] {
  return assessments
    .map((a) => a.latencyMs)
    .filter((l): l is number => l !== undefined && l !== null);
}

function calculateAverageLatencies(
  deviceLatencies: number[],
  cloudLatencies: number[]
) {
  const avgDeviceLatencyMs =
    deviceLatencies.length > 0
      ? deviceLatencies.reduce((sum, l) => sum + l, 0) / deviceLatencies.length
      : 0;

  const avgCloudLatencyMs =
    cloudLatencies.length > 0
      ? cloudLatencies.reduce((sum, l) => sum + l, 0) / cloudLatencies.length
      : 0;

  return { avgDeviceLatencyMs, avgCloudLatencyMs };
}

function calculatePercentileLatencies(
  deviceLatencies: number[],
  cloudLatencies: number[]
) {
  const p95DeviceLatencyMs = calculateP95(deviceLatencies);
  const p95CloudLatencyMs = calculateP95(cloudLatencies);
  return { p95DeviceLatencyMs, p95CloudLatencyMs };
}

function countTelemetryEvents(telemetry: AssessmentTelemetryModel[]) {
  const failureCount = telemetry.filter(
    (t) => t.eventType === 'inference_failed'
  ).length;
  const fallbackCount = telemetry.filter(
    (t) => t.eventType === 'cloud_fallback'
  ).length;
  return { failureCount, fallbackCount };
}

/**
 * Get inference performance metrics
 *
 * @param filters Optional date range filters to limit query scope for performance
 * @returns Promise resolving to inference metrics
 *
 * PERFORMANCE OPTIMIZATION:
 * - Without filters: fetches ALL historical data (comprehensive but potentially slow)
 * - With filters: limits queries to specified date range (faster, suitable for dashboards)
 * - Consider using filters for real-time dashboards, full historical data for reports
 */
export async function getInferenceMetrics(
  filters?: InferenceMetricsFilters
): Promise<InferenceMetrics> {
  // Build and execute queries
  const assessmentQuery = buildAssessmentQuery(filters);
  const telemetryQuery = buildTelemetryQuery(filters);

  const [assessments, telemetry] = await Promise.all([
    fetchAssessments(assessmentQuery),
    fetchTelemetry(telemetryQuery),
  ]);

  // Process assessment data
  const { deviceAssessments, cloudAssessments } =
    separateAssessmentsByMode(assessments);
  const deviceLatencies = extractLatencies(deviceAssessments);
  const cloudLatencies = extractLatencies(cloudAssessments);

  // Calculate metrics
  const { avgDeviceLatencyMs, avgCloudLatencyMs } = calculateAverageLatencies(
    deviceLatencies,
    cloudLatencies
  );
  const { p95DeviceLatencyMs, p95CloudLatencyMs } =
    calculatePercentileLatencies(deviceLatencies, cloudLatencies);
  const { failureCount, fallbackCount } = countTelemetryEvents(telemetry);

  return {
    totalAssessments: assessments.length,
    deviceCount: deviceAssessments.length,
    cloudCount: cloudAssessments.length,
    avgDeviceLatencyMs,
    avgCloudLatencyMs,
    p95DeviceLatencyMs,
    p95CloudLatencyMs,
    failureCount,
    fallbackCount,
  };
}
