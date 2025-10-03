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

  test("returns default when unit='grams' (default) and no gram values provided", () => {
    expect(formatYield({ min_oz: 1, max_oz: 2 })).toBe(DEFAULT_YIELD);
    expect(formatYield({ min_oz: 1.5 })).toBe(DEFAULT_YIELD);
  });

  test('uses gram values when unit defaults to grams (oz ignored)', () => {
    expect(
      formatYield({ min_grams: 400, max_grams: 500, min_oz: 1, max_oz: 2 })
    ).toBe('400-500g');
    expect(formatYield({ min_grams: 600, min_oz: 1.5 })).toBe('600g+');
  });

  test('returns default yield when no yield data available', () => {
    expect(formatYield(undefined)).toBe(DEFAULT_YIELD);
    expect(formatYield({})).toBe(DEFAULT_YIELD);
  });

  test('formats ounces correctly', () => {
    expect(formatYield({ min_oz: 1, max_oz: 2 }, 'oz')).toBe('1-2oz');
    expect(formatYield({ min_oz: 1.5 }, 'oz')).toBe('1.5oz+');
  });

  test('converts grams to ounces with unit=oz', () => {
    expect(formatYield({ min_grams: 400, max_grams: 500 }, 'oz')).toBe(
      '14.11-17.64oz'
    );
    expect(formatYield({ min_grams: 400 }, 'oz')).toBe('14.11oz+');
  });

  test('formats max-only yields', () => {
    expect(formatYield({ max_grams: 500 })).toBe('Up to 500g');
    expect(formatYield({ max_grams: 500 }, 'oz')).toBe('Up to 17.64oz');
  });

  test('formats equal min/max yields as single value', () => {
    expect(formatYield({ min_grams: 400, max_grams: 400 })).toBe('400g');
    expect(formatYield({ min_oz: 14.11, max_oz: 14.11 }, 'oz')).toBe('14.11oz');
  });
});
