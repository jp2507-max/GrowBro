import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';
import type { AssessmentTelemetryModel } from '@/lib/watermelon-models/assessment-telemetry';

import type { InferenceMetricsFilters } from './assessment-analytics-inference';

export function buildAssessmentQuery(
  filters?: InferenceMetricsFilters
): Q.Where[] {
  const query = [Q.where('status', 'completed')];
  if (filters?.dateFrom) {
    query.push(Q.where('created_at', Q.gte(filters.dateFrom.getTime())));
  }
  if (filters?.dateTo) {
    query.push(Q.where('created_at', Q.lte(filters.dateTo.getTime())));
  }
  return query;
}

export function buildTelemetryQuery(
  filters?: InferenceMetricsFilters
): Q.Where[] {
  const query = [];
  if (filters?.dateFrom) {
    query.push(Q.where('created_at', Q.gte(filters.dateFrom.getTime())));
  }
  if (filters?.dateTo) {
    query.push(Q.where('created_at', Q.lte(filters.dateTo.getTime())));
  }
  return query;
}

export async function fetchAssessments(
  query: Q.Where[]
): Promise<AssessmentModel[]> {
  return database
    .get<AssessmentModel>('assessments')
    .query(...query)
    .fetch();
}

export async function fetchTelemetry(
  query: Q.Where[]
): Promise<AssessmentTelemetryModel[]> {
  return database
    .get<AssessmentTelemetryModel>('assessment_telemetry')
    .query(...query)
    .fetch();
}
