import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getItem, setItem, SUPPORT_STORAGE_KEYS } from '@/lib/storage';
import {
  cacheArticles,
  getCachedArticle,
  getCachedArticles,
  recordArticleView,
} from '@/lib/support/help-article-cache';
import {
  buildSearchIndex,
  loadSearchIndex,
  recordSearch,
  searchHelpArticles,
  updateSearchIndex,
} from '@/lib/support/help-search-index';
import type {
  HelpArticle,
  HelpArticleRating,
  HelpCategory,
} from '@/types/support';

const HELP_ARTICLES_QUERY_KEY = 'helpArticles';
const HELP_ARTICLE_QUERY_KEY = 'helpArticle';

/**
 * Hook to fetch and cache help articles
 */
export function useHelpArticles(category?: HelpCategory) {
  const { i18n } = useTranslation();
  const locale = i18n.language;

  return useQuery({
    queryKey: [HELP_ARTICLES_QUERY_KEY, locale, category],
    queryFn: async () => {
      // Try cache first
      const cached = await getCachedArticles(locale, category);
      if (cached.length > 0) {
        return cached;
      }

      // TODO: Fetch from Supabase when online
      // For now, return cached only
      return cached;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch a single help article
 */
export function useHelpArticle(articleId: string) {
  const { i18n } = useTranslation();
  const locale = i18n.language;

  return useQuery({
    queryKey: [HELP_ARTICLE_QUERY_KEY, articleId, locale],
    queryFn: async () => {
      // Try cache first
      const cached = await getCachedArticle(articleId, locale);
      if (cached) {
        // Record view telemetry
        recordArticleView(articleId);
        return cached;
      }

      // TODO: Fetch from Supabase when online
      return null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!articleId,
  });
}

/**
 * Hook for help article search with debouncing
 */
export function useHelpSearch() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const [searchQuery, setSearchQuery] = useState('');

  // Get all articles for building index
  const { data: articles = [] } = useHelpArticles();

  // Build or load search index
  const searchIndex = useMemo(() => {
    if (articles.length === 0) {
      return null;
    }

    // Try to load cached index
    const cached = loadSearchIndex(locale);
    if (cached) {
      // Ensure cached index is kept in sync with the freshest cached articles.
      // If articles have changed since the serialized index was written, update
      // the in-memory index and persist the updated index back to storage.
      try {
        updateSearchIndex(cached, articles, locale);
      } catch (error) {
        // If updating fails for any reason, fall back to the cached index
        // (we still prefer returning an index over none).
        console.error(
          'Failed to update cached search index with new articles:',
          error
        );
      }

      return cached;
    }

    // Build new index
    return buildSearchIndex(articles, locale);
  }, [articles, locale]);

  // Search function
  const search = useCallback(
    (query: string) => {
      if (!searchIndex || !query.trim()) {
        return [];
      }

      const resultIds = searchHelpArticles(searchIndex, query);
      recordSearch(query);

      // Return full articles
      return resultIds
        .map((id) => articles.find((a) => a.id === id))
        .filter((a): a is HelpArticle => a !== undefined);
    },
    [searchIndex, articles]
  );

  // Debounced search results
  const results = useMemo(() => {
    return search(searchQuery);
  }, [search, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    results,
    isIndexReady: !!searchIndex,
  };
}

/**
 * Hook to submit article rating
 */
export function useSubmitArticleRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rating: HelpArticleRating) => {
      // TODO: Submit to backend when online
      // For now, persist rating locally (MMKV) keyed by articleId. Replace
      // with backend sync later.
      try {
        const key = SUPPORT_STORAGE_KEYS.HELP_ARTICLE_RATINGS;

        // Read existing ratings map from storage
        const existing =
          getItem<Record<string, HelpArticleRating[]>>(key) || {};

        const list = existing[rating.articleId] || [];
        list.push(rating);
        existing[rating.articleId] = list;

        // Persist to MMKV (synchronous under the hood). We `await` a resolved
        // promise so callers treating this as async will receive a settled
        // promise and we can catch/throw consistently.
        setItem(key, existing);
        await Promise.resolve();

        return rating;
      } catch (err: unknown) {
        // Bubble up storage errors so the mutation reports failure
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to save article rating locally: ${message}`);
      }
    },
    onSuccess: (rating) => {
      // Patch the in-memory react-query cache for immediate UI update.
      try {
        patchHelpArticleCache(queryClient, rating);
      } catch (e) {
        console.warn('Failed to patch help article cache:', e);
      }

      // Ensure server/list/detail queries are re-fetched when online
      queryClient.invalidateQueries({
        queryKey: [HELP_ARTICLE_QUERY_KEY, rating.articleId],
      });
      queryClient.invalidateQueries({ queryKey: [HELP_ARTICLES_QUERY_KEY] });
    },
  });
}

// Extracted helper to keep the mutation hook small and satisfy lint rules.
function patchHelpArticleCache(
  queryClient: QueryClient,
  rating: HelpArticleRating
) {
  // Update detail queries (may include locale in key)
  const qc = queryClient.getQueryCache?.()
    ? queryClient.getQueryCache().getAll()
    : [];

  // Iterate through queries and patch matching help article/list cache
  for (const q of qc) {
    const qKey = q.queryKey as unknown as unknown[];
    if (!Array.isArray(qKey) || qKey.length === 0) continue;

    // Help article detail queries: ['helpArticle', articleId, locale]
    if (qKey[0] === HELP_ARTICLE_QUERY_KEY && qKey[1] === rating.articleId) {
      const current = queryClient.getQueryData<HelpArticle>(qKey);
      if (current) {
        queryClient.setQueryData<HelpArticle>(qKey, {
          ...current,
          helpfulCount: current.helpfulCount + (rating.helpful ? 1 : 0),
          notHelpfulCount: current.notHelpfulCount + (rating.helpful ? 0 : 1),
        });
      }
    }

    // Help articles list queries: ['helpArticles', locale?, category?]
    if (qKey[0] === HELP_ARTICLES_QUERY_KEY) {
      const list = queryClient.getQueryData<HelpArticle[]>(qKey);
      if (list) {
        queryClient.setQueryData<HelpArticle[]>(
          qKey,
          (list: HelpArticle[] | undefined) =>
            list?.map((a: HelpArticle) =>
              a.id === rating.articleId
                ? {
                    ...a,
                    helpfulCount: a.helpfulCount + (rating.helpful ? 1 : 0),
                    notHelpfulCount:
                      a.notHelpfulCount + (rating.helpful ? 0 : 1),
                  }
                : a
            )
        );
      }
    }
  }
}

/**
 * Hook to sync help articles from server
 */
export function useSyncHelpArticles() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // TODO: Fetch from Supabase with ETag support
      // For now, return empty array
      const articles: HelpArticle[] = [];

      if (articles.length > 0) {
        await cacheArticles(articles, locale);
      }

      return articles;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [HELP_ARTICLES_QUERY_KEY],
      });
    },
  });
}
