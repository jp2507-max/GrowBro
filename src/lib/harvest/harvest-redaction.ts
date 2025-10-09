/**
 * Harvest Data Redaction Utilities
 *
 * Implements data minimization and PII scrubbing for harvest sharing flows.
 * Requirements: 18.4 (redact private data appropriately)
 *
 * Redaction Strategy:
 * - Remove user_id (direct PII)
 * - Strip notes (free-text may contain PII)
 * - Remove plant_id context (indirect identifier)
 * - Preserve aggregated/anonymized metrics (weights, stage durations)
 * - Strip photo URIs (local file paths contain device info)
 *
 * Based on PII scrubbing pattern from community-moderation (Art. 24(5) compliance)
 */

import type { Harvest, HarvestStage } from '@/types/harvest';

/**
 * Redacted harvest record safe for sharing
 * Strips PII while preserving analytical value
 */
export type RedactedHarvest = {
  // Preserved fields (non-PII, analytical value)
  stage: HarvestStage;
  wet_weight_g: number | null;
  dry_weight_g: number | null;
  trimmings_weight_g: number | null;
  stage_started_at: Date;
  stage_completed_at: Date | null;
  created_at: Date;

  // Aggregated/anonymized data
  has_photos: boolean;
  photo_count: number;
  duration_days: number | null;

  // Redaction metadata (audit trail)
  redacted_at: Date;
  redaction_version: string;
};

/**
 * Harvest sharing summary with multiple harvests aggregated
 */
export type HarvestSharingSummary = {
  total_harvests: number;
  total_weight_g: number;
  avg_duration_days: number | null;
  stages_completed: Record<HarvestStage, number>;
  photo_count: number;
  date_range: {
    earliest: Date;
    latest: Date;
  };

  // Privacy metadata
  redacted_at: Date;
  redaction_version: string;
};

const REDACTION_VERSION = '1.0.0';

/**
 * Calculate duration in days between two dates
 */
function calculateDurationDays(start: Date, end: Date | null): number | null {
  if (!end) return null;
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Redact a single harvest record for sharing
 *
 * @param harvest - Original harvest record
 * @returns Redacted harvest safe for sharing
 */
export function redactHarvest(harvest: Harvest): RedactedHarvest {
  const duration = calculateDurationDays(
    harvest.stage_started_at,
    harvest.stage_completed_at
  );

  const photoUris =
    Array.isArray(harvest.photos) && harvest.photos.length > 0
      ? harvest.photos
      : [];

  return {
    // Preserve analytical fields
    stage: harvest.stage,
    wet_weight_g: harvest.wet_weight_g,
    dry_weight_g: harvest.dry_weight_g,
    trimmings_weight_g: harvest.trimmings_weight_g,
    stage_started_at: harvest.stage_started_at,
    stage_completed_at: harvest.stage_completed_at,
    created_at: harvest.created_at,

    // Aggregated metrics
    has_photos: photoUris.length > 0,
    photo_count: photoUris.length,
    duration_days: duration,

    // Audit metadata
    redacted_at: new Date(),
    redaction_version: REDACTION_VERSION,
  };
}

/**
 * Create empty harvest sharing summary
 */
function createEmptySummary(): HarvestSharingSummary {
  return {
    total_harvests: 0,
    total_weight_g: 0,
    avg_duration_days: null,
    stages_completed: { harvest: 0, drying: 0, curing: 0, inventory: 0 },
    photo_count: 0,
    date_range: { earliest: new Date(), latest: new Date() },
    redacted_at: new Date(),
    redaction_version: REDACTION_VERSION,
  };
}

/**
 * Calculate average duration for completed harvests
 */
function calculateAvgDuration(harvests: Harvest[]): number | null {
  const completed = harvests.filter((h) => h.stage_completed_at);
  if (completed.length === 0) return null;

  const total = completed.reduce((sum, h) => {
    const duration = calculateDurationDays(
      h.stage_started_at,
      h.stage_completed_at
    );
    return sum + (duration ?? 0);
  }, 0);

  return total / completed.length;
}

/**
 * Redact multiple harvests and create aggregated summary
 *
 * @param harvests - Array of harvest records
 * @returns Aggregated sharing summary
 */
export function createHarvestSharingSummary(
  harvests: Harvest[]
): HarvestSharingSummary {
  if (harvests.length === 0) return createEmptySummary();

  const totalWeight = harvests.reduce(
    (sum, h) => sum + (h.dry_weight_g ?? h.wet_weight_g ?? 0),
    0
  );

  const stages = harvests.reduce(
    (counts, h) => {
      counts[h.stage] = (counts[h.stage] || 0) + 1;
      return counts;
    },
    {} as Record<HarvestStage, number>
  );

  const photoCount = harvests.reduce((sum, h) => {
    const uris = Array.isArray(h.photos) ? h.photos : [];
    return sum + uris.length;
  }, 0);

  const dates = harvests
    .map((h) => h.created_at)
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    total_harvests: harvests.length,
    total_weight_g: totalWeight,
    avg_duration_days: calculateAvgDuration(harvests),
    stages_completed: {
      harvest: stages.harvest || 0,
      drying: stages.drying || 0,
      curing: stages.curing || 0,
      inventory: stages.inventory || 0,
    },
    photo_count: photoCount,
    date_range: { earliest: dates[0], latest: dates[dates.length - 1] },
    redacted_at: new Date(),
    redaction_version: REDACTION_VERSION,
  };
}

/**
 * Validate that redaction properly strips PII
 * Used for testing and fail-safe validation
 *
 * @param redacted - Redacted harvest record
 * @returns True if no PII detected
 */
export function validateRedaction(redacted: RedactedHarvest): boolean {
  // Check that sensitive fields are not present
  const sensitiveKeys = [
    'id',
    'user_id',
    'plant_id',
    'notes',
    'photos',
    'harvest_id',
  ];

  for (const key of sensitiveKeys) {
    if (key in redacted) {
      console.error(`[RedactionValidation] Sensitive field present: ${key}`);
      return false;
    }
  }

  // Check redaction metadata
  if (!redacted.redacted_at || !redacted.redaction_version) {
    console.error('[RedactionValidation] Missing redaction metadata');
    return false;
  }

  return true;
}

/**
 * Validate that summary properly aggregates without PII
 *
 * @param summary - Harvest sharing summary
 * @returns True if no PII detected
 */
export function validateSummaryRedaction(
  summary: HarvestSharingSummary
): boolean {
  // Check that sensitive fields are not present
  const sensitiveKeys = ['user_id', 'plant_id', 'notes', 'photos', 'ids'];

  for (const key of sensitiveKeys) {
    if (key in summary) {
      console.error(
        `[SummaryRedactionValidation] Sensitive field present: ${key}`
      );
      return false;
    }
  }

  // Check redaction metadata
  if (!summary.redacted_at || !summary.redaction_version) {
    console.error('[SummaryRedactionValidation] Missing redaction metadata');
    return false;
  }

  // Ensure aggregation (k-anonymity principle: suppress small counts)
  if (summary.total_harvests > 0 && summary.total_harvests < 3) {
    console.warn(
      '[SummaryRedactionValidation] Small sample size may reduce anonymity'
    );
  }

  return true;
}
