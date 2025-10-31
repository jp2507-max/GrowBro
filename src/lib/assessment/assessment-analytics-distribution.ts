import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';
import type { AssessmentTelemetryModel } from '@/lib/watermelon-models/assessment-telemetry';

/**
 * Get model version distribution from completed assessments
 *
 * @param options - Optional filtering options for performance optimization
 * @param options.limit - Maximum number of assessments to process (most recent first)
 * @param options.since - Only include assessments created after this date
 * @param options.until - Only include assessments created before this date
 * @returns Promise resolving to a record mapping model versions to their usage counts
 */
export async function getModelVersionDistribution(options?: {
  limit?: number;
  since?: Date;
  until?: Date;
}): Promise<Record<string, number>> {
  // Build query with optional filters for performance optimization
  const queryConditions = [Q.where('status', 'completed')];

  // Date range filtering
  if (options?.since) {
    queryConditions.push(
      Q.where('created_at', { gte: options.since.getTime() })
    );
  }
  if (options?.until) {
    queryConditions.push(
      Q.where('created_at', { lte: options.until.getTime() })
    );
  }

  // Apply ordering for consistent limit behavior (most recent first)
  queryConditions.push(Q.sortBy('created_at', Q.desc));

  let assessmentsQuery = database
    .get<AssessmentModel>('assessments')
    .query(...queryConditions);

  if (options?.limit) {
    assessmentsQuery = assessmentsQuery.extend(Q.take(options.limit));
  }

  const assessments = await assessmentsQuery.fetch();

  const distribution: Record<string, number> = {};

  // Count occurrences of each model version, defaulting to 'unknown' for null/undefined
  for (const assessment of assessments) {
    const version = assessment.modelVersion || 'unknown';
    distribution[version] = (distribution[version] || 0) + 1;
  }

  return distribution;
}

/**
 * Get execution provider distribution from telemetry events
 *
 * @param options - Optional filtering options for performance optimization
 * @param options.limit - Maximum number of telemetry events to process (most recent first)
 * @param options.since - Only include events created after this date
 * @param options.until - Only include events created before this date
 * @returns Promise resolving to a record mapping execution providers to their usage counts
 */
export async function getExecutionProviderDistribution(options?: {
  limit?: number;
  since?: Date;
  until?: Date;
}): Promise<Record<string, number>> {
  // Set sensible defaults for unbounded queries
  const defaultLimit = 10000; // Reasonable upper bound
  const defaultSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

  const limit = options?.limit ?? defaultLimit;
  const since = options?.since ?? defaultSince;
  const until = options?.until;

  // Build query with filters for performance optimization
  const queryConditions = [Q.where('event_type', 'inference_started')];

  // Date range filtering
  queryConditions.push(Q.where('created_at', { gte: since.getTime() }));
  if (until) {
    queryConditions.push(Q.where('created_at', { lte: until.getTime() }));
  }

  // Apply ordering for consistent limit behavior (most recent first)
  queryConditions.push(Q.sortBy('created_at', Q.desc));

  const telemetryQuery = database
    .get<AssessmentTelemetryModel>('assessment_telemetry')
    .query(...queryConditions)
    .extend(Q.take(limit));

  const telemetry = await telemetryQuery.fetch();

  const distribution: Record<string, number> = {};

  for (const event of telemetry) {
    const provider = event.executionProvider || 'unknown';
    distribution[provider] = (distribution[provider] || 0) + 1;
  }

  return distribution;
}
