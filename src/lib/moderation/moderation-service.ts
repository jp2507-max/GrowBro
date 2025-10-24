/**
 * Moderation Service - Core moderation workflow management
 *
 * Implements DSA-compliant moderation queue management with:
 * - Priority lanes with trusted flagger support (DSA Art. 22)
 * - SLA tracking and deadline monitoring
 * - Conflict-of-interest guards for reviewer assignment
 * - 4-hour claim timeout with automatic release
 *
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3
 */

import { DateTime } from 'luxon';

import type {
  ClaimResult,
  ContentReport,
  ModerationAction,
  ModerationDecisionInput,
  ModerationQueue,
  ModerationQueueItem,
  QueueFilters,
  ReportStatus,
} from '@/types/moderation';

import { supabase } from '../supabase';
import { RepeatOffenderService } from './repeat-offender-service';

// ============================================================================
// Types
// ============================================================================

interface ReleaseClaimResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CLAIM_TIMEOUT_HOURS = 4;
const TRUSTED_FLAGGER_PRIORITY_BOOST = 20;
const SLA_WARNING_THRESHOLD_75 = 0.75;
const SLA_WARNING_THRESHOLD_90 = 0.9;

// ============================================================================
// Moderation Service
// ============================================================================

export class ModerationService {
  private repeatOffenderService: RepeatOffenderService;

  constructor() {
    this.repeatOffenderService = new RepeatOffenderService();
  }

