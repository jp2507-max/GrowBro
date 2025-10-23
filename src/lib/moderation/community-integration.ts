/**
 * Community Integration Service
 *
 * Integrates moderation system with existing GrowBro community features:
 * - Connects reporting to posts/comments
 * - Integrates age-gating with authentication
 * - Wires moderation decisions to content visibility
 * - Connects geo-restrictions to location features
 *
 * Requirements: 1.1, 8.7, 9.4
 */

import type { Post as ApiPost } from '@/api/posts';
import { getOptionalAuthenticatedUserId } from '@/lib/auth/user-utils';
import { supabase } from '@/lib/supabase';
import type { PostComment } from '@/types/community';

import { ContentAgeGatingEngine } from './content-age-gating';
import { geoLocationService } from './geo-location-service';

// Initialize content age gating engine
const contentAgeGatingEngine = new ContentAgeGatingEngine(supabase);

// Define ModerationDecision type locally since it's not exported
export interface ModerationDecision {
  action: string;
  geoRestrictions?: string[];
  requiresAgeVerification?: boolean;
  reasoning: string;
}

/**
 * Content visibility status after moderation checks
 */
export interface ContentVisibilityStatus {
  visible: boolean;
  reason?: 'removed' | 'quarantined' | 'geo_blocked' | 'age_restricted';
  message?: string;
  canAppeal?: boolean;
  appealDeadline?: Date;
}

/**
 * Enhanced post with moderation metadata
 */
export interface ModeratedPost extends ApiPost {
  moderation_status?: 'active' | 'removed' | 'quarantined' | 'under_review';
  is_age_restricted?: boolean;
  geo_restrictions?: string[]; // ISO country codes
  moderation_decision_id?: string;
  can_appeal?: boolean;
  appeal_deadline?: Date;
}

/**
 * Enhanced comment with moderation metadata
 */
export interface ModeratedComment extends PostComment {
  moderation_status?: 'active' | 'removed' | 'quarantined' | 'under_review';
  moderation_decision_id?: string;
  can_appeal?: boolean;
  appeal_deadline?: Date;
}

/**
 * Community Integration Service
 *
 * Provides integration points between moderation system and community features
 */
class CommunityIntegrationService {
  /**
   * Check if content should be visible to current user
   *
   * Applies moderation decisions, age-gating, and geo-restrictions
   */
  async checkContentVisibility(
    contentId: string,
    contentType: 'post' | 'comment'
  ): Promise<ContentVisibilityStatus> {
    try {
      const userId = await getOptionalAuthenticatedUserId();

      // Check moderation status
      const moderationStatus = await this.getModerationStatus(
        contentId,
        contentType
      );

      if (moderationStatus === 'removed') {
        return {
          visible: false,
          reason: 'removed',
          message:
            'This content has been removed for violating community guidelines',
          canAppeal: true,
          appealDeadline: this.calculateAppealDeadline(contentType),
        };
      }

      if (moderationStatus === 'quarantined') {
        return {
          visible: false,
          reason: 'quarantined',
          message: 'This content is under review',
        };
      }

      // Check age-gating if user is authenticated
      if (userId) {
        const ageGatingResult = await contentAgeGatingEngine.checkAgeGating(
          userId,
          contentId
        );

        if (!ageGatingResult.granted) {
          return {
            visible: false,
            reason: 'age_restricted',
            message: ageGatingResult.reason || 'Age verification required',
          };
        }
      }

      // Check geo-restrictions
      const geoAvailability = await geoLocationService.checkContentAvailability(
        contentId,
        await this.getCurrentLocation()
      );

      if (!geoAvailability.available) {
        return {
          visible: false,
          reason: 'geo_blocked',
          message:
            geoAvailability.reason || 'Content not available in your region',
        };
      }

      return { visible: true };
    } catch (error) {
      console.error('Error checking content visibility:', error);
      // Default to visible on error to avoid blocking legitimate content
      return { visible: true };
    }
  }

  /**
   * Filter posts based on moderation, age-gating, and geo-restrictions
   */
  async filterPosts(posts: ApiPost[]): Promise<ModeratedPost[]> {
    // const userId = await getOptionalAuthenticatedUserId();
    // const location = await this.getCurrentLocation();

    const filteredPosts = await Promise.all(
      posts.map(async (post) => {
        const visibility = await this.checkContentVisibility(
          String(post.id),
          'post'
        );

        // Enhance post with moderation metadata
        const moderatedPost: ModeratedPost = {
          ...post,
          moderation_status: await this.getModerationStatus(
            String(post.id),
            'post'
          ),
          is_age_restricted: post.is_age_restricted,
        };

        return visibility.visible ? moderatedPost : null;
      })
    );

    return filteredPosts.filter((post): post is ModeratedPost => post !== null);
  }

