/**
 * Profanity filter utility
 * Requirements: 9.10, 9.11
 *
 * Provides client-side profanity detection with generic feedback
 * that doesn't reveal specific blocked terms.
 */

export interface ProfanityCheckResult {
  isProfane: boolean;
  feedback?: string;
}

/**
 * Basic profanity patterns (case-insensitive)
 * This is a minimal list for demonstration. In production,
 * consider using a dedicated library like 'bad-words' or
 * server-side filtering for comprehensive coverage.
 *
 * Note: The client-side profanity filter is easily bypassable and provides minimal protection.
 * This should be complemented with server-side validation in the Supabase RLS policies or edge functions.
 * The current implementation serves more as a UX helper than actual content moderation.
 */
const PROFANITY_PATTERNS = [
  /\b(fuck|shit|bitch|ass|cunt|dick|piss|bastard)\b/i,
  /\b(damn|hell|crap)\b/i,
  // Add more patterns as needed
];

/**
 * Checks if the given text contains profanity
 * @param text - The text to check
 * @returns Result with isProfane flag and generic feedback message
 */
export function checkProfanity(text: string): ProfanityCheckResult {
  if (!text || text.trim().length === 0) {
    return { isProfane: false };
  }

  const trimmedText = text.trim();

  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(trimmedText)) {
      return {
        isProfane: true,
        feedback:
          'Your input contains inappropriate language. Please revise and try again.',
      };
    }
  }

  return { isProfane: false };
}

/**
 * Validates display name for profanity
 * @param displayName - The display name to validate
 * @returns Result with isProfane flag and feedback
 */
export function validateDisplayName(displayName: string): ProfanityCheckResult {
  return checkProfanity(displayName);
}

/**
 * Validates bio text for profanity
 * @param bio - The bio text to validate
 * @returns Result with isProfane flag and feedback
 */
export function validateBio(bio: string): ProfanityCheckResult {
  return checkProfanity(bio);
}
