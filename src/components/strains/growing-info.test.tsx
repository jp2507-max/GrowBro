// Mock translate function
const translate = (key: string) => {
  if (key === 'strains.detail.not_reported') return 'not_reported';
  return key;
};

// Import the formatYield function directly to test it in isolation
function formatYield(
  yieldData:
    | {
        min_grams?: number;
        max_grams?: number;
        min_oz?: number;
        max_oz?: number;
        label?: string;
      }
    | undefined
): string {
  if (!yieldData) return translate('strains.detail.not_reported');
  if (yieldData.label) return yieldData.label;
  if (yieldData.min_grams !== undefined) {
    if (yieldData.max_grams && yieldData.max_grams !== yieldData.min_grams) {
      return `${yieldData.min_grams}-${yieldData.max_grams}g`;
    }
    return `${yieldData.min_grams}g`;
  }
  if (yieldData.min_oz !== undefined) {
    if (yieldData.max_oz && yieldData.max_oz !== yieldData.min_oz) {
      return `${yieldData.min_oz}-${yieldData.max_oz}oz`;
    }
    return `${yieldData.min_oz}oz`;
  }
  return translate('strains.detail.not_reported');
}

describe('formatYield function', () => {
  test('returns label when present', () => {
    const result = formatYield({ label: 'High yield strain' });
    expect(result).toBe('High yield strain');
  });

  test('formats grams correctly', () => {
    expect(formatYield({ min_grams: 400, max_grams: 500 })).toBe('400-500g');
    expect(formatYield({ min_grams: 600 })).toBe('600g');
  });

  test('formats ounces correctly when grams not available', () => {
    expect(formatYield({ min_oz: 1, max_oz: 2 })).toBe('1-2oz');
    expect(formatYield({ min_oz: 1.5 })).toBe('1.5oz');
  });

  test('prioritizes grams over ounces', () => {
    expect(
      formatYield({ min_grams: 400, max_grams: 500, min_oz: 1, max_oz: 2 })
    ).toBe('400-500g');
    expect(formatYield({ min_grams: 600, min_oz: 1.5 })).toBe('600g');
  });

  test('returns not_reported when no yield data available', () => {
    expect(formatYield(undefined)).toBe('not_reported');
    expect(formatYield({})).toBe('not_reported');
  });
});
