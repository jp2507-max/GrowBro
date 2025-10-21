/**
 * Content Restoration Service
 *
 * Implements content visibility restoration for upheld appeals
 * Restores posts, comments, and other content that was incorrectly removed
 *
 * Requirements: 4.2 (Appeal decision reversal)
 */

import type { ModerationAction } from '@/types/moderation';

import { supabase } from '../supabase';

// ============================================================================
// Types
// ============================================================================

export interface ContentRestoration {
  contentId: string;
  // Only 'post' and 'comment' are currently implemented; 'image' and 'profile' reserved for future expansion
  contentType: 'post' | 'comment' | 'image' | 'profile';
  originalAction: ModerationAction;
  restoredAt: Date;
  reversalReason: string;
}

export interface RestorationResult {
  success: boolean;
  contentId?: string;
  error?: string;
}

// ============================================================================
// Content Restoration Functions
// ============================================================================

/**
 * Restore content visibility after appeal is upheld
 *
 * Actions:
 * - Clears deleted_at timestamp
 * - Resets moderation_status to 'active'
 * - Updates moderation_reason with reversal info
 * - Logs restoration event
 *
 * Requirement: 4.2
 */
export async function restoreContentVisibility(
  contentId: string,
  contentType: 'post' | 'comment',
  restorationData: { reversalReason: string; appealId?: string }
): Promise<RestorationResult> {
  try {
    const tableName = contentType === 'post' ? 'posts' : 'post_comments';

    // Update content to restore visibility
    const { data, error } = await supabase
      .from(tableName)
      .update({
        deleted_at: null,
        moderation_status: 'active',
        moderation_reason: `Restored via appeal ${restorationData.appealId}: ${restorationData.reversalReason}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
      .select()
      .single();

    if (error) throw error;

    console.log(
      `[ContentRestoration] Restored ${contentType} visibility:`,
      contentId
    );

    return {
      success: true,
      contentId: data.id,
    };
  } catch (error) {
    console.error('[ContentRestoration] Failed to restore content:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Restoration failed',
    };
  }
}

/**
 * Remove quarantine status from content
 *
 * Requirement: 4.2
 */
export async function removeQuarantine(
  contentId: string,
  contentType: 'post' | 'comment',
  reversalReason: string
): Promise<RestorationResult> {
  try {
    const tableName = contentType === 'post' ? 'posts' : 'post_comments';

    const { data, error } = await supabase
      .from(tableName)
      .update({
        moderation_status: 'active',
        moderation_reason: `Quarantine removed: ${reversalReason}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
      .select()
      .single();

    if (error) throw error;

    console.log(
      `[ContentRestoration] Removed quarantine from ${contentType}:`,
      contentId
    );

    return {
      success: true,
      contentId: data.id,
    };
  } catch (error) {
    console.error('[ContentRestoration] Failed to remove quarantine:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Removal failed',
    };
  }
}

/**
 * Remove geographic blocking restrictions
 *
 * Requirement: 4.2
 */
export async function removeGeoBlock(
  contentId: string,
  contentType: 'post' | 'comment',
  reversalReason: string
): Promise<RestorationResult> {
  try {
    const tableName = contentType === 'post' ? 'posts' : 'post_comments';

    const { data, error } = await supabase
      .from(tableName)
      .update({
        geo_restrictions: null,
        moderation_reason: `Geo-block removed: ${reversalReason}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
      .select()
      .single();

    if (error) throw error;

    console.log(
      `[ContentRestoration] Removed geo-block from ${contentType}:`,
      contentId
    );

    return {
      success: true,
      contentId: data.id,
    };
  } catch (error) {
    console.error('[ContentRestoration] Failed to remove geo-block:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Removal failed',
    };
  }
}

/**
 * Main content restoration dispatcher
 *
 * Routes restoration request to appropriate function based on original action
 *
 * Requirement: 4.2
 */
export async function restoreContent(
  contentId: string,
  contentType: 'post' | 'comment',
  options: {
    originalAction: ModerationAction;
    restorationData: { reversalReason: string; appealId?: string };
  }
): Promise<RestorationResult> {
  switch (options.originalAction) {
    case 'remove':
      return restoreContentVisibility(
        contentId,
        contentType,
        options.restorationData
      );

    case 'quarantine':
      return removeQuarantine(
        contentId,
        contentType,
        options.restorationData.reversalReason
      );

    case 'geo_block':
      return removeGeoBlock(
        contentId,
        contentType,
        options.restorationData.reversalReason
      );

    case 'no_action':
      return {
        success: true,
        contentId,
      };

    default:
      console.warn(
        `[ContentRestoration] No restoration handler for action: ${options.originalAction}`
      );
      return {
        success: false,
        error: `Unsupported restoration action: ${options.originalAction}`,
      };
  }
}

// ============================================================================
// Exports
// ============================================================================

export const contentRestorationService = {
  restoreContent,
  restoreContentVisibility,
  removeQuarantine,
  removeGeoBlock,
};
