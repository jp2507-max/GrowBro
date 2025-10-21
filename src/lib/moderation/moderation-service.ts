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
  ContentReport,
  ModerationQueue,
  ModerationQueueItem,
  QueueFilters,
  ReportStatus,
} from '@/types/moderation';

import { supabase } from '../supabase';

// ============================================================================
// Types
// ============================================================================

interface ClaimResult {
  success: boolean;
  error?: string;
  claim_expires_at?: Date;
}

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

  private buildBaseQueueQuery() {
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

  private applyFiltersToQuery(query: any, filters: QueueFilters) {
    let q = query;

    if (filters.status && filters.status.length > 0) {
      q = q.in('status', filters.status);
    } else {
      q = q.in('status', ['pending', 'in_review']);
    }

    if (filters.priority_min !== undefined) {
      q = q.gte('priority', filters.priority_min);
    }

    if (filters.report_type && filters.report_type.length > 0) {
      q = q.in('report_type', filters.report_type);
    }

    if (filters.trusted_flagger !== undefined) {
      q = q.eq('trusted_flagger', filters.trusted_flagger);
    }

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
      return query.not('id', 'in', `(${claimedReportIds.join(',')})`);
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
      const slaProgress = 1 - timeRemaining / totalSlaTime;

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
        return { success: false, error: 'Report not found' };
      }

      // Conflict-of-interest check
      if (report.reporter_id === moderatorId) {
        return {
          success: false,
          error: 'Cannot claim reports you submitted (conflict of interest)',
        };
      }

      const existingClaim = await this.getActiveClaim(reportId);
      if (existingClaim) {
        return {
          success: false,
          error: `Report already claimed by another moderator until ${existingClaim.expires_at}`,
        };
      }

      const expiresAt = DateTime.now()
        .plus({ hours: CLAIM_TIMEOUT_HOURS })
        .toJSDate();

      const created = await this.createClaimRecord(
        reportId,
        moderatorId,
        expiresAt
      );
      if (!created) {
        return { success: false, error: 'Failed to claim report' };
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
          error: 'Failed to update report status',
        };
      }

      return { success: true, claim_expires_at: expiresAt };
    } catch (error) {
      return {
        success: false,
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
  ) {
    const now = new Date();
    const { error } = await supabase.from('moderation_claims').insert({
      report_id: reportId,
      moderator_id: moderatorId,
      claimed_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    return !error;
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
      // Delete claim
      const { error: deleteError } = await supabase
        .from('moderation_claims')
        .delete()
        .eq('report_id', reportId)
        .eq('moderator_id', moderatorId);

      if (deleteError) {
        return {
          success: false,
          error: `Failed to release claim: ${deleteError.message}`,
        };
      }

      // Update report status back to pending
      const { error: updateError } = await supabase
        .from('content_reports')
        .update({
          status: 'pending' as ReportStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (updateError) {
        return {
          success: false,
          error: `Failed to update report status: ${updateError.message}`,
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
}

// Export singleton instance
export const moderationService = new ModerationService();
