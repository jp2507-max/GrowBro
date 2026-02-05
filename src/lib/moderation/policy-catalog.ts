/**
 * Policy catalog service for moderation decision-making
 * Provides access to prohibited content policies and violation categories
 * Requirements: 2.2, 3.2, 7.1-7.7
 */

import { client } from '@/api/common';
import type { PolicyCatalogEntry } from '@/types/moderation';

/**
 * Fetch policy catalog entry by category
 */
export async function getPolicyCatalogEntry(
  category: string
): Promise<PolicyCatalogEntry> {
  const response = await client.get<PolicyCatalogEntry>(
    `/moderation/policy-catalog/${encodeURIComponent(category)}`
  );

  return response.data;
}

/**
 * Search policy catalog by keywords
 */
export async function searchPolicyCatalog(
  query: string
): Promise<PolicyCatalogEntry[]> {
  const response = await client.get<PolicyCatalogEntry[]>(
    '/moderation/policy-catalog/search',
    {
      params: { q: query },
    }
  );

  return response.data;
}

/**
 * Get all policy catalog entries
 */
export async function getAllPolicies(): Promise<PolicyCatalogEntry[]> {
  const response = await client.get<PolicyCatalogEntry[]>(
    '/moderation/policy-catalog'
  );

  return response.data;
}

/**
 * Get policies by jurisdiction
 */
export async function getPoliciesByJurisdiction(
  jurisdiction: string
): Promise<PolicyCatalogEntry[]> {
  const allPolicies = await getAllPolicies();

  return allPolicies.filter((policy) => {
    if (!policy.jurisdictional_mapping) return true;
    return jurisdiction in policy.jurisdictional_mapping;
  });
}

/**
 * Get policy deep link URL
 */
export function getPolicyDeepLink(policyId: string): string {
  return `/moderator/policy-catalog/${policyId}`;
}

/**
 * Format policy reference for display
 */
export function formatPolicyReference(policy: PolicyCatalogEntry): string {
  const parts = [policy.category, policy.title];

  if (policy.legal_basis) {
    parts.push(`(${policy.legal_basis})`);
  } else if (policy.terms_reference) {
    parts.push(`(${policy.terms_reference})`);
  }

  return parts.join(' - ');
}

/**
 * Get policy guidance for specific category
 */
export async function getPolicyGuidance(category: string): Promise<{
  evidenceRequired: string[];
  commonPitfalls: string[];
  exampleViolations: string[];
}> {
  const policy = await getPolicyCatalogEntry(category);

  return {
    evidenceRequired: policy.evidence_guidelines || [],
    commonPitfalls: [], // TODO: Add to database schema
    exampleViolations: policy.example_violations || [],
  };
}