  /**
   * Retrieves moderation queue with priority sorting and filtering
   *
   * Priority calculation:
   * - Trusted flagger reports: +20 priority boost
   * - Illegal content: base priority 100
   * - Policy violations: base priority 50
   * - SLA approaching (75%): +10 boost
   * - SLA critical (90%): +20 boost
   *
   * Requirements: 2.1, 2.2
   */
  async getModeratorQueue(
    moderatorId: string,
    filters: QueueFilters = {}
  ): Promise<ModerationQueue> {
    try {
      // Build query with filters
      let query = this.buildBaseQueueQuery();

      query = this.applyFiltersToQuery(query, filters);

      // Exclude reports claimed by other moderators
      query = await this.filterActiveClaims(query, moderatorId);

      // Execute query
      const { data: reports, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch moderation queue: ${error.message}`);
      }

      if (!reports) {
        return {
          items: [],
          total_count: 0,
          pending_count: 0,
          overdue_count: 0,
          average_age_hours: 0,
        };
      }

      // Calculate enhanced priority and add context
      const items = this.calculateEnhancedItems(reports);

      // Sort by enhanced priority (descending)
      items.sort((a, b) => b.report.priority - a.report.priority);

      // Calculate metrics
      const totalCount = items.length;
      const pendingCount = items.filter(
        (item) => item.report.status === 'pending'
      ).length;
      const overdueCount = items.filter(
        (item) => DateTime.fromJSDate(item.report.sla_deadline) < DateTime.now()
      ).length;
      const averageAgeHours =
        items.reduce((sum, item) => {
          const age = DateTime.now().diff(
            DateTime.fromJSDate(item.report.created_at),
            'hours'
          ).hours;
          return sum + age;
        }, 0) / (totalCount || 1);

      return {
        items,
        total_count: totalCount,
        pending_count: pendingCount,
        overdue_count: overdueCount,
        average_age_hours: Math.round(averageAgeHours * 10) / 10,
      };
    } catch (error) {
      throw new Error(
        `Moderation queue retrieval failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Build the base Supabase query for retrieving moderation queue items.
   *
   * Notes:
   * - Selects the core `content_reports` fields plus a single `content_snapshots`
   *   entry (snapshot metadata) and a join against `users` (reporter metadata).
   * - Uses `is('deleted_at', null)` to exclude soft-deleted reports at the DB
   *   level so downstream logic doesn't need to filter them again.
   * - Return type is `any` to avoid coupling this service to PostgREST types in
   *   this file; callers treat the result as a query builder and execute it.
   */
  private buildBaseQueueQuery(): any {
    // Base query: content_reports with snapshot and reporter info
    // Keep the selected fields compact to avoid transferring large blob
    // `snapshot_data` when not needed; callers may adjust the select if
    // additional fields are required.
    return supabase
      .from('content_reports')
      .select(
        `
          *,
          content_snapshots (
            id,
            snapshot_hash,
            snapshot_data,
            captured_at
          ),
          users!content_reports_reporter_id_fkey (
            id,
            trusted_flagger,
            total_reports:content_reports(count)
          )
        `
      )
      .is('deleted_at', null);
  }
  /**
   * Apply filtering parameters to an existing query builder.
   *
   * This method mutates and returns the provided Supabase query builder so it
   * can be chained by the caller. Filters are translated to PostgREST queries
   * and intentionally mirror UI filter options. Defaults:
   * - If no `status` filter is provided, we only return `pending` and
   *   `in_review` items (the active moderation queue).
   *
   * Warning: callers should execute the returned query (e.g. with `await query`)
   * to run the request. The query type is `any` to keep this utility focused on
   * behavior rather than on exact PostgREST generic types.
   */
  private applyFiltersToQuery(query: any, filters: QueueFilters): any {
    let q = query;

    // Status filter: if provided, use the explicit list. Otherwise limit to
    // active queue statuses to avoid returning closed/archived reports.
    if (filters.status && filters.status.length > 0) {
      q = q.in('status', filters.status);
    } else {
      q = q.in('status', ['pending', 'in_review']);
    }

    // Minimum priority: use greater-than-or-equal when supplied
    if (filters.priority_min !== undefined) {
      q = q.gte('priority', filters.priority_min);
    }

    // Report type(s): allow filtering by one or more report_type values
    if (filters.report_type && filters.report_type.length > 0) {
      q = q.in('report_type', filters.report_type);
    }

    // Trusted flagger: this is joined from the `users` relation in the
    // base select; PostgREST allows filtering on joined columns if aliased
    // appropriately in the select. Here we rely on a flat `trusted_flagger`
    // column being available on the selected result rows.
    if (filters.trusted_flagger !== undefined) {
      q = q.eq('trusted_flagger', filters.trusted_flagger);
    }

    // Overdue only: compare SLA deadline to now to return only overdue items
    if (filters.overdue_only) {
      q = q.lt('sla_deadline', new Date().toISOString());
    }

    return q;
  }

  private async filterActiveClaims(query: any, moderatorId: string) {
    const { data: activeClaims } = await supabase
      .from('moderation_claims')
      .select('report_id')
      .neq('moderator_id', moderatorId)
      .gt('expires_at', new Date().toISOString());

    if (activeClaims && activeClaims.length > 0) {
      const claimedReportIds = activeClaims.map((c) => c.report_id);
      return query.not('id', 'in', claimedReportIds);
    }

    return query;
  }

  private calculateEnhancedItems(reports: any[]): ModerationQueueItem[] {
    const now = DateTime.now();
    return reports.map((report: any) => {
      let enhancedPriority = report.priority;

      if (report.trusted_flagger) {
        enhancedPriority += TRUSTED_FLAGGER_PRIORITY_BOOST;
      }

      const slaDeadline = DateTime.fromJSDate(new Date(report.sla_deadline));
      const timeRemaining = slaDeadline.diff(now, 'hours').hours;
      const totalSlaTime = slaDeadline.diff(
        DateTime.fromJSDate(new Date(report.created_at)),
        'hours'
      ).hours;

      let slaProgress: number;
      if (totalSlaTime <= 0) {
        // SLA window has elapsed or is invalid
        slaProgress = 1;
      } else {
        // Clamp timeRemaining between 0 and totalSlaTime
        const clampedTimeRemaining = Math.max(
          0,
          Math.min(timeRemaining, totalSlaTime)
        );
        slaProgress = 1 - clampedTimeRemaining / totalSlaTime;
        // Ensure slaProgress is bounded between 0 and 1
        slaProgress = Math.max(0, Math.min(slaProgress, 1));
      }

      if (slaProgress >= SLA_WARNING_THRESHOLD_90) {
        enhancedPriority += 20;
      } else if (slaProgress >= SLA_WARNING_THRESHOLD_75) {
        enhancedPriority += 10;
      }

      return {
        report: {
          ...report,
          priority: enhancedPriority,
        } as ContentReport,
        content_snapshot: report.content_snapshots?.[0] || undefined,
        reporter_history: report.users
          ? {
              total_reports: report.users.total_reports?.[0]?.count || 0,
              trusted_flagger: report.users.trusted_flagger || false,
              accuracy_rate: undefined,
            }
          : undefined,
        similar_decisions: [],
      };
    });
  }

  /**
   * Claims a report for exclusive moderation by a specific moderator
   *
   * Features:
   * - 4-hour claim timeout with automatic release
   * - Conflict-of-interest prevention (moderator cannot claim own reports)
   * - Atomic claim operation to prevent race conditions
   *
   * Requirements: 2.2
   */
  async claimReport(
    reportId: string,
    moderatorId: string
  ): Promise<ClaimResult> {
    try {
      const report = await this.fetchReport(reportId);
      if (!report) {
        return {
          success: false,
          report_id: reportId,
          error: 'Report not found',
        };
      }

      // Conflict-of-interest check
      if (report.reporter_id === moderatorId) {
        return {
          success: false,
          report_id: reportId,
          error: 'Cannot claim reports you submitted (conflict of interest)',
          conflict_of_interest: {
            has_conflict: true,
            reasons: [
              'Cannot claim reports you submitted (conflict of interest)',
            ],
            conflict_type: 'relationship',
          },
        };
      }

      // Atomic claim operation: rely on database unique constraint to prevent race conditions
      // The unique index on (report_id) WHERE expires_at > NOW() ensures only one active claim per report
      const expiresAt = DateTime.now()
        .plus({ hours: CLAIM_TIMEOUT_HOURS })
        .toJSDate();

      const claimResult = await this.createClaimRecord(
        reportId,
        moderatorId,
        expiresAt
      );
      if (!claimResult.success) {
        return {
          success: false,
          report_id: reportId,
          error: claimResult.error || 'Failed to claim report',
          ...(claimResult.conflictingExpiry && {
            conflicting_expiry: claimResult.conflictingExpiry,
          }),
        };
      }

      const updated = await this.updateReportStatusToInReview(reportId);
      if (!updated) {
        // Rollback claim if status update fails
        await supabase
          .from('moderation_claims')
          .delete()
          .eq('report_id', reportId)
          .eq('moderator_id', moderatorId);

        return {
          success: false,
          report_id: reportId,
          error: 'Failed to update report status',
        };
      }

      return {
        success: true,
        report_id: reportId,
        claimed_by: moderatorId,
        claim_expires_at: expiresAt,
      };
    } catch (error) {
      return {
        success: false,
        report_id: reportId,
        error: `Claim operation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  private async fetchReport(reportId: string) {
    const { data, error } = await supabase
      .from('content_reports')
      .select('id, reporter_id, status')
      .eq('id', reportId)
      .single();

    if (error) return null;
    return data as any;
  }

  private async getActiveClaim(reportId: string) {
    const now = new Date();
    const { data } = await supabase
      .from('moderation_claims')
      .select('moderator_id, expires_at')
      .eq('report_id', reportId)
      .gt('expires_at', now.toISOString())
      .maybeSingle();

    return data as any;
  }

  private async createClaimRecord(
    reportId: string,
    moderatorId: string,
    expiresAt: Date
  ): Promise<{ success: boolean; error?: string; conflictingExpiry?: string }> {
    const now = new Date();
    const { error } = await supabase.from('moderation_claims').insert({
      report_id: reportId,
      moderator_id: moderatorId,
      claimed_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    if (!error) {
      return { success: true };
    }

    // Handle unique constraint violation (race condition: report already claimed)
    if (
      error.code === '23505' &&
      error.message?.includes('uniq_active_moderation_claim')
    ) {
      // Try to get the conflicting claim's expiry time for better error message
      const conflictingClaim = await this.getActiveClaim(reportId);
      return {
        success: false,
        error: 'Report already claimed by another moderator',
        conflictingExpiry: conflictingClaim?.expires_at?.toString(),
      };
    }

    return {
      success: false,
      error: `Failed to create claim record: ${error.message}`,
    };
  }

  private async updateReportStatusToInReview(reportId: string) {
    const now = new Date();
    const { error } = await supabase
      .from('content_reports')
      .update({
        status: 'in_review' as ReportStatus,
        updated_at: now.toISOString(),
      })
      .eq('id', reportId);

    return !error;
  }

  /**
   * Releases a claim on a report, returning it to the general queue
   *
   * Requirements: 2.2
   */
  async releaseClaim(
    reportId: string,
    moderatorId: string
  ): Promise<ReleaseClaimResult> {
    try {
      // First, update report status to pending with guard (only if currently in_review)
      // This ensures we don't overwrite a status change that happened concurrently
      const { error: statusUpdateError, count } = await supabase
        .from('content_reports')
        .update({
          status: 'pending' as ReportStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)
        .eq('status', 'in_review')
        .select('id', { count: 'exact', head: true });

      if (statusUpdateError) {
        return {
          success: false,
          error: `Failed to update report status: ${statusUpdateError.message}`,
        };
      }

      // If no rows were updated, the report was not in 'in_review' status
      // This could mean it was already processed or claimed by someone else
      if (count === 0) {
        return {
          success: false,
          error: 'Report is not in review status or was already processed',
        };
      }

      // Now delete the claim - this should succeed since we verified the report was in_review
      const { error: deleteError } = await supabase
        .from('moderation_claims')
        .delete()
        .eq('report_id', reportId)
        .eq('moderator_id', moderatorId);

      if (deleteError) {
        // Claim deletion failed - revert the status update to prevent orphaned reports
        const { error: revertError } = await supabase
          .from('content_reports')
          .update({
            status: 'in_review' as ReportStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reportId)
          .eq('status', 'pending'); // Only revert if it's still pending

        if (revertError) {
          // Log the revert failure but still return the original error
          console.error(
            'Failed to revert report status after claim deletion failure:',
            revertError
          );
        }

        return {
          success: false,
          error: `Failed to release claim: ${deleteError.message}`,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: `Release claim failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Automatically releases expired claims (background job)
   *
   * Should be called periodically (e.g., every 5 minutes) to ensure
   * claims are released when the 4-hour timeout expires
   *
   * Requirements: 2.2
   */
  async releaseExpiredClaims(): Promise<{ released_count: number }> {
    try {
      const now = new Date().toISOString();

      // Find expired claims
      const { data: expiredClaims, error: fetchError } = await supabase
        .from('moderation_claims')
        .select('report_id')
        .lt('expires_at', now);

      if (fetchError) {
        throw new Error(
          `Failed to fetch expired claims: ${fetchError.message}`
        );
      }

      if (!expiredClaims || expiredClaims.length === 0) {
        return { released_count: 0 };
      }

      const reportIds = expiredClaims.map((c) => c.report_id);

      // Delete expired claims
      const { error: deleteError } = await supabase
        .from('moderation_claims')
        .delete()
        .lt('expires_at', now);

      if (deleteError) {
        throw new Error(
          `Failed to delete expired claims: ${deleteError.message}`
        );
      }

      // Update report statuses back to pending
      const { error: updateError } = await supabase
        .from('content_reports')
        .update({
          status: 'pending' as ReportStatus,
          updated_at: new Date().toISOString(),
        })
        .in('id', reportIds);

      if (updateError) {
        throw new Error(
          `Failed to update report statuses: ${updateError.message}`
        );
      }

      return { released_count: reportIds.length };
    } catch (error) {
      throw new Error(
        `Expired claim release failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Record enforcement action and track repeat offenders
   *
   * Integrates with RepeatOffenderService to automatically track violations
   * when restrictive moderation actions are taken.
   *
   * Requirements: 12.1, 12.3
   */
  async recordEnforcementAction(
    decision: ModerationDecisionInput,
    decisionId: string,
    contentReport: ContentReport
  ): Promise<void> {
    // Only track violations for actions that indicate policy violations
    const restrictiveActions: ModerationAction[] = [
      'quarantine',
      'geo_block',
      'remove',
      'suspend_user',
      'rate_limit',
      'shadow_ban',
    ];

    if (!restrictiveActions.includes(decision.action)) {
      return;
    }

    // Get user_id from content report
    const userId = contentReport.user_id;
    if (!userId) {
      return; // Cannot track violations without user ID
    }

    // Determine violation type from policy violations
    const violationType =
      decision.policy_violations && decision.policy_violations.length > 0
        ? decision.policy_violations[0] // Use primary policy violation
        : 'general_policy_violation';

    // Record violation
    await this.repeatOffenderService.recordViolation({
      user_id: userId,
      violation_type: violationType,
      decision_id: decisionId,
      reasoning: decision.reasoning,
    });
  }

  /**
   * Track manifestly unfounded report
   *
   * Called when a report is determined to be baseless or in bad faith
   *
   * Requirements: 12.1, 12.3
   */
  async trackManifestlyUnfounded(params: {
    reportId: string;
    reporterId: string;
    decisionId: string;
    reasoning: string;
  }): Promise<void> {
    const { reportId, reporterId, decisionId, reasoning } = params;
    await this.repeatOffenderService.trackManifestlyUnfounded({
      reporter_id: reporterId,
      report_id: reportId,
      decision_id: decisionId,
      reasoning,
    });
  }

  /**
   * Get repeat offender records for a user
   *
   * Requirements: 12.5
   */
  async getRepeatOffenderRecords(userId: string) {
    return await this.repeatOffenderService.getAllRecordsForUser(userId);
  }
}

// Export singleton instance
export const moderationService = new ModerationService();
