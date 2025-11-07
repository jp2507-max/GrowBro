import { Q } from '@nozbe/watermelondb';

import { storage, SUPPORT_STORAGE_KEYS } from '@/lib/storage';
import { database } from '@/lib/watermelon';
import type { HelpArticle } from '@/types/support';

// Import functions after mocking
import * as cacheModule from './help-article-cache';

// Mock the database and storage
jest.mock('@/lib/watermelon', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(),
  },
}));

jest.mock('@/lib/storage', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
  SUPPORT_STORAGE_KEYS: {
    HELP_CACHE_VERSION: 'help_cache_version',
    HELP_ARTICLE_TELEMETRY: 'help_article_telemetry',
  },
}));

// Mock the functions that use Q.lt to avoid issues in tests
const mockEvictExpiredArticles = jest.fn().mockResolvedValue(undefined);
const mockEnforceCacheSizeLimit = jest.fn().mockResolvedValue(undefined);

// Replace the functions in the module
Object.defineProperty(cacheModule, 'evictExpiredArticles', {
  value: mockEvictExpiredArticles,
});
Object.defineProperty(cacheModule, 'enforceCacheSizeLimit', {
  value: mockEnforceCacheSizeLimit,
});

const {
  getCachedArticles,
  getCachedArticle,
  cacheArticles,
  clearCache,
  getCacheMetadata,
  recordArticleView,
} = cacheModule;

