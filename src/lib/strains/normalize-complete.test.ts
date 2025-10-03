/**
 * Unit tests for normalizeStrain - complete strain data
 */

import { normalizeStrain } from './normalization';

describe('normalizeStrain - complete data', () => {
  test('normalizes all fields correctly', () => {
    const apiStrain = {
      id: 'og-kush-001',
      name: 'OG Kush',
      slug: 'og-kush',
      synonyms: ['OG', 'Original Kush'],
      link: 'https://example.com/og-kush',
      imageUrl: 'https://example.com/og-kush.jpg',
      description: ['Classic indica-dominant hybrid'],
      genetics: {
        parents: ['Chemdawg', 'Hindu Kush'],
        lineage: 'Chemdawg x Hindu Kush',
      },
      race: 'hybrid',
      thc: '18-24%',
      cbd: '0.5-1%',
      effects: [{ name: 'Relaxed', intensity: 'high' }],
      flavors: ['Earthy', 'Pine'],
      terpenes: [{ name: 'Myrcene', percentage: 0.5 }],
      grow: {
        difficulty: 'intermediate',
        indoor_suitable: true,
        outdoor_suitable: true,
        flowering_time: { min_weeks: 8, max_weeks: 9 },
        yield: { indoor: { min_grams: 400, max_grams: 600 } },
        height: { indoor_cm: 90 },
      },
      source: {
        provider: 'The Weed DB',
        updated_at: '2025-01-15T12:00:00Z',
        attribution_url: 'https://www.theweedb.com',
      },
    };

    const result = normalizeStrain(apiStrain);

    expect(result.id).toBe('og-kush-001');
    expect(result.name).toBe('OG Kush');
    expect(result.race).toBe('hybrid');
    expect(result.thc).toEqual({ min: 18, max: 24 });
    expect(result.cbd).toEqual({ min: 0.5, max: 1 });
    expect(result.thc_display).toBe('18-24%');
    expect(result.cbd_display).toBe('0.5-1%');
    expect(result.effects).toEqual([{ name: 'Relaxed', intensity: 'high' }]);
  });

  test('normalizes effects as strings correctly', () => {
    const apiStrain = {
      id: 'test-strain',
      name: 'Test Strain',
      effects: ['Relaxed', 'Happy', 'Euphoric'],
    };

    const result = normalizeStrain(apiStrain);

    expect(result.effects).toEqual([
      { name: 'Relaxed' },
      { name: 'Happy' },
      { name: 'Euphoric' },
    ]);
  });
});
