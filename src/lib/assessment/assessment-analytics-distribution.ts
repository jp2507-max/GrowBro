import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';
import type { AssessmentTelemetryModel } from '@/lib/watermelon-models/assessment-telemetry';

/**
 * Get model version distribution
 */
export async function getModelVersionDistribution(): Promise<
  Record<string, number>
> {
  const assessments = await database
    .get<AssessmentModel>('assessments')
    .query(Q.where('status', 'completed'))
    .fetch();

  const distribution: Record<string, number> = {};

  for (const assessment of assessments) {
    const version = assessment.modelVersion || 'unknown';
    distribution[version] = (distribution[version] || 0) + 1;
  }

  return distribution;
}

/**
 * Get execution provider distribution
 */
export async function getExecutionProviderDistribution(): Promise<
  Record<string, number>
> {
  const telemetry = await database
    .get<AssessmentTelemetryModel>('assessment_telemetry')
    .query(Q.where('event_type', 'inference_started'))
    .fetch();

  const distribution: Record<string, number> = {};

  for (const event of telemetry) {
    const provider = event.executionProvider || 'unknown';
    distribution[provider] = (distribution[provider] || 0) + 1;
  }

  return distribution;
}
