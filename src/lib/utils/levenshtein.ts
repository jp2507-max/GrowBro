/**
 * Calculate Levenshtein distance between two strings
 * Used for "Did you mean?" suggestions in search
 *
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance between the strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  // Create distance matrix
  const matrix: number[][] = Array.from({ length: aLen + 1 }, () =>
    Array(bLen + 1).fill(0)
  );

  // Initialize first column and row
  for (let i = 0; i <= aLen; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= bLen; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix with edit distances
  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[aLen][bLen];
}

/**
 * Find the closest match from a list of strings based on Levenshtein distance
 *
 * @param query - Search query string
 * @param candidates - Array of candidate strings to match against
 * @param threshold - Maximum distance to consider a match (default: 3)
 * @returns Closest matching string or null if no match within threshold
 */
export function findClosestMatch(
  query: string,
  candidates: string[],
  threshold: number = 3
): string | null {
  if (!query || candidates.length === 0) return null;

  const lowerQuery = query.toLowerCase();
  let closestMatch: string | null = null;
  let minDistance = Infinity;

  for (const candidate of candidates) {
    const lowerCandidate = candidate.toLowerCase();

    // Exact match - return immediately
    if (lowerCandidate === lowerQuery) {
      return null; // No suggestion needed for exact match
    }

    const distance = levenshteinDistance(lowerQuery, lowerCandidate);

    if (distance < minDistance && distance <= threshold) {
      minDistance = distance;
      closestMatch = candidate;
    }
  }

  return closestMatch;
}

/**
 * Calculate similarity percentage between two strings
 * Used for ranking search suggestions
 *
 * @param a - First string
 * @param b - Second string
 * @returns Similarity percentage (0-100)
 */
export function calculateSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return ((maxLen - distance) / maxLen) * 100;
}
