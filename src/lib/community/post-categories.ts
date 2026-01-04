/**
 * Community post category constants
 *
 * Single source of truth for category identifiers used in
 * feed filtering and post creation.
 */

export const COMMUNITY_HELP_CATEGORY = 'problem_deficiency' as const;

export type CommunityPostCategory = typeof COMMUNITY_HELP_CATEGORY;
