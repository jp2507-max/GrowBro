import {
  normalizeStrain,
  type RawApiStrain,
} from '@/lib/strains/normalization';
import { supabase } from '@/lib/supabase';

import type {
  GetStrainsParams,
  Strain,
  StrainFilters,
  StrainsResponse,
} from './types';

export type SupabaseStrainRow = {
  id: string;
  slug: string | null;
  name: string | null;
  race: string | null;
  data?: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseQuery = any;

function coerceRowToRawStrain(row: SupabaseStrainRow): RawApiStrain {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    ...data,
    id: (data as RawApiStrain).id ?? row.id,
    slug: (data as RawApiStrain).slug ?? row.slug ?? undefined,
    name: (data as RawApiStrain).name ?? row.name ?? undefined,
    race: (data as RawApiStrain).race ?? row.race ?? undefined,
  };
}

export function mapSupabaseRowToStrain(row: SupabaseStrainRow): Strain {
  return normalizeStrain(coerceRowToRawStrain(row));
}

function applyFilters(query: SupabaseQuery, filters?: StrainFilters) {
  if (!filters) return query;

  let next = query;

  if (filters.race) {
    next = next.eq('race', filters.race);
  }

  if (filters.thcMin !== undefined) {
    next = next.gte('data->thc->>min', String(filters.thcMin));
  }
  if (filters.thcMax !== undefined) {
    next = next.lte('data->thc->>max', String(filters.thcMax));
  }
  if (filters.cbdMin !== undefined) {
    next = next.gte('data->cbd->>min', String(filters.cbdMin));
  }
  if (filters.cbdMax !== undefined) {
    next = next.lte('data->cbd->>max', String(filters.cbdMax));
  }

  return next;
}

function applySort(
  query: SupabaseQuery,
  sortBy?: GetStrainsParams['sortBy'],
  sortDirection: GetStrainsParams['sortDirection'] = 'asc'
) {
  const ascending = sortDirection !== 'desc';

  if (sortBy === 'thc') {
    return query.order('data->thc->>max', { ascending, nullsLast: true });
  }

  if (sortBy === 'cbd') {
    return query.order('data->cbd->>max', { ascending, nullsLast: true });
  }

  return query.order('name', { ascending, nullsLast: true });
}

function buildStrainsQuery({
  table,
  params,
  offset,
  pageSize,
}: {
  table: 'strains_public' | 'strain_cache';
  params: GetStrainsParams;
  offset: number;
  pageSize: number;
}): SupabaseQuery {
  const searchQuery = params.searchQuery?.trim();
  let query = supabase.from(table).select('id, slug, name, race, data');

  if (searchQuery && searchQuery.length > 0) {
    // Escape special characters for PostgREST .or() and LIKE pattern
    const escaped = searchQuery.replace(/[%_\,()]/g, '\\$&');
    const pattern = `%${escaped}%`;
    query = query.or(`name.ilike.${pattern},slug.ilike.${pattern}`);
  }

  query = applyFilters(query, params.filters);
  query = applySort(query, params.sortBy, params.sortDirection);
  return query.range(offset, offset + pageSize - 1);
}

export async function withStrainTableFallback<T>(
  queryFn: (
    table: 'strains_public' | 'strain_cache'
  ) => Promise<{ data: T; error: Error | null }>
): Promise<{ data: T; error: Error | null }> {
  let result = await queryFn('strains_public');
  if (
    result.error &&
    ((typeof result.error.message === 'string' &&
      result.error.message.toLowerCase().includes('strains_public')) ||
      (result.error as { code?: string }).code === 'PGRST116')
  ) {
    result = await queryFn('strain_cache');
  }
  return result;
}

export async function fetchStrainsFromSupabase(
  params: GetStrainsParams = {}
): Promise<StrainsResponse> {
  const page = params.page ?? 0;
  const pageSize = params.pageSize ?? 20;
  const offset = page * pageSize;

  const result = await withStrainTableFallback(async (table) => {
    const query = buildStrainsQuery({ table, params, offset, pageSize });
    return await query;
  });

  const { data, error } = result;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SupabaseStrainRow[];
  const strains = rows.map(mapSupabaseRowToStrain);

  // Avoid expensive COUNT queries on every page.
  // If the page is full, assume there might be more; if it's short, we're done.
  const hasMore = strains.length === pageSize;

  return {
    data: strains,
    hasMore,
    nextCursor: undefined,
  };
}
