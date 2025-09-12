import type { PaginateQuery } from '../types';

type KeyParams = {
  [key: string]: any;
};
export const DEFAULT_LIMIT = 10;

export function getQueryKey<T extends KeyParams>(key: string, params?: T) {
  return [key, ...(params ? [params] : [])];
}

// for infinite query pages to flatList data
export function normalizePages<T>(pages?: PaginateQuery<T>[]): T[] {
  return pages
    ? pages.reduce((prev: T[], current) => [...prev, ...current.results], [])
    : [];
}

// Enhanced normalizePages that includes cursor information for v5 bi-directional paging
export function normalizePagesWithCursors<T>(pages?: PaginateQuery<T>[]): {
  data: T[];
  nextCursor: string | null;
  prevCursor: string | null;
} {
  if (!pages || pages.length === 0) {
    return { data: [], nextCursor: null, prevCursor: null };
  }

  const data = pages.reduce(
    (prev: T[], current) => [...prev, ...current.results],
    []
  );
  const lastPage = pages[pages.length - 1];
  const firstPage = pages[0];

  return {
    data,
    nextCursor: lastPage.next,
    prevCursor: firstPage.previous,
  };
}

// Cursor-based pagination functions for TanStack Query v5
// These helpers extract cursor tokens from full pagination URLs
export const getNextPageParam = (
  lastPage: PaginateQuery<unknown>
): string | undefined => {
  if (!lastPage.next) return undefined;
  try {
    return new URL(lastPage.next).searchParams.get('cursor') ?? undefined;
  } catch {
    // If URL parsing fails, try to extract cursor from query string directly
    const params = getUrlParameters(lastPage.next);
    return params?.cursor ?? undefined;
  }
};

export const getPreviousPageParam = (
  firstPage: PaginateQuery<unknown>
): string | undefined => {
  if (!firstPage.previous) return undefined;
  try {
    return new URL(firstPage.previous).searchParams.get('cursor') ?? undefined;
  } catch {
    // If URL parsing fails, try to extract cursor from query string directly
    const params = getUrlParameters(firstPage.previous);
    return params?.cursor ?? undefined;
  }
};

// Legacy offset-based pagination (deprecated - use cursor-based above)
export const getPreviousPageParamLegacy = (page: PaginateQuery<unknown>) =>
  getUrlParameters(page.previous)?.offset ?? undefined;

export const getNextPageParamLegacy = (page: PaginateQuery<unknown>) =>
  getUrlParameters(page.next)?.offset ?? undefined;

// a function that accept a url and return params as an object
function getUrlParameters(url: string | null): Record<string, string> | null {
  if (!url) return null;
  // Prefer robust URL parsing to avoid including fragments and to handle absolute URLs.
  // If the input is a relative URL or a query string, provide a base origin for the URL constructor.
  const params: Record<string, string> = {};
  try {
    // Use window.location.origin when available so relative paths resolve correctly.
    let base = 'http://localhost';
    if (
      typeof window !== 'undefined' &&
      window.location &&
      window.location.origin
    ) {
      base = window.location.origin;
    }
    const parsed = new URL(url, base);

    // If the parsed URL contains search params, use them. This excludes any fragment/hash.
    if (parsed.search && parsed.search.length > 1) {
      parsed.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      return params;
    }

    // If there were no search params, the input might be a raw query string like "a=1&b=2"
    // or start with a leading "?". Fall back to treating the input as a query string in that case.
    const maybeQuery = url.startsWith('?') ? url.slice(1) : url;
    // Remove any fragment part if present
    const maybeQueryNoHash = maybeQuery.split('#')[0];
    if (maybeQueryNoHash.includes('=')) {
      const usp = new URLSearchParams(maybeQueryNoHash);
      usp.forEach((value, key) => {
        params[key] = value;
      });
      return params;
    }

    return params;
  } catch {
    // Parsing failed (invalid URL) - treat the whole string as a query string (strip fragment)
    const fallback = url.split('#')[0];
    const query = fallback.startsWith('?') ? fallback.slice(1) : fallback;
    const usp = new URLSearchParams(query);
    usp.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }
}
