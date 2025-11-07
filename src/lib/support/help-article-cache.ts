import { Q } from '@nozbe/watermelondb';

import { storage, SUPPORT_STORAGE_KEYS } from '@/lib/storage';
import { database } from '@/lib/watermelon';
import { type HelpArticleCacheModel } from '@/lib/watermelon-models/help-article-cache';
import type { HelpArticle, HelpCategory } from '@/types/support';

const CACHE_SIZE_LIMIT = 100; // Maximum number of articles to cache
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Validate and cast category to HelpCategory with fallback
 */
function validateHelpCategory(category: unknown): HelpCategory {
  const validCategories: HelpCategory[] = [
    'getting-started',
    'calendar-tasks',
    'plants-harvest',
    'community',
    'ai-assessment',
    'account-settings',
    'troubleshooting',
  ];

  if (
    typeof category === 'string' &&
    validCategories.includes(category as HelpCategory)
  ) {
    return category as HelpCategory;
  }

  console.warn(
    `Invalid help category: ${category}, defaulting to 'getting-started'`
  );
  return 'getting-started';
}

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

    return records.map((record: any) => ({
      id: record.articleId,
      title: record.title,
      bodyMarkdown: record.bodyMarkdown,
      category: validateHelpCategory(record.category),
      locale: record.locale,
      tags: record.tags,
      viewCount: record.viewCount,
      helpfulCount: record.helpfulCount,
      notHelpfulCount: record.notHelpfulCount,
      lastUpdated: record.lastUpdated,
      expiresAt: record.expiresAt,
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
  const collection = database.get('help_articles_cache');
  const records = await collection
    .query(Q.where('article_id', articleId), Q.where('locale', locale))
    .fetch();

  if (records.length === 0) {
    return null;
  }

  const record = records[0] as HelpArticleCacheModel;

  // Get tags using the model's getter (handles JSON parsing with fallback)
  const tags = record.tags || [];

  return {
    id: record.articleId,
    title: record.title,
    bodyMarkdown: record.bodyMarkdown,
    category: validateHelpCategory(record.category),
    locale: record.locale,
    tags,
    viewCount: record.viewCount,
    helpfulCount: record.helpfulCount,
    notHelpfulCount: record.notHelpfulCount,
    lastUpdated: record.lastUpdated,
    expiresAt: record.expiresAt,
  };
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

    // Remove expired articles first
    await evictExpiredArticles();

    await database.write(async () => {
      // Upsert articles
      for (const article of articles) {
        const existing = await collection
          .query(Q.where('article_id', article.id), Q.where('locale', locale))
          .fetch();

        if (existing.length > 0) {
          // Update existing
          await existing[0].update((record: any) => {
            record.title = article.title;
            record.bodyMarkdown = article.bodyMarkdown;
            record.category = article.category;
            record.setTags(article.tags);
            record.viewCount = article.viewCount;
            record.helpfulCount = article.helpfulCount;
            record.notHelpfulCount = article.notHelpfulCount;
            record.lastUpdated = article.lastUpdated;
            record.expiresAt = article.expiresAt;
          });
        } else {
          // Create new
          await collection.create((record: any) => {
            record.articleId = article.id;
            record.title = article.title;
            record.bodyMarkdown = article.bodyMarkdown;
            record.category = article.category;
            record.locale = locale;
            record.setTags(article.tags);
            record.viewCount = article.viewCount;
            record.helpfulCount = article.helpfulCount;
            record.notHelpfulCount = article.notHelpfulCount;
            record.lastUpdated = article.lastUpdated;
            record.expiresAt = article.expiresAt;
          });
        }
      }

      // NOTE: enforceCacheSizeLimit() was moved outside the write transaction
      // because it performs its own queries and write operations, which can conflict
      // with the ongoing write transaction. WatermelonDB doesn't allow nested writes
      // or queries within writes that might affect the same tables.
      // await enforceCacheSizeLimit(locale);
    });

    // Enforce cache size limit after the main write transaction completes
    await enforceCacheSizeLimit(locale);

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

    // Also remove articles older than CACHE_EXPIRY_MS
    const oldRecords = await collection
      .query(Q.where('last_updated', Q.lt(now - CACHE_EXPIRY_MS)))
      .fetch();

    await database.write(async () => {
      for (const record of expiredRecords) {
        await record.markAsDeleted();
      }

      for (const record of oldRecords) {
        await record.markAsDeleted();
      }
    });
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
