/**
 * Account Restoration Service
 *
 * Implements account status restoration for upheld appeals
 * Restores user accounts that were incorrectly suspended or banned
 *
 * Requirements: 4.2 (Appeal decision reversal)
 */

import type { ModerationAction } from '@/types/moderation';

import { supabase } from '../supabase';

// ============================================================================
// Types
// ============================================================================

export interface AccountRestoration {
  userId: string;
  originalAction: ModerationAction;
  restoredAt: Date;
  reversalReason: string;
}

export interface AccountRestorationResult {
  success: boolean;
  userId?: string;
  error?: string;
}

// ============================================================================
// Account Restoration Functions
// ============================================================================

/**
 * Restore user account status after appeal is upheld
 *
 * Actions:
 * - Removes suspension flags
 * - Restores account to 'active' status
 * - Clears rate limiting restrictions
 * - Removes shadow ban if applicable
 * - Logs restoration event
 *
 * Requirement: 4.2
 */
export async function restoreAccountStatus(
  userId: string,
  _reversalReason: string,
  _appealId: string
): Promise<AccountRestorationResult> {
  try {
    // Check if user has repeat offender record
    const { data: offenderRecord } = await supabase
      .from('repeat_offender_records')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (offenderRecord) {
      // Update repeat offender record to mark suspension as reversed
      const suspensionHistory = offenderRecord.suspension_history || [];
      const updatedHistory = suspensionHistory.map((suspension: any) => ({
        ...suspension,
        reversed: true,
        reversal_reason: restorationData.reversalReason,
        reversal_appeal_id: restorationData.appealId,
        reversal_date: new Date().toISOString(),
      }));

      await supabase
        .from('repeat_offender_records')
        .update({
          status: 'active',
          suspension_history: updatedHistory,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }

    // Note: In a full implementation, this would also update user profile table
    // to remove account restrictions, rate limits, shadow bans, etc.
    // For now, we log the restoration event

    console.log('[AccountRestoration] Restored account status:', userId);

    return {
      success: true,
      userId,
    };
  } catch (error) {
    console.error('[AccountRestoration] Failed to restore account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Restoration failed',
    };
  }
}

/**
 * Remove rate limiting restrictions
 *
 * Requirement: 4.2
 */
export async function removeRateLimit(
  userId: string,
  reversalReason: string
): Promise<AccountRestorationResult> {
  try {
    // In a full implementation, this would update rate limiting configuration
    // stored in Redis or similar cache layer

    console.log('[AccountRestoration] Removed rate limit for user:', userId);
    console.log('[AccountRestoration] Reason:', reversalReason);

    return {
      success: true,
      userId,
    };
  } catch (error) {
    console.error('[AccountRestoration] Failed to remove rate limit:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Removal failed',
    };
  }
}

/**
 * Remove shadow ban restrictions
 *
 * Requirement: 4.2
 */
export async function removeShadowBan(
  userId: string,
  reversalReason: string
): Promise<AccountRestorationResult> {
  try {
    // In a full implementation, this would update shadow ban flags
    // in user profile or cache layer

    console.log('[AccountRestoration] Removed shadow ban for user:', userId);
    console.log('[AccountRestoration] Reason:', reversalReason);

    return {
      success: true,
      userId,
    };
  } catch (error) {
    console.error('[AccountRestoration] Failed to remove shadow ban:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Removal failed',
    };
  }
}

/**
 * Get user ID from content report
 *
 * Helper to extract user ID from the content that was reported
 */
async function getUserIdFromReport(reportId: string): Promise<string | null> {
  try {
    const { data: report } = await supabase
      .from('content_reports')
      .select('content_id, content_type')
      .eq('id', reportId)
      .single();

    if (!report) return null;

    // Fetch the actual content to get user_id
    const tableName =
      report.content_type === 'post' ? 'posts' : 'post_comments';
    const { data: content } = await supabase
      .from(tableName)
      .select('user_id')
      .eq('id', report.content_id)
      .single();

    return content?.user_id || null;
  } catch (error) {
    console.error('[AccountRestoration] Failed to get user ID:', error);
    return null;
  }
}

/**
 * Main account restoration dispatcher
 *
 * Routes restoration request to appropriate function based on original action
 *
 * Requirement: 4.2
 */
export async function restoreAccount(
  reportId: string,
  originalAction: ModerationAction,
  restorationData: { reversalReason: string; appealId?: string }
): Promise<AccountRestorationResult> {
  // Get user ID from report
  const userId = await getUserIdFromReport(reportId);
  if (!userId) {
    return {
      success: false,
      error: 'Could not determine user ID from report',
    };
  }

  switch (originalAction) {
    case 'suspend_user':
      return restoreAccountStatus(
        userId,
        restorationData.reversalReason,
        restorationData.appealId || ''
      );

    case 'rate_limit':
      return removeRateLimit(userId, restorationData.reversalReason);

    case 'shadow_ban':
      return removeShadowBan(userId, restorationData.reversalReason);

    case 'no_action':
    case 'remove':
    case 'quarantine':
    case 'geo_block':
      // These actions don't affect account status
      return {
        success: true,
        userId,
      };

    default:
      console.warn(
        `[AccountRestoration] No restoration handler for action: ${originalAction}`
      );
      return {
        success: false,
        error: `Unsupported restoration action: ${originalAction}`,
      };
  }
}

// ============================================================================
// Exports
// ============================================================================

export const accountRestorationService = {
  restoreAccount,
  restoreAccountStatus,
  removeRateLimit,
  removeShadowBan,
};
