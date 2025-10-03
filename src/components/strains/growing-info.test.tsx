import { DEFAULT_YIELD } from '@/lib/strains/constants';
import { formatYield } from '@/lib/strains/normalization';

describe('formatYield function', () => {
  test('returns label when present', () => {
    const result = formatYield({ label: 'High yield strain' });
    expect(result).toBe('High yield strain');
  });

  test('formats grams correctly', () => {
    expect(formatYield({ min_grams: 400, max_grams: 500 })).toBe('400-500g');
    expect(formatYield({ min_grams: 600 })).toBe('600g+');
  });

  test('returns default when only ounces are available (grams prioritized)', () => {
    expect(formatYield({ min_oz: 1, max_oz: 2 })).toBe(DEFAULT_YIELD);
    expect(formatYield({ min_oz: 1.5 })).toBe(DEFAULT_YIELD);
  });

  test('prioritizes grams over ounces', () => {
    expect(
      formatYield({ min_grams: 400, max_grams: 500, min_oz: 1, max_oz: 2 })
    ).toBe('400-500g');
    expect(formatYield({ min_grams: 600, min_oz: 1.5 })).toBe('600g+');
  });

  test('returns default yield when no yield data available', () => {
    expect(formatYield(undefined)).toBe(DEFAULT_YIELD);
    expect(formatYield({})).toBe(DEFAULT_YIELD);
  });
});
