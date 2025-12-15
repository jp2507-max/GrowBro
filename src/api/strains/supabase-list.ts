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

export async function fetchStrainsFromSupabase(
  params: GetStrainsParams = {}
): Promise<StrainsResponse> {
  const page = params.page ?? 0;
  const pageSize = params.pageSize ?? 20;
  const offset = page * pageSize;

  const searchQuery = params.searchQuery?.trim();

  let query = supabase
    .from('strain_cache')
    .select('id, slug, name, race, data', { count: 'exact' });

  if (searchQuery && searchQuery.length > 0) {
    const pattern = `%${searchQuery}%`;
    query = query.or(`name.ilike.${pattern},slug.ilike.${pattern}`);
  }

  query = applyFilters(query, params.filters);
  query = applySort(query, params.sortBy, params.sortDirection);
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const strains = (data ?? []).map(mapSupabaseRowToStrain);
  const totalCount = count ?? strains.length;
  const hasMore = offset + strains.length < totalCount;

  return {
    data: strains,
    hasMore,
    nextCursor: undefined,
  };
}
