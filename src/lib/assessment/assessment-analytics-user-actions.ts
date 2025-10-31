import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import { database } from '@/lib/watermelon';

export type UserActionMetrics = {
  taskCreatedCount: number;
  playbookShiftedCount: number;
  communityCtaCount: number;
  taskCreationRate: number;
  playbookShiftRate: number;
  communityCtaRate: number;
};

export type UserActionMetricsParams = {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
};

/**
 * Get user action metrics with bounded queries and optimized aggregations
 */
export async function getUserActionMetrics(
  params: UserActionMetricsParams = {}
): Promise<UserActionMetrics> {
  // Validate and set defaults
  const now = DateTime.now();
  const startDate = params.startDate ?? now.minus({ days: 90 }).toJSDate(); // Default to last 90 days
  const endDate = params.endDate ?? now.toJSDate();
  // limit/offset parameters are intentionally ignored for the telemetry counts
  // as we use aggregated count queries to avoid loading records into memory.

  // Validate date range
  if (startDate > endDate) {
    throw new Error('startDate cannot be after endDate');
  }

  // Build date range query for telemetry
  const dateRangeQuery = [
    Q.where('created_at', Q.gte(startDate.getTime())),
    Q.where('created_at', Q.lte(endDate.getTime())),
  ];

  // Use count queries instead of fetching full records for better performance
  const [
    taskCreatedCount,
    playbookShiftedCount,
    communityCtaCount,
    totalCompleted,
  ] = await Promise.all([
    // Count task_created events within date range
    database
      .get('assessment_telemetry')
      .query(...dateRangeQuery, Q.where('event_type', 'task_created'))
      .fetchCount(),

    // Count playbook_adjustment events within date range
    database
      .get('assessment_telemetry')
      .query(...dateRangeQuery, Q.where('event_type', 'playbook_adjustment'))
      .fetchCount(),

    // Count community_cta_tapped events within date range
    database
      .get('assessment_telemetry')
      .query(...dateRangeQuery, Q.where('event_type', 'community_cta_tapped'))
      .fetchCount(),

    // Count completed assessments within date range (using processing_completed_at if available, fallback to created_at)
    database
      .get('assessments')
      .query(
        Q.where('status', 'completed'),
        Q.where('created_at', Q.gte(startDate.getTime())),
        Q.where('created_at', Q.lte(endDate.getTime()))
      )
      .fetchCount(),
  ]);

  return {
    taskCreatedCount,
    playbookShiftedCount,
    communityCtaCount,
    taskCreationRate:
      totalCompleted > 0 ? taskCreatedCount / totalCompleted : 0,
    playbookShiftRate:
      totalCompleted > 0 ? playbookShiftedCount / totalCompleted : 0,
    communityCtaRate:
      totalCompleted > 0 ? communityCtaCount / totalCompleted : 0,
  };
}
