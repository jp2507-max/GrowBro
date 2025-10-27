/**
 * Assessment Query Functions
 *
 * Provides query functions for fetching assessments from WatermelonDB.
 * Used for plant profile integration and assessment history display.
 *
 * Requirements:
 * - 3.4: Link assessment history to plant profiles
 * - 9.1: Enable assessment tracking and analytics
 */

import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';

/**
 * Assessment query result with typed fields
 */
export type AssessmentQueryResult = {
  id: string;
  plantId: string;
  status: string;
  predictedClass?: string;
  calibratedConfidence?: number;
  inferenceMode: string;
  modelVersion: string;
  issueResolved?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Get assessments by plant ID, sorted by creation date (newest first)
 *
 * @param plantId - Plant ID to query
 * @param limit - Maximum number of results (default: 50)
 * @returns Array of assessment records
 */
export async function getAssessmentsByPlantId(
  plantId: string,
  limit = 50
): Promise<AssessmentQueryResult[]> {
  const collection = database.collections.get<AssessmentModel>('assessments');

  const records = await collection
    .query(
      Q.where('plant_id', plantId),
      Q.sortBy('created_at', Q.desc),
      Q.take(limit)
    )
    .fetch();

  return records.map(mapAssessmentToResult);
}

/**
 * Get recent assessments across all plants for current user
 *
 * @param userId - User ID to query
 * @param limit - Maximum number of results (default: 20)
 * @returns Array of assessment records
 */
export async function getRecentAssessments(
  userId: string,
  limit = 20
): Promise<AssessmentQueryResult[]> {
  const collection = database.collections.get<AssessmentModel>('assessments');

  const records = await collection
    .query(
      Q.where('user_id', userId),
      Q.sortBy('created_at', Q.desc),
      Q.take(limit)
    )
    .fetch();

  return records.map(mapAssessmentToResult);
}

/**
 * Get unresolved assessments for a plant
 *
 * @param plantId - Plant ID to query
 * @returns Array of unresolved assessment records
 */
export async function getUnresolvedAssessments(
  plantId: string
): Promise<AssessmentQueryResult[]> {
  const collection = database.collections.get<AssessmentModel>('assessments');

  const records = await collection
    .query(
      Q.where('plant_id', plantId),
      Q.where('issue_resolved', Q.notEq(true)),
      Q.where('status', 'completed'),
      Q.sortBy('created_at', Q.desc)
    )
    .fetch();

  return records.map(mapAssessmentToResult);
}

/**
 * Get assessment count by plant ID
 *
 * @param plantId - Plant ID to query
 * @returns Total assessment count
 */
export async function getAssessmentCount(plantId: string): Promise<number> {
  const collection = database.collections.get<AssessmentModel>('assessments');

  return await collection.query(Q.where('plant_id', plantId)).fetchCount();
}

/**
 * Get assessment by ID
 *
 * @param assessmentId - Assessment ID to fetch
 * @returns Assessment record or null if not found
 */
export async function getAssessmentById(
  assessmentId: string
): Promise<AssessmentQueryResult | null> {
  const collection = database.collections.get<AssessmentModel>('assessments');

  try {
    const record = await collection.find(assessmentId);
    return mapAssessmentToResult(record);
  } catch {
    return null;
  }
}

/**
 * Map AssessmentModel to query result
 */
function mapAssessmentToResult(record: AssessmentModel): AssessmentQueryResult {
  return {
    id: record.id,
    plantId: record.plantId,
    status: record.status,
    predictedClass: record.predictedClass,
    calibratedConfidence: record.calibratedConfidence,
    inferenceMode: record.inferenceMode,
    modelVersion: record.modelVersion,
    issueResolved: record.issueResolved,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
