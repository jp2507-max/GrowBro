import {
  calculateAverageLatencies,
  calculatePercentileLatencies,
  countTelemetryEvents,
  extractLatencies,
  separateAssessmentsByMode,
} from './assessment-analytics-inference-processors';
import {
  buildAssessmentQuery,
  buildTelemetryQuery,
  fetchAssessments,
  fetchTelemetry,
} from './assessment-analytics-inference-queries';

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
