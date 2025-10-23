/**
 * Content Age-Gating Engine
 *
 * Implements DSA Art. 28 age-gating enforcement for community content
 * Automatic flagging, manual tagging, and safer defaults for minors
 *
 * Requirement 8.2: Automatically flag and restrict age-restricted content,
 * restrict visibility to verified 18+ users with safer defaults for minors
 */

import { type createClient } from '@supabase/supabase-js';

import type {
  AccessResult,
  ContentAgeRestriction,
  FlagAgeRestrictedContentInput,
  UserAgeStatus,
} from '@/types/age-verification';
import { AGE_RESTRICTED_KEYWORDS } from '@/types/age-verification';

export class ContentAgeGatingEngine {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  /**
   * Check if user can access age-restricted content
   * Implements safer defaults for minors
   *
   * @param userId - User UUID
   * @param contentId - Content identifier
   * @param contentType - Type of content
   * @returns Access result with gating status
   */
  async checkAgeGating(
    userId: string,
    contentId: string,
    contentType: 'post' | 'comment' | 'image' | 'profile' | 'other'
  ): Promise<AccessResult> {
    // Check if content is age-restricted
    const restriction = await this.getContentRestriction(
      contentId,
      contentType
    );

    // Content not restricted - grant access
    if (!restriction || !restriction.isAgeRestricted) {
      return {
        granted: true,
        reason: 'content_not_restricted',
        requiresVerification: false,
        contentId,
        contentType,
      };
    }

    // Check user age verification status
    const userStatus = await this.getUserAgeStatus(userId);

    // User is age-verified - grant access
    if (userStatus?.isAgeVerified) {
      return {
        granted: true,
        reason: 'age_verified',
        requiresVerification: false,
        contentId,
        contentType,
      };
    }

    // Apply safer defaults for minors/unverified users
    const reason = this.determineAccessDenialReason(userStatus);

    return {
      granted: false,
      reason,
      requiresVerification: true,
      contentId,
      contentType,
    };
  }

