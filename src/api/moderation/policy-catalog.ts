/**
 * React Query hooks for policy catalog integration
 * Requirements: 2.2, 7.1-7.7
 */

import { createQuery } from 'react-query-kit';

import {
  getAllPolicies,
  getPoliciesByJurisdiction,
  getPolicyCatalogEntry,
  getPolicyGuidance,
  searchPolicyCatalog,
} from '@/lib/moderation/policy-catalog';

/**
 * Fetch single policy catalog entry
 */
export const usePolicyCatalogEntry = createQuery({
  queryKey: ['moderation', 'policy-catalog'],
  fetcher: (variables: { category: string }) =>
    getPolicyCatalogEntry(variables.category),
});

/**
 * Fetch all policy catalog entries
 */
export const useAllPolicies = createQuery({
  queryKey: ['moderation', 'policy-catalog', 'all'],
  fetcher: () => getAllPolicies(),
  staleTime: 5 * 60 * 1000, // 5 minutes - policies don't change often
});

/**
 * Search policy catalog
 */
export const useSearchPolicies = createQuery({
  queryKey: ['moderation', 'policy-catalog', 'search'],
  fetcher: (variables: { query: string }) =>
    searchPolicyCatalog(variables.query),
});

/**
 * Get policies by jurisdiction
 */
export const usePoliciesByJurisdiction = createQuery({
  queryKey: ['moderation', 'policy-catalog', 'jurisdiction'],
  fetcher: (variables: { jurisdiction: string }) =>
    getPoliciesByJurisdiction(variables.jurisdiction),
});

/**
 * Get policy guidance
 */
export const usePolicyGuidance = createQuery({
  queryKey: ['moderation', 'policy-guidance'],
  fetcher: (variables: { category: string }) =>
    getPolicyGuidance(variables.category),
});

/**
 * Hook to get formatted policy options for dropdown/select
 */
export function usePolicyOptions() {
  const { data: policies, isLoading } = useAllPolicies({
    variables: undefined,
  });

  if (isLoading || !policies) {
    return { options: [], isLoading };
  }

  const options = policies.map((policy) => ({
    label: `${policy.category} - ${policy.title}`,
    value: policy.id,
    category: policy.category,
  }));

  return { options, isLoading };
}
