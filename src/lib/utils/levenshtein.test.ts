import {
  calculateSimilarity,
  findClosestMatch,
  levenshteinDistance,
} from './levenshtein';

describe('levenshteinDistance', () => {
  test('calculates distance between identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
    expect(levenshteinDistance('', '')).toBe(0);
  });

  test('calculates distance with empty strings', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
    expect(levenshteinDistance('hello', '')).toBe(5);
  });

  test('calculates distance for single character changes', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1);
    expect(levenshteinDistance('cat', 'cats')).toBe(1);
    expect(levenshteinDistance('cat', 'at')).toBe(1);
  });

  test('calculates distance for multiple changes', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
  });

  test('is case-sensitive', () => {
    expect(levenshteinDistance('Hello', 'hello')).toBe(1);
  });
});

describe('findClosestMatch', () => {
  const candidates = [
    'OG Kush',
    'Sour Diesel',
    'Blue Dream',
    'White Widow',
    'Northern Lights',
  ];

  test('returns null for exact matches', () => {
    expect(findClosestMatch('OG Kush', candidates)).toBeNull();
  });

  test('finds close match for typos', () => {
    expect(findClosestMatch('OG Ksh', candidates)).toBe('OG Kush');
    expect(findClosestMatch('Sour Disel', candidates)).toBe('Sour Diesel');
    expect(findClosestMatch('Blue Drem', candidates)).toBe('Blue Dream');
  });

  test('returns null when no match within threshold', () => {
    expect(findClosestMatch('completely different', candidates)).toBeNull();
  });

  test('respects custom threshold', () => {
    expect(findClosestMatch('OG', candidates, 1)).toBeNull();
    expect(findClosestMatch('OG Ksh', candidates, 2)).toBe('OG Kush');
  });

  test('handles empty candidates array', () => {
    expect(findClosestMatch('test', [])).toBeNull();
  });

  test('handles empty query', () => {
    expect(findClosestMatch('', candidates)).toBeNull();
  });
});

describe('calculateSimilarity', () => {
  test('returns 100 for identical strings', () => {
    expect(calculateSimilarity('hello', 'hello')).toBe(100);
  });

  test('returns 0 for completely different strings', () => {
    const result = calculateSimilarity('abc', 'xyz');
    expect(result).toBeLessThan(50);
  });

  test('calculates percentage correctly', () => {
    const result = calculateSimilarity('cat', 'bat');
    expect(result).toBeGreaterThan(50);
    expect(result).toBeLessThan(100);
  });

  test('handles empty strings', () => {
    expect(calculateSimilarity('', '')).toBe(100);
  });

  test('is case-insensitive', () => {
    expect(calculateSimilarity('Hello', 'hello')).toBe(100);
  });
});
