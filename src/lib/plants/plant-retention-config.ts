/**
 * Plant retention configuration
 *
 * Centralized constants for plant deletion retention policy.
 */

/** Number of days to retain soft-deleted plants before hard deletion */
export const PLANT_DELETION_RETENTION_DAYS = 10;

/** Retention period in milliseconds */
export const PLANT_DELETION_RETENTION_MS =
  PLANT_DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Get the cutoff timestamp (in ms) for plant deletion retention.
 * Plants deleted before this timestamp are eligible for hard deletion.
 */
export function getPlantDeletionRetentionCutoffMs(): number {
  return Date.now() - PLANT_DELETION_RETENTION_MS;
}

/**
 * Get the cutoff timestamp (in ISO format) for plant deletion retention.
 */
export function getPlantDeletionRetentionCutoffIso(): string {
  return new Date(getPlantDeletionRetentionCutoffMs()).toISOString();
}
