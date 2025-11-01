import type { AssessmentModel } from '@/lib/watermelon-models/assessment';
import type { AssessmentTelemetryModel } from '@/lib/watermelon-models/assessment-telemetry';

import { calculateP95 } from './assessment-analytics-utils';

export function separateAssessmentsByMode(assessments: AssessmentModel[]) {
  const deviceAssessments = assessments.filter(
    (a) => a.inferenceMode === 'device'
  );
  const cloudAssessments = assessments.filter(
    (a) => a.inferenceMode === 'cloud'
  );
  return { deviceAssessments, cloudAssessments };
}

export function extractLatencies(assessments: AssessmentModel[]): number[] {
  return assessments
    .map((a) => a.latencyMs)
    .filter((l): l is number => l !== undefined && l !== null);
}

export function calculateAverageLatencies(
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

export function calculatePercentileLatencies(
  deviceLatencies: number[],
  cloudLatencies: number[]
) {
  const p95DeviceLatencyMs = calculateP95(deviceLatencies);
  const p95CloudLatencyMs = calculateP95(cloudLatencies);
  return { p95DeviceLatencyMs, p95CloudLatencyMs };
}

export function countTelemetryEvents(telemetry: AssessmentTelemetryModel[]) {
  const failureCount = telemetry.filter(
    (t) => t.eventType === 'inference_failed'
  ).length;
  const fallbackCount = telemetry.filter(
    (t) => t.eventType === 'cloud_fallback'
  ).length;
  return { failureCount, fallbackCount };
}