describe('help-article-cache', () => {
  const mockCollection = {
    query: jest.fn().mockReturnThis(),
    fetch: jest.fn(),
    create: jest.fn(),
    where: jest.fn(),
    sortBy: jest.fn(),
  };

  const mockDatabase = database as jest.Mocked<typeof database>;
  const mockStorage = storage as jest.Mocked<typeof storage>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase.get.mockReturnValue(mockCollection as any);
    mockDatabase.write.mockImplementation((callback) => callback());
  });

  describe('getCachedArticles', () => {
    test('returns empty array when no articles found', async () => {
      mockCollection.fetch.mockResolvedValue([]);

      const result = await getCachedArticles('en');

      expect(result).toEqual([]);
      expect(mockDatabase.get).toHaveBeenCalledWith('help_articles_cache');
    });

    test('returns articles with correct structure', async () => {
      const mockRecord = {
        _raw: {
          article_id: 'test-id',
          title: 'Test Title',
          body_markdown: 'Test content',
          category: 'test-category',
          locale: 'en',
          tags: '["tag1", "tag2"]',
          view_count: 10,
          helpful_count: 5,
          not_helpful_count: 1,
          last_updated: 1234567890,
          expires_at: 1234567890,
        },
      };

      mockCollection.fetch.mockResolvedValue([mockRecord]);

      const result = await getCachedArticles('en');

      expect(result).toEqual([
        {
          id: 'test-id',
          title: 'Test Title',
          bodyMarkdown: 'Test content',
          category: 'test-category',
          locale: 'en',
          tags: ['tag1', 'tag2'],
          viewCount: 10,
          helpfulCount: 5,
          notHelpfulCount: 1,
          lastUpdated: 1234567890,
          expiresAt: 1234567890,
        },
      ]);
    });

    test('handles invalid tags JSON gracefully', async () => {
      const mockRecord = {
        _raw: {
          article_id: 'test-id',
          title: 'Test Title',
          body_markdown: 'Test content',
          category: 'test-category',
          locale: 'en',
          tags: 'invalid-json',
          view_count: 10,
          helpful_count: 5,
          not_helpful_count: 1,
          last_updated: 1234567890,
          expires_at: 1234567890,
        },
      };

      mockCollection.fetch.mockResolvedValue([mockRecord]);

      const result = await getCachedArticles('en');

      expect(result[0].tags).toEqual([]);
    });

    test('filters by category when provided', async () => {
      mockCollection.fetch.mockResolvedValue([]);

      await getCachedArticles('en', 'test-category');

      expect(mockCollection.query).toHaveBeenCalledWith(
        Q.where('locale', 'en'),
        Q.where('category', 'test-category')
      );
    });
  });

  describe('getCachedArticle', () => {
    test('returns null when article not found', async () => {
      mockCollection.fetch.mockResolvedValue([]);

      const result = await getCachedArticle('test-id', 'en');

      expect(result).toBeNull();
    });

    test('returns article when found', async () => {
      const mockRecord = {
        _raw: {
          article_id: 'test-id',
          title: 'Test Title',
          body_markdown: 'Test content',
          category: 'test-category',
          locale: 'en',
          tags: '["tag1"]',
          view_count: 10,
          helpful_count: 5,
          not_helpful_count: 1,
          last_updated: 1234567890,
          expires_at: 1234567890,
        },
      };

      mockCollection.fetch.mockResolvedValue([mockRecord]);

      const result = await getCachedArticle('test-id', 'en');

      expect(result).toEqual({
        id: 'test-id',
        title: 'Test Title',
        bodyMarkdown: 'Test content',
        category: 'test-category',
        locale: 'en',
        tags: ['tag1'],
        viewCount: 10,
        helpfulCount: 5,
        notHelpfulCount: 1,
        lastUpdated: 1234567890,
        expiresAt: 1234567890,
      });
    });
  });

  describe('cacheArticles', () => {
    const testArticle: HelpArticle = {
      id: 'test-id',
      title: 'Test Title',
      bodyMarkdown: 'Test content',
      category: 'test-category',
      locale: 'en',
      tags: ['tag1', 'tag2'],
      viewCount: 10,
      helpfulCount: 5,
      notHelpfulCount: 1,
      lastUpdated: 1234567890,
      expiresAt: 1234567890,
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockEvictExpiredArticles.mockResolvedValue(undefined);
      mockEnforceCacheSizeLimit.mockResolvedValue(undefined);
    });

    test('creates new article when not exists', async () => {
      mockCollection.fetch.mockResolvedValue([]);
      const mockCreate = jest.fn();
      mockCollection.create.mockImplementation(mockCreate);

      await cacheArticles([testArticle], 'en');

      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith(expect.any(Function));
    });

    test('updates existing article', async () => {
      const mockRecord = { update: jest.fn() };
      mockCollection.fetch.mockResolvedValue([mockRecord]);

      await cacheArticles([testArticle], 'en');

      expect(mockRecord.update).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('clearCache', () => {
    test('clears all cache when no locale specified', async () => {
      const mockRecord = { markAsDeleted: jest.fn() };
      mockCollection.fetch.mockResolvedValue([mockRecord]);

      await clearCache();

      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockRecord.markAsDeleted).toHaveBeenCalled();
      expect(mockStorage.delete).toHaveBeenCalledWith(
        SUPPORT_STORAGE_KEYS.HELP_CACHE_VERSION
      );
    });

    test('clears cache for specific locale', async () => {
      const mockRecord = { markAsDeleted: jest.fn() };
      mockCollection.fetch.mockResolvedValue([mockRecord]);

      await clearCache('en');

      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockRecord.markAsDeleted).toHaveBeenCalled();
      expect(mockStorage.delete).not.toHaveBeenCalled();
    });
  });

  describe('getCacheMetadata', () => {
    test('returns null when no metadata stored', () => {
      mockStorage.getString.mockReturnValue(null);

      const result = getCacheMetadata();

      expect(result).toBeNull();
    });

    test('returns parsed metadata', () => {
      const metadata = {
        totalArticles: 10,
        lastSync: 1234567890,
        cacheVersion: 1,
      };
      mockStorage.getString.mockReturnValue(JSON.stringify(metadata));

      const result = getCacheMetadata();

      expect(result).toEqual(metadata);
    });

    test('returns null on invalid JSON', () => {
      mockStorage.getString.mockReturnValue('invalid-json');

      const result = getCacheMetadata();

      expect(result).toBeNull();
    });
  });

  describe('recordArticleView', () => {
    test('increments view count for new article', () => {
      mockStorage.getString.mockReturnValue(null);

      recordArticleView('test-id');

      expect(mockStorage.set).toHaveBeenCalledWith(
        SUPPORT_STORAGE_KEYS.HELP_ARTICLE_TELEMETRY,
        JSON.stringify({ 'test-id': 1 })
      );
    });

    test('increments view count for existing article', () => {
      mockStorage.getString.mockReturnValue(JSON.stringify({ 'test-id': 2 }));

      recordArticleView('test-id');

      expect(mockStorage.set).toHaveBeenCalledWith(
        SUPPORT_STORAGE_KEYS.HELP_ARTICLE_TELEMETRY,
        JSON.stringify({ 'test-id': 3 })
      );
    });
  });
});
