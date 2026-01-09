/**
 * Community post category constants
 *
 * Single source of truth for category identifiers used in
 * feed filtering and post creation.
 */

export const COMMUNITY_HELP_CATEGORY = 'problem_deficiency' as const;

export const POST_CATEGORIES = [
  COMMUNITY_HELP_CATEGORY,
  'grow_tips',
  'harvest',
  'equipment',
  'general',
] as const;

export type CommunityPostCategory = (typeof POST_CATEGORIES)[number];
