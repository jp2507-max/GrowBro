import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import { NotificationPreferenceModel } from '@/lib/watermelon-models/notification-preference';

/**
 * Community notification service for handling push notifications
 * related to community feed interactions (likes, comments).
 *
 * Note: The actual notification sending is handled by database triggers
 * that call the send-push-notification Edge Function. This service provides
 * client-side utilities for managing preferences and tracking.
 */

export interface CommunityNotificationConfig {
  /**
   * Whether community interaction notifications are enabled
   * (replies to posts)
   */
  communityInteractionsEnabled: boolean;

  /**
   * Whether community like notifications are enabled
   * (likes on posts)
   */
  communityLikesEnabled: boolean;
}

export class CommunityNotificationService {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Get the current notification preferences for community interactions
   * @param userId - The user ID to fetch preferences for
   * @returns Community notification configuration
   */
  async getCommunityNotificationConfig(
    userId: string
  ): Promise<CommunityNotificationConfig> {
    const NotificationPreference = this.database.collections.get(
      'notification_preferences'
    );

    const preferences = (await NotificationPreference.query(
      Q.where('user_id', userId)
    ).fetch()) as NotificationPreferenceModel[];

    if (preferences.length === 0) {
      // Return defaults if no preferences exist
      return {
        communityInteractionsEnabled: true,
        communityLikesEnabled: true,
      };
    }

    const pref = preferences[0];
    return {
      communityInteractionsEnabled: pref.communityInteractions,
      communityLikesEnabled: pref.communityLikes,
    };
  }

  /**
   * Update community notification preferences
   * @param userId - The user ID to update preferences for
   * @param config - The new configuration
   */
  async updateCommunityNotificationConfig(
    userId: string,
    config: Partial<CommunityNotificationConfig>
  ): Promise<void> {
    const preference = await NotificationPreferenceModel.findOrCreate(
      this.database,
      userId
    );

    await this.database.write(async () => {
      await preference.update((record: any) => {
        if (config.communityInteractionsEnabled !== undefined) {
          record.communityInteractions = config.communityInteractionsEnabled;
        }
        if (config.communityLikesEnabled !== undefined) {
          record.communityLikes = config.communityLikesEnabled;
        }
        record.updatedAt = new Date();
      });
    });
  }

  /**
   * Check if like notifications are enabled for a user
   * @param userId - The user ID to check
   * @returns true if like notifications are enabled
   */
  async areLikeNotificationsEnabled(userId: string): Promise<boolean> {
    const config = await this.getCommunityNotificationConfig(userId);
    return config.communityLikesEnabled;
  }

  /**
   * Check if comment/reply notifications are enabled for a user
   * @param userId - The user ID to check
   * @returns true if comment notifications are enabled
   */
  async areCommentNotificationsEnabled(userId: string): Promise<boolean> {
    const config = await this.getCommunityNotificationConfig(userId);
    return config.communityInteractionsEnabled;
  }
}

/**
 * Rate limiting information for like notifications
 * Server enforces: max 1 notification per post per 5 minutes
 * Uses collapseKey pattern: 'like_${postId}'
 */
export const LIKE_NOTIFICATION_RATE_LIMIT = {
  maxPerPost: 1,
  windowMinutes: 5,
  collapseKeyPrefix: 'like_',
} as const;

/**
 * Helper to generate deep link URL for a post
 * @param postId - The post ID
 * @param commentId - Optional comment ID to scroll to
 * @returns Deep link URL
 */
export function generatePostDeepLink(
  postId: string,
  commentId?: string
): string {
  if (commentId) {
    return `growbro://post/${postId}/comment/${commentId}`;
  }
  return `growbro://post/${postId}`;
}

/**
 * Helper to parse post deep link
 * @param url - The deep link URL
 * @returns Parsed post and comment IDs, or null if invalid
 */
export function parsePostDeepLink(url: string): {
  postId: string;
  commentId?: string;
} | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'growbro:') {
      return null;
    }

    // Handle format: growbro://post/:postId or growbro://post/:postId/comment/:commentId
    // The URL host is "post" and pathname contains the ID
    const host = parsed.hostname || parsed.host;
    const pathParts = parsed.pathname.replace(/^\/+/, '').split('/');

    // Check if this is a post URL: host should be 'post' or first path part should be 'post'
    if (host === 'post') {
      // Format: growbro://post/:postId or growbro://post/:postId/comment/:commentId
      // postId is in the pathname
      const postId = pathParts[0];
      if (!postId) {
        return null;
      }

      const commentId =
        pathParts[1] === 'comment' && pathParts[2] ? pathParts[2] : undefined;

      return { postId, commentId };
    }

    // Alternative format where 'post' might be in path
    if (pathParts[0] === 'post' && pathParts[1]) {
      const postId = pathParts[1];
      const commentId =
        pathParts[2] === 'comment' && pathParts[3] ? pathParts[3] : undefined;

      return { postId, commentId };
    }

    return null;
  } catch {
    return null;
  }
}
