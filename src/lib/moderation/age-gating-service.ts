/**
 * Age Gating Service
 *
 * Handles age-restricted content access checks.
 * Implements DSA Art. 28 requirement 8.2: Age-restricted content filtering.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { CheckAgeGatingInput } from '@/types/age-verification';
import type {
  DbContentRestriction,
  DbUserAgeStatus,
} from '@/types/database-records';

import { type AgeAuditService } from './age-audit-service';

type DbContentRestrictionRecord = Pick<
  DbContentRestriction,
  'content_id' | 'content_type' | 'is_age_restricted'
>;

export type AgeGatingResult = {
  granted: boolean;
  reason: string;
  requiresVerification: boolean;
};

export class AgeGatingService {
  private supabase: SupabaseClient;
  private auditService: AgeAuditService;

  constructor(supabase: SupabaseClient, auditService: AgeAuditService) {
    this.supabase = supabase;
    this.auditService = auditService;
  }

  /**
   * Check age-gating access for content
   * Implements Requirement 8.2: Age-restricted content filtering
   *
   * @param input - Age-gating check input
   * @returns Access result with gating status
   */
  async checkAgeGating(input: CheckAgeGatingInput): Promise<AgeGatingResult> {
    const { userId, contentId, contentType } = input;

    // Check if content is age-restricted
    const { data: restriction, error: restrictionError } = await this.supabase
      .from('content_age_restrictions')
      .select('*')
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .limit(1);

    const restrictionData = (
      restriction as DbContentRestrictionRecord[] | null
    )?.[0];

    // If restriction lookup fails, fail-closed (safer for compliance)
    if (restrictionError) {
      await this.auditService.logAgeGatingEvent({
        userId,
        contentId,
        contentType,
        accessGranted: false,
      });
      return this.buildResult(false, 'verification_required', true);
    }

    // Content not restricted
    if (!restrictionData || !restrictionData.is_age_restricted) {
      await this.auditService.logAgeGatingEvent({
        userId,
        contentId,
        contentType,
        accessGranted: true,
      });
      return this.buildResult(true, 'content_not_restricted', false);
    }

    // Check user age verification status
    const { data: userStatus, error: userStatusError } = await this.supabase
      .from('user_age_status')
      .select('*')
      .eq('user_id', userId)
      .limit(1);

    if (userStatusError) {
      await this.auditService.logAgeGatingEvent({
        userId,
        contentId,
        contentType,
        accessGranted: false,
        failureReason: 'user_status_lookup_failed',
      });
      return this.buildResult(false, 'verification_check_failed', true);
    }

    const userStatusData = (userStatus as DbUserAgeStatus[] | null)?.[0];

    // User is age-verified
    if (userStatusData?.is_age_verified) {
      await this.auditService.logAgeGatingEvent({
        userId,
        contentId,
        contentType,
        accessGranted: true,
      });
      return this.buildResult(true, 'age_verified', false);
    }

    // Access denied - verification required
    await this.auditService.logAgeGatingEvent({
      userId,
      contentId,
      contentType,
      accessGranted: false,
    });
    const reason = userStatusData?.is_minor
      ? 'minor_protections_active'
      : 'age_not_verified';
    return this.buildResult(false, reason, true);
  }

  /**
   * Check if content is age-restricted (without user context)
   *
   * @param contentId - Content identifier
   * @param contentType - Type of content
   * @returns Whether the content is age-restricted
   */
  async isContentAgeRestricted(
    contentId: string,
    contentType: string
  ): Promise<boolean> {
    const { data: restriction, error } = await this.supabase
      .from('content_age_restrictions')
      .select('is_age_restricted')
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .limit(1);

    // Fail-closed: assume restricted if lookup fails
    if (error) {
      console.error(
        '[AgeGatingService] Restriction lookup failed:',
        error.message
      );
      return true;
    }

    const restrictionData = (
      restriction as Pick<DbContentRestrictionRecord, 'is_age_restricted'>[]
    )?.[0];

    return restrictionData?.is_age_restricted ?? false;
  }

  private buildResult(
    granted: boolean,
    reason: string,
    requiresVerification: boolean
  ): AgeGatingResult {
    return { granted, reason, requiresVerification };
  }
}
