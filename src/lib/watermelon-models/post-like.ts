import { Model, type Relation } from '@nozbe/watermelondb';
import { date, immutableRelation, text } from '@nozbe/watermelondb/decorators';

import type { PostModel } from './post';

export class PostLikeModel extends Model {
  static table = 'post_likes';

  static associations = {
    posts: { type: 'belongs_to', key: 'post_id' } as const,
  };

  @text('post_id') postId!: string;
  @text('user_id') userId!: string;
  @date('created_at') createdAt!: Date;

  @immutableRelation('posts', 'post_id') post!: Relation<PostModel>;
}
