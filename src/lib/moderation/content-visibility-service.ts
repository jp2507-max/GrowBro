/**
 * Content Visibility Service
 *
 * Wires moderation decisions to content visibility controls in feeds
 * Applies moderation actions to posts and comments in real-time
 *
 * Requirements:
 * - 1.1: Connect reporting to posts/comments
 * - 3.6: Create immutable audit trail entries
 * - 9.4: Connect geo-restrictions to location features
 */

import type { Post as ApiPost } from '@/api/posts';
import { supabase } from '@/lib/supabase';
import type { PostComment } from '@/types/community';

import { communityIntegration } from './community-integration';

export interface ContentVisibilityResult {
  visible: boolean;
  reason?: string;
  moderationStatus?: 'active' | 'removed' | 'quarantined' | 'under_review';
  canAppeal?: boolean;
  appealDeadline?: Date;
}

/**
 * Content Visibility Service
 *
 * Manages content visibility based on moderation decisions
 */
export class ContentVisibilityService {
  /**
   * Apply moderation decision to content and update visibility
   *
   * This is called after a moderation decision is executed
   */
  async applyModerationDecision(params: {
    decisionId: string;
    contentId: string;
    contentType: 'post' | 'comment';
    action: string;
  }): Promise<void> {
    const { decisionId, contentId, contentType, action } = params;
    try {
      // Get the full decision with SoR
      const { data: decision, error: decisionError } = await supabase
        .from('moderation_decisions')
        .select(
          `
          *,
          statement_of_reasons:statements_of_reasons(*)
        `
        )
        .eq('id', decisionId)
        .single();

      if (decisionError || !decision) {
        throw new Error(
          `Failed to fetch decision: ${decisionError?.message || 'Not found'}`
        );
      }

      // Apply the decision through community integration
      await communityIntegration.applyModerationDecision(
        {
          action,
          geoRestrictions: decision.statement_of_reasons?.territorial_scope,
          requiresAgeVerification: false, // Set based on content analysis
          reasoning: decision.reasoning,
        },
        contentId,
        contentType
      );

      // Mark decision as executed
      await supabase
        .from('moderation_decisions')
        .update({
          status: 'executed',
          executed_at: new Date().toISOString(),
        })
        .eq('id', decisionId);
    } catch (error) {
      console.error('Error applying moderation decision:', error);
      throw error;
    }
  }

  /**
   * Check if content is visible to current user
   *
   * Combines moderation status, age-gating, and geo-restrictions
   */
  async checkContentVisibility(
    contentId: string,
    contentType: 'post' | 'comment',
    _userId?: string
  ): Promise<ContentVisibilityResult> {
    try {
      const visibility = await communityIntegration.checkContentVisibility(
        contentId,
        contentType
      );

      return {
        visible: visibility.visible,
        reason: visibility.message,
        moderationStatus: await this.getModerationStatus(
          contentId,
          contentType
        ),
        canAppeal: visibility.canAppeal,
        appealDeadline: visibility.appealDeadline,
      };
    } catch (error) {
      console.error('Error checking content visibility:', error);
      // Default to visible on error to avoid blocking legitimate content
      return { visible: true };
    }
  }

  /**
   * Filter posts based on visibility rules
   */
  async filterVisiblePosts(
    posts: ApiPost[],
    userId?: string
  ): Promise<ApiPost[]> {
    const visibilityChecks = await Promise.all(
      posts.map(async (post) => {
        const visibility = await this.checkContentVisibility(
          String(post.id),
          'post',
          userId
        );
        return { post, visible: visibility.visible };
      })
    );

    return visibilityChecks
      .filter((check) => check.visible)
      .map((check) => check.post);
  }

  /**
   * Filter comments based on visibility rules
   */
  async filterVisibleComments(
    comments: PostComment[],
    userId?: string
  ): Promise<PostComment[]> {
    const visibilityChecks = await Promise.all(
      comments.map(async (comment) => {
        const visibility = await this.checkContentVisibility(
          String(comment.id),
          'comment',
          userId
        );
        return { comment, visible: visibility.visible };
      })
    );

    return visibilityChecks
      .filter((check) => check.visible)
      .map((check) => check.comment);
  }

  /**
   * Get moderation status for content
   */
  private async getModerationStatus(
    contentId: string,
    contentType: 'post' | 'comment'
  ): Promise<'active' | 'removed' | 'quarantined' | 'under_review'> {
    try {
      const tableName = contentType === 'post' ? 'posts' : 'post_comments';

      const { data, error } = await supabase
        .from(tableName)
        .select('deleted_at, hidden_at, moderation_reason')
        .eq('id', contentId)
        .single();

      if (error || !data) {
        return 'active';
      }

      if (data.deleted_at) {
        return 'removed';
      }

      if (data.hidden_at) {
        return 'quarantined';
      }

      if (data.moderation_reason) {
        return 'under_review';
      }

      return 'active';
    } catch (error) {
      console.error('Error getting moderation status:', error);
      return 'active';
    }
  }

  /**
   * Restore content visibility after appeal is upheld
   */
  async restoreContentVisibility(
    contentId: string,
    contentType: 'post' | 'comment'
  ): Promise<void> {
    try {
      const tableName = contentType === 'post' ? 'posts' : 'post_comments';

      await supabase
        .from(tableName)
        .update({
          deleted_at: null,
          hidden_at: null,
          moderation_reason: null,
        })
        .eq('id', contentId);
    } catch (error) {
      console.error('Error restoring content visibility:', error);
      throw error;
    }
  }

  /**
   * Subscribe to moderation decision changes for real-time updates
   */
  subscribeToModerationChanges(
    contentId: string,
    contentType: 'post' | 'comment',
    callback: (visibility: ContentVisibilityResult) => void
  ) {
    const tableName = contentType === 'post' ? 'posts' : 'post_comments';

    const subscription = supabase
      .channel(`moderation_${contentType}_${contentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: tableName,
          filter: `id=eq.${contentId}`,
        },
        async () => {
          // Refresh visibility status
          const visibility = await this.checkContentVisibility(
            contentId,
            contentType
          );
          callback(visibility);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }
}

// Export singleton instance
export const contentVisibilityService = new ContentVisibilityService();
