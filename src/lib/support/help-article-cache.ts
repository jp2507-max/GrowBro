import { Q } from '@nozbe/watermelondb';

import { storage, SUPPORT_STORAGE_KEYS } from '@/lib/storage';
import { database } from '@/lib/watermelon';
import type { HelpArticle } from '@/types/support';

const CACHE_SIZE_LIMIT = 100; // Maximum number of articles to cache
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheMetadata {
  totalArticles: number;
  lastSync: number;
  cacheVersion: number;
}

/**
 * Get help articles from cache
 */
export async function getCachedArticles(
  locale: string,
  category?: string
): Promise<HelpArticle[]> {
  try {
    const collection = database.get('help_articles_cache');
    let query = collection.query(Q.where('locale', locale));

    if (category) {
      query = collection.query(
        Q.where('locale', locale),
        Q.where('category', category)
      );
    }

    const records = await query.fetch();

    return records.map((record) => ({
      id: record._raw.article_id as string,
      title: record._raw.title as string,
      bodyMarkdown: record._raw.body_markdown as string,
      category: record._raw.category as string,
      locale: record._raw.locale as string,
      tags: JSON.parse(record._raw.tags as string) as string[],
      viewCount: record._raw.view_count as number,
      helpfulCount: record._raw.helpful_count as number,
      notHelpfulCount: record._raw.not_helpful_count as number,
      lastUpdated: record._raw.last_updated as number,
      expiresAt: record._raw.expires_at as number | undefined,
    }));
  } catch (error) {
    console.error('Failed to get cached articles:', error);
    return [];
  }
}

/**
 * Get a single article from cache
 */
export async function getCachedArticle(
  articleId: string,
  locale: string
): Promise<HelpArticle | null> {
  try {
    const collection = database.get('help_articles_cache');
    const records = await collection
      .query(Q.where('article_id', articleId), Q.where('locale', locale))
      .fetch();

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    return {
      id: record._raw.article_id as string,
      title: record._raw.title as string,
      bodyMarkdown: record._raw.body_markdown as string,
      category: record._raw.category as string,
      locale: record._raw.locale as string,
      tags: JSON.parse(record._raw.tags as string) as string[],
      viewCount: record._raw.view_count as number,
      helpfulCount: record._raw.helpful_count as number,
      notHelpfulCount: record._raw.not_helpful_count as number,
      lastUpdated: record._raw.last_updated as number,
      expiresAt: record._raw.expires_at as number | undefined,
    };
  } catch (error) {
    console.error('Failed to get cached article:', error);
    return null;
  }
}

/**
 * Cache articles from API response
 */
export async function cacheArticles(
  articles: HelpArticle[],
  locale: string
): Promise<void> {
  try {
    const collection = database.get('help_articles_cache');

    await database.write(async () => {
      // Remove expired articles
      await evictExpiredArticles();

      // Enforce cache size limit
      await enforceCacheSizeLimit(locale);

      // Upsert articles
      for (const article of articles) {
        const existing = await collection
          .query(Q.where('article_id', article.id), Q.where('locale', locale))
          .fetch();

        if (existing.length > 0) {
          // Update existing
          await existing[0].update((record) => {
            record._raw.title = article.title;
            record._raw.body_markdown = article.bodyMarkdown;
            record._raw.category = article.category;
            record._raw.tags = JSON.stringify(article.tags);
            record._raw.view_count = article.viewCount;
            record._raw.helpful_count = article.helpfulCount;
            record._raw.not_helpful_count = article.notHelpfulCount;
            record._raw.last_updated = article.lastUpdated;
            record._raw.expires_at = article.expiresAt;
          });
        } else {
          // Create new
          await collection.create((record) => {
            record._raw.article_id = article.id;
            record._raw.title = article.title;
            record._raw.body_markdown = article.bodyMarkdown;
            record._raw.category = article.category;
            record._raw.locale = locale;
            record._raw.tags = JSON.stringify(article.tags);
            record._raw.view_count = article.viewCount;
            record._raw.helpful_count = article.helpfulCount;
            record._raw.not_helpful_count = article.notHelpfulCount;
            record._raw.last_updated = article.lastUpdated;
            record._raw.expires_at = article.expiresAt;
          });
        }
      }
    });

    // Update cache metadata
    updateCacheMetadata(articles.length);
  } catch (error) {
    console.error('Failed to cache articles:', error);
  }
}

/**
 * Evict expired articles from cache
 */
async function evictExpiredArticles(): Promise<void> {
  try {
    const collection = database.get('help_articles_cache');
    const now = Date.now();

    const expiredRecords = await collection
      .query(
        Q.where('expires_at', Q.notEq(null)),
        Q.where('expires_at', Q.lt(now))
      )
      .fetch();

    for (const record of expiredRecords) {
      await record.markAsDeleted();
    }

    // Also remove articles older than CACHE_EXPIRY_MS
    const oldRecords = await collection
      .query(Q.where('last_updated', Q.lt(now - CACHE_EXPIRY_MS)))
      .fetch();

    for (const record of oldRecords) {
      await record.markAsDeleted();
    }
  } catch (error) {
    console.error('Failed to evict expired articles:', error);
  }
}

/**
 * Enforce cache size limit using LRU eviction
 */
async function enforceCacheSizeLimit(locale: string): Promise<void> {
  try {
    const collection = database.get('help_articles_cache');
    const records = await collection
      .query(Q.where('locale', locale), Q.sortBy('last_updated', Q.asc))
      .fetch();

    if (records.length > CACHE_SIZE_LIMIT) {
      const toDelete = records.slice(0, records.length - CACHE_SIZE_LIMIT);
      await database.write(async () => {
        for (const record of toDelete) {
          await record.markAsDeleted();
        }
      });
    }
  } catch (error) {
    console.error('Failed to enforce cache size limit:', error);
  }
}

/**
 * Update cache metadata
 */
function updateCacheMetadata(totalArticles: number): void {
  const metadata: CacheMetadata = {
    totalArticles,
    lastSync: Date.now(),
    cacheVersion: 1,
  };

  storage.set(
    SUPPORT_STORAGE_KEYS.HELP_CACHE_VERSION,
    JSON.stringify(metadata)
  );
}

/**
 * Get cache metadata
 */
export function getCacheMetadata(): CacheMetadata | null {
  const cached = storage.getString(SUPPORT_STORAGE_KEYS.HELP_CACHE_VERSION);
  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached) as CacheMetadata;
  } catch {
    return null;
  }
}

/**
 * Clear all cached articles
 */
export async function clearCache(locale?: string): Promise<void> {
  try {
    const collection = database.get('help_articles_cache');
    let records;

    if (locale) {
      records = await collection.query(Q.where('locale', locale)).fetch();
    } else {
      records = await collection.query().fetch();
    }

    await database.write(async () => {
      for (const record of records) {
        await record.markAsDeleted();
      }
    });

    if (!locale) {
      storage.delete(SUPPORT_STORAGE_KEYS.HELP_CACHE_VERSION);
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

/**
 * Record article view telemetry (anonymized)
 */
export function recordArticleView(articleId: string): void {
  try {
    const telemetry = storage.getString(
      SUPPORT_STORAGE_KEYS.HELP_ARTICLE_TELEMETRY
    );
    const views: Record<string, number> = telemetry
      ? JSON.parse(telemetry)
      : {};

    views[articleId] = (views[articleId] || 0) + 1;

    storage.set(
      SUPPORT_STORAGE_KEYS.HELP_ARTICLE_TELEMETRY,
      JSON.stringify(views)
    );
  } catch (error) {
    console.error('Failed to record article view:', error);
  }
}
