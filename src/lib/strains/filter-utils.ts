import type { StrainFilters } from '@/api/strains/types';

/**
 * Checks if any filters are currently active
 * @param filters - The strain filters object to check
 * @returns true if any filter has a non-empty value
 */
export function hasActiveFilters(filters: StrainFilters): boolean {
  return Object.values(filters).some(
    (v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  );
}