  /**
   * Filter comments based on moderation decisions
   */
  async filterComments(comments: PostComment[]): Promise<ModeratedComment[]> {
    const filteredComments = await Promise.all(
      comments.map(async (comment) => {
        const visibility = await this.checkContentVisibility(
          String(comment.id),
          'comment'
        );

        const moderatedComment: ModeratedComment = {
          ...comment,
          moderation_status: await this.getModerationStatus(
            String(comment.id),
            'comment'
          ),
        };

        return visibility.visible ? moderatedComment : null;
      })
    );

    return filteredComments.filter(
      (comment): comment is ModeratedComment => comment !== null
    );
  }

  /**
   * Apply moderation decision to content
   *
   * Updates content visibility based on moderation action
   */
  async applyModerationDecision(
    decision: ModerationDecision,
    contentId: string,
    contentType: 'post' | 'comment'
  ): Promise<void> {
    try {
      // Update content moderation status in database
      await this.updateContentModerationStatus(
        contentId,
        contentType,
        decision.action
      );

      // If geo-blocking, apply geo-restrictions
      if (decision.action === 'geo_block' && decision.geoRestrictions) {
        await geoLocationService.applyGeoRestriction(
          contentId,
          decision.geoRestrictions,
          true // Include in SoR
        );
      }

      // If age-restricted content, flag it
      if (decision.requiresAgeVerification) {
        await contentAgeGatingEngine.flagAgeRestrictedContent(
          contentId,
          'moderator',
          decision.reasoning
        );
      }
    } catch (error) {
      console.error('Error applying moderation decision:', error);
      throw error;
    }
  }

  /**
   * Get current user location for geo-restrictions
   */
  private async getCurrentLocation(): Promise<{
    country: string;
    region?: string;
  }> {
    try {
      // Use IP-based geolocation by default (privacy-first)
      const location = await geoLocationService.detectUserLocationIP({
        ipAddress: await this.getUserIpAddress(),
      });

      return {
        country: location.countryCode || 'UNKNOWN',
        region: location.regionCode,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      // Default to no restrictions on error
      return { country: 'UNKNOWN' };
    }
  }

  /**
   * Get user IP address for geolocation
   */
  private async getUserIpAddress(): Promise<string> {
    // In React Native, we need to call a backend endpoint to get IP
    // This is a placeholder - implement based on your backend
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Error getting IP address:', error);
      return '';
    }
  }

  /**
   * Get moderation status for content
   */
  private async getModerationStatus(
    _contentId: string,
    _contentType: 'post' | 'comment'
  ): Promise<'active' | 'removed' | 'quarantined' | 'under_review'> {
    // TODO: Query moderation_decisions table
    // For now, return active as default
    return 'active';
  }

  /**
   * Update content moderation status in database
   */
  private async updateContentModerationStatus(
    contentId: string,
    contentType: 'post' | 'comment',
    action: string
  ): Promise<void> {
    // TODO: Update posts/comments table with moderation status
    console.log('Updating moderation status:', {
      contentId,
      contentType,
      action,
    });
  }

  /**
   * Calculate appeal deadline based on content type
   */
  private calculateAppealDeadline(contentType: 'post' | 'comment'): Date {
    const now = new Date();
    // 14 days for content removal, 30 days for account actions
    const daysToAdd = contentType === 'post' ? 14 : 14;
    return new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  }

  /**
   * Check if user can report content
   *
   * Prevents manifestly unfounded reporters from submitting reports
   */
  async canUserReportContent(_userId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // TODO: Check repeat_offender_records for manifestly unfounded reports
    // For now, allow all users to report
    return { allowed: true };
  }

  /**
   * Get content locator (permalink) for reporting
   */
  getContentLocator(
    contentId: string,
    contentType: 'post' | 'comment'
  ): string {
    if (contentType === 'post') {
      return `growbro://feed/${contentId}`;
    }
    return `growbro://comment/${contentId}`;
  }

  /**
   * Check if content is age-restricted
   */
  async isContentAgeRestricted(contentId: string): Promise<boolean> {
    try {
      // Check content_age_restrictions table
      const restrictions =
        await contentAgeGatingEngine.getContentRestrictions(contentId);
      return restrictions !== null;
    } catch (error) {
      console.error('Error checking age restrictions:', error);
      return false;
    }
  }

  /**
   * Check if content is geo-blocked for user
   */
  async isContentGeoBlocked(
    contentId: string,
    userCountry: string
  ): Promise<boolean> {
    try {
      const availability = await geoLocationService.checkContentAvailability(
        contentId,
        { country: userCountry }
      );
      return !availability.available;
    } catch (error) {
      console.error('Error checking geo-blocking:', error);
      return false;
    }
  }
}

// Export singleton instance
export const communityIntegration = new CommunityIntegrationService();
