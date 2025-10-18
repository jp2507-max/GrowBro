import { Model, Q, type Query } from '@nozbe/watermelondb';
import { children, date, lazy, text } from '@nozbe/watermelondb/decorators';

import type { PostCommentModel } from './post-comment';
import type { PostLikeModel } from './post-like';

export class PostModel extends Model {
  static table = 'posts';

  static associations = {
    post_comments: { type: 'has_many', foreignKey: 'post_id' } as const,
    post_likes: { type: 'has_many', foreignKey: 'post_id' } as const,
  };

  @text('user_id') userId!: string;
  @text('body') body!: string;
  @text('media_uri') mediaUri?: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
  @date('hidden_at') hiddenAt?: Date;
  @text('moderation_reason') moderationReason?: string;
  @date('undo_expires_at') undoExpiresAt?: Date;

  @children('post_comments') comments!: Query<PostCommentModel>;
  @children('post_likes') likes!: Query<PostLikeModel>;

  // Computed properties for UI - not persisted in DB
  @lazy
  likeCount = this.likes
    .extend(Q.where('deleted_at', null))
    .observeCount(false);

  @lazy
  commentCount = this.comments
    .extend(Q.where('deleted_at', null), Q.where('hidden_at', null))
    .observeCount(false);

  // Check if current user has liked this post
  async hasUserLiked(userId: string): Promise<boolean> {
    const count = await this.likes
      .extend(Q.where('user_id', userId))
      .fetchCount();
    return count > 0;
  }

  // Get visible comments (not deleted or hidden)
  get visibleComments(): Query<PostCommentModel> {
    return this.comments.extend(
      Q.where('deleted_at', null),
      Q.where('hidden_at', null),
      Q.sortBy('created_at', Q.asc)
    );
  }

  // Check if post is visible (not deleted or hidden)
  get isVisible(): boolean {
    return !this.deletedAt && !this.hiddenAt;
  }

  // Check if post can be undone (within undo window)
  get canUndo(): boolean {
    if (!this.deletedAt || !this.undoExpiresAt) {
      return false;
    }
    return Date.now() < this.undoExpiresAt.getTime();
  }
}
