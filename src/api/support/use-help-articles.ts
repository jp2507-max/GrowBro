import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
      // For now, just store locally
      return rating;
    },
    onSuccess: (rating) => {
      // Invalidate article query to refresh counts
      queryClient.invalidateQueries({
        queryKey: [HELP_ARTICLE_QUERY_KEY, rating.articleId],
      });
    },
  });
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
