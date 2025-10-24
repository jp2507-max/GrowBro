/**
 * Trusted Flagger Periodic Review Service
 * Implements automated review scheduling and quality assessment
 *
 * Requirements: 11.2, 11.6
 */

import { supabase } from '@/lib/supabase';
import type { TrustedFlagger } from '@/types/moderation';

import { AuditService } from './audit-service';
import {
  assessFlaggerQuality,
  enforceQualityStandards,
} from './trusted-flagger-revocation';
import { getFlaggersDueForReview } from './trusted-flagger-service';

const auditService = new AuditService(supabase);

// ============================================================================
// Constants
// ============================================================================

const REVIEW_PERIOD_MONTHS = 6;
const REVIEW_WARNING_DAYS = 14; // Warn 14 days before review due

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Schedule next periodic review for a flagger
 */
export async function scheduleNextReview(
  flaggerId: string,
  currentReviewDate: Date = new Date()
): Promise<Date> {
  const nextReview = new Date(currentReviewDate);
  nextReview.setMonth(nextReview.getMonth() + REVIEW_PERIOD_MONTHS);

  await supabase
    .from('trusted_flaggers')
    .update({
      review_date: nextReview.toISOString(),
    })
    .eq('id', flaggerId);

  return nextReview;
}

/**
 * Conduct periodic review for a flagger
 * Assesses quality and applies enforcement if needed
 */
export async function conductPeriodicReview(
  flaggerId: string,
  reviewedBy: string,
  reviewNotes?: string
): Promise<{
  passed: boolean;
  action_taken: 'none' | 'warning' | 'suspension' | 'revocation';
  reasons: string[];
  next_review_date: Date;
}> {
  // Assess current quality
  const assessment = await assessFlaggerQuality(flaggerId);

  // Apply enforcement if needed
  const enforcement = await enforceQualityStandards(flaggerId, reviewedBy);

  // Log review event
  await auditService.logEvent({
    event_type: 'trusted_flagger_reviewed',
    actor_id: reviewedBy,
    actor_type: 'moderator',
    target_id: flaggerId,
    target_type: 'trusted_flagger',
    action: 'periodic_review',
    metadata: {
      meets_standards: assessment.meets_standards,
      action_taken: enforcement.action_taken,
      reasons: enforcement.reasons,
      review_notes: reviewNotes,
    },
  });

  // Schedule next review (if not revoked)
  const nextReviewDate =
    enforcement.action_taken === 'revocation'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year out
      : await scheduleNextReview(flaggerId);

  return {
    passed: assessment.meets_standards,
    action_taken: enforcement.action_taken,
    reasons: enforcement.reasons,
    next_review_date: nextReviewDate,
  };
}

/**
 * Get flaggers with upcoming reviews (within warning period)
 */
export async function getFlaggersNeedingReviewSoon(): Promise<
  TrustedFlagger[]
> {
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + REVIEW_WARNING_DAYS);

  const { data, error } = await supabase
    .from('trusted_flaggers')
    .select('*')
    .eq('status', 'active')
    .is('deleted_at', null)
    .lte('review_date', warningDate.toISOString())
    .gte('review_date', new Date().toISOString());

  if (error) {
    throw new Error(
      `Failed to fetch flaggers needing review: ${error.message}`
    );
  }

  return (data || []).map(mapDatabaseRowToFlagger);
}

/**
 * Process all overdue reviews
 * Should be run periodically (e.g., daily cron job)
 */
export async function processOverdueReviews(
  processedBy: string = 'system'
): Promise<{
  processed: number;
  warnings: number;
  suspensions: number;
  revocations: number;
}> {
  const overdueFlaggers = await getFlaggersDueForReview();

  const results = {
    processed: 0,
    warnings: 0,
    suspensions: 0,
    revocations: 0,
  };

  for (const flagger of overdueFlaggers) {
    try {
      const review = await conductPeriodicReview(
        flagger.id,
        processedBy,
        'Automated periodic review'
      );

      results.processed++;

      switch (review.action_taken) {
        case 'warning':
          results.warnings++;
          break;
        case 'suspension':
          results.suspensions++;
          break;
        case 'revocation':
          results.revocations++;
          break;
      }
    } catch (error) {
      // Log error and continue with other reviews
      console.error(
        `Failed to process review for flagger ${flagger.id}:`,
        error
      );
    }
  }

  return results;
}

/**
 * Send review reminder notifications
 */
export async function sendReviewReminders(): Promise<number> {
  const flaggers = await getFlaggersNeedingReviewSoon();

  for (const flagger of flaggers) {
    // TODO: Send email/notification to flagger organization
    await auditService.logEvent({
      event_type: 'trusted_flagger_reviewed',
      actor_id: 'system',
      actor_type: 'system',
      target_id: flagger.id,
      target_type: 'trusted_flagger',
      action: 'review_reminder_sent',
      metadata: {
        review_due_date: flagger.review_date.toISOString(),
        days_until_due: Math.ceil(
          (flagger.review_date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        ),
      },
    });
  }

  return flaggers.length;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapDatabaseRowToFlagger(row: any): TrustedFlagger {
  return {
    id: row.id,
    organization_name: row.organization_name,
    contact_info: row.contact_info,
    specialization: row.specialization,
    status: row.status,
    quality_metrics: row.quality_metrics,
    certification_date: row.certification_date
      ? new Date(row.certification_date)
      : null,
    review_date: new Date(row.review_date),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    deleted_at: row.deleted_at ? new Date(row.deleted_at) : undefined,
  };
}