  /**
   * Flag content as age-restricted
   * Supports system auto-flagging, author tagging, and moderator flagging
   *
   * @param input - Age restriction flagging input
   * @returns Created/updated age restriction
   */
  async flagAgeRestrictedContent(
    input: FlagAgeRestrictedContentInput
  ): Promise<ContentAgeRestriction> {
    const {
      contentId,
      contentType,
      flaggedBySystem = false,
      flaggedByAuthor = false,
      flaggedByModerator = false,
      moderatorId,
      restrictionReason,
      keywordsDetected,
      minAge = 18,
    } = input;

    // Upsert age restriction
    const { data: restriction, error } = await this.supabase
      .from('content_age_restrictions')
      .upsert(
        {
          content_id: contentId,
          content_type: contentType,
          is_age_restricted: true,
          min_age: minAge,
          flagged_by_system: flaggedBySystem,
          flagged_by_author: flaggedByAuthor,
          flagged_by_moderator: flaggedByModerator,
          moderator_id: moderatorId || null,
          restriction_reason: restrictionReason || null,
          keywords_detected: keywordsDetected || null,
        } as any,
        {
          onConflict: 'content_id,content_type',
        }
      )
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to flag age-restricted content: ${error.message}`
      );
    }

    return this.mapDbRestrictionToType(restriction);
  }

  /**
   * Automatically detect and flag age-restricted content
   * Uses keyword detection for cannabis-related content
   *
   * @param contentId - Content identifier
   * @param contentType - Type of content
   * @param contentText - Content text to analyze
   * @returns True if flagged, false otherwise
   */
  async autoFlagContent(
    contentId: string,
    contentType: 'post' | 'comment' | 'image' | 'profile' | 'other',
    contentText: string
  ): Promise<boolean> {
    // Detect age-restricted keywords
    const detectedKeywords = this.detectAgeRestrictedKeywords(contentText);

    // No restricted keywords found
    if (detectedKeywords.length === 0) {
      return false;
    }

    // Flag content with detected keywords
    await this.flagAgeRestrictedContent({
      contentId,
      contentType,
      minAge: 18,
      flaggedBySystem: true,
      flaggedByAuthor: false,
      flaggedByModerator: false,
      restrictionReason: 'Automatic detection: age-restricted keywords',
      keywordsDetected: detectedKeywords,
    });

    return true;
  }

  /**
   * Remove age restriction from content
   *
   * @param contentId - Content identifier
   * @param contentType - Type of content
   */
  async removeAgeRestriction(
    contentId: string,
    contentType: 'post' | 'comment' | 'image' | 'profile' | 'other'
  ): Promise<void> {
    const { error } = (await (
      this.supabase.from('content_age_restrictions').update as any
    )({
      is_age_restricted: false,
    })
      .eq('content_id', contentId)
      .eq('content_type', contentType)) as any;

    if (error) {
      throw new Error(`Failed to remove age restriction: ${error.message}`);
    }
  }

  /**
   * Get age-gating status for content
   *
   * @param contentId - Content identifier
   * @param contentType - Type of content
   * @returns Age restriction or null
   */
  async getAgeGatingStatus(
    contentId: string,
    contentType: 'post' | 'comment' | 'image' | 'profile' | 'other'
  ): Promise<ContentAgeRestriction | null> {
    return this.getContentRestriction(contentId, contentType);
  }

  /**
   * Filter content list based on user age verification
   * Removes age-restricted content for unverified users
   *
   * @param userId - User UUID
   * @param contentIds - Array of content IDs to filter
   * @param contentType - Type of content
   * @returns Filtered content IDs
   */
  async filterContentByAge(
    userId: string,
    contentIds: string[],
    contentType: 'post' | 'comment' | 'image' | 'profile' | 'other'
  ): Promise<string[]> {
    // Get user age status
    const userStatus = await this.getUserAgeStatus(userId);

    // User is verified - no filtering needed
    if (userStatus?.isAgeVerified) {
      return contentIds;
    }

    // Get all age-restricted content in the list
    const { data: restrictions } = await this.supabase
      .from('content_age_restrictions')
      .select('content_id')
      .in('content_id', contentIds)
      .eq('content_type', contentType)
      .eq('is_age_restricted', true);

    const restrictedItems = (restrictions || []) as any[];
    const restrictedIds = new Set(restrictedItems.map((r) => r.content_id));

    // Filter out restricted content
    return contentIds.filter((id) => !restrictedIds.has(id));
  }

  /**
   * Get age-restricted content statistics
   *
   * @returns Statistics object
   */
  async getAgeRestrictionStats(): Promise<{
    totalRestricted: number;
    systemFlagged: number;
    authorFlagged: number;
    moderatorFlagged: number;
  }> {
    const { data: stats } = await this.supabase
      .from('content_age_restrictions')
      .select('flagged_by_system, flagged_by_author, flagged_by_moderator')
      .eq('is_age_restricted', true);

    const statsList = (stats || []) as any[];
    const totalRestricted = statsList.length;
    const systemFlagged = statsList.filter((s) => s.flagged_by_system).length;
    const authorFlagged = statsList.filter((s) => s.flagged_by_author).length;
    const moderatorFlagged = statsList.filter(
      (s) => s.flagged_by_moderator
    ).length;

    return {
      totalRestricted,
      systemFlagged,
      authorFlagged,
      moderatorFlagged,
    };
  }

  /**
   * Apply safer defaults for a user (minors)
   * Implements DSA Art. 28 safety-by-design principles
   *
   * @param userId - User UUID
   */
  async applySaferDefaults(userId: string): Promise<void> {
    await this.supabase.from('user_age_status').upsert({
      user_id: userId,
      is_age_verified: false,
      is_minor: true,
      minor_protections_enabled: true,
      show_age_restricted_content: false,
    } as any);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get content restriction from database
   */
  private async getContentRestriction(
    contentId: string,
    contentType: string
  ): Promise<ContentAgeRestriction | null> {
    const { data: restriction, error } = await this.supabase
      .from('content_age_restrictions')
      .select('*')
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .single();

    if (error || !restriction) {
      return null;
    }

    return this.mapDbRestrictionToType(restriction);
  }

  /**
   * Get user age status from database
   */
  private async getUserAgeStatus(
    userId: string
  ): Promise<UserAgeStatus | null> {
    const { data: status, error } = await this.supabase
      .from('user_age_status')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !status) {
      return null;
    }

    const statusData = status as any;

    return {
      userId: statusData.user_id,
      isAgeVerified: statusData.is_age_verified,
      verifiedAt: statusData.verified_at
        ? new Date(statusData.verified_at)
        : null,
      activeTokenId: statusData.active_token_id,
      isMinor: statusData.is_minor,
      minorProtectionsEnabled: statusData.minor_protections_enabled,
      showAgeRestrictedContent: statusData.show_age_restricted_content,
      createdAt: new Date(statusData.created_at),
      updatedAt: new Date(statusData.updated_at),
    };
  }

  /**
   * Determine reason for access denial
   */
  private determineAccessDenialReason(
    userStatus: UserAgeStatus | null
  ): AccessResult['reason'] {
    if (!userStatus) {
      return 'verification_required';
    }

    if (userStatus.isMinor) {
      return 'minor_protections_active';
    }

    return userStatus.isAgeVerified ? 'age_verified' : 'age_not_verified';
  }

  /**
   * Detect age-restricted keywords in content text
   */
  private detectAgeRestrictedKeywords(contentText: string): string[] {
    const lowerText = contentText.toLowerCase();
    const detected: string[] = [];

    for (const keyword of AGE_RESTRICTED_KEYWORDS) {
      if (lowerText.includes(keyword)) {
        detected.push(keyword);
      }
    }

    return detected;
  }

  /**
   * Map database restriction to TypeScript type
   */
  private mapDbRestrictionToType(dbRestriction: any): ContentAgeRestriction {
    return {
      id: dbRestriction.id,
      contentId: dbRestriction.content_id,
      contentType: dbRestriction.content_type,
      isAgeRestricted: dbRestriction.is_age_restricted,
      minAge: dbRestriction.min_age,
      flaggedBySystem: dbRestriction.flagged_by_system,
      flaggedByAuthor: dbRestriction.flagged_by_author,
      flaggedByModerator: dbRestriction.flagged_by_moderator,
      moderatorId: dbRestriction.moderator_id,
      restrictionReason: dbRestriction.restriction_reason,
      keywordsDetected: dbRestriction.keywords_detected,
      createdAt: new Date(dbRestriction.created_at),
      updatedAt: new Date(dbRestriction.updated_at),
    };
  }
}

/**
 * Content age-gating integration hooks for feed filtering
 */
export class ContentAgeGatingHooks {
  private gatingEngine: ContentAgeGatingEngine;

  constructor(gatingEngine: ContentAgeGatingEngine) {
    this.gatingEngine = gatingEngine;
  }

  /**
   * Post-creation hook: auto-flag age-restricted content
   *
   * @param contentId - Content identifier
   * @param contentType - Type of content
   * @param contentText - Content text to analyze
   */
  async onContentCreated(
    contentId: string,
    contentType: 'post' | 'comment' | 'image' | 'profile' | 'other',
    contentText: string
  ): Promise<void> {
    await this.gatingEngine.autoFlagContent(
      contentId,
      contentType,
      contentText
    );
  }

  /**
   * Feed filtering hook: filter age-restricted content for unverified users
   *
   * @param userId - User UUID
   * @param contentIds - Array of content IDs to filter
   * @param contentType - Type of content
   * @returns Filtered content IDs
   */
  async onFeedLoad(
    userId: string,
    contentIds: string[],
    contentType: 'post' | 'comment' | 'image' | 'profile' | 'other'
  ): Promise<string[]> {
    return this.gatingEngine.filterContentByAge(
      userId,
      contentIds,
      contentType
    );
  }

  /**
   * User registration hook: apply safer defaults for new users
   *
   * @param userId - User UUID
   */
  async onUserRegistered(userId: string): Promise<void> {
    await this.gatingEngine.applySaferDefaults(userId);
  }
}
