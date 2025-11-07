import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export class HelpArticleCacheModel extends Model {
  static table = 'help_articles_cache';

  @text('article_id') articleId!: string;
  @text('title') title!: string;
  @text('body_markdown') bodyMarkdown!: string;
  @text('category') category!: string;
  @text('locale') locale!: string;
  @text('tags') tagsJson!: string;
  @field('view_count') viewCount!: number;
  @field('helpful_count') helpfulCount!: number;
  @field('not_helpful_count') notHelpfulCount!: number;
  @field('last_updated') lastUpdated!: number;
  @field('expires_at') expiresAt?: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;

  get tags(): string[] {
    try {
      const parsed = JSON.parse(this.tagsJson) as string[] | undefined;
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('[HelpArticleCacheModel] Failed to parse tags', error);
      return [];
    }
  }

  setTags(tags: string[]): void {
    this.tagsJson = JSON.stringify(tags);
  }
}
