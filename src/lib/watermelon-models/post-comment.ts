import { Model, type Relation } from '@nozbe/watermelondb';
import { date, immutableRelation, text } from '@nozbe/watermelondb/decorators';

import type { PostModel } from './post';

export class PostCommentModel extends Model {
  static table = 'post_comments';

  static associations = {
    posts: { type: 'belongs_to', key: 'post_id' } as const,
  };

  @text('post_id') postId!: string;
  @text('user_id') userId!: string;
  @text('body') body!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
  @date('hidden_at') hiddenAt?: Date;
  @date('undo_expires_at') undoExpiresAt?: Date;

  @immutableRelation('posts', 'post_id') post!: Relation<PostModel>;

  // Check if comment is visible (not deleted or hidden)
  get isVisible(): boolean {
    return !this.deletedAt && !this.hiddenAt;
  }

  // Check if comment can be undone (within undo window)
  get canUndo(): boolean {
    if (!this.deletedAt || !this.undoExpiresAt) {
      return false;
    }
    return Date.now() < this.undoExpiresAt.getTime();
  }
}
