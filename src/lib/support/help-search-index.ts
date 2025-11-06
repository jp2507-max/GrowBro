import MiniSearch from 'minisearch';

import { storage, SUPPORT_STORAGE_KEYS } from '@/lib/storage';
import type { HelpArticle } from '@/types/support';

interface SearchableArticle {
  id: string;
  title: string;
  bodyMarkdown: string;
  category: string;
  tags: string[];
}

const SEARCH_INDEX_VERSION = 1;

interface SerializedIndex {
  version: number;
  index: string;
  locale: string;
  timestamp: number;
}

/**
 * Create a new MiniSearch index for help articles
 */
export function createHelpSearchIndex(): MiniSearch<SearchableArticle> {
  return new MiniSearch<SearchableArticle>({
    fields: ['title', 'bodyMarkdown', 'category', 'tags'],
    storeFields: ['title', 'category'],
    searchOptions: {
      boost: {
        title: 3,
        tags: 2,
        category: 1.5,
        bodyMarkdown: 1,
      },
      fuzzy: 0.2,
      prefix: true,
    },
  });
}

/**
 * Load search index from MMKV storage
 */
export function loadSearchIndex(
  locale: string
): MiniSearch<SearchableArticle> | null {
  const cached = storage.getString(SUPPORT_STORAGE_KEYS.HELP_SEARCH_INDEX);

  if (!cached) {
    return null;
  }

  try {
    const serialized: SerializedIndex = JSON.parse(cached);

    // Check version and locale match
    if (
      serialized.version !== SEARCH_INDEX_VERSION ||
      serialized.locale !== locale
    ) {
      return null;
    }

    // Check if index is stale (older than 24 hours)
    const age = Date.now() - serialized.timestamp;
    if (age > 24 * 60 * 60 * 1000) {
      return null;
    }

    const index = MiniSearch.loadJS<SearchableArticle>(
      JSON.parse(serialized.index),
      {
        fields: ['title', 'bodyMarkdown', 'category', 'tags'],
        storeFields: ['title', 'category'],
      }
    );

    return index;
  } catch (error) {
    console.error('Failed to load search index:', error);
    return null;
  }
}

/**
 * Save search index to MMKV storage
 */
export function saveSearchIndex(
  index: MiniSearch<SearchableArticle>,
  locale: string
): void {
  try {
    const serialized: SerializedIndex = {
      version: SEARCH_INDEX_VERSION,
      index: JSON.stringify(index.toJSON()),
      locale,
      timestamp: Date.now(),
    };

    storage.set(
      SUPPORT_STORAGE_KEYS.HELP_SEARCH_INDEX,
      JSON.stringify(serialized)
    );
  } catch (error) {
    console.error('Failed to save search index:', error);
  }
}

/**
 * Build search index from articles
 */
export function buildSearchIndex(
  articles: HelpArticle[],
  locale: string
): MiniSearch<SearchableArticle> {
  const index = createHelpSearchIndex();

  const searchableArticles: SearchableArticle[] = articles.map((article) => ({
    id: article.id,
    title: article.title,
    bodyMarkdown: article.bodyMarkdown,
    category: article.category,
    tags: article.tags,
  }));

  index.addAll(searchableArticles);
  saveSearchIndex(index, locale);

  return index;
}

/**
 * Search help articles with debouncing support
 */
export function searchHelpArticles(
  index: MiniSearch<SearchableArticle>,
  query: string
): string[] {
  if (!query.trim()) {
    return [];
  }

  try {
    const results = index.search(query, {
      boost: {
        title: 3,
        tags: 2,
        category: 1.5,
        bodyMarkdown: 1,
      },
      fuzzy: 0.2,
      prefix: true,
    });

    return results.map((result) => result.id);
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

/**
 * Update search index with new/updated articles
 */
export function updateSearchIndex(
  index: MiniSearch<SearchableArticle>,
  articles: HelpArticle[],
  locale: string
): void {
  const searchableArticles: SearchableArticle[] = articles.map((article) => ({
    id: article.id,
    title: article.title,
    bodyMarkdown: article.bodyMarkdown,
    category: article.category,
    tags: article.tags,
  }));

  // Remove old entries and add new ones
  searchableArticles.forEach((article) => {
    try {
      index.remove(article);
    } catch {
      // Article doesn't exist, that's fine
    }
    index.add(article);
  });

  saveSearchIndex(index, locale);
}

/**
 * Clear search index from storage
 */
export function clearSearchIndex(): void {
  storage.delete(SUPPORT_STORAGE_KEYS.HELP_SEARCH_INDEX);
}

/**
 * Record search history for telemetry
 */
export function recordSearch(query: string): void {
  if (!query.trim()) return;

  try {
    const history = storage.getString(SUPPORT_STORAGE_KEYS.HELP_SEARCH_HISTORY);
    const searches: { query: string; timestamp: number }[] = history
      ? JSON.parse(history)
      : [];

    searches.push({
      query: query.trim().toLowerCase(),
      timestamp: Date.now(),
    });

    // Keep last 100 searches
    const recent = searches.slice(-100);
    storage.set(
      SUPPORT_STORAGE_KEYS.HELP_SEARCH_HISTORY,
      JSON.stringify(recent)
    );
  } catch (error) {
    console.error('Failed to record search:', error);
  }
}
