import {
  type GetNextPageParamFunction,
  type GetPreviousPageParamFunction,
  keepPreviousData,
} from '@tanstack/react-query';

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
export const getNextPageParam: GetNextPageParamFunction<
  unknown,
  PaginateQuery<unknown>
> = (lastPage) => lastPage.next;

export const getPreviousPageParam: GetPreviousPageParamFunction<
  unknown,
  PaginateQuery<unknown>
> = (lastPage) => lastPage.previous;

// Legacy offset-based pagination (deprecated - use cursor-based above)
export const getPreviousPageParamLegacy: GetNextPageParamFunction<
  unknown,
  PaginateQuery<unknown>
> = (page) => getUrlParameters(page.previous)?.offset ?? null;

export const getNextPageParamLegacy: GetPreviousPageParamFunction<
  unknown,
  PaginateQuery<unknown>
> = (page) => getUrlParameters(page.next)?.offset ?? null;

// a function that accept a url and return params as an object
function getUrlParameters(url: string | null): { [k: string]: string } | null {
  if (url === null) {
    return null;
  }
  let regex = /[?&]([^=#]+)=([^&#]*)/g,
    params = {},
    match;
  while ((match = regex.exec(url))) {
    if (match[1] !== null) {
      //@ts-ignore
      params[match[1]] = match[2];
    }
  }
  return params;
}

// Re-export keepPreviousData for convenience
export { keepPreviousData };

// Example usage for infinite queries with TanStack Query v5:
// import { useInfiniteQuery } from '@tanstack/react-query';
// import { getNextPageParam, getPreviousPageParam, keepPreviousData } from '@/api/common/utils';
//
// const useInfinitePosts = (params?: { limit?: number }) => {
//   return useInfiniteQuery({
//     queryKey: ['posts', params],
//     queryFn: ({ pageParam }) => fetchPosts({ cursor: pageParam, ...params }),
//     getNextPageParam,
//     getPreviousPageParam,
//     placeholderData: keepPreviousData,
//     initialPageParam: null,
//     // Remove maxPages until getPreviousPageParam is fully implemented
//     // maxPages: 10,
//   });
// };
